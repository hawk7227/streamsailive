"use client";

import { useEffect } from "react";
import "./message-action-bridge.css";

function sessionIdFromPath() {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "streams-ai" && parts[1] ? parts[1] : "";
}

function visibleText(body) {
  const clone = body.cloneNode(true);
  clone.querySelectorAll(".assistantMessageActions,.streamsMessageActionFooter,.assistantMessageActionStatus").forEach((node) => node.remove());
  return String(clone.innerText || clone.textContent || "").trim();
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return `${sameDay ? "Today" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

async function postAction(payload) {
  const response = await fetch("/api/streams-ai/message-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.error || "Action failed");
  return data;
}

function button(label, title, onClick) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "streamsMessageActionButton";
  element.setAttribute("aria-label", title || label);
  element.title = title || label;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

function closeMenus(except) {
  document.querySelectorAll(".streamsMessageMoreMenu.isOpen").forEach((menu) => {
    if (menu !== except) menu.classList.remove("isOpen");
  });
}

export default function MessageActionBridge() {
  useEffect(() => {
    let cancelled = false;
    let messageRows = [];

    const loadRows = async () => {
      const sessionId = sessionIdFromPath();
      if (!sessionId) return [];
      try {
        const response = await fetch(`/api/streams-ai/messages?sessionId=${encodeURIComponent(sessionId)}`);
        const data = await response.json();
        return Array.isArray(data?.messages) ? data.messages : [];
      } catch {
        return [];
      }
    };

    const findRow = (text) => {
      const normalized = String(text || "").trim();
      for (let index = messageRows.length - 1; index >= 0; index -= 1) {
        const row = messageRows[index];
        if (row?.role === "assistant" && String(row?.content || "").trim() === normalized) return row;
      }
      return null;
    };

    const decorate = async () => {
      messageRows = await loadRows();
      if (cancelled) return;
      const sessionId = sessionIdFromPath();

      document.querySelectorAll(".startAssistantBody").forEach((body) => {
        if (body.querySelector(":scope > .streamsMessageActionFooter")) return;
        const text = visibleText(body);
        if (!text) return;
        const row = findRow(text);
        const messageId = row?.id || "";

        body.querySelectorAll(":scope > .assistantMessageActions").forEach((node) => {
          node.setAttribute("aria-hidden", "true");
          node.style.display = "none";
        });

        const footer = document.createElement("div");
        footer.className = "streamsMessageActionFooter";
        footer.dataset.messageId = messageId;

        const status = document.createElement("span");
        status.className = "streamsMessageActionStatus";
        status.setAttribute("role", "status");
        status.setAttribute("aria-live", "polite");

        const log = (action, metadata = {}) => postAction({ action, sessionId, messageId, content: text, metadata }).catch(() => null);

        footer.appendChild(button("⧉", "Copy response", async () => {
          await navigator.clipboard.writeText(text);
          status.textContent = "Copied";
          window.setTimeout(() => { status.textContent = ""; }, 1200);
          await log("copied");
        }));
        footer.appendChild(button("♡", "Good response", async (event) => {
          event.currentTarget.classList.toggle("isSelected");
          await log("feedback_up", { selected: event.currentTarget.classList.contains("isSelected") });
        }));
        footer.appendChild(button("♧", "Bad response", async (event) => {
          event.currentTarget.classList.toggle("isSelected");
          await log("feedback_down", { selected: event.currentTarget.classList.contains("isSelected") });
        }));
        footer.appendChild(button("↗", "Share response", async () => {
          if (navigator.share) await navigator.share({ title: "Streams response", text });
          else await navigator.clipboard.writeText(text);
          status.textContent = navigator.share ? "Shared" : "Copied for sharing";
          window.setTimeout(() => { status.textContent = ""; }, 1200);
          await log("shared");
        }));
        footer.appendChild(button("↻", "Regenerate response", async (event) => {
          const control = event.currentTarget;
          if (control.disabled) return;
          control.disabled = true;
          status.textContent = "Regenerating…";
          try {
            await postAction({
              action: "regenerate",
              sessionId,
              messageId,
              content: text,
              idempotencyKey: `regenerate:${messageId || btoa(unescape(encodeURIComponent(text))).slice(0, 24)}`,
            });
            window.location.reload();
          } catch {
            status.textContent = "Could not regenerate";
            control.disabled = false;
          }
        }));

        const moreWrap = document.createElement("div");
        moreWrap.className = "streamsMessageMoreWrap";
        const moreButton = button("•••", "More response actions", async () => {
          const willOpen = !menu.classList.contains("isOpen");
          closeMenus(menu);
          menu.classList.toggle("isOpen", willOpen);
          moreButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
          if (willOpen) await log("more_menu_opened");
        });
        moreButton.setAttribute("aria-haspopup", "menu");
        moreButton.setAttribute("aria-expanded", "false");

        const menu = document.createElement("div");
        menu.className = "streamsMessageMoreMenu";
        menu.setAttribute("role", "menu");

        const stamp = document.createElement("div");
        stamp.className = "streamsMessageTimestamp";
        stamp.textContent = formatTimestamp(row?.created_at || row?.createdAt);
        menu.appendChild(stamp);

        menu.appendChild(button("Branch in new chat", "Branch in new chat", async () => {
          status.textContent = "Creating branch…";
          try {
            const data = await postAction({ action: "branch", sessionId, messageId, content: text });
            window.location.assign(data.href || `/streams-ai/${data.sessionId}`);
          } catch {
            status.textContent = "Could not create branch";
          }
        }));

        menu.appendChild(button("Read aloud", "Read response aloud", async () => {
          menu.classList.remove("isOpen");
          if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
            status.textContent = "Read aloud is unavailable";
            await log("read_aloud_unavailable");
            return;
          }
          window.speechSynthesis.cancel();
          const spoken = text.replace(/```[\s\S]*?```/g, " Code block omitted. ");
          const utterance = new SpeechSynthesisUtterance(spoken);
          utterance.onstart = () => { status.textContent = "Reading aloud…"; log("read_aloud_started"); };
          utterance.onend = () => { status.textContent = ""; log("read_aloud_completed"); };
          utterance.onerror = () => { status.textContent = "Read aloud stopped"; log("read_aloud_failed"); };
          window.speechSynthesis.speak(utterance);
        }));

        moreWrap.appendChild(moreButton);
        moreWrap.appendChild(menu);
        footer.appendChild(moreWrap);
        footer.appendChild(status);
        body.appendChild(footer);
      });
    };

    const observer = new MutationObserver(() => { window.clearTimeout(observer._timer); observer._timer = window.setTimeout(decorate, 80); });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    decorate();

    const outside = (event) => {
      if (!event.target.closest(".streamsMessageMoreWrap")) closeMenus();
    };
    const escape = (event) => { if (event.key === "Escape") closeMenus(); };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  return null;
}
