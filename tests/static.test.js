// Статические проверки сайта без браузера и без сети: node --test
// Ловят типичные регрессии: битые ссылки на файлы, встроенные скрипты, чужие CDN,
// ослабленный CSP, расхождение заголовков Netlify и nginx, подменённые библиотеки, сломанный config.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const html = read('index.html');
const isLocal = (u) => !/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(u);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const cssFiles = walk(SRC).filter((f) => f.endsWith('.css'));
// все страницы сайта (главная, визитка и т. д.) и весь свой JS (без vendor/)
const pages = walk(SRC).filter((f) => f.endsWith('.html')).map((f) => ({ file: f, rel: path.relative(SRC, f), html: fs.readFileSync(f, 'utf8') }));
const ownJs = walk(SRC).filter((f) => f.endsWith('.js') && !f.includes(path.sep + 'vendor' + path.sep));

function parseCsp(value) {
  const map = {};
  for (const part of value.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...vals] = part.split(/\s+/);
    map[name] = vals.join(' ');
  }
  return map;
}
function headersFromNetlify() {
  const out = {};
  let inRoot = false;
  for (const line of read('_headers').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { inRoot = line.trim() === '/*'; continue; }
    if (!inRoot) continue;
    const i = line.indexOf(':');
    out[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  return out;
}
function headersFromNginx() {
  const text = fs.readFileSync(path.join(ROOT, 'deploy/nginx/security-headers.conf'), 'utf8');
  const out = {};
  for (const m of text.matchAll(/^\s*add_header\s+([\w-]+)\s+"([^"]*)"\s+always;/gm)) out[m[1].toLowerCase()] = m[2];
  return out;
}

test('все локальные файлы со всех страниц существуют', () => {
  for (const p of pages) {
    const refs = [...p.html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter(isLocal);
    assert.ok(refs.length > 3, p.rel + ': подозрительно мало ссылок');
    for (const ref of refs) assert.ok(fs.existsSync(path.join(path.dirname(p.file), ref.split('?')[0])), p.rel + ': нет файла ' + ref);
  }
});

test('CSS ссылается только на существующие локальные файлы', () => {
  for (const f of cssFiles) {
    const css = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(css, /@import\s+url\(\s*["']?https?:/i, path.relative(SRC, f) + ': внешний @import');
    for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      assert.ok(isLocal(m[1]), path.relative(SRC, f) + ': внешний url ' + m[1]);
      assert.ok(fs.existsSync(path.join(path.dirname(f), m[1])), path.relative(SRC, f) + ': нет файла ' + m[1]);
    }
  }
});

test('в HTML нет встроенных скриптов, стилей и обработчиков событий', () => {
  for (const p of pages) {
    assert.doesNotMatch(p.html, /<script(?![^>]*\bsrc=)[^>]*>/i, p.rel + ': встроенный <script>');
    assert.doesNotMatch(p.html, /\sstyle="/i, p.rel + ': атрибут style');
    assert.doesNotMatch(p.html, /\son[a-z]+="/i, p.rel + ': обработчик on…=');
    assert.doesNotMatch(p.html, /<style[\s>]/i, p.rel + ': тег <style>');
  }
});

test('ничего не грузится с чужих сайтов', () => {
  for (const p of pages) assert.doesNotMatch(p.html, /<(script|link|img|iframe|source|video|audio)[^>]+(src|href)="(https?:)?\/\//i, p.rel);
  for (const f of ownJs) {
    const js = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(js, /import\s[^;]*from\s+['"]https?:/, path.relative(SRC, f) + ': импорт с чужого сайта');
    assert.doesNotMatch(js, /\b(eval|new Function)\s*\(/, path.relative(SRC, f) + ': eval');
    assert.doesNotMatch(js, /\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write/, path.relative(SRC, f) + ': вставка HTML-строк (риск XSS)');
  }
});

test('_headers: строгий CSP', () => {
  const csp = parseCsp(headersFromNetlify()['content-security-policy'] || '');
  assert.equal(csp['default-src'], "'none'");
  assert.equal(csp['script-src'], "'self'");
  assert.equal(csp['frame-ancestors'], "'none'");
  assert.equal(csp['object-src'], "'none'");
  assert.equal(csp['base-uri'], "'none'");
  assert.equal(csp['form-action'], "'none'");
  for (const v of Object.values(csp)) assert.doesNotMatch(v, /unsafe-inline|unsafe-eval|\*/);
});

test('_headers: неизменяемые папки (vendor, fonts) кэшируются на год', () => {
  const text = read('_headers');
  for (const dir of ['vendor', 'fonts']) {
    if (!fs.existsSync(path.join(SRC, dir))) continue;
    const block = text.split(/\r?\n(?=\S)/).find((b) => b.startsWith('/' + dir + '/*'));
    assert.ok(block, 'нет правила /' + dir + '/* в _headers');
    assert.match(block, /Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/, 'кэш для /' + dir + '/*');
  }
});

test('nginx отдаёт те же заголовки защиты, что и _headers', () => {
  const a = headersFromNetlify(), b = headersFromNginx();
  for (const name of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy', 'cross-origin-opener-policy', 'cross-origin-resource-policy', 'x-robots-tag']) {
    assert.equal(b[name], a[name], 'заголовок ' + name);
  }
  assert.match(b['strict-transport-security'] || '', /max-age=\d{7,}/);
});

test('форма: POST, ловушка для ботов, ограничение длины', () => {
  assert.match(html, /<form[^>]+method="post"/);
  assert.match(html, /name="website"[^>]*tabindex="-1"/);
  assert.match(html, /name="name"[^>]*maxlength="\d+"/);
  assert.match(html, /name="phone"[^>]*maxlength="\d+"/);
});

test('ссылки target="_blank" защищены rel="noopener"', () => {
  for (const p of pages) for (const m of p.html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="[^"]*noopener/, p.rel + ': ' + m[0]);
});

test('библиотеки не изменены (SHA-256 совпадают)', () => {
  const sums = walk(path.join(SRC, 'vendor')).filter((f) => f.endsWith('SHA256SUMS'));
  for (const s of sums) {
    for (const line of fs.readFileSync(s, 'utf8').trim().split(/\r?\n/)) {
      const [hash, name] = line.split(/\s+\*?/);
      const file = path.join(path.dirname(s), name.replace(/^\*/, ''));
      const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      assert.equal(actual, hash, 'изменён файл ' + path.relative(SRC, file));
    }
  }
});

test('шрифты — настоящие woff2', () => {
  for (const f of walk(path.join(SRC, 'fonts')).filter((x) => x.endsWith('.woff2'))) {
    assert.equal(fs.readFileSync(f).subarray(0, 4).toString('latin1'), 'wOF2', path.basename(f));
  }
});

test('config.js корректен и содержит допустимые контакты', () => {
  const ctx = vm.createContext({});
  const CONFIG = vm.runInContext(read('config.js') + '\n;CONFIG', ctx);
  assert.match(CONFIG.phoneTel, /^\+?\d{10,15}$/, 'phoneTel');
  assert.match(CONFIG.whatsapp, /^\d{10,15}$/, 'whatsapp');
  assert.match(CONFIG.telegram, /^[A-Za-z0-9_]{5,32}$/, 'telegram');
  assert.ok(Array.isArray(CONFIG.prices) && CONFIG.prices.length > 0, 'prices');
  for (const row of CONFIG.prices) assert.ok(Array.isArray(row) && row.length === 2 && row.every((x) => typeof x === 'string'), 'строка цены');
  for (const [, url] of CONFIG.social || []) assert.equal(new URL(url).protocol, 'https:', 'social ' + url);
});

const hasCard = fs.existsSync(path.join(SRC, 'card/card-config.js'));
test('визитка: card-config.js корректен, внешние ссылки только https', { skip: !hasCard }, () => {
  const CARD = vm.runInContext(read('card/card-config.js') + '\n;CARD', vm.createContext({}));
  assert.ok(CARD.name, 'name');
  assert.match(CARD.phoneTel, /^\+?\d{10,15}$/, 'phoneTel');
  assert.match(CARD.whatsapp, /^\d{10,15}$/, 'whatsapp');
  assert.match(CARD.telegram, /^[A-Za-z0-9_]{5,32}$/, 'telegram');
  for (const key of ['cardUrl', 'instagram', 'mapUrl', 'map2gisUrl']) if (CARD[key]) assert.equal(new URL(CARD[key]).protocol, 'https:', key);
  for (const [, url] of CARD.social || []) assert.equal(new URL(url).protocol, 'https:', 'social ' + url);
});

test('визитка: файл контакта (vCard) совпадает с card-config.js', { skip: !hasCard }, () => {
  const CARD = vm.runInContext(read('card/card-config.js') + '\n;CARD', vm.createContext({}));
  const vcf = read('card/contact.vcf');
  assert.match(vcf, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.ok(vcf.includes('FN:' + CARD.name + '\r\n'), 'название в vCard устарело — запустите npm run card');
  assert.ok(vcf.includes('TEL;TYPE=WORK,VOICE:' + CARD.phoneTel.replace(/[^\d+]/g, '') + '\r\n'), 'телефон в vCard устарел — запустите npm run card');
  assert.ok(vcf.includes('URL:' + new URL(CARD.cardUrl).href + '\r\n'), 'адрес визитки в vCard устарел — запустите npm run card');
  assert.match(read('_headers'), /\/card\/contact\.vcf\s+Content-Type: text\/vcard/, 'нет Content-Type для vCard в _headers');
});
