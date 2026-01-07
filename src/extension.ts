import * as vscode from 'vscode';

let currentPanel: vscode.WebviewPanel | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'jinja2Visualizer.open',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const document = editor.document;
      const text = document.getText();
      const lines = text.split(/\r?\n/);
      const tree = parseJinja(text);

      // Reuse existing panel or create new one
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.Beside);
      } else {
        currentPanel = vscode.window.createWebviewPanel(
          'jinja2IfElseVisualizer',
          'Jinja2 Visualizer',
          vscode.ViewColumn.Beside,
          { enableScripts: true }
        );

        currentPanel.onDidDispose(() => {
          currentPanel = undefined;
        });
      }

      currentPanel.webview.html = getWebviewContent(tree, lines);

      // Handle messages from webview
      currentPanel.webview.onDidReceiveMessage(
        message => {
          if (message.command === 'navigateToLine') {
            const line = message.line;
            const lineText = document.lineAt(line).text;
            const startChar = lineText.search(/\S/);
            const endChar = lineText.length;
            
            const range = new vscode.Range(line, startChar, line, endChar);
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
            
            vscode.window.showTextDocument(document, {
              viewColumn: editor.viewColumn,
              preserveFocus: false
            });
          } else if (message.command === 'export') {
            handleExport(tree, message.format);
          }
        },
        undefined,
        context.subscriptions
      );

      // Auto-refresh on file changes
      const changeDisposable = vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document === document && currentPanel) {
          const updatedText = e.document.getText();
          const updatedLines = updatedText.split(/\r?\n/);
          const updatedTree = parseJinja(updatedText);
          currentPanel.webview.html = getWebviewContent(updatedTree, updatedLines);
        }
      });

      currentPanel.onDidDispose(() => {
        changeDisposable.dispose();
      });
    }
  );

  context.subscriptions.push(disposable);
}

function handleExport(tree: Node[], format: string) {
  if (format === 'json') {
    const cleanTree = cleanTreeForExport(tree);
    const json = JSON.stringify(cleanTree, null, 2);
    vscode.workspace.openTextDocument({ content: json, language: 'json' })
      .then(doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside));
  } else if (format === 'mermaid') {
    const mermaid = generateMermaid(tree);
    vscode.workspace.openTextDocument({ content: mermaid, language: 'markdown' })
      .then(doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside));
  }
}

function cleanTreeForExport(nodes: Node[]): any[] {
  return nodes.map(node => ({
    type: node.type,
    line: node.line + 1,
    condition: node.condition,
    children: cleanTreeForExport(node.children)
  }));
}

function generateMermaid(nodes: Node[], prefix = ''): string {
  if (!nodes.length) return '';
  
  let result = '';
  if (!prefix) {
    result = 'graph TD\n';
  }
  
  nodes.forEach((node, idx) => {
    const id = prefix ? `${prefix}_${idx}` : `node${idx}`;
    const label = node.type === 'else' ? 'else' : 
                  node.type === 'for' ? `for ${node.condition}` :
                  `${node.type} ${node.condition}`;
    
    const shape = node.type === 'for' ? `${id}[/${label}/]` : `${id}{${label}}`;
    result += `  ${shape}\n`;
    
    if (node.children.length > 0) {
      node.children.forEach((child, childIdx) => {
        const childId = `${id}_${childIdx}`;
        result += `  ${id} --> ${childId}\n`;
      });
      result += generateMermaid(node.children, id);
    }
  });
  
  return result;
}

// ------------------------------
// Jinja2 parsing (simple & safe)
// ------------------------------
interface Node {
  type: 'if' | 'elif' | 'else' | 'for';
  condition?: string;
  children: Node[];
  line: number;
  endLine?: number;
  contentPreview?: string;
  depth: number;
}

function parseJinja(text: string): Node[] {
  const lines = text.split(/\r?\n/);
  const stack: Array<Node & { endLine: number }> = [];
  const root: Node[] = [];

  const ifRegex = /\{%-?\s*if\s+(.*?)\s*-?%\}/;
  const elifRegex = /\{%-?\s*elif\s+(.*?)\s*-?%\}/;
  const elseRegex = /\{%-?\s*else\s*-?%\}/;
  const endifRegex = /\{%-?\s*endif\s*-?%\}/;
  const forRegex = /\{%-?\s*for\s+(.*?)\s*-?%\}/;
  const endforRegex = /\{%-?\s*endfor\s*-?%\}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const depth = stack.length;
    
    if (ifRegex.test(line)) {
      const condition = line.match(ifRegex)?.[1] ?? '';
      const node: Node & { endLine: number } = { 
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
      } else {
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
      const node: Node & { endLine: number } = { 
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
      stack.push(node);
    }
    else if (elseRegex.test(line)) {
      if (stack.length) {
        stack[stack.length - 1].endLine = i - 1;
        stack.pop();
      }
      const node: Node & { endLine: number } = { 
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
      stack.push(node);
    }
    else if (endifRegex.test(line)) {
      if (stack.length) {
        stack[stack.length - 1].endLine = i - 1;
        stack.pop();
      }
    }
    else if (forRegex.test(line)) {
      const condition = line.match(forRegex)?.[1] ?? '';
      const node: Node & { endLine: number } = { 
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
      } else {
        root.push(node);
      }
      stack.push(node);
    }
    else if (endforRegex.test(line)) {
      if (stack.length) {
        stack[stack.length - 1].endLine = i - 1;
        stack.pop();
      }
    }
  }

  return root;
}

function getContentPreview(lines: string[], startLine: number): string {
  const previewLines: string[] = [];
  let count = 0;
  const maxLines = 3;
  
  for (let i = startLine + 1; i < lines.length && count < maxLines; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('{%') && !line.startsWith('{#')) {
      previewLines.push(lines[i].trim());
      count++;
    }
  }
  
  return previewLines.join('\n') || 'No content';
}

function highlightCondition(condition: string): string {
  // Don't escape - apply highlighting directly to raw condition text
  return condition
    .replace(/\b(and|or|not|in|is|true|false|none|defined)\b/gi, '<span class="keyword">$1</span>')
    .replace(/(['"])(.*?)\1/g, '<span class="string">$1$2$1</span>')
    .replace(/([=!<>]+)/g, '<span class="operator">$1</span>');
}

// ------------------------------
// Webview HTML
// ------------------------------
function getWebviewContent(tree: Node[], lines: string[]): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <style>
    body { 
      font-family: monospace; 
      padding: 12px; 
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .export-buttons button {
      margin-left: 8px;
      padding: 4px 8px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
    }
    .export-buttons button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    ul { 
      list-style: none; 
      padding-left: 0; 
      margin: 4px 0;
    }
    li {
      position: relative;
      padding-left: 24px;
    }
    .depth-line {
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      opacity: 0.3;
    }
    .depth-0 { background-color: #4fc3f7; }
    .depth-1 { background-color: #ffb74d; }
    .depth-2 { background-color: #e57373; }
    .depth-3 { background-color: #81c784; }
    .depth-4 { background-color: #ba68c8; }
    .node-container {
      display: flex;
      align-items: center;
      margin: 2px 0;
      position: relative;
    }
    .expand-icon {
      cursor: pointer;
      user-select: none;
      margin-right: 6px;
      font-size: 14px;
      width: 16px;
      display: inline-block;
      color: var(--vscode-foreground);
    }
    .expand-icon:hover {
      opacity: 0.7;
    }

    .node-label {
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 3px;
      transition: background-color 0.2s;
      position: relative;
    }
    .node-label:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .if { color: #4fc3f7; }
    .elif { color: #ffb74d; }
    .else { color: #e57373; }
    .for { color: #81c784; }
    .children {
      overflow: hidden;
      transition: max-height 0.3s ease;
    }
    .collapsed {
      max-height: 0;
    }
    .expanded {
      max-height: 10000px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h3>Jinja2 Visualizer</h3>
    <div class="export-buttons">
      <button onclick="exportAs('mermaid')">Export Mermaid</button>
    </div>
  </div>
  ${renderTree(tree)}
  
  <script>
    const vscode = acquireVsCodeApi();
    
    function exportAs(format) {
      vscode.postMessage({
        command: 'export',
        format: format
      });
    }
    
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      // Handle expand/collapse
      if (target.classList.contains('expand-icon')) {
        const container = target.closest('li');
        const children = container.querySelector(':scope > .children');
        if (children) {
          if (children.classList.contains('collapsed')) {
            children.classList.remove('collapsed');
            children.classList.add('expanded');
            target.textContent = '▼';
          } else {
            children.classList.remove('expanded');
            children.classList.add('collapsed');
            target.textContent = '▶';
          }
        }
      }
      
      // Handle navigation to line
      if (target.classList.contains('node-label')) {
        const line = parseInt(target.dataset.line);
        if (!isNaN(line)) {
          vscode.postMessage({
            command: 'navigateToLine',
            line: line
          });
        }
      }
    });
  </script>
</body>
</html>`;
}

function renderTree(nodes: Node[]): string {
  if (!nodes.length) return '';

  return `<ul>${nodes
    .map(n => {
      const depthClass = `depth-${n.depth % 5}`;
      
      let label: string;
      if (n.type === 'else') {
        label = 'ELSE';
      } else if (n.type === 'for') {
        label = `FOR ${escapeHtml(n.condition || '')}`;
      } else {
        label = `${n.type.toUpperCase()} ${escapeHtml(n.condition || '')}`;
      }
      
      const hasChildren = n.children.length > 0;
      const expandIcon = hasChildren ? '<span class="expand-icon">▼</span>' : '<span class="expand-icon" style="visibility:hidden">▶</span>';
      const childrenHtml = hasChildren ? `<div class="children expanded">${renderTree(n.children)}</div>` : '';

      return `<li>
        <div class="depth-line ${depthClass}"></div>
        <div class="node-container">
          ${expandIcon}
          <span class="node-label ${n.type}" data-line="${n.line}">${label}</span>
        </div>
        ${childrenHtml}
      </li>`;
    })
    .join('')}</ul>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function deactivate() {}
