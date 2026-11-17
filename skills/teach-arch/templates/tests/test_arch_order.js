/* Verifies lessons follow the ARCHITECTURE.md lesson-mapping table order:
   lesson NNNN teaches the Nth done row, and no row is skipped or repeated.
   Run: node test_arch_order.js (needs the real course repo). */
const fs = require('fs');
const path = require('path');

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

const arch = fs.readFileSync(path.join(__dirname, 'ARCHITECTURE.md'), 'utf8');
const rows = [];
for (const line of arch.split('\n')) {
  const m = line.match(/^\s*\|\s*(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|\s*(todo|done|stale)\s*\|/i);
  if (m) rows.push({ n: +m[1], node: m[2].trim(), status: m[5].toLowerCase() });
}

check('ARCHITECTURE.md has a lesson-mapping table', rows.length > 0);
check('table rows are numbered 1..N in order',
  rows.every((r, i) => r.n === i + 1));

const done = rows.filter(r => r.status === 'done');
const lessons = fs.readdirSync(path.join(__dirname, 'lessons'))
  .filter(f => /^\d{4}-.*\.html$/.test(f)).sort();

check('lesson count matches done rows', lessons.length === done.length);

for (let i = 0; i < lessons.length; i++) {
  const text = fs.readFileSync(path.join(__dirname, 'lessons', lessons[i]), 'utf8');
  const node = done[i] && done[i].node.toLowerCase().split(/\s+/).slice(0, 3).join(' ');
  const mentions = node && text.toLowerCase().includes(node.split(' ')[0]);
  check(`${lessons[i]} follows table row ${done[i] && done[i].n} (${done[i] && done[i].node})`, !!mentions);
}

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
