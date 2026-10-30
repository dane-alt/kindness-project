// Brand assets: main QR (with logo), share image, 4x6 card, link preview, phone icon. Usage: node scripts/make-brand.mjs
import QR from 'qrcode'; import fs from 'node:fs'; import { chromium } from 'playwright';
const URL_ = 'https://dane-alt.github.io/kindness-project/';
const logo = fs.readFileSync('img/logo.svg', 'utf8');
const photo = 'data:image/jpeg;base64,' + fs.readFileSync('img/jungle.jpg').toString('base64');
const rainbowBtn = 'background:linear-gradient(90deg,#ff8a80,#ffc94a,#9be564,#5bc0eb,#b39ddb);color:#16302a;border-radius:999px;font-family:Fredoka,sans-serif;font-weight:600';
const logoInner = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
let qr = await QR.toString(URL_, { type: 'svg', errorCorrectionLevel: 'H', margin: 2, color: { dark: '#193b35', light: '#ffffff' } });
const vb = +qr.match(/viewBox="0 0 (\d+) \d+"/)[1];
const s = vb * 0.24, o = (vb - s) / 2, pad = s * 0.12;
qr = qr.replace('</svg>', `<rect x="${o - pad}" y="${o - pad}" width="${s + 2 * pad}" height="${s + 2 * pad}" rx="${pad * 1.5}" fill="#fff"/><svg x="${o}" y="${o}" width="${s}" height="${s}" viewBox="0 0 120 120">${logoInner}</svg></svg>`);
fs.writeFileSync('qr/kindness-project-qr.svg', qr);
const font = `<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@600&family=Nunito:wght@400;700&display=swap" rel="stylesheet">`;
const base = `*{margin:0;box-sizing:border-box}body{font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d2236}h1,.d{font-family:Fredoka,Nunito,system-ui,sans-serif;font-weight:600}`;
const pages = {
  'qr/kindness-project-qr.png': [900, 900, `<style>${base}body{background:#fff}</style>${qr.replace('<svg ', '<svg width="900" height="900" ')}`],
  'qr/kindness-project-share.png': [1080, 1350, `${font}<style>${base}body{background:linear-gradient(180deg,rgba(10,30,20,.15),rgba(8,26,18,.85)),url(${photo}) center 30%/cover;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:30px;height:1350px;text-align:center;padding:60px 60px 70px}h1{text-shadow:0 3px 18px rgba(0,0,0,.5)}.pill{${rainbowBtn};font-size:40px;padding:22px 44px}
    .l{width:150px;height:150px;background:#fff;border-radius:40px;padding:22px}h1{font-size:76px;line-height:1.05}p{font-size:36px;opacity:.92;max-width:860px;line-height:1.35}.q{background:#fff;border-radius:36px;padding:28px}.q svg{width:380px;height:380px;display:block}.u{font-size:28px;opacity:.85}</style>
    <div class="l">${logo}</div><h1>Someone made your day.<br>Pass it on.</h1><div class="q">${qr}</div><div class="pill">Take the kindness journey</div><p class="u">Scan, or visit dane-alt.github.io/kindness-project</p>`],
  'qr/kindness-project-card-4x6.png': [1200, 1800, `${font}<style>${base}body{background:linear-gradient(180deg,rgba(244,248,239,.0) 0%,rgba(244,248,239,.92) 30%,#f4f8ef 45%),url(${photo}) center top/100% auto no-repeat,#f4f8ef;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;height:1800px;text-align:center;padding:90px}
    .l{width:170px;height:170px}h1{font-size:88px;line-height:1.05}p{font-size:42px;color:#4f6b64;line-height:1.35}.q svg{width:700px;height:700px;display:block}.u{font-size:30px}</style>
    <div class="l">${logo}</div><h1>The Kindness Project</h1><div class="q">${qr}</div><p>What is the kindest thing anyone<br>has ever done for you?<br><b style="color:#16302a">Scan to take the kindness journey.</b></p><p class="u">dane-alt.github.io/kindness-project</p>`],
  'img/og.png': [1200, 630, `${font}<style>${base}body{background:linear-gradient(90deg,rgba(8,26,18,.85),rgba(8,26,18,.35)),url(${photo}) center 35%/cover;color:#fff;display:flex;align-items:center;gap:60px;height:630px;padding:70px 90px}.l{width:240px;height:240px;flex:none;background:#fff;border-radius:50%;padding:30px}h1{font-size:78px;line-height:1.05}p{font-size:34px;opacity:.9;margin-top:22px;line-height:1.3}</style>
    <div class="l">${logo}</div><div><h1>The Kindness Project</h1><p>True stories of kindness, and a place to share your own.</p></div>`],
  'img/icon-180.png': [180, 180, `<style>${base}body{background:#fff;display:flex;align-items:center;justify-content:center;height:180px}.l{width:150px;height:150px}</style><div class="l">${logo}</div>`],
};
const b = await chromium.launch(); const pg = await b.newPage();
for (const [file, [w, h, html]] of Object.entries(pages)) {
  await pg.setViewportSize({ width: w, height: h }); await pg.setContent(html); await pg.waitForTimeout(400);
  await pg.screenshot({ path: file }); console.log(file);
}
await b.close();
