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
          padding-bottom: 138px !important;
          scroll-padding-bottom: 138px !important;
        }

        .shell.desktop .empty,
        .shell.expanded .empty,
        .shell.collapsed .empty {
          margin: 42px auto auto !important;
          max-width: 430px !important;
          text-align: center !important;
        }

        .shell.desktop .empty .orb,
        .shell.expanded .empty .orb,
        .shell.collapsed .empty .orb {
          width: 76px !important;
          height: 76px !important;
          border-radius: 24px !important;
          background: radial-gradient(circle at 50% 50%, #22d3ee 0 12%, #7c3aed 34%, #d946ef 72%) !important;
          box-shadow: 0 0 42px rgba(124,58,237,.45) !important;
          margin: 0 auto 14px !important;
        }

        .shell.desktop .empty h1,
        .shell.expanded .empty h1,
        .shell.collapsed .empty h1 {
          margin: 0 !important;
          color: #f8fafc !important;
          font-size: 23px !important;
          line-height: 1.15 !important;
          font-weight: 900 !important;
          letter-spacing: -0.02em !important;
          text-align: center !important;
        }

        .shell.desktop .empty p,
        .shell.expanded .empty p,
        .shell.collapsed .empty p {
          display: inline-block !important;
          max-width: 92% !important;
          border: 1px solid rgba(148,163,184,.14) !important;
          border-radius: 14px !important;
          padding: 9px 10px !important;
          color: #e2e8f0 !important;
          font-size: 13px !important;
          line-height: 1.35 !important;
          font-weight: 700 !important;
          background: rgba(15,23,42,.72) !important;
          text-align: left !important;
          margin: 14px auto 0 !important;
        }

        .shell.desktop .composer,
        .shell.expanded .composer,
        .shell.collapsed .composer {
          left: 50% !important;
          right: auto !important;
          bottom: 24px !important;
          width: min(1120px, calc(100vw - 520px)) !important;
          min-width: 640px !important;
          transform: translateX(-50%) !important;
          z-index: 90 !important;
        }

        .shell.desktop .streamsComposer,
        .shell.expanded .streamsComposer,
        .shell.collapsed .streamsComposer {
          min-height: 52px !important;
          padding: 6px !important;
          border-radius: 22px !important;
          border: 1px solid rgba(168,85,247,.45) !important;
          background: rgba(49,18,89,.78) !important;
          box-shadow: 0 0 32px rgba(124,58,237,.25) !important;
          overflow: visible !important;
          color: #fff !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
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
          min-height: 36px !important;
          display: grid !important;
          grid-template-columns: 36px minmax(0,1fr) auto 34px 42px !important;
          grid-template-rows: 36px !important;
          grid-template-areas: "tools input mode mic send" !important;
          align-items: center !important;
          gap: 7px !important;
          padding: 0 !important;
        }

        .shell.desktop .streamsComposerIconButton,
        .shell.expanded .streamsComposerIconButton,
        .shell.collapsed .streamsComposerIconButton {
          grid-area: tools !important;
          width: 36px !important;
          height: 36px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: rgba(30,41,59,.96) !important;
          color: #fff !important;
          box-shadow: none !important;
          font-size: 16px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
          display: grid !important;
          place-items: center !important;
        }

        .shell.desktop .streamsComposerInput,
        .shell.expanded .streamsComposerInput,
        .shell.collapsed .streamsComposerInput {
          grid-area: input !important;
          height: 36px !important;
          min-width: 0 !important;
          border: 0 !important;
          outline: none !important;
          background: transparent !important;
          color: #fff !important;
          box-shadow: none !important;
          font-size: 12px !important;
          line-height: 36px !important;
          font-weight: 800 !important;
          letter-spacing: 0 !important;
          text-shadow: none !important;
          transform: none !important;
        }

        .shell.desktop .streamsComposerInput::placeholder,
        .shell.expanded .streamsComposerInput::placeholder,
        .shell.collapsed .streamsComposerInput::placeholder {
          color: #fff !important;
          opacity: .92 !important;
          font-weight: 800 !important;
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
          color: rgba(255,255,255,.86) !important;
          box-shadow: none !important;
          font-size: 12px !important;
          line-height: 34px !important;
          font-weight: 800 !important;
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
          color: #fff !important;
          box-shadow: none !important;
          font-size: 13px !important;
          line-height: 34px !important;
          display: grid !important;
          place-items: center !important;
        }

        .shell.desktop .streamsComposerSendButton,
        .shell.expanded .streamsComposerSendButton,
        .shell.collapsed .streamsComposerSendButton {
          grid-area: send !important;
          width: 42px !important;
          height: 36px !important;
          border: 0 !important;
          border-radius: 999px !important;
          background: #7c3aed !important;
          color: #fff !important;
          box-shadow: none !important;
          font-size: 16px !important;
          font-weight: 900 !important;
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
          border-bottom: 1px solid rgba(168,85,247,.22) !important;
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
