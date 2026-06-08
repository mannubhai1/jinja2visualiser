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
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert"));
const parser_1 = require("./parser");
(0, node_test_1.describe)('parseJinja', () => {
    (0, node_test_1.it)('parses a simple if/endif block', () => {
        const text = `{% if x %}\nhello\n{% endif %}`;
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'if');
        assert.strictEqual(tree[0].condition, 'x');
        assert.strictEqual(tree[0].line, 0);
        assert.strictEqual(tree[0].endLine, 2);
    });
    (0, node_test_1.it)('parses if/elif/else/endif', () => {
        const text = [
            '{% if a %}',
            '  val_a',
            '{% elif b %}',
            '  val_b',
            '{% else %}',
            '  val_c',
            '{% endif %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        // if, elif, else are siblings at the same level
        assert.strictEqual(tree.length, 3);
        assert.strictEqual(tree[0].type, 'if');
        assert.strictEqual(tree[0].condition, 'a');
        assert.strictEqual(tree[1].type, 'elif');
        assert.strictEqual(tree[1].condition, 'b');
        assert.strictEqual(tree[2].type, 'else');
    });
    (0, node_test_1.it)('parses nested if blocks', () => {
        const text = [
            '{% if outer %}',
            '  {% if inner %}',
            '    content',
            '  {% endif %}',
            '{% endif %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'if');
        assert.strictEqual(tree[0].children.length, 1);
        assert.strictEqual(tree[0].children[0].type, 'if');
        assert.strictEqual(tree[0].children[0].condition, 'inner');
    });
    (0, node_test_1.it)('parses for loops', () => {
        const text = [
            '{% for item in items %}',
            '  {{ item }}',
            '{% endfor %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'for');
        assert.strictEqual(tree[0].condition, 'item in items');
    });
    // Fix #8: Multi-line conditions
    (0, node_test_1.it)('handles multi-line conditions', () => {
        const text = [
            '{% if very_long_condition',
            '   and another_condition %}',
            '  content',
            '{% endif %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'if');
        assert.ok(tree[0].condition.includes('very_long_condition'));
        assert.ok(tree[0].condition.includes('another_condition'));
    });
    (0, node_test_1.it)('handles multi-line for conditions', () => {
        const text = [
            '{% for item',
            '   in collection %}',
            '  {{ item }}',
            '{% endfor %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'for');
        assert.ok(tree[0].condition.includes('item'));
        assert.ok(tree[0].condition.includes('collection'));
    });
    // Commented Jinja2 syntax (YAML style)
    (0, node_test_1.it)('parses commented Jinja2 blocks (# {%- if ... %})', () => {
        const text = [
            '# {%- if METABASE %}',
            '  metabase: true',
            '# {%- endif %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'if');
        assert.strictEqual(tree[0].condition, 'METABASE');
    });
    (0, node_test_1.it)('parses nested commented blocks', () => {
        const text = [
            '# {%- if PAYCE %}',
            '  sbpe: true',
            '# {%- if RETAIL or IP %}',
            '    pom: true',
            '# {%- endif %}',
            '# {%- endif %}'
        ].join('\n');
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        // Inner if is a child of the outer if
        assert.strictEqual(tree[0].children.length, 1);
        assert.strictEqual(tree[0].children[0].condition, 'RETAIL or IP');
    });
    (0, node_test_1.it)('handles whitespace-only trim markers {%- and -%}', () => {
        const text = `{%- if x -%}\nhello\n{%- endif -%}`;
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].condition, 'x');
    });
    (0, node_test_1.it)('returns empty array for no Jinja syntax', () => {
        const text = 'just some plain text\nno jinja here';
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 0);
    });
    (0, node_test_1.it)('handles unmatched endif gracefully (no crash)', () => {
        const text = '{% endif %}';
        const tree = (0, parser_1.parseJinja)(text);
        // Should not crash, just returns empty (nothing on the stack to pop)
        assert.strictEqual(tree.length, 0);
    });
    (0, node_test_1.it)('handles unclosed if gracefully (no crash)', () => {
        const text = '{% if x %}\n  content';
        const tree = (0, parser_1.parseJinja)(text);
        assert.strictEqual(tree.length, 1);
        assert.strictEqual(tree[0].type, 'if');
        // endLine stays at the opening line since there's no endif
        assert.strictEqual(tree[0].endLine, 0);
    });
});
(0, node_test_1.describe)('getContentPreview', () => {
    // Fix #10: content preview stops at block boundaries
    (0, node_test_1.it)('stops at the next block boundary', () => {
        const lines = [
            '{% if x %}',
            '  content line 1',
            '  content line 2',
            '{% elif y %}',
            '  other content'
        ];
        const preview = (0, parser_1.getContentPreview)(lines, 0);
        assert.ok(preview.includes('content line 1'));
        assert.ok(preview.includes('content line 2'));
        assert.ok(!preview.includes('other content'));
    });
    (0, node_test_1.it)('stops at commented block boundaries (# {%- if ...)', () => {
        const lines = [
            '# {%- if PAYCE %}',
            '  sbpe: true',
            '# {%- if RETAIL %}',
            '  pom: true'
        ];
        const preview = (0, parser_1.getContentPreview)(lines, 0);
        assert.ok(preview.includes('sbpe: true'));
        assert.ok(!preview.includes('pom: true'));
    });
    (0, node_test_1.it)('returns "No content" for empty blocks', () => {
        const lines = [
            '{% if x %}',
            '{% endif %}'
        ];
        const preview = (0, parser_1.getContentPreview)(lines, 0);
        assert.strictEqual(preview, 'No content');
    });
    (0, node_test_1.it)('limits to 3 lines max', () => {
        const lines = [
            '{% if x %}',
            '  line1',
            '  line2',
            '  line3',
            '  line4',
            '  line5',
            '{% endif %}'
        ];
        const preview = (0, parser_1.getContentPreview)(lines, 0);
        const previewLines = preview.split('\n');
        assert.strictEqual(previewLines.length, 3);
    });
    (0, node_test_1.it)('skips Jinja comment lines ({#)', () => {
        const lines = [
            '{% if x %}',
            '{# this is a comment #}',
            '  actual content',
            '{% endif %}'
        ];
        const preview = (0, parser_1.getContentPreview)(lines, 0);
        assert.ok(!preview.includes('this is a comment'));
        assert.ok(preview.includes('actual content'));
    });
});
//# sourceMappingURL=parser.test.js.map