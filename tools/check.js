// Проверка опубликованного сайта: страница, заголовки защиты, все подключённые файлы, закрытые служебные пути.
// Запуск: node tools/check.js [адрес]
// Адрес по умолчанию: переменная SITE_URL или site.url из package.json.
const pkg = require('../package.json');
const BASE = (process.argv[2] || process.env.SITE_URL || pkg.site.url).replace(/\/$/, '');
let fails = 0, warns = 0;
const ok = (m) => console.log('  OK    ' + m);
const bad = (m) => { fails++; console.log('  FAIL  ' + m); };
const warn = (m) => { warns++; console.log('  WARN  ' + m); };
const check = (cond, m) => (cond ? ok(m) : bad(m));
const get = (p, opts = {}) => fetch(BASE + p, { redirect: 'manual', ...opts });
const localRefs = (text, re) => [...text.matchAll(re)].map((m) => m[1])
  .filter((u) => !/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(u));

(async () => {
  console.log('Проверка ' + BASE + '\n');

  console.log('Главная страница');
  const r = await get('/');
  const html = await r.text();
  check(r.status === 200, 'отвечает 200 (сейчас ' + r.status + ')');
  check(html.includes(pkg.site.title), 'это наш сайт (в странице есть «' + pkg.site.title + '»)');
  const h = (n) => r.headers.get(n) || '';
  const csp = h('content-security-policy');
  check(csp.includes("default-src 'none'"), "CSP: default-src 'none'");
  check(/script-src 'self'(;|$)/.test(csp), 'CSP: скрипты только с сайта, без unsafe-inline/eval');
  check(csp.includes("frame-ancestors 'none'"), 'CSP: сайт нельзя встроить в чужую страницу');
  check(csp.includes("form-action 'none'"), 'CSP: форма не отправляется на чужие адреса');
  check(/max-age=\d{7,}/.test(h('strict-transport-security')), 'HSTS включён');
  check(h('x-content-type-options') === 'nosniff', 'X-Content-Type-Options: nosniff');
  check(h('x-frame-options') === 'DENY', 'X-Frame-Options: DENY');
  check(h('referrer-policy') !== '', 'Referrer-Policy задан');
  check(h('permissions-policy').includes('camera=()'), 'Permissions-Policy: камера/микрофон/геолокация выключены');
  check(!/nginx\/\d|apache\/\d/i.test(h('server')), 'сервер не раскрывает свою версию');
  if (h('x-robots-tag').includes('noindex')) warn('сайт скрыт от поисковиков (noindex) — так и нужно для демо, убрать при запуске');
  else ok('сайт открыт для поисковиков');

  // все страницы из package.json (site.pages): главная, визитка и т. д.
  const resolve = (base, rel) => new URL(rel, 'https://x/' + base).pathname.slice(1);
  const refs = new Set();
  for (const page of pkg.site.pages || ['/']) {
    console.log('\nКод страницы ' + page);
    const pr = page === '/' ? r : await get(page);
    const ph = page === '/' ? html : await pr.text();
    if (page !== '/') {
      check(pr.status === 200, 'отвечает 200 (сейчас ' + pr.status + ')');
      check((pr.headers.get('content-security-policy') || '') === csp, 'тот же CSP, что на главной');
    }
    check(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(ph), 'нет встроенных скриптов');
    check(!/<(script|link|img|iframe)[^>]+(src|href)=["']https?:/i.test(ph), 'нет загрузок с чужих сайтов');
    check(!/\sstyle=["']/i.test(ph), 'нет встроенных стилей');
    localRefs(ph, /\s(?:src|href)=["']([^"']+)["']/gi).forEach((u) => refs.add(resolve(page.slice(1), u)));
  }
  refs.delete('');

  console.log('\nПодключённые файлы');
  // файлы, которые подключают CSS (url(...)) и JS-модули (import ... from '...'), тоже проверяем
  for (const ref of refs) { // Set перебирает и добавленные по ходу элементы — импорты импортов тоже
    if (!/\.(css|js)$/.test(ref)) continue;
    const text = await (await get('/' + ref)).text();
    const re = ref.endsWith('.css') ? /url\(["']?([^"')]+)["']?\)/gi : /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g;
    localRefs(text, re).forEach((u) => refs.add(resolve(ref, u)));
  }
  for (const ref of refs) {
    const p = '/' + ref.replace(/^\.?\//, '');
    const x = await get(p, { method: 'HEAD' });
    const cc = x.headers.get('cache-control') || '';
    check(x.status === 200, p + ' → ' + x.status + ' ' + (x.headers.get('content-type') || ''));
    if (/^\/(fonts|vendor)\//.test(p)) check(cc.includes('immutable'), p + ' кэшируется на год');
    if (p.endsWith('.vcf')) check((x.headers.get('content-type') || '').startsWith('text/vcard'), p + ' отдаётся как контакт (text/vcard)');
  }

  console.log('\nЗакрытые служебные пути');
  for (const p of ['/_headers', '/.git/config', '/.env', '/package.json', '/tools/check.js', '/src/index.html', '/design/logo-original.png', '/docs/']) {
    const x = await get(p, { method: 'HEAD' });
    check(x.status === 404 || x.status === 403, p + ' недоступен (' + x.status + ')');
  }

  console.log('\nHTTPS');
  if (BASE.startsWith('https://')) {
    const insecure = await fetch(BASE.replace(/^https:/, 'http:') + '/', { redirect: 'manual' });
    check(insecure.status >= 301 && insecure.status <= 308 && (insecure.headers.get('location') || '').startsWith('https://'), 'http перенаправляет на https (' + insecure.status + ')');
  } else bad('адрес не https');

  console.log('\nИтог: ' + (fails ? fails + ' ошибок' : 'ошибок нет') + (warns ? ', ' + warns + ' предупреждений' : ''));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('Проверка не выполнилась: ' + e.message); process.exit(2); });
