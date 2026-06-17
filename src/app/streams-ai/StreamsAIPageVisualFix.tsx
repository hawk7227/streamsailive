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

      .streamsComposerRow {
        display: grid !important;
        grid-template-columns: 58px minmax(0, 1fr) 72px !important;
        grid-template-rows: 56px 22px !important;
        grid-template-areas:
          "tools input send"
          ". mode send" !important;
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
        grid-area: mode !important;
        justify-self: start !important;
        align-self: start !important;
      }

      .streamsComposerMicButton {
        grid-area: mode !important;
        justify-self: start !important;
        align-self: start !important;
        margin-left: 118px !important;
      }

      @media (max-width: 760px) {
        .shell .chatPanel .msg.assistant .bubble {
          font-size: 16px !important;
          line-height: 1.45 !important;
        }

        .streamsComposerRow {
          grid-template-columns: 42px minmax(0, 1fr) 52px !important;
          grid-template-rows: 36px 20px !important;
        }

        .streamsComposerMicButton {
          margin-left: 92px !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return null;
}
