// js13k build pipeline: esbuild -> terser -> Roadroller -> inline HTML -> ECT zip
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { minify } from 'terser';
import { minify as minifyHtml } from 'html-minifier-terser';
import { Packer } from 'roadroller';
import ect from 'ect-bin';

const LIMIT = 13312; // 13 * 1024
const DEV = process.argv.includes('--dev');

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

// 1. bundle
const bundled = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  define: { DEV: JSON.stringify(DEV) },
  minify: !DEV,
  write: false,
}).then((r) => r.outputFiles[0].text);

// 2. squeeze harder than esbuild does
const js = DEV ? bundled : (await minify(bundled, {
  ecma: 2020,
  module: true,
  toplevel: true,
  compress: { passes: 3, unsafe: true, unsafe_arrows: true, unsafe_math: true, drop_console: true },
  mangle: { toplevel: true },
  format: { comments: false },
})).code;

// 3. Roadroller — the big win, packs JS into a self-extracting blob.
// Its decoder costs ~600 B, so on tiny payloads plain minified JS still wins: keep whichever is smaller.
let packed = js;
if (!DEV) {
  const packer = new Packer([{ data: js, type: 'js', action: 'eval' }], { maxMemoryMB: 250 });
  await packer.optimize(2);
  const { firstLine, secondLine } = packer.makeDecoder();
  const rr = firstLine + secondLine;
  console.log(`js     ${js.length} B minified, ${rr.length} B roadrolled`);
  if (rr.length < js.length) packed = rr;
}
if (packed.includes('</script')) throw new Error('packed JS contains </script — needs escaping');

// 4. inline everything into one HTML file
const css = await readFile('src/style.css', 'utf8');
const template = await readFile('src/index.html', 'utf8');
let html = template.replace('/*CSS*/', () => css).replace('/*JS*/', () => packed);
if (!DEV) {
  html = await minifyHtml(html, {
    collapseWhitespace: true,
    removeAttributeQuotes: true,
    removeComments: true,
    removeOptionalTags: true,
    minifyCSS: true,
    minifyJS: false, // already packed
  });
}
await writeFile('dist/index.html', html);

// 5. zip it as tightly as possible
if (!DEV) {
  execFileSync(ect, ['-9', '-strip', '-zip', 'game.zip', 'index.html'], { cwd: 'dist', stdio: 'ignore' });
  const size = (await stat('dist/game.zip')).size;
  const pct = ((size / LIMIT) * 100).toFixed(1);
  const left = LIMIT - size;
  console.log(`html   ${html.length} B`);
  console.log(`zip    ${size} B / ${LIMIT} B  (${pct}%, ${left} B left)`);
  if (size > LIMIT) { console.error('OVER LIMIT'); process.exit(1); }
} else {
  console.log(`dev build: dist/index.html (${html.length} B)`);
}
