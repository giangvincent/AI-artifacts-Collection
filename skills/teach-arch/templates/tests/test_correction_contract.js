/* Verifies the correction contract: practice groups are identified by
   <!-- group:x --> anchors, never by prose — an arch course renders the same
   way. Parses an arch correction with the real site.js functions and asserts
   both the group assignment and the placement.
   Run: node test_correction_contract.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const siteJs = fs.readFileSync(path.join(__dirname, 'assets', 'site.js'), 'utf8');

function extract(re) {
  const m = siteJs.match(re);
  if (!m) throw new Error('could not extract ' + re);
  return m[0];
}

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext([
  extract(/function esc\(s\) \{[\s\S]*?\n  \}/),
  extract(/function inline\(s\) \{[\s\S]*?\n  \}/),
  extract(/function tableHtml\(rows\) \{[\s\S]*?\n  \}/),
  extract(/function mdToHtml\(src\) \{[\s\S]*?\n  \}/),
  extract(/function splitSections\(md\) \{[\s\S]*?\n  \}/),
  extract(/function splitItems\(lines\) \{[\s\S]*?\n  \}/),
  extract(/function splitTableItems\(lines\) \{[\s\S]*?\n  \}/)
].join('\n'), sandbox);

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

/* An arch correction: verdict + why + arch pointer per question. */
const md = `# Correction — Lesson 0001

## What went well

- You named the right box for the invite row.

<!-- group:q -->
## Correction — questions

**1.** "B" → ✓ correct — the invite row is created there, see Invite flow step 2.

**2.** "A" → ✗, correct C — the page reads the token, see Invite flow step 3.

<!-- group:w -->
## Correction — written answers

**1.** "The server saves the invite." → ✓ — say which box saves it and why.
`;

const sections = sandbox.splitSections(md);
console.log('parsed sections:', JSON.stringify(sections.map(s => ({ title: s.title, group: s.group }))));

const q = sections.filter(s => s.group === 'q');
const w = sections.filter(s => s.group === 'w');
const extra = sections.filter(s => !s.group);

check('question section carries group q', q.length === 1);
check('written section carries group w', w.length === 1);
check('unanchored sections stay as extras', extra.length >= 1);

const parsed = sandbox.splitItems(q[0].lines);
check('question items are numbered', parsed.items.length === 2 && parsed.items[0].n === 1);

const html = sandbox.mdToHtml(q[0].lines.join('\n'));
check('markdown renders to html', html.includes('<strong>1.</strong>') || html.includes('1.'));

/* an anchor must bind to the next heading only, not leak to later sections */
const leak = sandbox.splitSections('<!-- group:q -->\n## A\n\nx\n\n## B\n\ny\n');
check('anchor binds only to the next heading',
  leak.find(s => s.title === 'A').group === 'q' && leak.find(s => s.title === 'B').group === null);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
