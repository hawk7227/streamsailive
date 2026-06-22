"use client";

import { useEffect } from "react";

export default function StreamsAIPageVisualFix() {
  useEffect(() => {
    const id = "streams-ai-active-chat-visual-fix";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .shell {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      }

      .shell.mobile {
        height: 100dvh !important;
        height: var(--vvh) !important;
        overflow: hidden !important;
      }

      .shell.mobile main,
      .shell.mobile .chatPanel {
        height: 100% !important;
        min-height: 0 !important;
        overflow: hidden !important;
      }

      .shell.mobile .chatPanel {
        display: grid !important;
        grid-template-rows: auto minmax(0, 1fr) auto !important;
      }

      .shell.mobile .mobileTop {
        position: sticky !important;
        top: 0 !important;
        z-index: 40 !important;
        min-height: calc(52px + env(safe-area-inset-top)) !important;
        padding-top: env(safe-area-inset-top) !important;
        backdrop-filter: blur(18px) saturate(1.2) !important;
        background: rgba(2, 5, 12, 0.82) !important;
        border-bottom: 1px solid rgba(148, 163, 184, 0.14) !important;
      }

      .shell.mobile .mobileTop strong {
        font-size: 15px !important;
        line-height: 1.1 !important;
        font-weight: 760 !important;
        letter-spacing: 0.06em !important;
      }

      .shell.mobile .chatScroll {
        min-height: 0 !important;
        height: auto !important;
        overflow-y: auto !important;
        overscroll-behavior: contain !important;
        -webkit-overflow-scrolling: touch !important;
        justify-content: flex-start !important;
        padding: 18px 13px calc(154px + env(safe-area-inset-bottom) + var(--keyboard)) !important;
        gap: 14px !important;
        scroll-padding-bottom: calc(154px + env(safe-area-inset-bottom) + var(--keyboard)) !important;
      }

      .shell .chatPanel .msg .avatar,
      .shell .chatPanel .msg.assistant .avatar {
        display: none !important;
      }

      .shell .chatPanel .msg,
      .shell .chatPanel .msg.assistant,
      .shell .chatPanel .msg.user {
        width: 100% !important;
        max-width: 920px !important;
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        gap: 0 !important;
      }

      .shell .chatPanel .msg.assistant {
        margin-right: auto !important;
        margin-left: 0 !important;
      }

      .shell .chatPanel .msg.user {
        width: fit-content !important;
        max-width: min(86%, 720px) !important;
        margin-left: auto !important;
      }

      .shell .chatPanel .msg .bubble,
      .shell .chatPanel .msg.assistant .bubble,
      .shell .chatPanel .msg.user .bubble {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        color: #eef6ff !important;
        font-size: 15px !important;
        line-height: 1.58 !important;
        letter-spacing: -0.01em !important;
        font-weight: 400 !important;
        text-shadow: none !important;
        overflow-wrap: anywhere !important;
        word-break: normal !important;
      }

      .shell .chatPanel .msg.assistant .bubble {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 2px 2px 6px !important;
      }

      .shell .chatPanel .msg.user .bubble {
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18) !important;
        border-radius: 18px 18px 6px 18px !important;
        padding: 11px 13px !important;
        max-height: min(34dvh, 280px) !important;
        overflow: auto !important;
      }

      .shell .chatPanel .msg .bubble *,
      .shell .chatPanel .msg.assistant .bubble *,
      .shell .chatPanel .msg.user .bubble * {
        color: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
        letter-spacing: inherit !important;
        text-shadow: none !important;
      }

      .shell .chatPanel .msg .bubble :is(p, li, td, th, blockquote),
      .shell .chatPanel .msg.assistant .bubble :is(p, li, td, th, blockquote) {
        font-size: 15px !important;
        line-height: 1.58 !important;
        font-weight: 400 !important;
      }

      .shell .chatPanel .msg .bubble :is(strong, b),
      .shell .chatPanel .msg.assistant .bubble :is(strong, b),
      .shell .chatPanel .msg.user .bubble :is(strong, b) {
        font-weight: 650 !important;
      }

      .shell .chatPanel .msg .bubble p {
        margin: 0 0 12px !important;
      }

      .shell .chatPanel .msg .bubble p:last-child {
        margin-bottom: 0 !important;
      }

      .shell .chatPanel .msg .bubble :is(ul, ol) {
        margin: 8px 0 12px !important;
        padding-left: 20px !important;
      }

      .shell .chatPanel .msg .bubble :is(pre, code) {
        white-space: pre-wrap !important;
        word-break: break-word !important;
      }

      .shell.mobile .composer {
        position: fixed !important;
        left: 12px !important;
        right: 12px !important;
        bottom: calc(58px + env(safe-area-inset-bottom) + var(--keyboard)) !important;
        z-index: 60 !important;
        overflow: visible !important;
      }

      .streamsComposer {
        min-height: 60px !important;
        padding: 7px 9px !important;
        border-radius: 28px !important;
        overflow: visible !important;
      }

      .streamsComposerRow {
        display: grid !important;
        grid-template-columns: 42px minmax(0, 1fr) 52px !important;
        grid-template-rows: 46px !important;
        grid-template-areas: "tools input send" !important;
        align-items: center !important;
        gap: 7px !important;
        min-height: 46px !important;
        padding: 0 !important;
      }

      .streamsComposerRow::before {
        inset: 0 !important;
        border-radius: 24px !important;
      }

      .streamsComposerIconButton {
        grid-area: tools !important;
        width: 38px !important;
        height: 38px !important;
        border-radius: 999px !important;
        font-size: 22px !important;
        line-height: 1 !important;
      }

      .streamsComposerInput {
        grid-area: input !important;
        align-self: center !important;
        width: 100% !important;
        min-width: 0 !important;
        font-size: 15px !important;
        line-height: 1.35 !important;
        font-weight: 400 !important;
        letter-spacing: -0.01em !important;
        text-shadow: none !important;
      }

      .streamsComposerInput::placeholder {
        font-weight: 400 !important;
      }

      .streamsComposerSendButton {
        grid-area: send !important;
        width: 46px !important;
        height: 46px !important;
        border-radius: 999px !important;
        font-size: 22px !important;
      }

      .streamsComposerToolPill {
        grid-column: 1 / -1 !important;
        order: 0 !important;
        width: fit-content !important;
        max-width: 100% !important;
        margin: 0 4px 6px !important;
      }

      .streamsComposerPill,
      .streamsComposerMicButton {
        position: absolute !important;
        left: 50% !important;
        top: calc(100% + 7px) !important;
        bottom: auto !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        color: rgba(255, 255, 255, 0.72) !important;
        height: 16px !important;
        padding: 0 !important;
        z-index: 6 !important;
        font-size: 10px !important;
        line-height: 1 !important;
        font-weight: 500 !important;
      }

      .streamsComposerPill {
        transform: translateX(-64%) !important;
      }

      .streamsComposerMicButton {
        transform: translateX(48px) !important;
        margin-left: 0 !important;
      }

      .streamsComposerAttachments {
        max-height: 84px !important;
        overflow-y: auto !important;
      }

      .shell.mobile .mobileNav {
        position: fixed !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 55 !important;
        height: calc(52px + env(safe-area-inset-bottom)) !important;
        min-height: calc(52px + env(safe-area-inset-bottom)) !important;
        padding: 5px 6px calc(5px + env(safe-area-inset-bottom)) !important;
        background: rgba(2, 5, 12, 0.92) !important;
        border-top: 1px solid rgba(148, 163, 184, 0.14) !important;
        backdrop-filter: blur(18px) saturate(1.2) !important;
      }

      .shell.mobile .mobileNav button,
      .shell.mobile .mobileNav a {
        min-height: 38px !important;
        height: 38px !important;
        padding: 4px 7px !important;
        font-size: 10px !important;
        font-weight: 650 !important;
      }

      .shell.mobile .empty {
        margin: auto !important;
        transform: translateY(-20px) !important;
        padding: 0 18px !important;
      }

      .shell.mobile .empty h1 {
        font-size: 30px !important;
        line-height: 1.14 !important;
        font-weight: 560 !important;
        letter-spacing: -0.04em !important;
      }

      .shell.mobile .empty p {
        font-size: 14px !important;
        line-height: 1.45 !important;
        font-weight: 400 !important;
      }

      @media (min-width: 761px) {
        .shell .chatPanel .msg .bubble,
        .shell .chatPanel .msg.assistant .bubble,
        .shell .chatPanel .msg.user .bubble {
          font-size: 16px !important;
          line-height: 1.62 !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
