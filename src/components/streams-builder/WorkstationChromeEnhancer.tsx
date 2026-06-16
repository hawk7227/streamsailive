"use client";

import { useEffect } from "react";

const INTERIOR_COLORS = ["#020617", "#07111f", "#111827", "#18181b", "#111d16", "#1f1633"];
const BORDER_COLORS = ["#334155", "#7c3aed", "#10b981", "#38bdf8", "#f59e0b", "#f43f5e"];
const RESIZE_DIRECTIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function button(label: string, title: string) {
  const item = document.createElement("button");
  item.type = "button";
  item.textContent = label;
  item.title = title;
  return item;
}

function labelWithColor(text: string, value: string, onChange: (value: string) => void) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  const input = document.createElement("input");
  span.textContent = text;
  input.type = "color";
  input.value = value;
  input.addEventListener("input", () => onChange(input.value));
  label.append(span, input);
  return label;
}

function titleFor(station: HTMLElement, index: number) {
  return station.querySelector(".stationControls b")?.textContent?.trim() || `Agent ${index + 1}`;
}

function setMinimized(station: HTMLElement, next: boolean) {
  station.classList.toggle("wsMinimized", next);
  const control = station.querySelector<HTMLButtonElement>("[data-ws-minimize]");
  if (control) control.textContent = next ? "▣" : "—";
}

function setLocked(station: HTMLElement, next: boolean) {
  station.classList.toggle("wsLocked", next);
  const control = station.querySelector<HTMLButtonElement>("[data-ws-lock]");
  if (control) control.textContent = next ? "🔒" : "🔓";
}

function beginMove(event: PointerEvent, station: HTMLElement) {
  const target = event.target as HTMLElement;
  if (station.classList.contains("wsLocked") || target.closest("button,input,select,textarea,label")) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const startPanelX = Number(station.dataset.wsX || "0");
  const startPanelY = Number(station.dataset.wsY || "0");
  const move = (moveEvent: PointerEvent) => {
    const nextX = startPanelX + moveEvent.clientX - startX;
    const nextY = startPanelY + moveEvent.clientY - startY;
    station.dataset.wsX = String(nextX);
    station.dataset.wsY = String(nextY);
    station.style.transform = `translate(${nextX}px, ${nextY}px)`;
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

function beginResize(event: PointerEvent, station: HTMLElement, direction: string) {
  if (station.classList.contains("wsLocked")) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = station.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const startPanelX = Number(station.dataset.wsX || "0");
  const startPanelY = Number(station.dataset.wsY || "0");
  const move = (moveEvent: PointerEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    let nextWidth = rect.width;
    let nextHeight = rect.height;
    let nextPanelX = startPanelX;
    let nextPanelY = startPanelY;
    if (direction.includes("e")) nextWidth = rect.width + dx;
    if (direction.includes("s")) nextHeight = rect.height + dy;
    if (direction.includes("w")) {
      nextWidth = rect.width - dx;
      nextPanelX = startPanelX + dx;
    }
    if (direction.includes("n")) {
      nextHeight = rect.height - dy;
      nextPanelY = startPanelY + dy;
    }
    station.style.width = `${Math.max(360, nextWidth)}px`;
    station.style.height = `${Math.max(260, nextHeight)}px`;
    station.dataset.wsX = String(nextPanelX);
    station.dataset.wsY = String(nextPanelY);
    station.style.transform = `translate(${nextPanelX}px, ${nextPanelY}px)`;
  };
  const stop = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", stop);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", stop);
}

function installPhone(station: HTMLElement) {
  const browser = station.querySelector<HTMLElement>(".browser");
  if (!browser || browser.querySelector(".streamsIphoneChat")) return;
  browser.classList.add("agentOneWithPhone");
  const phone = document.createElement("aside");
  phone.className = "streamsIphoneChat";
  const shell = document.createElement("div");
  shell.className = "iphoneShell";
  const island = document.createElement("div");
  island.className = "iphoneIsland";
  const top = document.createElement("div");
  top.className = "iphoneTop";
  top.textContent = "Streams AI";
  const messages = document.createElement("div");
  messages.className = "iphoneMessages";
  ["Select repo, folder, and file.", "Pull opens the visible active file.", "Ready for Agent 1."].forEach((text, index) => {
    const message = document.createElement("p");
    message.className = index === 2 ? "user" : "bot";
    message.textContent = text;
    messages.append(message);
  });
  const composer = document.createElement("div");
  composer.className = "iphoneComposer";
  const placeholder = document.createElement("span");
  placeholder.textContent = "Message Streams AI...";
  const send = button("↗", "Send");
  composer.append(placeholder, send);
  shell.append(island, top, messages, composer);
  phone.append(shell);
  browser.prepend(phone);
}

function enhanceStation(station: HTMLElement, index: number) {
  if (station.dataset.wsChromeReady === "true") return;
  station.dataset.wsChromeReady = "true";
  station.dataset.wsX = "0";
  station.dataset.wsY = "0";
  station.style.setProperty("--ws-interior", INTERIOR_COLORS[index % INTERIOR_COLORS.length]);
  station.style.setProperty("--ws-border", BORDER_COLORS[index % BORDER_COLORS.length]);

  const chrome = document.createElement("div");
  chrome.className = "wsChrome";
  const title = document.createElement("div");
  title.className = "wsChromeTitle";
  const strong = document.createElement("b");
  strong.textContent = titleFor(station, index);
  const status = document.createElement("span");
  status.textContent = "move · resize · lock";
  title.append(strong, status);

  const controls = document.createElement("div");
  controls.className = "wsChromeButtons";
  const minimize = button("—", "Minimize / restore");
  minimize.dataset.wsMinimize = "true";
  const lock = button("🔓", "Lock / unlock");
  lock.dataset.wsLock = "true";
  const reset = button("⟳", "Reset move / resize");
  controls.append(minimize, lock, reset);

  minimize.addEventListener("click", () => setMinimized(station, !station.classList.contains("wsMinimized")));
  lock.addEventListener("click", () => setLocked(station, !station.classList.contains("wsLocked")));
  reset.addEventListener("click", () => {
    if (station.classList.contains("wsLocked")) return;
    station.dataset.wsX = "0";
    station.dataset.wsY = "0";
    station.style.transform = "translate(0px, 0px)";
    station.style.width = "";
    station.style.height = "";
  });

  const interior = labelWithColor("Interior", INTERIOR_COLORS[index % INTERIOR_COLORS.length], (value) => {
    if (!station.classList.contains("wsLocked")) station.style.setProperty("--ws-interior", value);
  });
  const border = labelWithColor("Border", BORDER_COLORS[index % BORDER_COLORS.length], (value) => {
    if (!station.classList.contains("wsLocked")) station.style.setProperty("--ws-border", value);
  });

  chrome.addEventListener("pointerdown", (event) => beginMove(event, station));
  chrome.append(title, controls, interior, border);
  station.prepend(chrome);

  RESIZE_DIRECTIONS.forEach((direction) => {
    const handle = button("", `Resize ${direction}`);
    handle.className = `wsResize wsResize-${direction}`;
    handle.addEventListener("pointerdown", (event) => beginResize(event, station, direction));
    station.append(handle);
  });

  if (index === 0) installPhone(station);
  if (index === 1) setMinimized(station, true);
}

export default function WorkstationChromeEnhancer() {
  useEffect(() => {
    const apply = () => document.querySelectorAll<HTMLElement>(".station").forEach(enhanceStation);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <style jsx global>{`
      .station { position: relative !important; border-color: var(--ws-border, rgba(148, 163, 184, 0.16)) !important; background: linear-gradient(180deg, var(--ws-interior, rgba(15, 23, 42, 0.78)), rgba(15, 23, 42, 0.88)) !important; box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28); }
      .wsChrome { min-height: 34px; display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 6px; align-items: center; padding: 4px 6px; border-bottom: 1px solid rgba(148, 163, 184, 0.14); background: rgba(2, 6, 23, 0.82); cursor: move; user-select: none; z-index: 8; }
      .wsChromeTitle { min-width: 0; display: flex; align-items: center; gap: 7px; }
      .wsChromeTitle b { color: #fff; font-size: 9px; white-space: nowrap; }
      .wsChromeTitle span, .wsChrome label { color: #94a3b8; font-size: 7px; font-weight: 900; text-transform: uppercase; white-space: nowrap; }
      .wsChromeButtons { display: flex; gap: 3px; }
      .wsChrome button { width: 22px; min-width: 22px; height: 22px; padding: 0; border-radius: 6px; font-size: 10px; }
      .wsChrome label { display: flex; align-items: center; gap: 4px; }
      .wsChrome input[type="color"] { width: 22px; min-width: 22px; height: 18px; padding: 0; border: 0; background: transparent; cursor: pointer; }
      .wsMinimized { align-self: start !important; max-height: 38px !important; min-height: 38px !important; overflow: hidden !important; }
      .wsLocked .stationControls, .wsLocked .browser, .wsLocked .stationSettings, .wsLocked .stationChat, .wsLocked .error, .wsLocked .status { pointer-events: none !important; opacity: 0.68 !important; }
      .wsLocked { box-shadow: inset 0 0 0 1px rgba(248, 113, 113, 0.42), 0 18px 40px rgba(0, 0, 0, 0.28) !important; }
      .wsResize { position: absolute; z-index: 9; padding: 0 !important; background: transparent !important; border: 0 !important; }
      .wsResize-n, .wsResize-s { left: 18px; right: 18px; height: 8px; cursor: ns-resize; }
      .wsResize-e, .wsResize-w { top: 44px; bottom: 14px; width: 8px; cursor: ew-resize; }
      .wsResize-n { top: 0; } .wsResize-s { bottom: 0; } .wsResize-e { right: 0; } .wsResize-w { left: 0; }
      .wsResize-nw, .wsResize-ne, .wsResize-se, .wsResize-sw { width: 14px; height: 14px; }
      .wsResize-nw { top: 0; left: 0; cursor: nwse-resize; } .wsResize-ne { top: 0; right: 0; cursor: nesw-resize; } .wsResize-se { right: 0; bottom: 0; cursor: nwse-resize; } .wsResize-sw { left: 0; bottom: 0; cursor: nesw-resize; }
      .agentOneWithPhone { grid-template-columns: 250px minmax(0, 1fr) !important; grid-template-rows: minmax(0, 1fr) !important; gap: 5px !important; padding: 5px !important; }
      .streamsIphoneChat { min-width: 0; min-height: 0; display: grid; place-items: stretch; }
      .iphoneShell { height: 100%; min-height: 0; border: 2px solid rgba(255, 255, 255, 0.12); border-radius: 28px; background: linear-gradient(180deg, #050816, #0f172a); padding: 12px 10px 10px; display: grid; grid-template-rows: 16px auto minmax(0, 1fr) auto; gap: 8px; box-sizing: border-box; overflow: hidden; }
      .iphoneIsland { width: 70px; height: 14px; border-radius: 999px; background: #020617; justify-self: center; }
      .iphoneTop { color: #fff; font-size: 11px; font-weight: 900; text-align: center; }
      .iphoneMessages { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 7px; }
      .iphoneMessages p { margin: 0; max-width: 82%; border-radius: 14px; padding: 8px 9px; font-size: 10px; line-height: 1.3; }
      .iphoneMessages .bot { align-self: flex-start; background: rgba(30, 41, 59, 0.9); color: #e5e7eb; }
      .iphoneMessages .user { align-self: flex-end; background: #7c3aed; color: #fff; }
      .iphoneComposer { min-height: 30px; display: grid; grid-template-columns: minmax(0, 1fr) 28px; gap: 5px; align-items: center; border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 999px; padding: 3px 4px 3px 10px; color: #94a3b8; font-size: 9px; }
      .iphoneComposer button { width: 24px; height: 24px; min-width: 24px; padding: 0; border-radius: 999px; }
    `}</style>
  );
}
