"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NEAR_BOTTOM_PX = 180;
const CACHE_OWNER_KEY = "streams-ai:cache-owner.v1";
const SESSION_CACHE_KEYS = [
  "streams-ai:current-chat-id",
  "streams-ai:sessions.cache.v1",
  "streams:split-preview:last",
];

function findSurface() {
  return document.querySelector(".operatorChatScroll")
    || document.querySelector(".startChatSurface")
    || document.querySelector(".chatScroll")
    || document.querySelector(".splitChatScroll");
}

function isNearBottom(node) {
  if (!node) return true;
  return node.scrollHeight - node.scrollTop - node.clientHeight <= NEAR_BOTTOM_PX;
}

function jumpToBottom(node) {
  if (!node) return;
  node.scrollTop = node.scrollHeight;
}

function smoothToBottom(node) {
  if (!node) return;
  node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
}

function clearAccountScopedChatCache() {
  try {
    SESSION_CACHE_KEYS.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {}
}

function nextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}

async function waitForCurrentMedia(surface) {
  const media = Array.from(surface.querySelectorAll("img, video"));
  await Promise.all(media.map((node) => {
    if (node.tagName === "IMG") {
      if (node.complete) return typeof node.decode === "function" ? node.decode().catch(() => {}) : Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        node.addEventListener("load", done, { once: true });
        node.addEventListener("error", done, { once: true });
      });
    }
    if (node.readyState >= 1) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      node.addEventListener("loadedmetadata", done, { once: true });
      node.addEventListener("error", done, { once: true });
    });
  }));
}

export default function ChatScrollController() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [portalHost, setPortalHost] = useState(null);
  const surfaceRef = useRef(null);
  const nearBottomRef = useRef(true);
  const initialRestoreRef = useRef(true);
  const userMovedRef = useRef(false);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (loading || typeof window === "undefined") return;
    const nextOwner = user?.id || "signed-out";
    let previousOwner = "";
    try {
      previousOwner = window.sessionStorage.getItem(CACHE_OWNER_KEY) || "";
    } catch {}

    if (previousOwner !== nextOwner) clearAccountScopedChatCache();
    try {
      window.sessionStorage.setItem(CACHE_OWNER_KEY, nextOwner);
    } catch {}
  }, [loading, user?.id]);

  useEffect(() => {
    if (loading) return undefined;

    let cancelled = false;
    let rootObserver;
    let mutationObserver;
    let resizeObserver;
    let mediaObserver;
    let detachSurface = null;
    const mediaCleanup = new Map();

    initialRestoreRef.current = true;
    userMovedRef.current = false;
    nearBottomRef.current = true;
    setShowNewMessages(false);

    const wireMedia = (surface) => {
      const current = new Set(surface.querySelectorAll("img, video"));
      for (const [node, cleanup] of mediaCleanup.entries()) {
        if (!current.has(node)) {
          cleanup();
          mediaCleanup.delete(node);
        }
      }
      current.forEach((media) => {
        if (mediaCleanup.has(media)) return;
        const onLoad = () => {
          if (cancelled) return;
          if (initialRestoreRef.current || nearBottomRef.current) jumpToBottom(surface);
          else setShowNewMessages(true);
        };
        media.addEventListener("load", onLoad);
        media.addEventListener("loadedmetadata", onLoad);
        media.addEventListener("error", onLoad);
        mediaCleanup.set(media, () => {
          media.removeEventListener("load", onLoad);
          media.removeEventListener("loadedmetadata", onLoad);
          media.removeEventListener("error", onLoad);
        });
      });
    };

    const applyInitialRestore = async (surface) => {
      await nextPaint();
      if (cancelled || surfaceRef.current !== surface) return;
      jumpToBottom(surface);
      if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
      await waitForCurrentMedia(surface);
      await nextPaint();
      if (cancelled || surfaceRef.current !== surface) return;
      jumpToBottom(surface);
      nearBottomRef.current = true;
      initialRestoreRef.current = false;
      setShowNewMessages(false);
    };

    const attachSurface = (surface) => {
      if (surfaceRef.current === surface) return;
      detachSurface?.();
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      mediaObserver?.disconnect();
      mediaCleanup.forEach((cleanup) => cleanup());
      mediaCleanup.clear();

      surfaceRef.current = surface;
      initialRestoreRef.current = true;
      userMovedRef.current = false;
      nearBottomRef.current = true;

      const onScroll = () => {
        const near = isNearBottom(surface);
        nearBottomRef.current = near;
        if (near) {
          userMovedRef.current = false;
          setShowNewMessages(false);
        }
      };
      const markUserMovement = () => {
        userMovedRef.current = true;
        if (!isNearBottom(surface)) nearBottomRef.current = false;
      };

      surface.addEventListener("scroll", onScroll, { passive: true });
      surface.addEventListener("wheel", markUserMovement, { passive: true });
      surface.addEventListener("touchmove", markUserMovement, { passive: true });
      surface.addEventListener("pointerdown", markUserMovement, { passive: true });

      const handleGrowth = () => {
        wireMedia(surface);
        if (initialRestoreRef.current) {
          jumpToBottom(surface);
          return;
        }
        if (nearBottomRef.current) {
          smoothToBottom(surface);
          return;
        }
        setShowNewMessages(true);
      };

      mutationObserver = new MutationObserver(handleGrowth);
      mutationObserver.observe(surface, { childList: true, subtree: true, characterData: true });

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (initialRestoreRef.current) jumpToBottom(surface);
          else if (nearBottomRef.current && !userMovedRef.current) jumpToBottom(surface);
          else if (!nearBottomRef.current) setShowNewMessages(true);
        });
        resizeObserver.observe(surface);
      }

      mediaObserver = new MutationObserver(() => wireMedia(surface));
      mediaObserver.observe(surface, { childList: true, subtree: true });
      wireMedia(surface);
      void applyInitialRestore(surface);

      detachSurface = () => {
        surface.removeEventListener("scroll", onScroll);
        surface.removeEventListener("wheel", markUserMovement);
        surface.removeEventListener("touchmove", markUserMovement);
        surface.removeEventListener("pointerdown", markUserMovement);
      };
    };

    const discoverSurface = () => {
      if (cancelled) return;
      const surface = findSurface();
      if (surface) attachSurface(surface);
    };

    rootObserver = new MutationObserver(discoverSurface);
    rootObserver.observe(document.body, { childList: true, subtree: true });
    discoverSurface();

    return () => {
      cancelled = true;
      rootObserver?.disconnect();
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      mediaObserver?.disconnect();
      mediaCleanup.forEach((cleanup) => cleanup());
      mediaCleanup.clear();
      detachSurface?.();
      surfaceRef.current = null;
    };
  }, [loading, pathname, user?.id]);

  const goToLatest = () => {
    const surface = surfaceRef.current || findSurface();
    jumpToBottom(surface);
    nearBottomRef.current = true;
    userMovedRef.current = false;
    setShowNewMessages(false);
  };

  if (!portalHost || !showNewMessages) return null;

  return createPortal(
    <button
      type="button"
      className="streamsNewMessagesButton"
      onClick={goToLatest}
      aria-label="Jump to new messages"
    >
      New messages ↓
    </button>,
    portalHost,
  );
}
