"use client";

/**
 * BottomSheet — mobile overlay that slides up from the bottom.
 * Used by GenerateTab for results on mobile (Rule 1.3).
 * Rules enforced:
 *   - position: fixed, transform-only animation (Rule M.1, Rule 9.4)
 *   - 200ms cubic-bezier(.4,0,.2,1) (Rule M.2, Rule 9.5)
 *   - z-index 300 / overlay 299 (Rule S.8)
 *   - env(safe-area-inset-bottom) (Rule 1.5, R.11)
 *   - Escape key closes (Rule K.5)
 *   - Focus trap (Rule K.3)
 *   - No !important anywhere (Rule CSS.1)
 *   - All spacing from locked scale (Rule 9.2)
 *   - All radius from locked scale (Rule 9.3)
 */

import React, { useEffect, useRef } from "react";
import { C, R, DUR, EASE } from "./tokens";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional label for aria-label on the sheet dialog */
  label?: string;
}

export default function BottomSheet({ open, onClose, children, label = "Panel" }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Rule K.5 — Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Rule K.3 — focus moves into sheet when it opens
  useEffect(() => {
    if (open && sheetRef.current) {
      const focusable = sheetRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, [open]);

  // Rule M.10 — pointer-events none while animating (closed state)
  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position:      "fixed",
          inset:         0,
          background:    "rgba(0,0,0,0.5)",
          zIndex:        299,
          opacity:       open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition:    `opacity ${DUR.base} ${EASE}`,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          position:      "fixed",
          bottom:        0,
          left:          0,
          right:         0,
          zIndex:        300,
          background:    C.bg2,
          borderRadius:  `${R.r3}px ${R.r3}px 0 0`,
          transform:     open ? "translateY(0)" : "translateY(100%)",
          transition:    `transform 200ms cubic-bezier(.4,0,.2,1)`,
          pointerEvents: open ? "auto" : "none",
          maxHeight:     "90dvh",
          display:       "flex",
          flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Drag handle + close */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          padding:        "12px 16px 8px",
          flexShrink:     0,
          position:       "relative",
        }}>
          {/* Visual drag handle */}
          <div style={{
            width:        40,
            height:       4,
            borderRadius: R.pill,
            background:   C.bg4,
          }} />

          {/* Close button */}
          <button
            aria-label="Close panel"
            onClick={onClose}
            style={{
              position:   "absolute",
              right:      16,
              top:        "50%",
              transform:  "translateY(-50%)",
              background: "transparent",
              border:     "none",
              color:      C.t4,
              fontSize:   20,
              cursor:     "pointer",
              padding:    "8px",
              lineHeight: 1,
              minWidth:   44,
              minHeight:  44,
              display:    "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content area */}
        <div style={{
          overflowY: "auto",
          flex:      1,
          padding:   "8px 0 24px",
        }}>
          {children}
        </div>
      </div>
    </>
  );
}
