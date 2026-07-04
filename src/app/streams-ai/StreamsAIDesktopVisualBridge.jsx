"use client";

import { useEffect } from "react";

export default function StreamsAIDesktopVisualBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const id = "streams-ai-desktop-visual-bridge";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @media (min-width: 900px) {
        .shell.desktop .microbar,
        .shell.expanded .microbar,
        .shell.collapsed .microbar {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          overflow: hidden !important;
          pointer-events: none !important;
        }

        .shell.desktop .chatScroll,
        .shell.expanded .chatScroll,
        .shell.collapsed .chatScroll {
          padding-top: 28px !important;
          padding-bottom: 120px !important;
          scroll-padding-bottom: 120px !important;
        }

        .shell.desktop .composer,
        .shell.expanded .composer,
        .shell.collapsed .composer {
          left: 24px !important;
          right: 24px !important;
          bottom: 24px !important;
          z-index: 80 !important;
        }

        .shell.desktop .streamsComposer,
        .shell.expanded .streamsComposer,
        .shell.collapsed .streamsComposer {
          min-height: 52px !important;
          padding: 5px !important;
          border-radius: 28px !important;
          border: 1px solid rgba(168, 85, 247, 0.72) !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.08) !important;
          overflow: visible !important;
          color: #0f172a !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .shell.desktop .streamsComposer:focus-within,
        .shell.expanded .streamsComposer:focus-within,
        .shell.collapsed .streamsComposer:focus-within {
          border-color: rgba(124, 58, 237, 0.9) !important;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.18), 0 1px 2px rgba(0, 0, 0, 0.04), 0 10px 30px rgba(0, 0, 0, 0.08) !important;
        }

        .shell.desktop .streamsComposer::before,
        .shell.desktop .streamsComposer::after,
        .shell.expanded .streamsComposer::before,
        .shell.expanded .streamsComposer::after,
        .shell.collapsed .streamsComposer::before,
        .shell.collapsed .streamsComposer::after {
          display: none !important;
        }

        .shell.desktop .streamsComposerRow,
        .shell.expanded .streamsComposerRow,
        .shell.collapsed .streamsComposerRow {
          min-height: 42px !important;
          display: grid !important;
          grid-template-columns: 38px minmax(0, 1fr) auto 34px 42px !important;
          grid-template-rows: 42px !important;
          grid-template-areas: "tools input mode mic send" !important;
          align-items: center !important;
          gap: 8px !important;
          padding: 0 !important;
        }

        .shell.desktop .streamsComposerIconButton,
        .shell.expanded .streamsComposerIconButton,
        .shell.collapsed .streamsComposerIconButton {
          grid-area: tools !important;
          width: 34px !important;
          height: 34px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: transparent !important;
          color: #111827 !important;
          box-shadow: none !important;
          font-size: 26px !important;
          line-height: 1 !important;
          font-weight: 300 !important;
          display: grid !important;
          place-items: center !important;
        }

        .shell.desktop .streamsComposerInput,
        .shell.expanded .streamsComposerInput,
        .shell.collapsed .streamsComposerInput {
          grid-area: input !important;
          height: 42px !important;
          min-width: 0 !important;
          border: 0 !important;
          outline: none !important;
          background: transparent !important;
          color: #111827 !important;
          box-shadow: none !important;
          font-size: 16px !important;
          line-height: 42px !important;
          font-weight: 400 !important;
          letter-spacing: -0.01em !important;
          text-shadow: none !important;
          transform: none !important;
        }

        .shell.desktop .streamsComposerInput::placeholder,
        .shell.expanded .streamsComposerInput::placeholder,
        .shell.collapsed .streamsComposerInput::placeholder {
          color: #8a8a8a !important;
          opacity: 1 !important;
          font-weight: 400 !important;
        }

        .shell.desktop .streamsComposerPill,
        .shell.expanded .streamsComposerPill,
        .shell.collapsed .streamsComposerPill {
          grid-area: mode !important;
          height: 34px !important;
          min-width: auto !important;
          max-width: none !important;
          padding: 0 6px 0 10px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: transparent !important;
          color: #8a8a8a !important;
          box-shadow: none !important;
          font-size: 15px !important;
          line-height: 34px !important;
          font-weight: 400 !important;
          white-space: nowrap !important;
        }

        .shell.desktop .streamsComposerMicButton,
        .shell.expanded .streamsComposerMicButton,
        .shell.collapsed .streamsComposerMicButton {
          grid-area: mic !important;
          width: 34px !important;
          height: 34px !important;
          margin: 0 !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: transparent !important;
          color: #111827 !important;
          box-shadow: none !important;
          font-size: 20px !important;
          line-height: 34px !important;
          display: grid !important;
          place-items: center !important;
        }

        .shell.desktop .streamsComposerSendButton,
        .shell.expanded .streamsComposerSendButton,
        .shell.collapsed .streamsComposerSendButton {
          grid-area: send !important;
          width: 42px !important;
          height: 42px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: #000000 !important;
          color: #ffffff !important;
          box-shadow: none !important;
          font-size: 19px !important;
          font-weight: 800 !important;
          display: grid !important;
          place-items: center !important;
        }

        .shell.desktop .streamsComposerAttachments,
        .shell.expanded .streamsComposerAttachments,
        .shell.collapsed .streamsComposerAttachments {
          width: 100% !important;
          display: flex !important;
          gap: 8px !important;
          flex-wrap: wrap !important;
          padding: 8px 10px 10px !important;
          border-bottom: 1px solid rgba(168, 85, 247, 0.18) !important;
          margin-bottom: 4px !important;
          max-height: 150px !important;
          overflow-y: auto !important;
        }
      }
    `;

    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
