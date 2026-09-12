// Reports the size of the last build without rebuilding it.
import { stat } from 'node:fs/promises';

const LIMIT = 13312;
try {
  const size = (await stat('dist/game.zip')).size;
  const pct = (size / LIMIT) * 100;
  const bar = '█'.repeat(Math.round(pct / 2.5)).padEnd(40, '·');
  console.log(`\n  ${bar}\n`);
  console.log(`  ${size} B / ${LIMIT} B   ${pct.toFixed(1)}%   ${LIMIT - size} B left\n`);
  if (size > LIMIT) process.exit(1);
} catch (e) {
  console.error('no dist/game.zip — run `npm run build` first');
  process.exit(1);
}
