import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { parseJinja, getContentPreview } from './parser';

describe('parseJinja', () => {

  it('parses a simple if/endif block', () => {
    const text = `{% if x %}\nhello\n{% endif %}`;
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'if');
    assert.strictEqual(tree[0].condition, 'x');
    assert.strictEqual(tree[0].line, 0);
    assert.strictEqual(tree[0].endLine, 2);
  });

  it('parses if/elif/else/endif', () => {
    const text = [
      '{% if a %}',
      '  val_a',
      '{% elif b %}',
      '  val_b',
      '{% else %}',
      '  val_c',
      '{% endif %}'
    ].join('\n');
    const tree = parseJinja(text);
    // if, elif, else are siblings at the same level
    assert.strictEqual(tree.length, 3);
    assert.strictEqual(tree[0].type, 'if');
    assert.strictEqual(tree[0].condition, 'a');
    assert.strictEqual(tree[1].type, 'elif');
    assert.strictEqual(tree[1].condition, 'b');
    assert.strictEqual(tree[2].type, 'else');
  });

  it('parses nested if blocks', () => {
    const text = [
      '{% if outer %}',
      '  {% if inner %}',
      '    content',
      '  {% endif %}',
      '{% endif %}'
    ].join('\n');
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'if');
    assert.strictEqual(tree[0].children.length, 1);
    assert.strictEqual(tree[0].children[0].type, 'if');
    assert.strictEqual(tree[0].children[0].condition, 'inner');
  });

  it('parses for loops', () => {
    const text = [
      '{% for item in items %}',
      '  {{ item }}',
      '{% endfor %}'
    ].join('\n');
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'for');
    assert.strictEqual(tree[0].condition, 'item in items');
  });

  // Fix #8: Multi-line conditions
  it('handles multi-line conditions', () => {
    const text = [
      '{% if very_long_condition',
      '   and another_condition %}',
      '  content',
      '{% endif %}'
    ].join('\n');
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'if');
    assert.ok(tree[0].condition!.includes('very_long_condition'));
    assert.ok(tree[0].condition!.includes('another_condition'));
  });

  it('handles multi-line for conditions', () => {
    const text = [
      '{% for item',
      '   in collection %}',
      '  {{ item }}',
      '{% endfor %}'
    ].join('\n');
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'for');
    assert.ok(tree[0].condition!.includes('item'));
    assert.ok(tree[0].condition!.includes('collection'));
  });

  // Commented Jinja2 syntax (YAML style)
  it('parses commented Jinja2 blocks (# {%- if ... %})', () => {
    const text = [
      '# {%- if METABASE %}',
      '  metabase: true',
      '# {%- endif %}'
    ].join('\n');
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'if');
    assert.strictEqual(tree[0].condition, 'METABASE');
  });

  it('parses nested commented blocks', () => {
    const text = [
      '# {%- if PAYCE %}',
      '  sbpe: true',
      '# {%- if RETAIL or IP %}',
      '    pom: true',
      '# {%- endif %}',
      '# {%- endif %}'
    ].join('\n');
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    // Inner if is a child of the outer if
    assert.strictEqual(tree[0].children.length, 1);
    assert.strictEqual(tree[0].children[0].condition, 'RETAIL or IP');
  });

  it('handles whitespace-only trim markers {%- and -%}', () => {
    const text = `{%- if x -%}\nhello\n{%- endif -%}`;
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].condition, 'x');
  });

  it('returns empty array for no Jinja syntax', () => {
    const text = 'just some plain text\nno jinja here';
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 0);
  });

  it('handles unmatched endif gracefully (no crash)', () => {
    const text = '{% endif %}';
    const tree = parseJinja(text);
    // Should not crash, just returns empty (nothing on the stack to pop)
    assert.strictEqual(tree.length, 0);
  });

  it('handles unclosed if gracefully (no crash)', () => {
    const text = '{% if x %}\n  content';
    const tree = parseJinja(text);
    assert.strictEqual(tree.length, 1);
    assert.strictEqual(tree[0].type, 'if');
    // endLine stays at the opening line since there's no endif
    assert.strictEqual(tree[0].endLine, 0);
  });
});

describe('getContentPreview', () => {

  // Fix #10: content preview stops at block boundaries
  it('stops at the next block boundary', () => {
    const lines = [
      '{% if x %}',
      '  content line 1',
      '  content line 2',
      '{% elif y %}',
      '  other content'
    ];
    const preview = getContentPreview(lines, 0);
    assert.ok(preview.includes('content line 1'));
    assert.ok(preview.includes('content line 2'));
    assert.ok(!preview.includes('other content'));
  });

  it('stops at commented block boundaries (# {%- if ...)', () => {
    const lines = [
      '# {%- if PAYCE %}',
      '  sbpe: true',
      '# {%- if RETAIL %}',
      '  pom: true'
    ];
    const preview = getContentPreview(lines, 0);
    assert.ok(preview.includes('sbpe: true'));
    assert.ok(!preview.includes('pom: true'));
  });

  it('returns "No content" for empty blocks', () => {
    const lines = [
      '{% if x %}',
      '{% endif %}'
    ];
    const preview = getContentPreview(lines, 0);
    assert.strictEqual(preview, 'No content');
  });

  it('limits to 3 lines max', () => {
    const lines = [
      '{% if x %}',
      '  line1',
      '  line2',
      '  line3',
      '  line4',
      '  line5',
      '{% endif %}'
    ];
    const preview = getContentPreview(lines, 0);
    const previewLines = preview.split('\n');
    assert.strictEqual(previewLines.length, 3);
  });

  it('skips Jinja comment lines ({#)', () => {
    const lines = [
      '{% if x %}',
      '{# this is a comment #}',
      '  actual content',
      '{% endif %}'
    ];
    const preview = getContentPreview(lines, 0);
    assert.ok(!preview.includes('this is a comment'));
    assert.ok(preview.includes('actual content'));
  });
});
