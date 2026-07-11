/**
 * Summarize the machine-readable Definition of Done. Prints status counts and
 * exits non-zero if any item that claims to be `verified` lacks referenced
 * evidence — a cheap guard against a status drifting away from its proof.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../docs/definition-of-done.json', import.meta.url));
const dod = JSON.parse(readFileSync(path, 'utf8'));

const counts = { verified: 0, partially_implemented: 0, blocked: 0, not_tested: 0 };
let problems = 0;

for (const item of dod.items) {
  counts[item.status] = (counts[item.status] ?? 0) + 1;
  if (item.status === 'verified' && (!item.evidence || item.evidence.length === 0)) {
    console.error(`✗ ${item.id}: marked verified but has no evidence reference`);
    problems += 1;
  }
}

console.log('No AI Slop — Definition of Done');
console.log('────────────────────────────────');
for (const [status, n] of Object.entries(counts)) {
  console.log(`  ${status.padEnd(22)} ${n}`);
}
console.log(`  ${'total'.padEnd(22)} ${dod.items.length}`);
console.log(
  `\n${counts.verified} verified; ${counts.blocked + counts.not_tested} blocked/not-tested (infrastructure-gated, honestly disclosed).`,
);

process.exit(problems === 0 ? 0 : 1);
