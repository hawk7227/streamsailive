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
  const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','PATH','META','LINK','HEAD','TITLE','BR']);
  const STRUCTURAL_TAGS = new Set(['MAIN','SECTION','ARTICLE','ASIDE','NAV','HEADER','FOOTER','FORM','UL','OL','LI']);
  let selected = null;
  let dragState = null;
  let fileInput = null;
  let toolbar = null;
  let alertBox = null;

  function snapshotScroll() {
    const root = document.scrollingElement || document.documentElement;
    const items = [{ el: root, top: root ? root.scrollTop : window.scrollY, left: root ? root.scrollLeft : window.scrollX }];
    document.querySelectorAll('*').forEach(el => { if ((el.scrollTop || el.scrollLeft) && el !== root) items.push({ el, top: el.scrollTop, left: el.scrollLeft }); });
    return items;
  }
  function restoreScroll(items) { items.forEach(item => { try { item.el.scrollTop = item.top; item.el.scrollLeft = item.left; } catch {} }); }
  function keepPreviewScroll(fn) { const scroll = snapshotScroll(); try { fn(); } finally { restoreScroll(scroll); requestAnimationFrame(() => restoreScroll(scroll)); setTimeout(() => restoreScroll(scroll), 0); } }
  function textOf(el) { return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim(); }
  function absoluteSrc(value) { try { return new URL(value || '', document.baseURI).toString(); } catch { return value || ''; } }
  function visibleRect(el) { const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null; return rect && rect.width > 8 && rect.height > 8 ? rect : null; }
  function bgUrl(el) { const match = (getComputedStyle(el).backgroundImage || '').match(/url\(["']?([^"')]+)["']?\)/); return match ? match[1] : ''; }
  function mediaSrc(el) {
    if (!el) return '';
    if (el.tagName === 'IMG') return absoluteSrc(el.currentSrc || el.getAttribute('src') || el.getAttribute('data-src') || '');
    if (el.tagName === 'VIDEO') { const source = el.querySelector('source[src]'); return absoluteSrc(el.currentSrc || el.getAttribute('src') || source?.getAttribute('src') || el.getAttribute('poster') || ''); }
    if (el.tagName === 'SOURCE') return absoluteSrc(el.getAttribute('src') || '');
    const bg = bgUrl(el);
    return bg ? absoluteSrc(bg) : '';
  }
  function cssPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body && parts.length < 8) {
      let part = node.tagName.toLowerCase();
      if (node.id) { part += '#' + node.id; parts.unshift(part); break; }
      const parent = node.parentElement;
      if (parent) { const same = Array.from(parent.children).filter(child => child.tagName === node.tagName); if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')'; }
      parts.unshift(part); node = parent;
    }
    return parts.join(' > ');
  }
  function post(type, payload) { window.parent && window.parent.postMessage({ type, payload, source: 'streams-editable-preview' }, window.location.origin); }

  function childLayers(el) { return Array.from(el.querySelectorAll('[data-streams-layer-id]')).filter(child => child !== el); }
  function directChildLayers(el) { return Array.from(el.children || []).flatMap(child => child.dataset.streamsLayerId ? [child] : Array.from(child.querySelectorAll('[data-streams-layer-id]')).filter(grand => !grand.parentElement.closest('[data-streams-layer-id]') || grand.parentElement.closest('[data-streams-layer-id]') === el)); }
  function nearestLayerParent(el) { return el.parentElement ? el.parentElement.closest('[data-streams-layer-id]') : null; }
  function countKinds(el) {
    const nodes = childLayers(el);
    return {
      total: nodes.length,
      media: nodes.filter(n => ['image','video','background-image','media-frame'].includes(n.dataset.streamsEditableKind)).length,
      text: nodes.filter(n => n.dataset.streamsEditableKind === 'text').length,
      controls: nodes.filter(n => ['button','link','input'].includes(n.dataset.streamsEditableKind)).length
    };
  }
  function classify(el) {
    if (!el || SKIP.has(el.tagName)) return '';
    const role = (el.getAttribute('role') || '').toLowerCase();
    const cls = String(el.className || '');
    const text = textOf(el);
    const rect = visibleRect(el);
    if (el.tagName === 'IMG') return 'image';
    if (el.tagName === 'VIDEO' || el.tagName === 'SOURCE') return 'video';
    if (bgUrl(el)) return 'background-image';
    if (el.tagName === 'BUTTON' || role === 'button') return 'button';
    if (el.tagName === 'A') return 'link';
    if (['INPUT','TEXTAREA','SELECT','LABEL'].includes(el.tagName)) return 'input';
    if (/badge|pill|tag|chip|icon/i.test(cls)) return 'badge';
    if (/grid|row|columns|cols/i.test(cls) || (rect && Array.from(el.children || []).length > 1 && getComputedStyle(el).display.includes('grid'))) return 'group';
    if (/frame|media|image|video|poster|thumb|photo/i.test(cls) && el.querySelector('img,video,[style*="background-image"]')) return 'media-frame';
    if (STRUCTURAL_TAGS.has(el.tagName) || /section|hero|banner|modal|overlay|wrapper|container|panel|card|box|frame|group/i.test(cls)) return 'group';
    const children = Array.from(el.children || []).filter(child => !SKIP.has(child.tagName));
    const childText = children.map(textOf).filter(Boolean).join(' ');
    if (text && text.length >= 2 && text.length <= 180 && (!childText || childText.length < text.length * 0.72)) return 'text';
    if (rect && children.length && text.length > 2) return 'group';
    return '';
  }
  function isEditableTextElement(el) { return classify(el) === 'text' && /[A-Za-z0-9]/.test(textOf(el)); }
  function isEditableLayer(el) { return Boolean(classify(el)); }
  function payloadFor(el) {
    const kind = el.dataset.streamsEditableKind || classify(el) || 'group';
    const style = window.getComputedStyle(el);
    const counts = countKinds(el);
    const parent = nearestLayerParent(el);
    const direct = directChildLayers(el).slice(0, 12).map(child => ({ id: child.dataset.streamsLayerId, kind: child.dataset.streamsEditableKind, text: textOf(child).slice(0, 80), src: mediaSrc(child) }));
    return {
      id: el.dataset.streamsEditableId,
      layerId: el.dataset.streamsLayerId,
      kind,
      selector: cssPath(el),
      text: kind === 'text' || kind === 'button' || kind === 'link' ? textOf(el) : textOf(el).slice(0, 160),
      original: el.dataset.streamsOriginalText || el.dataset.streamsOriginalSrc || '',
      src: ['image','video','background-image','media-frame'].includes(kind) ? mediaSrc(el) : '',
      parentLayerId: parent?.dataset.streamsLayerId || '',
      childLayerCount: counts.total,
      childLayerKinds: counts,
      childLayers: direct,
      inlineStyle: el.getAttribute('style') || '',
      width: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.getBoundingClientRect().height),
      transform: style.transform === 'none' ? '' : style.transform
    };
  }
  function safetyFor(action, el) {
    const p = payloadFor(el);
    const riskyContainer = ['group','media-frame','background-image'].includes(p.kind) && p.childLayerCount > 0;
    if (action === 'replace' && p.kind !== 'image' && p.kind !== 'background-image') return { safe: false, severity: 'blocked', reason: 'Replace image needs an exact image or background-image layer.', recommendations: ['Select the child image layer', 'Use Parent/Child controls to move to the exact image', 'Double-click only when you want a parent group'] };
    if (action === 'replace' && p.childLayerKinds.media > 1) return { safe: false, severity: 'blocked', reason: 'Selected layer contains multiple media children.', recommendations: ['Replace exact image only', 'Select image frame only', 'Select video only if changing video source'] };
    if (action === 'remove' && riskyContainer) return { safe: false, severity: 'blocked', reason: 'Selected layer contains child layers. Removing it would remove more than one visible item.', recommendations: ['Delete exact child item only', 'Use Parent for full group delete only after confirming', 'Choose section mode for whole section removal'] };
    return { safe: true, severity: 'safe', reason: '', recommendations: [] };
  }
  function showSafety(action, el, result) {
    const payload = payloadFor(el);
    const alert = { type: 'visual-editor:safety-alert', severity: result.severity, attemptedAction: action, selectedLayerId: payload.layerId, selectedLayerType: payload.kind, selectedLayer: payload, reason: result.reason, risks: [result.reason], recommendations: result.recommendations };
    if (!alertBox) { alertBox = document.createElement('div'); alertBox.className = 'streams-safety-alert'; document.body.appendChild(alertBox); }
    alertBox.innerHTML = '<strong>Unsafe action blocked</strong><span>' + result.reason + '</span><small>' + result.recommendations.join(' • ') + '</small>';
    alertBox.style.display = 'block';
    setTimeout(() => { if (alertBox) alertBox.style.display = 'none'; }, 8000);
    post('streams-editable-safety-alert', alert);
  }
  function createToolbar() {
    if (toolbar) return toolbar;
    toolbar = document.createElement('div'); toolbar.className = 'streams-edit-toolbar';
    toolbar.innerHTML = '<button data-act="parent">Parent</button><button data-act="child">Child</button><button data-act="replace">Replace image</button><button data-act="remove">Remove</button><button data-act="rotate">Rotate</button><button data-act="front">Front</button><button data-act="done">Done</button>';
    document.body.appendChild(toolbar);
    toolbar.addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button || !selected) return;
      const act = button.dataset.act;
      if (act === 'parent') { const parent = nearestLayerParent(selected); if (parent) selectElement(parent); return; }
      if (act === 'child') { const first = directChildLayers(selected)[0]; if (first) selectElement(first); return; }
      if (act === 'replace') { const safety = safetyFor('replace', selected); if (!safety.safe) return showSafety('replace', selected, safety); return replaceImage(selected); }
      if (act === 'remove') { const safety = safetyFor('remove', selected); if (!safety.safe) return showSafety('remove', selected, safety); return removeSelected(selected); }
      if (act === 'rotate') rotateSelected(selected);
      if (act === 'front') { selected.style.zIndex = String((Number(selected.style.zIndex) || 10) + 1); post('streams-editable-style', payloadFor(selected)); }
      if (act === 'done') deselect();
    });
    return toolbar;
  }
  function moveToolbar(el) {
    const bar = createToolbar(); const rect = el.getBoundingClientRect();
    bar.style.left = Math.max(8, rect.left + window.scrollX) + 'px'; bar.style.top = Math.max(8, rect.top + window.scrollY - 42) + 'px'; bar.style.display = 'flex';
    const replace = bar.querySelector('[data-act="replace"]'); if (replace) replace.style.display = ['image','background-image'].includes(el.dataset.streamsEditableKind) ? 'inline-flex' : 'none';
    const child = bar.querySelector('[data-act="child"]'); if (child) child.style.display = directChildLayers(el).length ? 'inline-flex' : 'none';
    const parent = bar.querySelector('[data-act="parent"]'); if (parent) parent.style.display = nearestLayerParent(el) ? 'inline-flex' : 'none';
  }
  function deselect() { if (selected) selected.removeAttribute('data-streams-selected'); selected = null; if (toolbar) toolbar.style.display = 'none'; }
  function selectElement(el) { keepPreviewScroll(() => { if (selected) selected.removeAttribute('data-streams-selected'); selected = el; el.dataset.streamsSelected = 'true'; moveToolbar(el); post('streams-editable-select', payloadFor(el)); }); }
  function removeSelected(el) { const payload = payloadFor(el); el.style.display = 'none'; post('streams-editable-remove', payload); deselect(); }
  function rotateSelected(el) { const current = Number(el.dataset.streamsRotate || '0') + 15; el.dataset.streamsRotate = String(current); const old = el.style.transform || ''; el.style.transform = old.replace(/rotate\([^)]*\)/g, '').trim() + ' rotate(' + current + 'deg)'; post('streams-editable-style', payloadFor(el)); }
  function replaceImage(el) { if (!fileInput) { fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none'; document.body.appendChild(fileInput); } fileInput.onchange = () => { const file = fileInput.files && fileInput.files[0]; if (!file || !selected) return; const reader = new FileReader(); reader.onload = () => { const dataUrl = String(reader.result || ''); const old = payloadFor(selected); if (selected.tagName === 'IMG') selected.src = dataUrl; else selected.style.backgroundImage = 'url(' + dataUrl + ')'; post('streams-editable-image-replace', { ...old, replacementDataUrl: dataUrl, replacementName: file.name }); }; reader.readAsDataURL(file); }; fileInput.click(); }
  function makeResizableAndMovable(el) { if (el.dataset.streamsTransformReady) return; el.dataset.streamsTransformReady = 'true'; el.addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation(); selectElement(el); el.dataset.streamsTransformMode = 'true'; el.style.resize = 'both'; el.style.overflow = el.style.overflow || 'hidden'; el.style.position = getComputedStyle(el).position === 'static' ? 'relative' : getComputedStyle(el).position; el.style.cursor = 'move'; post('streams-editable-transform-start', payloadFor(el)); }); el.addEventListener('pointerdown', event => { if (el.dataset.streamsTransformMode !== 'true') return; if (event.target && event.target.closest && event.target.closest('.streams-edit-toolbar')) return; dragState = { el, x: event.clientX, y: event.clientY, left: parseFloat(el.style.left || '0') || 0, top: parseFloat(el.style.top || '0') || 0 }; el.setPointerCapture && el.setPointerCapture(event.pointerId); }); }
  document.addEventListener('pointermove', event => { if (!dragState) return; const dx = event.clientX - dragState.x; const dy = event.clientY - dragState.y; dragState.el.style.left = dragState.left + dx + 'px'; dragState.el.style.top = dragState.top + dy + 'px'; moveToolbar(dragState.el); });
  document.addEventListener('pointerup', () => { if (!dragState) return; post('streams-editable-style', payloadFor(dragState.el)); dragState = null; });

  function bestLayerFromPoint(x, y, target) {
    const stack = document.elementsFromPoint(x, y).filter(el => el.dataset && el.dataset.streamsLayerId);
    const exact = stack.find(el => ['image','video','background-image','button','link','input','text','badge'].includes(el.dataset.streamsEditableKind));
    return exact || stack[0] || (target.closest && target.closest('[data-streams-layer-id]')) || null;
  }
  function delegatedClick(event) {
    if (event.target && event.target.closest && event.target.closest('.streams-edit-toolbar,.streams-safety-alert')) return;
    const el = bestLayerFromPoint(event.clientX, event.clientY, event.target);
    if (!el) return;
    event.preventDefault(); event.stopPropagation();
    if (el.dataset.streamsEditableKind === 'text') { try { el.focus({ preventScroll: true }); } catch { el.focus(); } }
    selectElement(el);
  }
  function markEditable() {
    let index = 0;
    const nodes = Array.from(document.body.querySelectorAll('main,section,article,aside,nav,header,footer,form,ul,ol,li,div,h1,h2,h3,h4,h5,h6,p,span,b,strong,em,a,button,label,small,input,textarea,select,img,picture img,video,source'));
    nodes.forEach(el => {
      if (!isEditableLayer(el)) return;
      const kind = classify(el);
      el.dataset.streamsEditable = 'true'; el.dataset.streamsEditableKind = kind; el.dataset.streamsEditableId = kind + '-' + index; el.dataset.streamsLayerId = kind + '-' + index; index += 1;
      if (['text','button','link','badge'].includes(kind)) el.dataset.streamsOriginalText = textOf(el);
      if (['image','video','background-image','media-frame'].includes(kind)) el.dataset.streamsOriginalSrc = mediaSrc(el);
      if (kind === 'text') { el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); el.addEventListener('input', () => post('streams-editable-input', payloadFor(el))); el.addEventListener('blur', () => post('streams-editable-commit', payloadFor(el))); }
      makeResizableAndMovable(el);
    });
    document.addEventListener('click', delegatedClick, true);
    post('streams-editable-layer-map', { layers: Array.from(document.body.querySelectorAll('[data-streams-layer-id]')).map(payloadFor).slice(0, 1200) });
  }
  const style = document.createElement('style');
  style.textContent = '[data-streams-editable="true"]{outline:1px solid transparent;outline-offset:2px}[data-streams-editable-kind="text"]{cursor:text}[data-streams-editable-kind="image"],[data-streams-editable-kind="video"],[data-streams-editable-kind="background-image"],[data-streams-editable-kind="media-frame"],[data-streams-editable-kind="group"],[data-streams-editable-kind="button"],[data-streams-editable-kind="link"],[data-streams-editable-kind="input"],[data-streams-editable-kind="badge"]{cursor:pointer}[data-streams-editable="true"]:hover,[data-streams-selected="true"]{outline:2px solid #f97316!important;box-shadow:0 0 0 1px rgba(249,115,22,.45),0 0 18px rgba(249,115,22,.24)!important}[data-streams-editable="true"]:focus{outline:2px solid #f97316!important;background:rgba(249,115,22,.08)!important}.streams-edit-toolbar{position:absolute;z-index:2147483647;display:none;gap:6px;align-items:center;padding:6px;border:1px solid rgba(249,115,22,.7);border-radius:10px;background:rgba(2,6,23,.96);box-shadow:0 12px 32px rgba(0,0,0,.35)}.streams-edit-toolbar button{height:28px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:#7c3aed;color:#fff;font:700 11px system-ui;padding:0 8px;cursor:pointer}.streams-safety-alert{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:none;max-width:360px;border:1px solid rgba(251,191,36,.8);border-radius:14px;background:rgba(15,23,42,.96);color:#fff;padding:12px;box-shadow:0 18px 48px rgba(0,0,0,.45);font:600 12px system-ui}.streams-safety-alert strong{display:block;color:#fbbf24;font-size:13px;margin-bottom:4px}.streams-safety-alert span{display:block;line-height:1.35}.streams-safety-alert small{display:block;color:#cbd5e1;margin-top:6px;line-height:1.35}';
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
  const response = await fetch(target.toString(), { cache: "no-store", headers: { "user-agent": "StreamsAI Editable Preview" } });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    const body = await response.arrayBuffer();
    return new NextResponse(body, { status: response.status, headers: { "content-type": contentType || "application/octet-stream" } });
  }
  const html = await response.text();
  return new NextResponse(injectEditableBridge(html, target), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
