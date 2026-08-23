/**
 * Mobile modal layout audit (390x844)
 */
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = join(__dirname, '..', 'build');
const PORT = 3488;
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function startServer() {
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      let p = join(BUILD, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
      if (!existsSync(p) || statSync(p).isDirectory()) p = join(BUILD, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream' });
      res.end(readFileSync(p));
    });
    s.listen(PORT, '127.0.0.1', () => resolve(s));
  });
}

function measureModal(rootSel, contentSel) {
  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const root = document.querySelector(rootSel);
  const content = document.querySelector(contentSel);
  const critical = [];
  if (!root || !content) return { found: false, critical: ['not found'] };

  const r = content.getBoundingClientRect();
  const ost = getComputedStyle(root);
  const st = getComputedStyle(content);
  if (r.width > cw + 4) critical.push('wider than viewport');
  if (r.left < -4 || r.right > cw + 4) critical.push('out of x bounds');
  if (r.top < -4) critical.push('top out');

  let inputFs = null;
  const inp = content.querySelector('input, select, textarea');
  if (inp) {
    inputFs = parseFloat(getComputedStyle(inp).fontSize);
    if (inputFs < 16) critical.push(`input font ${inputFs} < 16`);
  }

  let closeSize = null;
  const close = content.querySelector(
    '[class*="close"], .modal__close, .catalog-modal__close, .ord-modal__close, .oed-modal__close, .pao-modal__close'
  );
  if (close) {
    const cr = close.getBoundingClientRect();
    closeSize = { w: Math.round(cr.width), h: Math.round(cr.height) };
    if (cr.width < 40 || cr.height < 40) critical.push('close button < 40px');
  }

  return {
    found: true,
    align: ost.alignItems,
    w: Math.round(r.width),
    h: Math.round(r.height),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    radius: st.borderRadius,
    maxH: st.maxHeight,
    inputFs,
    closeSize,
    critical,
  };
}

const server = await startServer();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

// --- Catalog modal ---
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(() => {
  const el =
    document.querySelector('.catalog-card') ||
    document.querySelector('.catalog-grid button') ||
    document.querySelector('main button');
  el?.click();
});
await new Promise((r) => setTimeout(r, 1200));
const catalog = await page.evaluate(measureModal, '.catalog-modal-overlay', '.catalog-modal');
console.log('CATALOG', JSON.stringify(catalog, null, 2));

// --- Admin modal ---
await page.evaluate(() => {
  localStorage.setItem(
    'currentUser',
    JSON.stringify({ id: 1, fullName: 'Admin', role: 'admin', email: 'a@a.a' })
  );
});
await page.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const add = btns.find((b) => /добав|сотрудник|новый/i.test(b.textContent || ''));
  add?.click();
});
await new Promise((r) => setTimeout(r, 900));
const admin = await page.evaluate(measureModal, '.modal', '.modal__content');
console.log('ADMIN', JSON.stringify(admin, null, 2));

// --- AppUi confirm (inject) ---
await page.evaluate(() => {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="app-ui-overlay">
      <div class="app-ui-confirm">
        <p>Тест подтверждения на мобильном</p>
        <div class="app-ui-confirm__actions">
          <button type="button" class="app-ui-confirm__btn">Отмена</button>
          <button type="button" class="app-ui-confirm__btn app-ui-confirm__btn--primary">Ок</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
});
const confirm = await page.evaluate(measureModal, '.app-ui-overlay', '.app-ui-confirm');
console.log('CONFIRM', JSON.stringify(confirm, null, 2));

await browser.close();
server.close();

const all = [catalog, admin, confirm];
const fails = all.flatMap((x) => x.critical || []);
console.log(fails.length ? `FAIL: ${fails.join('; ')}` : 'MODAL MOBILE OK');
process.exitCode = fails.length ? 1 : 0;
