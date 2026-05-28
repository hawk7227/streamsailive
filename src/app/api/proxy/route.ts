import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

// Inspect script injected into every proxied page
const INSPECT_SCRIPT = `
<script id="__ep_inspector">
(function(){
  if(window.__ep_init) return; window.__ep_init=true;
  var selEl=null;
  function rgb2hex(c){
    if(!c||c==='transparent'||c.includes('0, 0, 0, 0'))return'transparent';
    var m=c.match(/\\d+/g);if(!m||m.length<3)return c;
    return'#'+m.slice(0,3).map(function(n){return parseInt(n).toString(16).padStart(2,'0')}).join('');
  }
  function report(el){
    var cs=getComputedStyle(el),r=el.getBoundingClientRect();
    var sty={};
    ['color','backgroundColor','fontSize','fontWeight','fontFamily','textAlign','lineHeight',
     'letterSpacing','textTransform','paddingTop','paddingBottom','paddingLeft','paddingRight',
     'marginTop','marginBottom','marginLeft','marginRight','width','height','maxWidth','minHeight',
     'border','borderRadius','boxShadow','display','position','flexDirection','justifyContent',
     'alignItems','gap','opacity','background'].forEach(function(k){sty[k]=cs[k];});
    window.parent.postMessage({type:'ep-sel',
      tag:el.tagName.toLowerCase(),
      txt:(el.innerText||el.textContent||'').slice(0,200),
      rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)},
      sty:sty
    },'*');
  }
  document.addEventListener('mouseover',function(e){
    if(e.target===selEl)return;
    document.querySelectorAll('[data-ep-hov]').forEach(function(n){
      if(n!==selEl){n.style.outline='';} n.removeAttribute('data-ep-hov');
    });
    e.target.style.outline='2px solid rgba(249,115,22,0.5)';
    e.target.setAttribute('data-ep-hov','1');
  },true);
  document.addEventListener('mouseout',function(e){
    if(e.target!==selEl){e.target.style.outline='';e.target.removeAttribute('data-ep-hov');}
  },true);
  document.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    if(selEl&&selEl!==e.target){selEl.style.outline='';selEl.removeAttribute('data-ep-sel');}
    selEl=e.target;
    selEl.style.outline='2px solid #f97316';
    selEl.setAttribute('data-ep-sel','1');
    report(selEl);
  },true);
  window.addEventListener('message',function(e){
    if(!selEl)return;
    if(e.data&&e.data.type==='ep-style')selEl.style[e.data.prop]=e.data.value;
    if(e.data&&e.data.type==='ep-text'){selEl.innerText=e.data.value;}
  });
  setTimeout(function(){
    var colors=[];
    document.querySelectorAll('*').forEach(function(el){
      var cs=getComputedStyle(el);
      [cs.color,cs.backgroundColor].forEach(function(c){
        var h=rgb2hex(c);
        if(h&&h!=='transparent'&&h!=='#000000'&&colors.indexOf(h)===-1)colors.push(h);
      });
    });
    window.parent.postMessage({type:'ep-colors',colors:colors.slice(0,32)},'*');
  },1500);
})();
</script>`

function rewriteUrls(html: string, targetOrigin: string, proxyBase: string): string {
  // Rewrite absolute URLs for assets (JS, CSS, images) to go through proxy
  // Rewrite src/href attributes pointing to the target origin
  return html
    // Rewrite absolute asset URLs to proxy
    .replace(
      /(?:src|href)="(https?:\/\/[^"]+)"/g,
      (match, url) => {
        if (url.startsWith(targetOrigin)) {
          return match.replace(url, `${proxyBase}?url=${encodeURIComponent(url)}`)
        }
        return match
      }
    )
    // Rewrite root-relative paths to absolute target URLs
    .replace(
      /(?:src|href)="(\/(?!\/)[^"]*?)"/g,
      `src="${targetOrigin}$1" data-proxied="1"`.replace('src=', (m, offset, str) => {
        // preserve original attr name
        return str.slice(offset - 3, offset) === 'src' ? 'src=' : 'href='
      })
    )
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  let targetUrl: URL
  try { targetUrl = new URL(url) } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    if (!response.ok) {
      return new NextResponse(
        `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#f87171;font-family:monospace;padding:20px">
          <h2>Upstream Error ${response.status}</h2>
          <p>The target server returned ${response.status} ${response.statusText}</p>
          <p style="color:#6b7280;font-size:12px">URL: ${url}</p>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' }, status: 200 }
      )
    }

    const contentType = response.headers.get('content-type') || ''

    // For non-HTML resources (JS, CSS, images) — proxy them directly
    if (!contentType.includes('text/html')) {
      const body = await response.arrayBuffer()
      return new NextResponse(body, {
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    let html = await response.text()
    const origin = targetUrl.origin
    const requestUrl = request.nextUrl
    const proxyBase = `${requestUrl.protocol}//${requestUrl.host}/api/proxy`

    // 1. Inject <base> tag so relative URLs resolve to the target origin
    const base = `<base href="${origin}/">`
    html = html.replace(/<head([^>]*)>/i, `<head$1>${base}`)

    // 2. Inject inspect script before </body>
    html = html.replace(/<\/body>/i, `${INSPECT_SCRIPT}</body>`)

    // 3. If no </body>, append at end
    if (!html.includes('__ep_inspector')) {
      html += INSPECT_SCRIPT
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Frame-Options': 'ALLOWALL',
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Proxy error'
    return new NextResponse(
      `<!DOCTYPE html><html><body style="background:#0a0a0a;color:#f87171;font-family:monospace;padding:20px">
        <h2>Proxy Error</h2><p>${msg}</p>
        <p style="color:#6b7280;font-size:12px">URL: ${url}</p>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    )
  }
}
