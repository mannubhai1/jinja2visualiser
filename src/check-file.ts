/**
 * CLI tool: verify the parser didn't miss any Jinja2 blocks in a file.
 * Compares raw regex line count vs parser output count.
 *
 * Usage: node out-test/check-file.js <path-to-file>
 */
import * as fs from 'node:fs';
import { parseJinja, Node } from './parser';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node out-test/check-file.js <path-to-file>');
  process.exit(1);
}

const text = fs.readFileSync(filePath, 'utf-8');
const lines = text.split(/\r?\n/);

// Count raw occurrences by scanning every line with the same regexes the parser uses
const tagRegex = /(?:#\s*)?\{%-?\s*(if|elif|else|for|endif|endfor)\b/;

let rawIf = 0, rawElif = 0, rawElse = 0, rawEndif = 0, rawFor = 0, rawEndfor = 0;
const missed: { line: number; text: string }[] = [];

for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(tagRegex);
  if (match) {
    switch (match[1]) {
      case 'if': rawIf++; break;
      case 'elif': rawElif++; break;
      case 'else': rawElse++; break;
      case 'endif': rawEndif++; break;
      case 'for': rawFor++; break;
      case 'endfor': rawEndfor++; break;
    }
  }
}

// Count what the parser actually captured
const tree = parseJinja(text);

function countNodes(nodes: Node[]): { if: number; elif: number; else: number; for: number } {
  let counts = { if: 0, elif: 0, else: 0, for: 0 };
  for (const node of nodes) {
    counts[node.type]++;
    const childCounts = countNodes(node.children);
    counts.if += childCounts.if;
    counts.elif += childCounts.elif;
    counts.else += childCounts.else;
    counts.for += childCounts.for;
  }
  return counts;
}

const parsed = countNodes(tree);

console.log(`\n  File: ${filePath}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  Tag        Raw (in file)   Parsed   Match`);
console.log(`  ─────────────────────────────────────────`);

const rows = [
  { tag: 'if', raw: rawIf, parsed: parsed.if },
  { tag: 'elif', raw: rawElif, parsed: parsed.elif },
  { tag: 'else', raw: rawElse, parsed: parsed.else },
  { tag: 'for', raw: rawFor, parsed: parsed.for },
  { tag: 'endif', raw: rawEndif, parsed: null as number | null },
  { tag: 'endfor', raw: rawEndfor, parsed: null as number | null },
];

let allGood = true;
for (const row of rows) {
  const parsedStr = row.parsed !== null ? String(row.parsed) : '–';
  const match = row.parsed === null ? '–' :
                row.raw === row.parsed ? '✔' : '✖ MISMATCH';
  if (match === '✖ MISMATCH') { allGood = false; }
  console.log(`  ${row.tag.padEnd(10)} ${String(row.raw).padStart(5)}         ${parsedStr.padStart(5)}   ${match}`);
}

console.log(`  ─────────────────────────────────────────`);
console.log(`  Total conditions: ${rawIf + rawElif + rawElse + rawFor} (if:${rawIf} elif:${rawElif} else:${rawElse} for:${rawFor})`);
console.log(`  Balance: if(${rawIf}) vs endif(${rawEndif}) ${rawIf === rawEndif ? '✔' : '✖ UNBALANCED'}`);
console.log(`  Balance: for(${rawFor}) vs endfor(${rawEndfor}) ${rawFor === rawEndfor ? '✔' : '✖ UNBALANCED'}`);
console.log(`  Result: ${allGood ? '✔ ALL PARSED' : '✖ SOME MISSED'}\n`);

process.exit(allGood ? 0 : 1);
