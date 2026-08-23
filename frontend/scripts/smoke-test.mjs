/**
 * Smoke-тест production-сборки: страницы открываются, чанки грузятся, нет JS-ошибок.
 */
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, '..', 'build');
const PORT = 3460;
const BASE = `http://127.0.0.1:${PORT}`;

const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.map': 'application/json',
};

function startServer() {
    return new Promise((resolve) => {
        const server = createServer((req, res) => {
            let filePath = join(BUILD_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
            if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
                filePath = join(BUILD_DIR, 'index.html');
            }
            res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
            res.end(readFileSync(filePath));
        });
        server.listen(PORT, '127.0.0.1', () => resolve(server));
    });
}

async function testRoute(page, route, checks) {
    const errors = [];
    const onError = (err) => errors.push(err.toString());
    const onPageError = (err) => errors.push(err.message);
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('requestfailed', (req) => {
        const url = req.url();
        if (url.includes('/static/') || url.includes('.js') || url.includes('.css')) {
            errors.push(`failed: ${url}`);
        }
    });
    page.on('pageerror', onPageError);
    page.on('error', onError);

    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForSelector('#root', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 2000));

    for (const check of checks) {
        const ok = await check(page);
        if (!ok.pass) errors.push(ok.msg);
    }

    page.off('pageerror', onPageError);
    page.off('error', onError);

    return { route, ok: errors.length === 0, errors };
}

async function main() {
    if (!existsSync(BUILD_DIR)) {
        console.error('Нет build/. Запустите: npm run build');
        process.exit(1);
    }

    const server = await startServer();
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const routes = [
        {
            path: '/',
            checks: [
                async (p) => ({
                    pass: await p.$('h1, .catalog-hero__title, #catalog-hero-title'),
                    msg: 'Каталог: нет заголовка',
                }),
                async (p) => ({
                    pass: (await p.$$('button.catalog-card')).length > 0,
                    msg: 'Каталог: нет карточек',
                }),
            ],
        },
        {
            path: '/signin',
            checks: [
                async (p) => ({
                    pass: await p.$('#auth-login'),
                    msg: 'Вход: нет поля логина',
                }),
                async (p) => ({
                    pass: await p.$('button.auth__submit'),
                    msg: 'Вход: нет кнопки',
                }),
            ],
        },
        {
            path: '/catalog',
            checks: [
                async (p) => ({
                    pass: await p.$('#catalog-search-input'),
                    msg: 'Каталог: нет поиска',
                }),
            ],
        },
    ];

    console.log('Smoke-тест production-сборки\n');
    let failed = 0;

    for (const { path, checks } of routes) {
        const result = await testRoute(page, path, checks);
        if (result.ok) {
            console.log(`✓ ${path}`);
        } else {
            failed++;
            console.log(`✗ ${path}`);
            result.errors.forEach((e) => console.log(`    ${e}`));
        }
    }

    // Lazy chunk: переход на signin из каталога
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle2' });
    await page.click('a[href="/signin"], a.header__top__right__logout-btn');
    await page.waitForSelector('#auth-login', { timeout: 15000 });
    console.log(page.url().includes('signin') ? '✓ lazy-route /signin' : '✗ lazy-route /signin');

    await browser.close();
    server.close();

    console.log(failed === 0 ? '\nВсе проверки пройдены.' : `\nПровалено маршрутов: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});