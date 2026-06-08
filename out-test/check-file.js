"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * CLI tool: verify the parser didn't miss any Jinja2 blocks in a file.
 * Compares raw regex line count vs parser output count.
 *
 * Usage: node out-test/check-file.js <path-to-file>
 */
const fs = __importStar(require("node:fs"));
const parser_1 = require("./parser");
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
const missed = [];
for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(tagRegex);
    if (match) {
        switch (match[1]) {
            case 'if':
                rawIf++;
                break;
            case 'elif':
                rawElif++;
                break;
            case 'else':
                rawElse++;
                break;
            case 'endif':
                rawEndif++;
                break;
            case 'for':
                rawFor++;
                break;
            case 'endfor':
                rawEndfor++;
                break;
        }
    }
}
// Count what the parser actually captured
const tree = (0, parser_1.parseJinja)(text);
function countNodes(nodes) {
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
    { tag: 'endif', raw: rawEndif, parsed: null },
    { tag: 'endfor', raw: rawEndfor, parsed: null },
];
let allGood = true;
for (const row of rows) {
    const parsedStr = row.parsed !== null ? String(row.parsed) : '–';
    const match = row.parsed === null ? '–' :
        row.raw === row.parsed ? '✔' : '✖ MISMATCH';
    if (match === '✖ MISMATCH') {
        allGood = false;
    }
    console.log(`  ${row.tag.padEnd(10)} ${String(row.raw).padStart(5)}         ${parsedStr.padStart(5)}   ${match}`);
}
console.log(`  ─────────────────────────────────────────`);
console.log(`  Total conditions: ${rawIf + rawElif + rawElse + rawFor} (if:${rawIf} elif:${rawElif} else:${rawElse} for:${rawFor})`);
console.log(`  Balance: if(${rawIf}) vs endif(${rawEndif}) ${rawIf === rawEndif ? '✔' : '✖ UNBALANCED'}`);
console.log(`  Balance: for(${rawFor}) vs endfor(${rawEndfor}) ${rawFor === rawEndfor ? '✔' : '✖ UNBALANCED'}`);
console.log(`  Result: ${allGood ? '✔ ALL PARSED' : '✖ SOME MISSED'}\n`);
process.exit(allGood ? 0 : 1);
//# sourceMappingURL=check-file.js.map