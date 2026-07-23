"use client";

import { useEffect } from "react";

const ATTACH_MARKER = "data-builder-top-attach";
const ACTIVE_PROJECT_KEY = "streams-ai:active-project-id";

function activeProjectId() {
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY) || "";
  } catch {
    return "";
  }
}

export default function BuilderTopRowAttachmentBridge() {
  useEffect(() => {
    let disposed = false;
    let activeUpload = false;

    function dispatchUpload(assets: unknown[]) {
      window.dispatchEvent(new CustomEvent("streams:chat-upload-complete", { detail: { assets } }));
      window.dispatchEvent(new CustomEvent("streams-builder-summary-event", {
        detail: {
          phase: "asset.attached",
          source: "builder-top-row",
          message: `${assets.length} file${assets.length === 1 ? "" : "s"} attached from the top builder row.`,
          projectId: activeProjectId() || null,
          assetIds: assets.map((asset: any) => asset?.id).filter(Boolean),
        },
      }));
    }

    async function uploadFiles(files: File[], button: HTMLButtonElement) {
      if (!files.length || activeUpload) return;
      activeUpload = true;
      button.disabled = true;
      const originalText = button.textContent || "Attach";
      button.textContent = "Uploading…";
      const uploaded: unknown[] = [];
      try {
        for (const file of files) {
          const form = new FormData();
          form.append("file", file);
          const projectId = activeProjectId();
          if (projectId) form.append("projectId", projectId);
          const response = await fetch("/api/v1/assets", {
            method: "POST",
            body: form,
            credentials: "same-origin",
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.ok === false || !data?.asset) {
            throw new Error(data?.error || `Unable to upload ${file.name}.`);
          }
          uploaded.push(data.asset);
        }
        dispatchUpload(uploaded);
        button.textContent = uploaded.length === 1 ? "Attached" : `Attached ${uploaded.length}`;
        window.setTimeout(() => {
          if (!disposed) button.textContent = originalText;
        }, 1400);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Attachment upload failed.";
        button.textContent = "Attach failed";
        window.dispatchEvent(new CustomEvent("streams-builder-summary-event", {
          detail: { phase: "asset.attach.failed", source: "builder-top-row", message, error: message },
        }));
        window.setTimeout(() => {
          if (!disposed) button.textContent = originalText;
        }, 2200);
      } finally {
        activeUpload = false;
        button.disabled = false;
      }
    }

    function install() {
      if (disposed) return;
      const lowerAttach = document.querySelector<HTMLButtonElement>('.footerComposer button[aria-label="Add files"]');
      if (lowerAttach) {
        lowerAttach.hidden = true;
        lowerAttach.setAttribute("data-moved-to-top-row", "true");
      }

      const strip = document.querySelector<HTMLElement>(".liveWorkstation .toolStrip");
      if (!strip || strip.querySelector(`[${ATTACH_MARKER}]`)) return;

      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.hidden = true;
      input.accept = "image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
      input.setAttribute(ATTACH_MARKER, "input");

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Attach";
      button.setAttribute("aria-label", "Attach files");
      button.setAttribute(ATTACH_MARKER, "button");
      button.addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        input.value = "";
        void uploadFiles(files, button);
      });

      const firstAction = strip.querySelector("button");
      strip.insertBefore(button, firstAction || null);
      strip.appendChild(input);
    }

    install();
    const observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      document.querySelectorAll(`[${ATTACH_MARKER}]`).forEach((element) => element.remove());
      const lowerAttach = document.querySelector<HTMLButtonElement>('.footerComposer button[aria-label="Add files"]');
      if (lowerAttach) {
        lowerAttach.hidden = false;
        lowerAttach.removeAttribute("data-moved-to-top-row");
      }
    };
  }, []);

  return null;
}
