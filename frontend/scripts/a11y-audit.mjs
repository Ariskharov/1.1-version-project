/**
 * Аудит доступности: axe-core + симуляция Tab-порядка для скринридеров.
 * Запуск: node scripts/a11y-audit.mjs [baseUrl]
 */
import puppeteer from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');
const PORT = 3456;
const BASE = process.argv[2] || `http://127.0.0.1:${PORT}`;

const MIME = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2',
};

function startStaticServer() {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            let filePath = join(BUILD_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
            if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
                filePath = join(BUILD_DIR, 'index.html');
            }
            const ext = extname(filePath);
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(readFileSync(filePath));
        });
        server.listen(PORT, '127.0.0.1', () => resolve(server));
    });
}

async function waitForApp(page) {
    await page.waitForFunction(
        () => !document.querySelector('.loading-page, [class*="loading"]')?.offsetParent
            || document.querySelector('main, [role="main"], .catalog, .auth, h1'),
        { timeout: 15000 },
    ).catch(() => {});
    await page.waitForSelector('h1, main, .catalog, .auth', { timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1500));
}

async function getTabOrder(page) {
    return page.evaluate(() => {
        const order = [];
        const seen = new Set();
        const root = document.body;
        const isTabbable = (el) => (
            el.getAttribute('aria-hidden') !== 'true'
            && !el.closest('[inert]')
            && el.getAttribute('tabindex') !== '-1'
        );

        const allFocusable = () => Array.from(root.querySelectorAll(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]',
        )).filter(isTabbable);

        let current = allFocusable()[0];
        if (!current) return order;

        for (let i = 0; i < 80; i++) {
            current.focus();
            if (seen.has(current)) break;
            seen.add(current);

            const hidden = current.closest('[aria-hidden="true"]');
            const inert = current.closest('[inert]');
            const rect = current.getBoundingClientRect();
            const offScreen = rect.right < 0 || rect.left > window.innerWidth
                || rect.bottom < 0 || rect.top > window.innerHeight;

            const getName = (el) => {
                const labelledBy = el.getAttribute('aria-labelledby');
                if (labelledBy) {
                    const parts = labelledBy.split(/\s+/).map((id) => {
                        const node = document.getElementById(id);
                        return node?.textContent?.trim() || '';
                    }).filter(Boolean);
                    if (parts.length) return parts.join(', ');
                }
                const described = el.getAttribute('aria-label');
                if (described) return described;
                const tag = el.tagName.toLowerCase();
                if (tag === 'input' || tag === 'select' || tag === 'textarea') {
                    const id = el.id;
                    if (id) {
                        const label = document.querySelector(`label[for="${id}"]`);
                        if (label) return label.textContent?.trim() || tag;
                    }
                }
                return el.textContent?.trim().slice(0, 80) || tag;
            };
            const name = getName(current);

            order.push({
                tag: current.tagName.toLowerCase(),
                role: current.getAttribute('role') || '',
                name: name.replace(/\s+/g, ' '),
                hidden: Boolean(hidden || inert),
                offScreen,
                ariaHiddenAncestor: Boolean(hidden),
                inertAncestor: Boolean(inert),
            });

            const focusables = allFocusable();

            const idx = focusables.indexOf(current);
            if (idx === -1 || idx === focusables.length - 1) {
                current = focusables[0];
            } else {
                current = focusables[idx + 1];
            }
        }
        return order;
    });
}

async function getLandmarks(page) {
    return page.evaluate(() => ({
        main: document.querySelectorAll('main, [role="main"]').length,
        nav: document.querySelectorAll('nav, [role="navigation"]').length,
        h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent?.trim()),
        skipLink: Boolean(document.querySelector('.skip-link, a[href="#main-content"]')),
        dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map((d) => ({
            label: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') || '',
            modal: d.getAttribute('aria-modal'),
            hidden: d.getAttribute('aria-hidden'),
        })),
    }));
}

async function auditRoute(browser, route, viewport) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    const url = `${BASE}${route}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitForApp(page);

    const axeResults = await new AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa', 'best-practice'])
        .analyze();

    const tabOrder = await getTabOrder(page);
    const landmarks = await getLandmarks(page);

    const violations = axeResults.violations || [];
    const incomplete = axeResults.incomplete || [];

    const tabIssues = tabOrder.filter((el) => el.ariaHiddenAncestor || el.inertAncestor);
    const unnamedButtons = tabOrder.filter(
        (el) => el.tag === 'button' && !el.name && !el.role,
    );

    await page.close();

    return {
        route,
        viewport: `${viewport.width}x${viewport.height}`,
        landmarks,
        tabOrder: tabOrder.slice(0, 25),
        tabIssues,
        unnamedButtons,
        violations: violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
            help: v.help,
        })),
        incomplete: incomplete.length,
    };
}

async function main() {
    let server;
    if (BASE.includes(`:${PORT}`)) {
        if (!existsSync(BUILD_DIR)) {
            console.error('Нет папки build/. Сначала: npm run build');
            process.exit(1);
        }
        server = await startStaticServer();
        console.log(`Сервер: ${BASE}\n`);
    }

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

    const routes = ['/', '/signin', '/catalog'];
    const results = [];

    // Тест модалки каталога
    console.log('Проверка модалки каталога (desktop)...');
    try {
        const modalPage = await browser.newPage();
        await modalPage.setViewport({ width: 1280, height: 800 });
        await modalPage.goto(`${BASE}/catalog`, { waitUntil: 'networkidle2', timeout: 30000 });
        await waitForApp(modalPage);
        const firstCard = await modalPage.$('button.catalog-card');
        if (firstCard) {
            await firstCard.click();
            await modalPage.waitForSelector('[role="dialog"].catalog-modal, .catalog-modal[role="dialog"]', { timeout: 5000 });
            await new Promise((r) => setTimeout(r, 800));
            const modalAudit = await new AxePuppeteer(modalPage).withTags(['wcag2a', 'wcag2aa']).analyze();
            const dialog = await modalPage.evaluate(() => {
                const d = document.querySelector('.catalog-modal[role="dialog"]');
                const mainHidden = document.getElementById('main-content')?.getAttribute('aria-hidden');
                const headerHidden = document.querySelector('.header')?.getAttribute('aria-hidden');
                const focused = document.activeElement?.getAttribute('aria-label')
                    || document.activeElement?.className;
                return {
                    hasDialog: Boolean(d),
                    ariaModal: d?.getAttribute('aria-modal'),
                    labelledBy: d?.getAttribute('aria-labelledby'),
                    title: document.getElementById(d?.getAttribute('aria-labelledby') || '')?.textContent?.trim(),
                    mainHidden,
                    headerHidden,
                    focused,
                };
            });
            results.push({
                route: '/catalog (modal open)',
                viewport: '1280x800',
                modalDialog: dialog,
                violations: (modalAudit.violations || []).map((v) => ({
                    id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length,
                })),
                tabIssues: [],
                tabOrder: [],
                landmarks: {},
            });
            console.log(`  Dialog: ${JSON.stringify(dialog)}`);
            console.log(`  Axe violations: ${(modalAudit.violations || []).length}`);
        } else {
            console.log('  Карточки не найдены — пропуск');
        }
        await modalPage.close();
    } catch (err) {
        console.log(`  Ошибка теста модалки: ${err.message}`);
    }
    console.log('');
    const viewports = [
        { width: 1280, height: 800, label: 'desktop' },
        { width: 390, height: 844, label: 'mobile' },
    ];

    for (const route of routes) {
        for (const vp of viewports) {
            console.log(`Проверка ${route} (${vp.label})...`);
            try {
                results.push(await auditRoute(browser, route, vp));
            } catch (err) {
                results.push({ route, viewport: vp.label, error: err.message });
            }
        }
    }

    await browser.close();
    if (server) server.close();

    console.log('\n========== ОТЧЁТ ДОСТУПНОСТИ ==========\n');

    let totalViolations = 0;
    let totalTabIssues = 0;

    for (const r of results) {
        if (r.error) {
            console.log(`❌ ${r.route} (${r.viewport}): ${r.error}\n`);
            continue;
        }

        console.log(`--- ${r.route} [${r.viewport}] ---`);

        if (r.modalDialog) {
            console.log(`Модалка: ${JSON.stringify(r.modalDialog)}`);
            if (r.violations?.length) {
                totalViolations += r.violations.length;
                r.violations.forEach((v) => console.log(`  [${v.impact}] ${v.id}: ${v.help}`));
            } else {
                console.log('Axe: нарушений не найдено');
            }
            console.log('');
            continue;
        }

        console.log(`Landmarks: main=${r.landmarks.main}, nav=${r.landmarks.nav}, h1=${JSON.stringify(r.landmarks.h1)}`);
        console.log(`Skip-link: ${r.landmarks.skipLink ? 'да' : 'НЕТ'}`);

        if (r.landmarks.dialogs?.length) {
            console.log(`Dialogs: ${JSON.stringify(r.landmarks.dialogs)}`);
        }

        console.log('Tab-порядок (первые элементы):');
        (r.tabOrder || []).forEach((el, i) => {
            const flags = [
                el.hidden ? 'HIDDEN' : '',
                el.offScreen ? 'OFF-SCREEN' : '',
                el.ariaHiddenAncestor ? 'aria-hidden' : '',
            ].filter(Boolean).join(', ');
            console.log(`  ${i + 1}. [${el.tag}${el.role ? `/${el.role}` : ''}] ${el.name}${flags ? ` (${flags})` : ''}`);
        });

        if (r.tabIssues?.length) {
            totalTabIssues += r.tabIssues.length;
            console.log(`⚠️  Tab-проблемы: ${r.tabIssues.length} элемент(ов) вне экрана или в aria-hidden`);
            r.tabIssues.forEach((el) => console.log(`     - ${el.name} (${el.tag})`));
        }

        if (r.unnamedButtons?.length) {
            console.log(`⚠️  Кнопки без имени: ${r.unnamedButtons.length}`);
        }

        if (r.violations?.length) {
            totalViolations += r.violations.length;
            console.log(`Axe violations (${r.violations.length}):`);
            r.violations.forEach((v) => {
                console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes} узлов)`);
            });
        } else {
            console.log('Axe: нарушений не найдено');
        }

        if (r.incomplete) {
            console.log(`Axe incomplete checks: ${r.incomplete}`);
        }
        console.log('');
    }

    console.log('========================================');
    console.log(`Итого: ${totalViolations} axe-нарушений, ${totalTabIssues} tab-проблем`);

    const reportPath = join(__dirname, '..', 'agent-tools', 'a11y-report.json');
    try {
        const { mkdirSync, writeFileSync } = await import('fs');
        mkdirSync(join(__dirname, '..', 'agent-tools'), { recursive: true });
        writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`Полный отчёт: ${reportPath}`);
    } catch { /* ignore */ }

    process.exit(totalViolations > 0 || totalTabIssues > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});