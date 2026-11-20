// Готовит файлы для визитки из src/config.js:
//   src/card/ortodont-rashid.vcf  — контакт для кнопки «В контакты»
//   design/qr-card.svg, .png      — QR-код на адрес визитки (cardUrl) для печати
//   design/print-card.svg         — макет бумажной визитки 90×50 мм с QR-кодом
// Запуск: npm run card   (после изменения телефона, адреса или cardUrl в config.js)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const QRCode = require('qrcode');

const ROOT = path.join(__dirname, '..');
const CONFIG = vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8') + '\n;CONFIG', vm.createContext({}));
const url = new URL(CONFIG.cardUrl);
if (url.protocol !== 'https:') throw new Error('cardUrl должен начинаться с https://');

/* ---------- vCard 3.0 ---------- */
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const vcf = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  `N:;${esc(CONFIG.clinicName)};;;`,
  `FN:${esc(CONFIG.clinicName)}`,
  `ORG:${esc(CONFIG.clinicName)}`,
  `TITLE:${esc(CONFIG.cardTagline)}`,
  `TEL;TYPE=WORK,VOICE:${String(CONFIG.phoneTel).replace(/[^\d+]/g, '')}`,
  `ADR;TYPE=WORK:;;${esc(CONFIG.address)};;;;`,
  `URL:${url.href}`,
  `NOTE:${esc(CONFIG.hours)}`,
  'END:VCARD',
  '',
].join('\r\n');
fs.writeFileSync(path.join(ROOT, 'src/card/ortodont-rashid.vcf'), vcf);

/* ---------- QR ---------- */
(async () => {
  fs.mkdirSync(path.join(ROOT, 'design'), { recursive: true });
  const qr = QRCode.create(url.href, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size, data = qr.modules.data;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y * n + x]) d += `M${x} ${y}h1v1h-1z`;
  const q = 4; // «тихая зона» вокруг кода — без неё телефоны хуже распознают
  const qrSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${n + 2 * q} ${n + 2 * q}" shape-rendering="crispEdges">
<rect x="${-q}" y="${-q}" width="${n + 2 * q}" height="${n + 2 * q}" fill="#ffffff"/>
<path fill="#0a0f18" d="${d}"/>
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'design/qr-card.svg'), qrSvg);
  await QRCode.toFile(path.join(ROOT, 'design/qr-card.png'), url.href, { errorCorrectionLevel: 'M', width: 3000, margin: 4, color: { dark: '#0a0f18', light: '#ffffff' } });

  /* ---------- макет визитки 90×50 мм (открыть в браузере → печать в PDF) ---------- */
  const s = 30 / (n + 2 * q); // QR 30×30 мм
  const card = `<svg xmlns="http://www.w3.org/2000/svg" width="90mm" height="50mm" viewBox="0 0 90 50">
<style>
  @font-face { font-family: Forum; src: url("../src/fonts/forum-latin.woff2") format("woff2"); }
  @font-face { font-family: Golos; src: url("../src/fonts/golos-cyrillic.woff2") format("woff2"); }
  .t { font-family: Forum, serif; fill: #f3f5f8; }
  .s { font-family: Golos, sans-serif; fill: #b9c5d5; }
</style>
<rect width="90" height="50" fill="#0a0f18"/>
<circle cx="14" cy="14" r="7.4" fill="#1f3a6b" stroke="#8b9bb2" stroke-width="1"/>
<path transform="translate(9.5 9.3) scale(0.09)" fill="#f3f5f8" d="M33 20c-10 0-17 8-17 19 0 9 4 14 6 22 3 10 3 25 11 25 7 0 6-15 11-20 3-3 9-3 12 0 5 5 4 20 11 20 8 0 8-15 11-25 2-8 6-13 6-22 0-11-7-19-17-19-7 0-11 4-17 4s-10-4-17-4z"/>
<text class="t" x="6" y="31" font-size="5.6" letter-spacing="0.4">ORTODONT</text>
<text class="t" x="6" y="37.5" font-size="5.6" letter-spacing="0.4">RASHID</text>
<text class="s" x="6" y="44.5" font-size="2.6">Наведите камеру на QR-код</text>
<rect x="53" y="7" width="32" height="32" rx="2.4" fill="#ffffff"/>
<g transform="translate(54 8) scale(${s.toFixed(5)}) translate(${q} ${q})"><path fill="#0a0f18" d="${d}"/></g>
<text class="s" x="69" y="44.5" font-size="2.3" text-anchor="middle">${url.host}</text>
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'design/print-card.svg'), card);

  /* ---------- QR с логотипом в центре (как на табличке) ----------
     Уровень коррекции H: код читается, даже если ~30% модулей закрыто. Логотип закрывает ~8%. */
  const qh = QRCode.create(url.href, { errorCorrectionLevel: 'H' });
  const N = qh.modules.size, D = qh.modules.data, c = N / 2, R = N * 0.16; // радиус белой площадки под логотип
  let dh = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!D[y * N + x]) continue;
    if (Math.hypot(x + 0.5 - c, y + 0.5 - c) < R + 0.6) continue; // модули под логотипом не рисуем
    dh += `M${x} ${y}h1v1h-1z`;
  }
  // логотип в центре QR: design/logo-ideal.png (круг 600×600 с прозрачными углами), встраивается в SVG целиком
  const logoPng = fs.readFileSync(path.join(ROOT, 'design/logo-ideal.png')).toString('base64');
  const logo = (cx, cy, r) => { const s = r * 0.92; return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff"/>
<image x="${(cx - s).toFixed(3)}" y="${(cy - s).toFixed(3)}" width="${(2 * s).toFixed(3)}" height="${(2 * s).toFixed(3)}" href="data:image/png;base64,${logoPng}"/>`; };
  const qrLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${N + 2 * q} ${N + 2 * q}">
<rect x="${-q}" y="${-q}" width="${N + 2 * q}" height="${N + 2 * q}" fill="#ffffff"/>
<path fill="#0a0f18" shape-rendering="crispEdges" d="${dh}"/>
${logo(c, c, R)}
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'src/card/qr.svg'), qrLogo);       // для кнопки «Показать QR» на визитке
  fs.writeFileSync(path.join(ROOT, 'design/qr-logo.svg'), qrLogo);

  /* ---------- табличка 150×150 мм для стены/ресепшена ---------- */
  const t = 112 / (N + 2 * q); // код 112×112 мм
  const plaque = `<svg xmlns="http://www.w3.org/2000/svg" width="150mm" height="150mm" viewBox="0 0 150 150">
<style>
  @font-face { font-family: Forum; src: url("../src/fonts/forum-latin.woff2") format("woff2"); }
  @font-face { font-family: Golos; src: url("../src/fonts/golos-cyrillic.woff2") format("woff2"); }
</style>
<rect width="150" height="150" rx="6" fill="#ffffff"/>
<g transform="translate(19 10) scale(${t.toFixed(5)}) translate(${q} ${q})">
<path fill="#0a0f18" shape-rendering="crispEdges" d="${dh}"/>
${logo(c, c, R)}
</g>
<text x="75" y="131" font-family="Forum, serif" font-size="9" letter-spacing="1.2" text-anchor="middle" fill="#1f3a6b">ORTODONT RASHID</text>
<text x="75" y="141" font-family="Golos, sans-serif" font-size="4.4" text-anchor="middle" fill="#4b5b72">Наведите камеру — откроется визитка клиники</text>
</svg>
`;
  fs.writeFileSync(path.join(ROOT, 'design/qr-plaque.svg'), plaque);

  console.log(`Готово: vCard, QR ${n}×${n} (обычный) и ${N}×${N} (с логотипом) на ${url.href}, визитка 90×50 мм, табличка 150×150 мм`);
})();
