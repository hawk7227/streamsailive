"use client";

import { useEffect, useState } from "react";
import { useMobileAppRuntime } from "@/lib/mobile/useMobileAppRuntime";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppPrompt() {
  const runtime = useMobileAppRuntime();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator && window.location.protocol === "https:") {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => setServiceWorkerReady(true))
        .catch(() => setServiceWorkerReady(false));
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (runtime.isPWA || dismissed || (!runtime.isMobile && !runtime.isTablet)) return null;

  const canPrompt = runtime.isAndroid && promptEvent;

  return (
    <section className="installAppPrompt" aria-label="Install StreamsAI app">
      <div>
        <strong>Install StreamsAI</strong>
        <span>
          {runtime.isIOS
            ? "For app mode on iPhone: Share → Add to Home Screen."
            : canPrompt
              ? "Add StreamsAI to your home screen for app-style fullscreen use."
              : "Use your browser install option to add StreamsAI to your home screen."}
        </span>
        {!serviceWorkerReady ? <em>Offline shell is not active yet.</em> : null}
      </div>

      {canPrompt ? (
        <button
          type="button"
          onClick={async () => {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
            setDismissed(true);
          }}
        >
          Install
        </button>
      ) : null}

      <button type="button" aria-label="Dismiss install prompt" onClick={() => setDismissed(true)}>
        ×
      </button>
    </section>
  );
}
