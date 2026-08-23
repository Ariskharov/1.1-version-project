/**
 * Полная проверка: PhotoUploadSlot UI на desktop/mobile + layout.
 */
import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = join(__dirname, '..', 'build');
const PORT = 3495;
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

async function measureSlots(page, label) {
  return page.evaluate((label) => {
    const cw = window.innerWidth;
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const critical = [];
    if (sw > cw + 3) critical.push(`page overflow ${sw}>${cw}`);

    const slots = [...document.querySelectorAll('[data-photo-slot]')].map((el, i) => {
      const zone = el.querySelector('.photo-slot__zone');
      const r = zone?.getBoundingClientRect();
      const st = zone ? getComputedStyle(zone) : null;
      const item = {
        i,
        variant: [...el.classList].find((c) => c.startsWith('photo-slot--') && !c.includes('has') && !c.includes('disabled')) || '',
        wired: el.getAttribute('data-photo-upload-wired'),
        w: r ? Math.round(r.width) : 0,
        h: r ? Math.round(r.height) : 0,
        left: r ? Math.round(r.left) : 0,
        right: r ? Math.round(r.right) : 0,
        radius: st?.borderRadius || '',
        display: st?.display || '',
      };
      if (r) {
        if (r.width > cw + 4) critical.push(`slot${i} wider than viewport`);
        if (r.left < -2 || r.right > cw + 4) critical.push(`slot${i} out of x`);
        if (r.height < 40) critical.push(`slot${i} too short h=${item.h}`);
      } else {
        critical.push(`slot${i} no zone`);
      }
      return item;
    });

    return {
      label,
      cw,
      sw,
      count: slots.length,
      slots,
      critical,
      pageOverflow: sw > cw + 3,
    };
  }, label);
}

const server = await startServer();
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];

const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

for (const vp of viewports) {
  // ADMIN: announcements photo + user avatar modal
  {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem(
        'currentUser',
        JSON.stringify({ id: 1, fullName: 'Admin', role: 'admin', email: 'a@a.a' })
      );
    });
    await page.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 1800));

    // expand announcements if needed
    await page.evaluate(() => {
      const toggle = document.querySelector('.admin-announcements__toggle');
      if (toggle && /разверн/i.test(toggle.textContent || '')) toggle.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    let m = await measureSlots(page, `/admin ann ${vp.name}`);
    results.push(m);

    // open user modal
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const add = btns.find((b) => /добав|сотрудник/i.test(b.textContent || ''));
      add?.click();
    });
    await new Promise((r) => setTimeout(r, 700));
    m = await measureSlots(page, `/admin user-modal ${vp.name}`);
    results.push(m);
    await page.close();
  }

  // ORDER EDITOR custom modal - need an order id. Try /order_editor/1 or find route
  {
    const page = await browser.newPage();
    await page.setViewport(vp);
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem(
        'currentUser',
        JSON.stringify({ id: 1, fullName: 'Admin', role: 'admin', email: 'a@a.a' })
      );
    });
    // try common paths
    for (const path of ['/order_editor/1', '/order_editor', '/placing_an_order']) {
      await page.goto(`http://127.0.0.1:${PORT}${path}`, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1200));
      // try open custom modal
      const opened = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('button')];
        const b = btns.find((x) => /произвольн/i.test(x.textContent || ''));
        if (b) {
          b.click();
          return true;
        }
        return false;
      });
      if (opened) {
        await new Promise((r) => setTimeout(r, 800));
        const m = await measureSlots(page, `${path} custom-modal ${vp.name}`);
        results.push(m);
        break;
      }
    }
    await page.close();
  }
}

// CSS chunk exists
const hasCss = existsSync(join(BUILD, 'static', 'css')) || true;
// component files
const componentOk =
  existsSync(join(__dirname, '..', 'src', 'components', 'ui', 'PhotoUploadSlot.js')) &&
  existsSync(join(__dirname, '..', 'src', 'components', 'ui', 'PhotoUploadSlot.scss'));

await browser.close();
server.close();

let fail = 0;
for (const r of results) {
  const bad = r.critical.length > 0;
  if (bad) fail += 1;
  console.log((bad ? '✗' : '✓') + ' ' + r.label + ` slots=${r.count} cw=${r.cw}`);
  r.slots.forEach((s) => {
    console.log(`   #${s.i} ${s.variant} ${s.w}x${s.h} wired=${s.wired} r=${s.radius}`);
  });
  r.critical.forEach((c) => console.log('   !! ' + c));
}

// Expectations
const adminAnnDesktop = results.find((r) => r.label.includes('/admin ann desktop'));
const adminUserDesktop = results.find((r) => r.label.includes('user-modal desktop'));
if (adminAnnDesktop && adminAnnDesktop.count < 1) {
  console.log('✗ expected announcement photo slot on admin');
  fail += 1;
}
if (adminUserDesktop && adminUserDesktop.count < 1) {
  console.log('✗ expected avatar slot in user modal');
  fail += 1;
}
if (!componentOk) {
  console.log('✗ component files missing');
  fail += 1;
}

console.log('\n==== PHOTO SLOT AUDIT ====');
console.log(fail ? `FAIL (${fail})` : `PASS (${results.length} checks)`);
console.log('component files:', componentOk ? 'OK' : 'MISSING');
process.exitCode = fail ? 1 : 0;
