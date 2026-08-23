import { describe, expect, it } from 'vitest';
import { cleanDiscoveryPlanContent, renderMarkdown } from './markdown';

describe('markdown utilities', () => {
  it('cleans discovery plan marker blocks from text', () => {
    const raw = '# Title\nSome content\n<task-hub-discovery-plan>\n{"epic":{"title":"Test"}}\n</task-hub-discovery-plan>';
    const cleaned = cleanDiscoveryPlanContent(raw);
    expect(cleaned).toBe('# Title\nSome content');
    expect(cleaned).not.toContain('<task-hub-discovery-plan>');
  });

  it('handles empty and whitespace markdown gracefully', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   ')).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });

  it('renders headings and bold text', () => {
    const md = '# Main Header\n## Sub Header\n### Section 3\n#### Section 4\n##### Section 5\n###### Section 6\n**Important text** and *italic text*';
    const html = renderMarkdown(md);
    expect(html).toContain('markdown-h1');
    expect(html).toContain('Main Header');
    expect(html).toContain('markdown-h2');
    expect(html).toContain('Sub Header');
    expect(html).toContain('markdown-h3');
    expect(html).toContain('Section 3');
    expect(html).toContain('markdown-h4');
    expect(html).toContain('markdown-h5');
    expect(html).toContain('markdown-h6');
    expect(html).toContain('<strong>Important text</strong>');
    expect(html).toContain('<em>italic text</em>');
  });

  it('renders code blocks with copy buttons and language label', () => {
    const md = '```typescript\nconst message: string = "hello world";\nconst sum = (a: number, b: number) => a + b;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('code-block-wrapper');
    expect(html).toContain('copy-code-btn');
    expect(html).toContain('TYPESCRIPT');
    expect(html).toContain('const message: string = &quot;hello world&quot;;');
    expect(html).toContain('data-code="');
  });

  it('renders GitHub alert callouts for all 5 alert levels', () => {
    const alertsMd = `
> [!NOTE]
> This is an important note.

> [!TIP]
> This is a performance tip.

> [!IMPORTANT]
> This is a required condition.

> [!WARNING]
> Warning regarding breaking changes.

> [!CAUTION]
> Risk of data loss if not careful.
`;
    const html = renderMarkdown(alertsMd);
    expect(html).toContain('markdown-alert-note');
    expect(html).toContain('Note');
    expect(html).toContain('This is an important note.');

    expect(html).toContain('markdown-alert-tip');
    expect(html).toContain('Tip');
    expect(html).toContain('This is a performance tip.');

    expect(html).toContain('markdown-alert-important');
    expect(html).toContain('Important');
    expect(html).toContain('This is a required condition.');

    expect(html).toContain('markdown-alert-warning');
    expect(html).toContain('Warning');
    expect(html).toContain('Warning regarding breaking changes.');

    expect(html).toContain('markdown-alert-caution');
    expect(html).toContain('Caution');
    expect(html).toContain('Risk of data loss if not careful.');
  });

  it('renders GFM task lists with checked and unchecked items', () => {
    const md = '- [ ] Pending task\n- [x] Completed task';
    const html = renderMarkdown(md);
    expect(html).toContain('markdown-task-item');
    expect(html).toContain('task-list-checkbox');
    expect(html).toContain('checked');
    expect(html).toContain('Pending task');
    expect(html).toContain('Completed task');
    expect(html).toContain('line-through');
  });

  it('renders diff code blocks with colored line highlights', () => {
    const md = '```diff\n--- a/file.txt\n+++ b/file.txt\n@@ -1,2 +1,2 @@\n-old line\n+new line\n unchanged\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('diff-block-wrapper');
    expect(html).toContain('diff-add');
    expect(html).toContain('diff-del');
    expect(html).toContain('diff-chunk');
    expect(html).toContain('diff-meta');
    expect(html).toContain('DIFF');
  });

  it('renders mermaid diagram blocks with container and toggle buttons', () => {
    const md = '```mermaid\ngraph TD;\n  A-->B;\n```';
    const html = renderMarkdown(md);
    expect(html).toContain('mermaid-block-wrapper');
    expect(html).toContain('mermaid-diagram-container');
    expect(html).toContain('view-mermaid-source-btn');
    expect(html).toContain('MERMAID DIAGRAM');
    expect(html).toContain('data-raw-mermaid=');
  });

  it('renders tables with aligned cells', () => {
    const md = '| Left | Center | Right |\n|:---|:---:|---:|\n| A | B | C |';
    const html = renderMarkdown(md);
    expect(html).toContain('table-wrapper');
    expect(html).toContain('markdown-table');
    expect(html).toContain('text-left');
    expect(html).toContain('text-center');
    expect(html).toContain('text-right');
    expect(html).toContain('Left');
    expect(html).toContain('Center');
    expect(html).toContain('Right');
  });

  it('renders blockquotes and standard lists', () => {
    const md = '> Standard quote\n\n- Bullet 1\n- Bullet 2\n\n1. Number 1\n2. Number 2';
    const html = renderMarkdown(md);
    expect(html).toContain('markdown-blockquote');
    expect(html).toContain('Standard quote');
    expect(html).toContain('markdown-ul');
    expect(html).toContain('Bullet 1');
    expect(html).toContain('markdown-ol');
    expect(html).toContain('Number 1');
  });

  it('renders safe links with target and rel attributes', () => {
    const md = '[Task Hub](https://example.com/docs "Task Hub Documentation")';
    const html = renderMarkdown(md);
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('title="Task Hub Documentation"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('markdown-link');
  });

  it('sanitizes malicious script and event tags while allowing safe tags', () => {
    const md = '<script>alert("xss")</script><img src="x" onerror="alert(1)">Hello <a href="javascript:alert(2)">click</a>';
    const html = renderMarkdown(md);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Hello');
  });

  it('supports stripping discovery plan marker on renderMarkdown option', () => {
    const md = '# Discovery\nPlan details\n<task-hub-discovery-plan>\n{"epic":{"title":"Secret"}}\n</task-hub-discovery-plan>';
    const html = renderMarkdown(md, { stripPlanMarker: true });
    expect(html).toContain('Discovery');
    expect(html).toContain('Plan details');
    expect(html).not.toContain('task-hub-discovery-plan');
  });
});
