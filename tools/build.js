// Сборка сайта: копирует src/ в dist/.
// node tools/build.js         — только dist/
// node tools/build.js --zip   — ещё и <slug>-netlify.zip для ручной загрузки на Netlify (нужен tar из Windows 10+)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const pkg = require('../package.json');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(src, dist, { recursive: true });

let files = 0, bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else { files++; bytes += fs.statSync(p).size; }
  }
})(dist);
console.log(`dist/: ${files} файлов, ${(bytes / 1024).toFixed(0)} КБ`);

if (process.argv.includes('--zip')) {
  const zip = path.join(root, `${pkg.site.slug}-netlify.zip`);
  fs.rmSync(zip, { force: true });
  const entries = fs.readdirSync(dist);
  if (process.platform === 'win32') {
    // системный tar.exe из Windows умеет ZIP; tar из Git Bash — нет, поэтому путь указан явно
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    execFileSync(tar, ['-a', '-cf', path.relative(dist, zip), ...entries], { cwd: dist, stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-qr', path.relative(dist, zip), ...entries], { cwd: dist, stdio: 'inherit' });
  }
  console.log('Архив: ' + path.basename(zip));
}
