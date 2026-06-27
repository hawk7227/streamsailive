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
  let selected = null;
  let dragState = null;
  let fileInput = null;
  let toolbar = null;

  function textOf(el) {
    return (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
  }
  function absoluteSrc(value) {
    try { return new URL(value || '', document.baseURI).toString(); } catch { return value || ''; }
  }
  function visibleRect(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 8 && rect.height > 8 ? rect : null;
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
  function isEditableImageElement(el) {
    if (!el) return false;
    if (el.tagName === 'IMG') return true;
    const style = getComputedStyle(el);
    const bg = style.backgroundImage || '';
    return bg && bg !== 'none' && /url\\(/.test(bg);
  }
  function isEditableContainerElement(el) {
    if (!el || SKIP.has(el.tagName)) return false;
    if (el.dataset.streamsEditableKind) return false;
    const rect = visibleRect(el);
    if (!rect || rect.width < 120 || rect.height < 80) return false;
    const style = getComputedStyle(el);
    const hasFrame = style.borderWidth !== '0px' || style.borderColor !== 'rgba(0, 0, 0, 0)' || Number.parseFloat(style.borderRadius || '0') > 0;
    const hasBackground = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || (style.backgroundImage && style.backgroundImage !== 'none');
    const hasMedia = Boolean(el.querySelector('img,[style*="background-image"]'));
    const looksLikeCard = /card|panel|visit|hero|section|grid|col|frame|box/i.test(el.className || '') || ['ARTICLE','SECTION','MAIN','HEADER','FOOTER'].includes(el.tagName);
    return Boolean((hasFrame || hasBackground || hasMedia || looksLikeCard) && textOf(el).length > 2);
  }
  function bgUrl(el) {
    const match = (getComputedStyle(el).backgroundImage || '').match(/url\\(["']?([^"')]+)["']?\\)/);
    return match ? match[1] : '';
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
  function payloadFor(el) {
    const kind = el.dataset.streamsEditableKind || (el.tagName === 'IMG' ? 'image' : 'text');
    const style = window.getComputedStyle(el);
    return {
      id: el.dataset.streamsEditableId,
      kind,
      selector: cssPath(el),
      text: kind === 'text' ? textOf(el) : textOf(el).slice(0, 160),
      original: el.dataset.streamsOriginalText || el.dataset.streamsOriginalSrc || '',
      src: kind === 'image' ? (el.tagName === 'IMG' ? absoluteSrc(el.getAttribute('src')) : absoluteSrc(bgUrl(el))) : '',
      inlineStyle: el.getAttribute('style') || '',
      width: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.getBoundingClientRect().height),
      transform: style.transform === 'none' ? '' : style.transform
    };
  }
  function createToolbar() {
    if (toolbar) return toolbar;
    toolbar = document.createElement('div');
    toolbar.className = 'streams-edit-toolbar';
    toolbar.innerHTML = '<button data-act="replace">Replace image</button><button data-act="remove">Remove</button><button data-act="rotate">Rotate</button><button data-act="front">Front</button><button data-act="done">Done</button>';
    document.body.appendChild(toolbar);
    toolbar.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button || !selected) return;
      const act = button.dataset.act;
      if (act === 'replace') replaceImage(selected);
      if (act === 'remove') removeSelected(selected);
      if (act === 'rotate') rotateSelected(selected);
      if (act === 'front') { selected.style.zIndex = String((Number(selected.style.zIndex) || 10) + 1); post('streams-editable-style', payloadFor(selected)); }
      if (act === 'done') deselect();
    });
    return toolbar;
  }
  function moveToolbar(el) {
    const bar = createToolbar();
    const rect = el.getBoundingClientRect();
    bar.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
    bar.style.top = Math.max(8, rect.top + window.scrollY - 42) + 'px';
    bar.style.display = 'flex';
    const replace = bar.querySelector('[data-act="replace"]');
    if (replace) replace.style.display = el.dataset.streamsEditableKind === 'image' ? 'inline-flex' : 'none';
  }
  function deselect() {
    if (selected) selected.removeAttribute('data-streams-selected');
    selected = null;
    if (toolbar) toolbar.style.display = 'none';
  }
  function selectElement(el) {
    if (selected) selected.removeAttribute('data-streams-selected');
    selected = el;
    el.dataset.streamsSelected = 'true';
    moveToolbar(el);
    post('streams-editable-select', payloadFor(el));
  }
  function removeSelected(el) {
    const payload = payloadFor(el);
    el.style.display = 'none';
    post('streams-editable-remove', payload);
    deselect();
  }
  function rotateSelected(el) {
    const current = Number(el.dataset.streamsRotate || '0') + 15;
    el.dataset.streamsRotate = String(current);
    const old = el.style.transform || '';
    el.style.transform = old.replace(/rotate\\([^)]*\\)/g, '').trim() + ' rotate(' + current + 'deg)';
    post('streams-editable-style', payloadFor(el));
  }
  function replaceImage(el) {
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }
    fileInput.onchange = () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file || !selected) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        const old = payloadFor(selected);
        if (selected.tagName === 'IMG') selected.src = dataUrl; else selected.style.backgroundImage = 'url(' + dataUrl + ')';
        post('streams-editable-image-replace', { ...old, replacementDataUrl: dataUrl, replacementName: file.name });
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  }
  function makeResizableAndMovable(el) {
    if (el.dataset.streamsTransformReady) return;
    el.dataset.streamsTransformReady = 'true';
    el.addEventListener('dblclick', event => {
      event.preventDefault();
      event.stopPropagation();
      selectElement(el);
      el.dataset.streamsTransformMode = 'true';
      el.style.resize = 'both';
      el.style.overflow = el.style.overflow || 'hidden';
      el.style.position = getComputedStyle(el).position === 'static' ? 'relative' : getComputedStyle(el).position;
      el.style.cursor = 'move';
      post('streams-editable-transform-start', payloadFor(el));
    });
    el.addEventListener('pointerdown', event => {
      if (el.dataset.streamsTransformMode !== 'true') return;
      if (event.target && event.target.closest && event.target.closest('.streams-edit-toolbar')) return;
      dragState = { el, x: event.clientX, y: event.clientY, left: parseFloat(el.style.left || '0') || 0, top: parseFloat(el.style.top || '0') || 0 };
      el.setPointerCapture && el.setPointerCapture(event.pointerId);
    });
  }
  document.addEventListener('pointermove', event => {
    if (!dragState) return;
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    dragState.el.style.left = dragState.left + dx + 'px';
    dragState.el.style.top = dragState.top + dy + 'px';
    moveToolbar(dragState.el);
  });
  document.addEventListener('pointerup', () => {
    if (!dragState) return;
    post('streams-editable-style', payloadFor(dragState.el));
    dragState = null;
  });
  function markEditable() {
    const textNodes = Array.from(document.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,b,strong,em,a,button,label,li,small'));
    textNodes.forEach((el, index) => {
      if (!isEditableTextElement(el)) return;
      el.dataset.streamsEditable = 'true';
      el.dataset.streamsEditableKind = 'text';
      el.dataset.streamsEditableId = 'text-' + index;
      el.dataset.streamsOriginalText = textOf(el);
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      makeResizableAndMovable(el);
      el.addEventListener('click', event => { event.stopPropagation(); el.focus(); selectElement(el); });
      el.addEventListener('input', () => post('streams-editable-input', payloadFor(el)));
      el.addEventListener('blur', () => post('streams-editable-commit', payloadFor(el)));
    });
    const imageNodes = Array.from(document.body.querySelectorAll('img, picture img, [style*="background-image"]'));
    imageNodes.forEach((el, index) => {
      if (!isEditableImageElement(el)) return;
      el.dataset.streamsEditable = 'true';
      el.dataset.streamsEditableKind = 'image';
      el.dataset.streamsEditableId = 'image-' + index;
      el.dataset.streamsOriginalSrc = el.tagName === 'IMG' ? absoluteSrc(el.getAttribute('src')) : absoluteSrc(bgUrl(el));
      makeResizableAndMovable(el);
      el.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); selectElement(el); });
    });
    const containerNodes = Array.from(document.body.querySelectorAll('main,section,article,header,footer,div'));
    containerNodes.forEach((el, index) => {
      if (!isEditableContainerElement(el)) return;
      el.dataset.streamsEditable = 'true';
      el.dataset.streamsEditableKind = 'container';
      el.dataset.streamsEditableId = 'container-' + index;
      el.dataset.streamsOriginalText = textOf(el).slice(0, 180);
      makeResizableAndMovable(el);
      el.addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation(); selectElement(el); });
    });
  }
  const style = document.createElement('style');
  style.textContent = '[data-streams-editable="true"]{outline:1px solid transparent;outline-offset:2px}[data-streams-editable-kind="text"]{cursor:text}[data-streams-editable-kind="image"],[data-streams-editable-kind="container"]{cursor:pointer}[data-streams-editable="true"]:hover,[data-streams-selected="true"]{outline:2px solid #f97316!important;box-shadow:0 0 0 1px rgba(249,115,22,.45),0 0 18px rgba(249,115,22,.24)!important}[data-streams-editable="true"]:focus{outline:2px solid #f97316!important;background:rgba(249,115,22,.08)!important}.streams-edit-toolbar{position:absolute;z-index:2147483647;display:none;gap:6px;align-items:center;padding:6px;border:1px solid rgba(249,115,22,.7);border-radius:10px;background:rgba(2,6,23,.96);box-shadow:0 12px 32px rgba(0,0,0,.35)}.streams-edit-toolbar button{height:28px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#7c3aed;color:#fff;font:700 11px system-ui;padding:0 8px;cursor:pointer}';
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
