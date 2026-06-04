import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/account", label: "General" },
  { href: "/account/profile", label: "Account" },
  { href: "/account/privacy", label: "Privacy / Data Controls" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/usage", label: "Usage" },
  { href: "/account/credits", label: "Credits" },
  { href: "/account/modules", label: "Capabilities" },
  { href: "/account/apps", label: "Connectors / Apps" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/personalization", label: "Personalization" },
  { href: "/account/storage", label: "Storage" },
  { href: "/account/security", label: "Security" },
  { href: "/account/keyboard", label: "Keyboard" },
  { href: "/account/help", label: "Help" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="accountRouteShell">
      <style>{`
        .accountRouteShell {
          min-height: 100svh;
          min-height: 100dvh;
          background:
            radial-gradient(circle at 16% 0%, rgba(56,189,248,.18), transparent 28%),
            radial-gradient(circle at 92% 18%, rgba(139,92,246,.18), transparent 34%),
            linear-gradient(180deg, #030815 0%, #02050c 100%);
          color: #f8fbff;
        }

        .accountRouteNav {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
          background: rgba(2, 6, 23, 0.92);
          border-bottom: 1px solid rgba(148, 163, 184, .16);
          backdrop-filter: blur(18px);
          -webkit-overflow-scrolling: touch;
        }

        .accountRouteNav a {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          border: 1px solid rgba(74,222,255,.16);
          border-radius: 999px;
          padding: 0 12px;
          background: rgba(9,16,38,.68);
          color: rgba(226,238,255,.84);
          text-decoration: none;
          font-size: 12px;
          font-weight: 800;
        }

        .accountRouteNav a:hover {
          border-color: rgba(74,222,255,.34);
          color: #fff;
          background: rgba(56,189,248,.12);
        }

        .account-scroll-root {
          min-width: 0;
        }

        @media (min-width: 1100px) {
          .accountRouteShell {
            display: grid;
            grid-template-columns: 252px minmax(0, 1fr);
          }

          .accountRouteNav {
            position: sticky;
            top: 0;
            height: 100vh;
            align-content: start;
            flex-direction: column;
            justify-content: start;
            border-right: 1px solid rgba(148, 163, 184, .16);
            border-bottom: 0;
            padding: 22px 14px;
          }

          .accountRouteNav a {
            justify-content: flex-start;
            width: 100%;
          }
        }
      `}</style>

      <nav className="accountRouteNav" aria-label="Account sections">
        {tabs.map((tab) => (
          <Link href={tab.href} key={tab.href}>
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="account-scroll-root">{children}</div>
    </div>
  );
}
