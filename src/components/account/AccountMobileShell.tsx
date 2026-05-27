"use client";

import { ReactNode } from "react";
import { InstallAppPrompt } from "./InstallAppPrompt";
import { useMobileAppRuntime } from "@/lib/mobile/useMobileAppRuntime";

type AccountMobileShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function AccountMobileShell({ title, subtitle, children, actions }: AccountMobileShellProps) {
  const runtime = useMobileAppRuntime();

  return (
    <main
      className="accountShell"
      data-mobile={runtime.isMobile ? "true" : "false"}
      data-pwa={runtime.isPWA ? "true" : "false"}
      data-display-mode={runtime.displayMode}
      style={
        {
          "--keyboard-offset": `${runtime.keyboardOffset}px`,
          "--app-vh": `${runtime.visualViewportHeight}px`,
        } as React.CSSProperties
      }
    >
      <style>{`
        .accountShell {
          min-height: 100svh;
          min-height: 100dvh;
          background: #f7f7f8;
          color: #111;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .accountTopbar {
          position: sticky;
          top: 0;
          z-index: 20;
          padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 12px;
          background: rgba(247, 247, 248, 0.94);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        }

        .accountTopbar h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.15;
          letter-spacing: -0.03em;
        }

        .accountTopbar p {
          margin: 5px 0 0;
          color: #666;
          font-size: 13px;
          line-height: 1.35;
        }

        .accountScroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          padding: 14px 14px calc(96px + env(safe-area-inset-bottom, 0px) + var(--keyboard-offset, 0px));
        }

        .accountContent {
          width: min(100%, 1120px);
          margin: 0 auto;
          display: grid;
          gap: 14px;
        }

        .accountCard {
          min-width: 0;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
          padding: 16px;
        }

        .accountStickyActions {
          position: sticky;
          bottom: calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-offset, 0px));
          z-index: 30;
          width: min(100%, 1120px);
          margin: 0 auto;
          padding: 10px 14px calc(10px + env(safe-area-inset-bottom, 0px));
          background: linear-gradient(180deg, rgba(247, 247, 248, 0), rgba(247, 247, 248, 0.96) 28%);
        }

        .accountStickyActionsInner {
          display: grid;
          gap: 10px;
        }

        .accountShell button,
        .accountShell a,
        .installAppPrompt button {
          min-height: 44px;
          touch-action: manipulation;
        }

        .installAppPrompt {
          margin: 0 0 12px;
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: center;
          border: 1px solid rgba(0,0,0,.1);
          border-radius: 18px;
          background: #fff;
          padding: 12px;
        }

        .installAppPrompt strong,
        .installAppPrompt span,
        .installAppPrompt em {
          display: block;
        }

        .installAppPrompt strong {
          font-size: 14px;
        }

        .installAppPrompt span,
        .installAppPrompt em {
          color: #666;
          font-size: 12px;
          line-height: 1.35;
          margin-top: 2px;
        }

        .installAppPrompt button {
          border: 1px solid rgba(0,0,0,.12);
          background: #111;
          color: #fff;
          border-radius: 999px;
          padding: 0 14px;
          font-weight: 700;
        }

        .installAppPrompt button:last-child {
          width: 44px;
          padding: 0;
          background: #f4f4f5;
          color: #111;
        }

        input,
        textarea,
        select {
          font-size: 16px;
        }

        @media (min-width: 768px) {
          .accountTopbar {
            padding-left: 28px;
            padding-right: 28px;
          }

          .accountScroll {
            padding: 24px 28px calc(120px + env(safe-area-inset-bottom, 0px) + var(--keyboard-offset, 0px));
          }

          .accountContent {
            gap: 20px;
          }

          .accountStickyActions {
            padding-left: 28px;
            padding-right: 28px;
          }
        }

        @media (min-width: 1100px) {
          .accountShell {
            min-height: 100vh;
          }

          .accountTopbar h1 {
            font-size: 30px;
          }

          .accountContent {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @media (display-mode: standalone), (display-mode: fullscreen) {
          .accountShell {
            background: #fff;
          }
        }
      `}</style>

      <header className="accountTopbar">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>

      <section className="accountScroll">
        <div className="accountContent">
          <InstallAppPrompt />
          {children}
        </div>
      </section>

      {actions ? (
        <footer className="accountStickyActions">
          <div className="accountStickyActionsInner">{actions}</div>
        </footer>
      ) : null}
    </main>
  );
}
