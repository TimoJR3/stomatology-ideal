// Локальный просмотр сайта с теми же заголовками, что в src/_headers.
// node tools/serve.js [папка=src] [порт=8731]  ->  http://127.0.0.1:8731
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(path.join(__dirname, '..'), process.argv[2] || 'src');
const port = +process.argv[3] || 8731;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

// разбор _headers: блоки «путь» и строки «  Имя: значение»
function readRules() {
  const rules = []; let cur = null; let text;
  try { text = fs.readFileSync(path.join(root, '_headers'), 'utf8'); } catch { return rules; }
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { cur = { pattern: line.trim(), headers: [] }; rules.push(cur); continue; }
    const i = line.indexOf(':'); if (cur && i > 0) cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return rules;
}
const match = (pattern, p) => pattern.endsWith('/*') ? p.startsWith(pattern.slice(0, -1)) : p === pattern;

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root + path.sep) || path.basename(f).startsWith('_') || path.basename(f).startsWith('.')) { res.writeHead(404); return res.end('404'); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    const h = { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' };
    for (const r of readRules()) if (match(r.pattern, p)) for (const [k, v] of r.headers) h[k] = v;
    res.writeHead(200, h); res.end(data);
  });
}).listen(port, '127.0.0.1', () => console.log('ready http://127.0.0.1:' + port + '  (' + path.relative(path.join(__dirname, '..'), root) + ')'));
