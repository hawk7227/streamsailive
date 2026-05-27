import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/account", label: "General" },
  { href: "/account/profile", label: "Account" },
  { href: "/account/privacy", label: "Privacy" },
  { href: "/account/billing", label: "Billing" },
  { href: "/account/credits", label: "Credits / Usage" },
  { href: "/account/modules", label: "Capabilities" },
  { href: "/account/apps", label: "Connectors" },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="accountRouteShell">
      <style>{`
        .accountRouteShell {
          min-height: 100svh;
          min-height: 100dvh;
          background: #f7f7f8;
          color: #111;
        }

        .accountRouteNav {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: calc(10px + env(safe-area-inset-top, 0px)) 12px 10px;
          background: rgba(247, 247, 248, 0.94);
          border-bottom: 1px solid rgba(0,0,0,.08);
          backdrop-filter: blur(18px);
          -webkit-overflow-scrolling: touch;
        }

        .accountRouteNav a {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          border: 1px solid rgba(0,0,0,.1);
          border-radius: 999px;
          padding: 0 14px;
          background: #fff;
          color: #111;
          text-decoration: none;
          font-size: 14px;
          font-weight: 650;
        }

        .accountGrid {
          display: grid;
          gap: 14px;
        }

        .accountCardTitle {
          margin: 0 0 6px;
          font-size: 16px;
          letter-spacing: -.02em;
        }

        .accountMuted {
          color: #666;
          font-size: 13px;
          line-height: 1.45;
        }

        .accountKpis {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .accountKpi {
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 18px;
          background: #fafafa;
          padding: 14px;
        }

        .accountKpi strong {
          display: block;
          font-size: 24px;
          line-height: 1.1;
          letter-spacing: -.04em;
        }

        .accountKpi span {
          display: block;
          margin-top: 5px;
          color: #666;
          font-size: 12px;
        }

        .accountList {
          display: grid;
          gap: 10px;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .accountRowCard {
          min-height: 54px;
          border: 1px solid rgba(0,0,0,.08);
          border-radius: 16px;
          padding: 12px;
          background: #fff;
          display: grid;
          gap: 4px;
        }

        .accountBadge {
          display: inline-flex;
          min-height: 28px;
          align-items: center;
          width: max-content;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.1);
          padding: 0 10px;
          background: #f4f4f5;
          font-size: 12px;
          font-weight: 700;
        }

        .accountButton {
          min-height: 44px;
          border: 0;
          border-radius: 999px;
          background: #111;
          color: #fff;
          padding: 0 16px;
          font-weight: 750;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .accountButton.secondary {
          background: #fff;
          color: #111;
          border: 1px solid rgba(0,0,0,.12);
        }

        .accountForm {
          display: grid;
          gap: 12px;
        }

        .accountForm label {
          display: grid;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
        }

        .accountForm input,
        .accountForm select,
        .accountForm textarea {
          min-height: 44px;
          width: 100%;
          border: 1px solid rgba(0,0,0,.12);
          border-radius: 14px;
          padding: 10px 12px;
          background: #fff;
          color: #111;
          font-size: 16px;
        }

        .accountForm textarea {
          min-height: 120px;
          resize: vertical;
        }

        .accountBlocked {
          border: 1px solid rgba(173, 95, 0, .22);
          background: #fff8ed;
          color: #6b3b00;
          border-radius: 16px;
          padding: 12px;
          font-size: 13px;
          line-height: 1.45;
        }

        @media (min-width: 768px) {
          .accountRouteNav {
            justify-content: center;
            padding-left: 24px;
            padding-right: 24px;
          }

          .accountKpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (min-width: 1100px) {
          .accountRouteShell {
            display: grid;
            grid-template-columns: 260px minmax(0, 1fr);
          }

          .accountRouteNav {
            position: sticky;
            top: 0;
            height: 100vh;
            align-content: start;
            flex-direction: column;
            justify-content: start;
            border-right: 1px solid rgba(0,0,0,.08);
            border-bottom: 0;
            padding: 28px 18px;
          }

          .accountRouteNav a {
            justify-content: flex-start;
            width: 100%;
          }

          .accountKpis {
            grid-template-columns: repeat(4, minmax(0, 1fr));
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

      {children}
    </div>
  );
}
