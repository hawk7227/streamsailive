"use client";

import { useEffect } from "react";

export default function WorkstationChromeEnhancer() {
  useEffect(() => {
    const enhance = () => {
      document.querySelectorAll<HTMLElement>(".station,.workstationShell").forEach((panel, index) => {
        if (panel.dataset.chromeReady === "true") return;
        panel.dataset.chromeReady = "true";
        panel.style.setProperty("--ws-border", index === 1 ? "#7c3aed" : "#334155");
        panel.style.setProperty("--ws-bg", "#020617");

        const chrome = document.createElement("div");
        chrome.className = "wsChrome";

        const title = document.createElement("b");
        title.textContent = index === 0 ? "Agent 1" : `Agent ${index + 1}`;

        const controls = document.createElement("div");
        controls.className = "wsControls";

        const min = document.createElement("button");
        min.type = "button";
        min.textContent = "—";
        min.title = "Minimize";
        min.onclick = () => {
          const on = panel.classList.toggle("wsMinimized");
          min.textContent = on ? "▣" : "—";
        };

        const lock = document.createElement("button");
        lock.type = "button";
        lock.textContent = "🔓";
        lock.title = "Lock / Unlock";
        lock.onclick = () => {
          const on = panel.classList.toggle("wsLocked");
          lock.textContent = on ? "🔒" : "🔓";
        };

        const reset = document.createElement("button");
        reset.type = "button";
        reset.textContent = "⟳";
        reset.title = "Reset position";
        reset.onclick = () => {
          panel.dataset.x = "0";
          panel.dataset.y = "0";
          panel.style.transform = "translate(0px,0px)";
          panel.style.width = "";
          panel.style.height = "";
        };

        const interior = document.createElement("input");
        interior.type = "color";
        interior.value = "#020617";
        interior.title = "Interior color";
        interior.oninput = () => panel.style.setProperty("--ws-bg", interior.value);

        const border = document.createElement("input");
        border.type = "color";
        border.value = index === 1 ? "#7c3aed" : "#334155";
        border.title = "Border color";
        border.oninput = () => panel.style.setProperty("--ws-border", border.value);

        controls.append(min, lock, reset, interior, border);
        chrome.append(title, controls);
        panel.prepend(chrome);

        chrome.onpointerdown = (event) => {
          const target = event.target as HTMLElement;
          if (panel.classList.contains("wsLocked") || target.closest("button,input,select,textarea")) return;
          const sx = event.clientX;
          const sy = event.clientY;
          const ox = Number(panel.dataset.x || "0");
          const oy = Number(panel.dataset.y || "0");
          const move = (moveEvent: PointerEvent) => {
            const nx = ox + moveEvent.clientX - sx;
            const ny = oy + moveEvent.clientY - sy;
            panel.dataset.x = String(nx);
            panel.dataset.y = String(ny);
            panel.style.transform = `translate(${nx}px,${ny}px)`;
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        };

        ["nw","n","ne","e","se","s","sw","w"].forEach((dir) => {
          const h = document.createElement("button");
          h.type = "button";
          h.className = `wsHandle ws-${dir}`;
          h.onpointerdown = (event) => {
            if (panel.classList.contains("wsLocked")) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = panel.getBoundingClientRect();
            const sx = event.clientX;
            const sy = event.clientY;
            const ox = Number(panel.dataset.x || "0");
            const oy = Number(panel.dataset.y || "0");
            const move = (moveEvent: PointerEvent) => {
              const dx = moveEvent.clientX - sx;
              const dy = moveEvent.clientY - sy;
              let w = rect.width;
              let ht = rect.height;
              let x = ox;
              let y = oy;
              if (dir.includes("e")) w = rect.width + dx;
              if (dir.includes("s")) ht = rect.height + dy;
              if (dir.includes("w")) { w = rect.width - dx; x = ox + dx; }
              if (dir.includes("n")) { ht = rect.height - dy; y = oy + dy; }
              panel.style.width = `${Math.max(360,w)}px`;
              panel.style.height = `${Math.max(260,ht)}px`;
              panel.dataset.x = String(x);
              panel.dataset.y = String(y);
              panel.style.transform = `translate(${x}px,${y}px)`;
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          };
          panel.append(h);
        });

        if (index === 1) min.click();
      });
    };
    enhance();
    const obs = new MutationObserver(enhance);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  return <style jsx global>{`
    .station,.workstationShell{position:relative!important;border-color:var(--ws-border)!important;background:var(--ws-bg)!important;}
    .wsChrome{height:34px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px;background:#020617;border-bottom:1px solid rgba(148,163,184,.18);cursor:move;z-index:20;}
    .wsChrome b{font-size:10px;color:#fff}.wsControls{display:flex;gap:4px;align-items:center}.wsControls button{width:24px;height:22px;padding:0}.wsControls input{width:24px;height:20px;padding:0;border:0;background:transparent}
    .wsMinimized{max-height:38px!important;min-height:38px!important;overflow:hidden!important}.wsLocked>*:not(.wsChrome):not(.wsHandle){pointer-events:none!important;opacity:.55!important}
    .wsHandle{position:absolute!important;z-index:21!important;background:transparent!important;border:0!important;padding:0!important}.ws-n,.ws-s{left:18px;right:18px;height:8px;cursor:ns-resize}.ws-e,.ws-w{top:38px;bottom:8px;width:8px;cursor:ew-resize}.ws-n{top:0}.ws-s{bottom:0}.ws-e{right:0}.ws-w{left:0}.ws-nw,.ws-ne,.ws-se,.ws-sw{width:14px;height:14px}.ws-nw{top:0;left:0;cursor:nwse-resize}.ws-ne{top:0;right:0;cursor:nesw-resize}.ws-se{right:0;bottom:0;cursor:nwse-resize}.ws-sw{left:0;bottom:0;cursor:nesw-resize}
  `}</style>;
}
