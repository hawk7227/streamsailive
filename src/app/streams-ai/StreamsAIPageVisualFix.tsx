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
        padding-bottom: calc(194px + var(--keyboard)) !important;
        justify-content: center !important;
      }

      .shell.mobile .empty {
        margin: auto !important;
        transform: translateY(-16px) !important;
      }

      .shell.mobile .composer {
        bottom: calc(78px + var(--keyboard)) !important;
        left: 12px !important;
        right: 12px !important;
      }

      .streamsComposer {
        min-height: 112px !important;
        padding-bottom: 36px !important;
        overflow: visible !important;
      }

      .streamsComposerRow {
        display: grid !important;
        grid-template-columns: 58px minmax(0, 1fr) 72px !important;
        grid-template-rows: 56px !important;
        grid-template-areas: "tools input send" !important;
        align-items: center !important;
      }

      .streamsComposerInput {
        grid-area: input !important;
      }

      .streamsComposerIconButton {
        grid-area: tools !important;
      }

      .streamsComposerSendButton {
        grid-area: send !important;
      }

      .streamsComposerPill {
        position: absolute !important;
        left: 88px !important;
        bottom: 8px !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      .streamsComposerMicButton {
        position: absolute !important;
        left: 210px !important;
        bottom: 8px !important;
        margin-left: 0 !important;
        background: transparent !important;
        border: 0 !important;
        box-shadow: none !important;
      }

      @media (max-width: 760px) {
        .shell .chatPanel .msg.assistant .bubble {
          font-size: 16px !important;
          line-height: 1.45 !important;
        }

        .shell.mobile .chatScroll {
          padding-top: 86px !important;
          padding-bottom: calc(188px + var(--keyboard)) !important;
        }

        .shell.mobile .empty h1 {
          font-size: 29px !important;
          line-height: 1.18 !important;
        }

        .shell.mobile .empty p {
          font-size: 13px !important;
          line-height: 1.35 !important;
        }

        .streamsComposer {
          min-height: 104px !important;
          padding-bottom: 32px !important;
        }

        .streamsComposerRow {
          grid-template-columns: 42px minmax(0, 1fr) 52px !important;
          grid-template-rows: 52px !important;
        }

        .streamsComposerPill {
          left: 82px !important;
          bottom: 7px !important;
        }

        .streamsComposerMicButton {
          left: 198px !important;
          bottom: 7px !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
