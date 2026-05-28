// EditorPro Service Worker — injects inspect bridge into proxied pages
const BRIDGE = `
<script id="__ep_bridge">
(function(){
  if(window.__ep_bridge_init) return; window.__ep_bridge_init = true;
  var selEl = null;

  function toHex(c) {
    if (!c || c === 'transparent' || c.indexOf('0, 0, 0, 0') > -1) return '';
    var m = c.match(/\\d+/g); if (!m || m.length < 3) return '';
    var h = '#' + m.slice(0,3).map(function(n){return parseInt(n).toString(16).padStart(2,'0')}).join('');
    return (h === '#000000' || h === '#ffffff') ? '' : h;
  }

  function report(el) {
    var cs = getComputedStyle(el), r = el.getBoundingClientRect();
    var sty = {};
    'color backgroundColor fontSize fontWeight fontFamily textAlign lineHeight letterSpacing textTransform paddingTop paddingBottom paddingLeft paddingRight marginTop marginBottom marginLeft marginRight width height maxWidth minHeight border borderRadius boxShadow display position flexDirection justifyContent alignItems gap opacity background borderColor'.split(' ').forEach(function(k){ sty[k] = cs[k]; });
    window.parent.postMessage({ type: 'ep-sel', tag: el.tagName.toLowerCase(), txt: (el.innerText || el.textContent || '').slice(0, 200), rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, sty: sty }, '*');
  }

  document.addEventListener('mouseover', function(e) {
    document.querySelectorAll('[data-ep-hov]').forEach(function(n) { if (n !== selEl) n.style.outline = ''; n.removeAttribute('data-ep-hov'); });
    if (e.target !== selEl) { e.target.style.outline = '2px solid rgba(249,115,22,0.45)'; e.target.setAttribute('data-ep-hov', '1'); }
  }, true);

  document.addEventListener('mouseout', function(e) {
    if (e.target !== selEl) { e.target.style.outline = ''; e.target.removeAttribute('data-ep-hov'); }
  }, true);

  document.addEventListener('click', function(e) {
    e.preventDefault(); e.stopPropagation();
    if (selEl && selEl !== e.target) { selEl.style.outline = ''; selEl.removeAttribute('data-ep-sel'); }
    selEl = e.target;
    selEl.style.outline = '2px solid #f97316';
    selEl.setAttribute('data-ep-sel', '1');
    report(selEl);
  }, true);

  window.addEventListener('message', function(e) {
    if (!selEl) return;
    if (e.data && e.data.type === 'ep-style') selEl.style[e.data.prop] = e.data.value;
    if (e.data && e.data.type === 'ep-text') selEl.innerText = e.data.value;
    if (e.data && e.data.type === 'ep-reselect') report(selEl);
  });

  // Color scan
  setTimeout(function() {
    var colors = [], seen = {};
    document.querySelectorAll('*').forEach(function(el) {
      var cs = getComputedStyle(el);
      ['color','backgroundColor','borderTopColor'].forEach(function(k) {
        var h = toHex(cs[k]); if (h && !seen[h]) { seen[h] = 1; colors.push(h); }
      });
    });
    window.parent.postMessage({ type: 'ep-colors', colors: colors.slice(0, 64) }, '*');
  }, 1000);
})();
<\/script>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Only intercept requests routed through /api/proxy?url=...
  if (url.pathname === '/api/proxy' && url.searchParams.has('url')) {
    const targetUrl = url.searchParams.get('url');

    event.respondWith(
      fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        },
        redirect: 'follow',
      }).then(async function(response) {
        const ct = response.headers.get('content-type') || '';
        if (!ct.includes('text/html')) return response;

        let html = await response.text();
        const base = new URL(targetUrl);

        // Inject base tag
        html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${base.origin}/">`);

        // Inject bridge script
        if (html.includes('</body>')) {
          html = html.replace('</body>', BRIDGE + '</body>');
        } else {
          html += BRIDGE;
        }

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
          }
        });
      }).catch(function() {
        return new Response('<h1>Proxy fetch failed</h1>', { headers: { 'Content-Type': 'text/html' } });
      })
    );
  }
});
