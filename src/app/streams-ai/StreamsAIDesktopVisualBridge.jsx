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
          height: auto !important;
          max-height: none !important;
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
          height: auto !important;
          display: grid !important;
          grid-template-columns: 36px minmax(0,1fr) auto 34px 42px !important;
          grid-template-rows: auto !important;
          grid-template-areas: "tools input mode mic send" !important;
          align-items: flex-end !important;
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
          align-self: flex-end !important;
        }

        .shell.desktop .streamsComposerInput,
        .shell.expanded .streamsComposerInput,
        .shell.collapsed .streamsComposerInput {
          grid-area: input !important;
          min-height: 36px !important;
          height: auto !important;
          max-height: 168px !important;
          min-width: 0 !important;
          border: 0 !important;
          outline: none !important;
          background: transparent !important;
          color: #fff !important;
          box-shadow: none !important;
          font-size: 12px !important;
          line-height: 1.28 !important;
          font-weight: 800 !important;
          letter-spacing: 0 !important;
          text-shadow: none !important;
          transform: none !important;
          overflow-y: auto !important;
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
          word-break: break-word !important;
          padding: 8px 0 !important;
          margin: 0 !important;
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
          align-self: flex-end !important;
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
          align-self: flex-end !important;
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
          align-self: flex-end !important;
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

        /* New-chat landing must retain the original full two-row console. */
        .operatorNewChatLanding .operatorLandingComposer .streamsComposer {
          min-height: 96px !important;
          height: auto !important;
          padding: 8px 10px 7px !important;
          border: 1.5px solid transparent !important;
          border-radius: 28px !important;
          background: linear-gradient(rgba(35,21,82,.88), rgba(42,34,112,.78)) padding-box,
                      linear-gradient(92deg,#d946ef,#7c3aed 54%,#2563eb) border-box !important;
          box-shadow: 0 0 28px rgba(217,70,239,.52),0 14px 48px rgba(0,0,0,.34),inset 0 0 22px rgba(124,58,237,.24) !important;
          backdrop-filter: blur(18px) saturate(1.25) !important;
          -webkit-backdrop-filter: blur(18px) saturate(1.25) !important;
          overflow: visible !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposer::before,
        .operatorNewChatLanding .operatorLandingComposer .streamsComposer::after {
          display: block !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerRow {
          min-height: 78px !important;
          display: grid !important;
          grid-template-columns: 44px auto 28px minmax(0,1fr) 58px !important;
          grid-template-rows: 48px 24px !important;
          grid-template-areas:
            "tools input input input send"
            ". mode mic . send" !important;
          align-items: center !important;
          gap: 0 8px !important;
          padding: 0 !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerRow::before {
          inset: -1px -3px 34px -3px !important;
          border-radius: 24px !important;
          background: rgba(5,7,18,.3) !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerIconButton {
          grid-area: tools !important;
          width: 44px !important;
          height: 44px !important;
          border-radius: 16px !important;
          border: 1px solid rgba(217,70,239,.34) !important;
          background: rgba(90,40,160,.24) !important;
          box-shadow: inset 0 0 14px rgba(217,70,239,.1),0 0 14px rgba(124,58,237,.14) !important;
          font-size: 24px !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerInput {
          grid-area: input !important;
          min-height: 44px !important;
          max-height: 168px !important;
          padding: 10px 0 7px !important;
          font-size: 17px !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          letter-spacing: -.025em !important;
          align-self: center !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerPill {
          grid-area: mode !important;
          justify-self: start !important;
          align-self: center !important;
          width: auto !important;
          min-width: max-content !important;
          height: 22px !important;
          padding: 0 !important;
          font-size: 14px !important;
          line-height: 22px !important;
          color: #fff !important;
          border-radius: 0 !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerMicButton {
          grid-area: mic !important;
          justify-self: start !important;
          align-self: center !important;
          width: 28px !important;
          height: 22px !important;
          margin: 0 !important;
          padding: 0 !important;
          font-size: 13px !important;
          line-height: 22px !important;
          color: #fff !important;
        }

        .operatorNewChatLanding .operatorLandingComposer .streamsComposerSendButton {
          grid-area: send !important;
          align-self: center !important;
          width: 58px !important;
          height: 58px !important;
          border-radius: 21px !important;
          background: linear-gradient(135deg,#d946ef 0%,#7c3aed 55%,#06d9ff 100%) !important;
          box-shadow: 0 0 22px rgba(217,70,239,.62),inset 0 1px 16px rgba(255,255,255,.22) !important;
          font-size: 25px !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
