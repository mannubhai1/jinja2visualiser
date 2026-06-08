"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJinja = parseJinja;
exports.getContentPreview = getContentPreview;
function parseJinja(text) {
    const lines = text.split(/\r?\n/);
    const stack = [];
    const root = [];
    const ifRegex = /(?:#\s*)?\{%-?\s*if\s+(.*?)\s*-?%\}/;
    const elifRegex = /(?:#\s*)?\{%-?\s*elif\s+(.*?)\s*-?%\}/;
    const elseRegex = /(?:#\s*)?\{%-?\s*else\s*-?%\}/;
    const endifRegex = /(?:#\s*)?\{%-?\s*endif\s*-?%\}/;
    const forRegex = /(?:#\s*)?\{%-?\s*for\s+(.*?)\s*-?%\}/;
    const endforRegex = /(?:#\s*)?\{%-?\s*endfor\s*-?%\}/;
    // Fix #8: detect multi-line tags by checking for opening {%  without closing %}
    const openTagRegex = /(?:#\s*)?\{%-?\s*(if|elif|for)\s+(.*)/;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        // Fix #8: if line has an opening tag but no closing %}, join continuation lines
        if (openTagRegex.test(line) && !/%\}/.test(line)) {
            let joined = line;
            let j = i + 1;
            while (j < lines.length && !/%\}/.test(joined)) {
                joined += ' ' + lines[j].trim();
                j++;
            }
            line = joined;
        }
        const depth = stack.length;
        if (ifRegex.test(line)) {
            const condition = line.match(ifRegex)?.[1] ?? '';
            const node = {
                type: 'if',
                condition,
                children: [],
                line: i,
                endLine: i,
                depth,
                contentPreview: getContentPreview(lines, i)
            };
            if (stack.length) {
                stack[stack.length - 1].children.push(node);
            }
            else {
                root.push(node);
            }
            stack.push(node);
        }
        else if (elifRegex.test(line)) {
            if (stack.length) {
                stack[stack.length - 1].endLine = i - 1;
                stack.pop();
            }
            const condition = line.match(elifRegex)?.[1] ?? '';
            const node = {
                type: 'elif',
                condition,
                children: [],
                line: i,
                endLine: i,
                depth,
                contentPreview: getContentPreview(lines, i)
            };
            if (stack.length) {
                stack[stack.length - 1].children.push(node);
            }
            else {
                root.push(node);
            }
            stack.push(node);
        }
        else if (elseRegex.test(line)) {
            if (stack.length) {
                stack[stack.length - 1].endLine = i - 1;
                stack.pop();
            }
            const node = {
                type: 'else',
                children: [],
                line: i,
                endLine: i,
                depth,
                contentPreview: getContentPreview(lines, i)
            };
            if (stack.length) {
                stack[stack.length - 1].children.push(node);
            }
            else {
                root.push(node);
            }
            stack.push(node);
        }
        else if (endifRegex.test(line)) {
            if (stack.length) {
                stack[stack.length - 1].endLine = i;
                stack.pop();
            }
        }
        else if (forRegex.test(line)) {
            const condition = line.match(forRegex)?.[1] ?? '';
            const node = {
                type: 'for',
                condition,
                children: [],
                line: i,
                endLine: i,
                depth,
                contentPreview: getContentPreview(lines, i)
            };
            if (stack.length) {
                stack[stack.length - 1].children.push(node);
            }
            else {
                root.push(node);
            }
            stack.push(node);
        }
        else if (endforRegex.test(line)) {
            if (stack.length) {
                stack[stack.length - 1].endLine = i;
                stack.pop();
            }
        }
    }
    return root;
}
function getContentPreview(lines, startLine) {
    const previewLines = [];
    let count = 0;
    const maxLines = 3;
    // Regex to detect any Jinja block boundary (including commented ones)
    const blockBoundary = /(?:#\s*)?\{%-?\s*(if|elif|else|endif|for|endfor)\b/;
    for (let i = startLine + 1; i < lines.length && count < maxLines; i++) {
        const line = lines[i].trim();
        // Stop at block boundaries (both regular and commented)
        if (blockBoundary.test(line)) {
            break;
        }
        if (line && !line.startsWith('{#')) {
            previewLines.push(line);
            count++;
        }
    }
    return previewLines.join('\n') || 'No content';
}
//# sourceMappingURL=parser.js.map