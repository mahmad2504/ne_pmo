const ALLOWED = new Set(['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li']);
const DROP = new Set(['script', 'style']);

function escapeText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function serialize(node) {
  let html = '';
  let text = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const value = child.textContent || '';
      html += escapeText(value);
      text += value;
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const tag = child.tagName.toLowerCase();
    if (DROP.has(tag)) return;
    const inner = serialize(child);
    text += inner.text;
    if (!ALLOWED.has(tag)) {
      html += inner.html;
      return;
    }
    html += tag === 'br' ? '<br>' : `<${tag}>${inner.html}</${tag}>`;
  });
  return { html, text };
}

export function sanitizeReportHtml(value) {
  const source = String(value ?? '');
  if (!source.trim()) return '';
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const { html, text } = serialize(doc.body);
  if (!text.replace(/\u00a0/g, ' ').trim()) return '';
  if (!/<[a-z]/i.test(html)) return text.replace(/\u00a0/g, ' ').trim();
  return html.trim();
}

export function reportHasText(value) {
  return sanitizeReportHtml(value) !== '';
}
