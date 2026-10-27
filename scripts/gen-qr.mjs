// Print-ready QR codes for 4x6 inch cards. Writes qr/*.svg and qr/*.png (QR at 3in, 300 dpi = 900px)
// plus full 4x6 card layouts (qr/card-*.svg). Usage: npm run qr -- [base-url]
import QR from 'qrcode'; import fs from 'node:fs';
const base = (process.argv[2] || 'https://dane-alt.github.io/kindness-project/').replace(/\/?$/, '/');
const flows = [
  { id: 'flow1', url: base + '?f=1', title: 'Kindness received and given', line: 'What is the kindest thing anyone has ever done for you?' },
  { id: 'flow2', url: base + '?f=2', title: 'Kind acts inspired', line: 'Has the Kindness Project inspired a kind act?' },
];
fs.mkdirSync('qr', { recursive: true });
const opts = { errorCorrectionLevel: 'Q', margin: 4, color: { dark: '#000000', light: '#ffffff' } };
for (const f of flows) {
  let svg = await QR.toString(f.url, { ...opts, type: 'svg' });
  svg = svg.replace('<svg ', '<svg width="3in" height="3in" ');
  fs.writeFileSync(`qr/${f.id}-qr.svg`, svg);
  await QR.toFile(`qr/${f.id}-qr.png`, f.url, { ...opts, width: 900 });
  const inner = svg.replace(/<\?xml.*?\?>/, '').replace(/width="3in" height="3in" /, 'x="0.5in" y="1.35in" width="3in" height="3in" ');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="4in" height="6in" viewBox="0 0 384 576">
<rect width="384" height="576" fill="#fdf8f3"/>
<text x="192" y="62" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#b5523b">The Kindness Project</text>
<text x="192" y="100" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="17" fill="#2b2420">${esc(f.title)}</text>
<svg x="48" y="129.6" width="288" height="288" viewBox="${svg.match(/viewBox="([^"]+)"/)[1]}">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>
<text x="192" y="458" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="14" fill="#2b2420">${esc(f.line)}</text>
<text x="192" y="482" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="14" fill="#2b2420">Scan to share, anonymously.</text>
<text x="192" y="540" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="11" fill="#6b5d54">${esc(f.url.replace(/^https?:\/\//, ''))}</text>
</svg>`;
  fs.writeFileSync(`qr/card-${f.id}-4x6.svg`, card);
  console.log(f.id, f.url);
}
