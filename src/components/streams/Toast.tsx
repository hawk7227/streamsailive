"use client";

/**
 * Toast notification system for the Streams panel.
 * Replaces all console.error + inline text error states.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.error("Generation failed — check API key");
 *   toast.success("Video ready");
 *   toast.info("Polling…");
 *
 * Rendered by wrapping the panel in <ToastProvider>:
 *   <ToastProvider><StreamsPanel /></ToastProvider>
 *
 * Or import standalone <ToastContainer> alongside the panel.
 */

import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { C, R, DUR, EASE } from "./tokens";

type ToastType = "success" | "error" | "info" | "warn";

interface Toast {
  id:      string;
  type:    ToastType;
  message: string;
}

interface ToastCtx {
  toast: {
    success: (msg: string) => void;
    error:   (msg: string) => void;
    info:    (msg: string) => void;
    warn:    (msg: string) => void;
  };
}

const ToastContext = createContext<ToastCtx>({
  toast: {
    success: () => {},
    error:   () => {},
    info:    () => {},
    warn:    () => {},
  },
});

export function useToast() {
  return useContext(ToastContext);
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg:"rgba(16,185,129,0.12)",  border:"rgba(16,185,129,0.3)", icon:"✓" },
  error:   { bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)",  icon:"✗" },
  info:    { bg:"rgba(124,58,237,0.10)",  border:"rgba(124,58,237,0.3)", icon:"●" },
  warn:    { bg:"rgba(245,158,11,0.10)",  border:"rgba(245,158,11,0.3)", icon:"!" },
};
const TEXT_COLORS: Record<ToastType, string> = {
  success: "rgba(16,185,129,1)",
  error:   "rgba(239,68,68,1)",
  info:    C.acc2,
  warn:    "rgba(245,158,11,1)",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const add = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev: Toast[]) => [...prev.slice(-4), { id, type, message }]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
      delete timers.current[id];
    }, type === "error" ? 6000 : 3500);
  }, []);

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev: Toast[]) => prev.filter((t: Toast) => t.id !== id));
  }, []);

  const ctx: ToastCtx = {
    toast: {
      success: (m) => add("success", m),
      error:   (m) => add("error",   m),
      info:    (m) => add("info",    m),
      warn:    (m) => add("warn",    m),
    },
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div style={{
        position:"fixed", bottom:24, right:24, zIndex:9999,
        display:"flex", flexDirection:"column", gap:8,
        pointerEvents:"none",
      }}>
        {toasts.map((t: Toast) => {
          const col = COLORS[t.type];
          return (
            <div key={t.id} style={{
              display:"flex", alignItems:"flex-start", gap:10,
              padding:"8px 16px",
              borderRadius:R.r2,
              background:col.bg,
              border:`1px solid ${col.border}`,
              backdropFilter:"blur(12px)",
              minWidth:240, maxWidth:360,
              boxShadow:"0 4px 14px rgba(0,0,0,0.4)",
              pointerEvents:"all",
              animation:`streams-toast-in ${DUR.fast}ms ${EASE}`,
            }}>
              <span style={{ fontSize:13, color:TEXT_COLORS[t.type], flexShrink:0, marginTop:1 }}>
                {col.icon}
              </span>
              <span style={{ fontSize:13, color:C.t1, flex:1, lineHeight:1.5 }}>
                {t.message}
              </span>
              <button onClick={() => dismiss(t.id)} style={{
                background:"none", border:"none", color:C.t4, fontSize:14,
                cursor:"pointer", padding:0, lineHeight:1, flexShrink:0,
              }}>×</button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes streams-toast-in {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
