"use client";

import { useEffect, useMemo, useState } from "react";

type DisplayMode = "browser" | "standalone" | "fullscreen" | "minimal-ui";

type MobileAppRuntime = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  isFullscreen: boolean;
  isPWA: boolean;
  keyboardOpen: boolean;
  keyboardOffset: number;
  visualViewportHeight: number;
  displayMode: DisplayMode;
  safeAreaSupported: boolean;
};

function getDisplayMode(): DisplayMode {
  if (typeof window === "undefined") return "browser";
  if (window.matchMedia?.("(display-mode: fullscreen)")?.matches) return "fullscreen";
  if (window.matchMedia?.("(display-mode: standalone)")?.matches) return "standalone";
  if (window.matchMedia?.("(display-mode: minimal-ui)")?.matches) return "minimal-ui";
  return "browser";
}

function getRuntime(): MobileAppRuntime {
  if (typeof window === "undefined") {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isIOS: false,
      isAndroid: false,
      isStandalone: false,
      isFullscreen: false,
      isPWA: false,
      keyboardOpen: false,
      keyboardOffset: 0,
      visualViewportHeight: 900,
      displayMode: "browser",
      safeAreaSupported: true,
    };
  }

  const width = window.innerWidth;
  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1100;
  const displayMode = getDisplayMode();
  const isStandalone =
    displayMode === "standalone" ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  const isFullscreen = displayMode === "fullscreen";
  const isPWA = isStandalone || isFullscreen || displayMode === "minimal-ui";

  const vv = window.visualViewport;
  const visualViewportHeight = Math.round(vv?.height || window.innerHeight);
  const visualViewportOffsetTop = Math.round(vv?.offsetTop || 0);
  const keyboardOffset = Math.max(
    0,
    Math.round(window.innerHeight - visualViewportHeight - visualViewportOffsetTop)
  );
  const keyboardOpen = keyboardOffset > 80;

  return {
    isMobile,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    isIOS,
    isAndroid,
    isStandalone,
    isFullscreen,
    isPWA,
    keyboardOpen,
    keyboardOffset,
    visualViewportHeight,
    displayMode,
    safeAreaSupported: true,
  };
}

export function useMobileAppRuntime(): MobileAppRuntime {
  const [runtime, setRuntime] = useState<MobileAppRuntime>(() => getRuntime());

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = getRuntime();
        setRuntime(next);

        document.documentElement.style.setProperty("--app-vh", `${next.visualViewportHeight}px`);
        document.documentElement.style.setProperty("--keyboard-offset", `${next.keyboardOffset}px`);
        document.documentElement.dataset.displayMode = next.displayMode;
        document.documentElement.dataset.mobile = next.isMobile ? "true" : "false";
        document.documentElement.dataset.pwa = next.isPWA ? "true" : "false";
        document.documentElement.dataset.keyboardOpen = next.keyboardOpen ? "true" : "false";
      });
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    const queries = [
      "(display-mode: standalone)",
      "(display-mode: fullscreen)",
      "(display-mode: minimal-ui)",
    ].map((query) => window.matchMedia(query));

    queries.forEach((query) => query.addEventListener?.("change", update));

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      queries.forEach((query) => query.removeEventListener?.("change", update));
    };
  }, []);

  return useMemo(() => runtime, [runtime]);
}
