"use client";

import { useEffect } from "react";

export default function StreamsAIPageVisualFix() {
  useEffect(() => {
    const id = "streams-ai-active-chat-visual-fix";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .shell .chatPanel .msg .avatar,
      .shell .chatPanel .msg.assistant .avatar {
        display: none !important;
      }

      .shell .chatPanel .msg.assistant {
        grid-template-columns: minmax(0, 1fr) !important;
        margin-left: 0 !important;
      }

      .shell .chatPanel .msg.assistant .bubble {
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        padding: 0 !important;
        color: #ffffff !important;
        font-size: 18px !important;
        font-weight: 900 !important;
        line-height: 1.45 !important;
      }

      .shell .chatPanel .msg.assistant .bubble *,
      .shell .chatPanel .msg.user .bubble,
      .shell .chatPanel .msg.user .bubble * {
        color: #ffffff !important;
        font-weight: 900 !important;
      }

      .shell.mobile .chatScroll {
        padding-top: 92px !important;
        padding-bottom: calc(172px + var(--keyboard)) !important;
        justify-content: center !important;
      }

      .shell.mobile .empty {
        margin: auto !important;
        transform: translateY(-16px) !important;
      }

      .shell.mobile .composer {
        bottom: calc(72px + var(--keyboard)) !important;
        left: 12px !important;
        right: 12px !important;
        overflow: visible !important;
      }

      .streamsComposer {
        min-height: 62px !important;
        padding: 7px 10px !important;
        overflow: visible !important;
      }

      .streamsComposerRow {
        display: grid !important;
        grid-template-columns: 58px minmax(0, 1fr) 72px !important;
        grid-template-rows: 52px !important;
        grid-template-areas: "tools input send" !important;
        align-items: center !important;
      }

      .streamsComposerInput {
        grid-area: input !important;
        align-self: center !important;
      }

      .streamsComposerIconButton {
        grid-area: tools !important;
      }

      .streamsComposerSendButton {
        grid-area: send !important;
      }

      .streamsComposerPill {
        position: absolute !important;
        left: 50% !important;
        top: calc(100% + 4px) !important;
        bottom: auto !important;
        transform: translateX(-58%) !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        height: 18px !important;
        padding: 0 !important;
        z-index: 6 !important;
      }

      .streamsComposerMicButton {
        position: absolute !important;
        left: 50% !important;
        top: calc(100% + 4px) !important;
        bottom: auto !important;
        transform: translateX(54px) !important;
        margin-left: 0 !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
        height: 18px !important;
        padding: 0 !important;
        z-index: 6 !important;
      }

      @media (max-width: 760px) {
        .shell .chatPanel .msg.assistant .bubble {
          font-size: 16px !important;
          line-height: 1.45 !important;
        }

        .shell.mobile .chatScroll {
          padding-top: 86px !important;
          padding-bottom: calc(162px + var(--keyboard)) !important;
        }

        .shell.mobile .empty h1 {
          font-size: 29px !important;
          line-height: 1.18 !important;
        }

        .shell.mobile .empty p {
          font-size: 13px !important;
          line-height: 1.35 !important;
        }

        .shell.mobile .composer {
          bottom: calc(68px + var(--keyboard)) !important;
        }

        .streamsComposer {
          min-height: 58px !important;
          padding: 6px 8px !important;
        }

        .streamsComposerRow {
          grid-template-columns: 42px minmax(0, 1fr) 52px !important;
          grid-template-rows: 48px !important;
        }

        .streamsComposerPill {
          top: calc(100% + 3px) !important;
          transform: translateX(-58%) !important;
        }

        .streamsComposerMicButton {
          top: calc(100% + 3px) !important;
          transform: translateX(48px) !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
