"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const NEAR_BOTTOM_PX = 180;
const INITIAL_SETTLE_MS = 900;
const CACHE_OWNER_KEY = "streams-ai:cache-owner.v1";
const SESSION_CACHE_KEYS = [
  "streams-ai:current-chat-id",
  "streams-ai:sessions.cache.v1",
  "streams:split-preview:last",
];

function findSurface() {
  return document.querySelector(".startChatSurface")
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

export default function ChatScrollController() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [showNewMessages, setShowNewMessages] = useState(false);
  const [portalHost, setPortalHost] = useState(null);
  const surfaceRef = useRef(null);
  const nearBottomRef = useRef(true);
  const initialRestoreRef = useRef(true);
  const userMovedRef = useRef(false);
  const settleTimerRef = useRef(0);

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

    if (previousOwner && previousOwner !== nextOwner) clearAccountScopedChatCache();
    try {
      window.sessionStorage.setItem(CACHE_OWNER_KEY, nextOwner);
    } catch {}
  }, [loading, user?.id]);

  useEffect(() => {
    if (loading) return undefined;

    let cancelled = false;
    let mutationObserver;
    let resizeObserver;
    let retryTimer = 0;
    let imageCleanup = [];

    initialRestoreRef.current = true;
    userMovedRef.current = false;
    nearBottomRef.current = true;
    setShowNewMessages(false);

    const attach = () => {
      if (cancelled) return;
      const surface = findSurface();
      if (!surface) {
        retryTimer = window.setTimeout(attach, 50);
        return;
      }

      surfaceRef.current = surface;

      const restoreAfterRender = () => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (cancelled || !surfaceRef.current) return;
            jumpToBottom(surfaceRef.current);
            nearBottomRef.current = true;
            setShowNewMessages(false);
          });
        });
      };

      restoreAfterRender();
      settleTimerRef.current = window.setTimeout(() => {
        initialRestoreRef.current = false;
      }, INITIAL_SETTLE_MS);

      const onScroll = () => {
        const near = isNearBottom(surface);
        nearBottomRef.current = near;
        if (near) setShowNewMessages(false);
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
        if (initialRestoreRef.current) {
          restoreAfterRender();
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
          if (initialRestoreRef.current || nearBottomRef.current) jumpToBottom(surface);
          else setShowNewMessages(true);
        });
        resizeObserver.observe(surface);
        surface.querySelectorAll("img, video").forEach((node) => resizeObserver.observe(node));
      }

      const wireMedia = () => {
        imageCleanup.forEach((cleanup) => cleanup());
        imageCleanup = [];
        surface.querySelectorAll("img, video").forEach((media) => {
          const onLoad = () => {
            if (initialRestoreRef.current || nearBottomRef.current) jumpToBottom(surface);
            else setShowNewMessages(true);
          };
          media.addEventListener("load", onLoad);
          media.addEventListener("loadedmetadata", onLoad);
          imageCleanup.push(() => {
            media.removeEventListener("load", onLoad);
            media.removeEventListener("loadedmetadata", onLoad);
          });
        });
      };
      wireMedia();

      const mediaObserver = new MutationObserver(wireMedia);
      mediaObserver.observe(surface, { childList: true, subtree: true });
      imageCleanup.push(() => mediaObserver.disconnect());

      return () => {
        surface.removeEventListener("scroll", onScroll);
        surface.removeEventListener("wheel", markUserMovement);
        surface.removeEventListener("touchmove", markUserMovement);
        surface.removeEventListener("pointerdown", markUserMovement);
      };
    };

    let detachSurface = null;
    const start = () => {
      const result = attach();
      if (typeof result === "function") detachSurface = result;
    };
    start();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(settleTimerRef.current);
      mutationObserver?.disconnect();
      resizeObserver?.disconnect();
      imageCleanup.forEach((cleanup) => cleanup());
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
