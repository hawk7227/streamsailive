import { NextRequest, NextResponse } from "next/server";

function safeTarget(raw: string | null) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function stripClientRuntime(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<link\b[^>]*rel=["']?preload["']?[^>]*as=["']?script["']?[^>]*>/gi, "")
    .replace(/<link\b[^>]*as=["']?script["']?[^>]*rel=["']?preload["']?[^>]*>/gi, "")
    .replace(/\snonce=(['"])[\s\S]*?\1/gi, "");
}

function injectEditableBridge(html: string, target: URL) {
  const baseTag = `<base href="${target.origin}/">`;
  const script = `
<script>
(() => {
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','PATH','META','LINK','HEAD','TITLE']);
  function textOf(el) {
    return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
  }
  function isEditableTextElement(el) {
    if (!el || SKIP.has(el.tagName)) return false;
    const text = textOf(el);
    if (!text || text.length < 2 || text.length > 180) return false;
    if (/^(Home|FAQ|How It Works|About Your Provider)$/i.test(text) && el.tagName === 'DIV') return false;
    const children = Array.from(el.children || []).filter(child => !SKIP.has(child.tagName));
    const childText = children.map(textOf).filter(Boolean).join(' ');
    if (children.length && childText && childText.length >= text.length * 0.72) return false;
    return /[A-Za-z0-9]/.test(text);
  }
  function cssPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 8) {
      let part = node.tagName.toLowerCase();
      if (node.id) { part += '#' + node.id; parts.unshift(part); break; }
      const parent = node.parentElement;
      if (parent) {
        const same = Array.from(parent.children).filter(child => child.tagName === node.tagName);
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }
  function post(type, payload) {
    window.parent && window.parent.postMessage({ type, payload, source: 'streams-editable-preview' }, window.location.origin);
  }
  function markEditable() {
    const nodes = Array.from(document.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,b,strong,em,a,button,label,li,small'));
    nodes.forEach((el, index) => {
      if (!isEditableTextElement(el)) return;
      el.dataset.streamsEditable = 'true';
      el.dataset.streamsEditableId = 'editable-' + index;
      el.dataset.streamsOriginalText = textOf(el);
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        el.focus();
        document.querySelectorAll('[data-streams-selected="true"]').forEach(node => node.removeAttribute('data-streams-selected'));
        el.dataset.streamsSelected = 'true';
        post('streams-editable-select', { id: el.dataset.streamsEditableId, selector: cssPath(el), text: textOf(el), original: el.dataset.streamsOriginalText || '' });
      });
      el.addEventListener('input', () => {
        post('streams-editable-input', { id: el.dataset.streamsEditableId, selector: cssPath(el), text: textOf(el), original: el.dataset.streamsOriginalText || '' });
      });
      el.addEventListener('blur', () => {
        post('streams-editable-commit', { id: el.dataset.streamsEditableId, selector: cssPath(el), text: textOf(el), original: el.dataset.streamsOriginalText || '' });
      });
    });
  }
  const style = document.createElement('style');
  style.textContent = '[data-streams-editable="true"]{outline:1px solid transparent;outline-offset:2px;cursor:text}[data-streams-editable="true"]:hover,[data-streams-selected="true"]{outline:2px solid #f97316!important;box-shadow:0 0 0 1px rgba(249,115,22,.45),0 0 18px rgba(249,115,22,.24)!important}[data-streams-editable="true"]:focus{outline:2px solid #f97316!important;background:rgba(249,115,22,.08)!important}';
  document.head.appendChild(style);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markEditable); else markEditable();
})();
</script>`;
  let next = stripClientRuntime(html);
  if (!/<base\s/i.test(next)) next = next.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  if (/<\/body>/i.test(next)) return next.replace(/<\/body>/i, `${script}</body>`);
  return `${next}${script}`;
}

export async function GET(request: NextRequest) {
  const target = safeTarget(request.nextUrl.searchParams.get("url"));
  if (!target) return new NextResponse("Missing or invalid url", { status: 400 });

  const response = await fetch(target.toString(), {
    cache: "no-store",
    headers: { "user-agent": "StreamsAI Editable Preview" },
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    const body = await response.arrayBuffer();
    return new NextResponse(body, { status: response.status, headers: { "content-type": contentType || "application/octet-stream" } });
  }

  const html = await response.text();
  return new NextResponse(injectEditableBridge(html, target), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
