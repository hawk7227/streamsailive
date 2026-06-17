"use client";

export default function TopRowWorkstationControls() {
  return (
    <style jsx global>{`
      .workstationShell > .wsChrome {
        justify-content: flex-start !important;
      }

      .workstationShell > .wsChrome .wsControls {
        position: fixed !important;
        top: 6px !important;
        right: 6px !important;
        z-index: 9999 !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        height: 24px !important;
        padding: 0 !important;
        background: transparent !important;
      }

      .workstationShell > .wsChrome .wsControls button {
        width: 24px !important;
        height: 22px !important;
        min-width: 24px !important;
        padding: 0 !important;
        border: 0 !important;
        border-radius: 0 !important;
        background: transparent !important;
        color: #ffffff !important;
        font-size: 14px !important;
        line-height: 22px !important;
        box-shadow: none !important;
      }

      .workstationShell > .wsChrome .wsControls input[type="color"] {
        width: 28px !important;
        height: 16px !important;
        padding: 0 !important;
        border: 1px solid rgba(148, 163, 184, 0.6) !important;
        background: transparent !important;
      }
    `}</style>
  );
}
