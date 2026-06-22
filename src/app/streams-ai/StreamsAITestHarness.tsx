"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    StreamsAITestReport?: () => unknown;
    StreamsAITestStop?: () => void;
    StreamsAITestPrompts?: Record<string, string>;
  }
}

const PROMPTS = {
  hello: "hello",
  markdown: "Give me a short formatted answer with a heading, 3 bullet points, one bold sentence, and one short code block.",
  longStreaming: "Give me 25 short numbered items about ideal ChatGPT-style mobile chat streaming behavior.",
  fullCapability: `Run a full visible capability test for this chat system.

Important:
Do not generate files unless asked.
Do not claim external actions were completed unless a tool actually ran.
Answer each section clearly and briefly.

Test these capabilities:

1. Simple chat
Reply to this sentence naturally: hello.

2. Reasoning
Explain in 3 short steps how to decide whether a mobile chat UI is working well.

3. Markdown formatting
Return:
- one heading
- three bullet points
- one bold sentence
- one numbered list with 3 items
- one short code block

4. Summary
Summarize this in one sentence:
A good AI chat app should respond quickly, stream text smoothly, keep the composer visible, avoid covering messages, and show clear error or retry states.

5. UI/UX critique
Give 5 specific checks for comparing this app’s mobile chat behavior to ChatGPT and Claude.

6. Long response streaming
Give 25 short numbered items about ideal chat response streaming behavior.

7. Table rendering
Create a small table with columns:
Capability, Expected behavior, Pass condition.

8. Error handling explanation
Explain what the app should show if a response takes longer than expected.

9. Tool honesty
State what you can and cannot verify from inside this chat without actually running external tools.

10. Final result
End with:
TEST COMPLETE`,
};

export default function StreamsAITestHarness() {
  useEffect(() => {
    const startedAt = Date.now();
    const events: Array<Record<string, unknown>> = [];
    const scrollSamples: Array<Record<string, unknown>> = [];
    const composerSamples: Array<Record<string, unknown>> = [];
    let lastUserText = "";
    let lastAssistantText = "";
    let thinkingSeenAt = 0;
    let stillWorkingSeenAt = 0;
    let firstAssistantContentAt = 0;

    const now = () => Date.now();
    const textOf = (node: Element | null | undefined) => (node?.textContent || "").replace(/\s+/g, " ").trim();
    const log = (type: string, data: Record<string, unknown> = {}) => {
      events.push({ t: now(), ms: now() - startedAt, type, ...data });
    };

    const getChatScroll = () =>
      document.querySelector<HTMLElement>(".chatScroll") ||
      document.querySelector<HTMLElement>(".splitChatScroll") ||
      document.querySelector<HTMLElement>(".startChatSurface");

    const getLatestUser = () => Array.from(document.querySelectorAll<HTMLElement>(".msg.user .bubble")).at(-1) || null;
    const getLatestAssistant = () => Array.from(document.querySelectorAll<HTMLElement>(".msg.assistant .bubble")).at(-1) || null;

    const sampleScroll = () => {
      const scroller = getChatScroll();
      if (!scroller) return null;
      const bottomDistance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      const sample = {
        ms: now() - startedAt,
        scrollTop: Math.round(scroller.scrollTop),
        scrollHeight: Math.round(scroller.scrollHeight),
        clientHeight: Math.round(scroller.clientHeight),
        bottomDistance: Math.round(bottomDistance),
        nearBottom: bottomDistance < 80,
        className: scroller.className,
      };
      scrollSamples.push(sample);
      return sample;
    };

    const sampleComposer = () => {
      const composer = document.querySelector<HTMLElement>(".streamsComposer");
      const nav = document.querySelector<HTMLElement>(".mobileNav");
      const navStyle = nav ? getComputedStyle(nav) : null;
      const keyboardGap = window.visualViewport ? Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop) : 0;
      const sample = {
        ms: now() - startedAt,
        composerFocused: Boolean(composer?.contains(document.activeElement)),
        keyboardLikelyOpen: keyboardGap > 40,
        keyboardGap: Math.round(keyboardGap),
        navVisible: navStyle ? navStyle.visibility !== "hidden" && navStyle.opacity !== "0" : null,
        navTransform: navStyle?.transform || null,
      };
      composerSamples.push(sample);
      return sample;
    };

    const inspect = () => {
      document.querySelectorAll<HTMLElement>(".chatScroll").forEach((node) => node.classList.add("splitChatScroll"));

      const userText = textOf(getLatestUser());
      const assistantText = textOf(getLatestAssistant());

      if (userText && userText !== lastUserText) {
        lastUserText = userText;
        log("user_message_seen", { text: userText.slice(0, 180) });
      }

      if (assistantText && assistantText !== lastAssistantText) {
        const previous = lastAssistantText;
        lastAssistantText = assistantText;

        if (assistantText.includes("Thinking") && !thinkingSeenAt) {
          thinkingSeenAt = now();
          log("thinking_seen", { text: assistantText });
        }

        if (assistantText.includes("Still working") && !stillWorkingSeenAt) {
          stillWorkingSeenAt = now();
          log("still_working_seen", { text: assistantText });
        }

        const realContent = assistantText && !assistantText.includes("Thinking") && !assistantText.includes("Still working") && assistantText.length > 2;
        if (realContent && !firstAssistantContentAt) {
          firstAssistantContentAt = now();
          log("first_assistant_content_seen", { text: assistantText.slice(0, 220) });
        }

        log("assistant_text_changed", { previous: previous.slice(0, 100), current: assistantText.slice(0, 220), length: assistantText.length });
      }

      sampleScroll();
      sampleComposer();
    };

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style"] });
    const interval = window.setInterval(inspect, 500);

    window.StreamsAITestPrompts = PROMPTS;
    window.StreamsAITestReport = () => {
      inspect();
      const report = {
        startedAt: new Date(startedAt).toISOString(),
        totalMs: now() - startedAt,
        latestUserText: lastUserText,
        latestAssistantText: lastAssistantText,
        timing: {
          thinkingSeenMs: thinkingSeenAt ? thinkingSeenAt - startedAt : null,
          stillWorkingSeenMs: stillWorkingSeenAt ? stillWorkingSeenAt - startedAt : null,
          firstAssistantContentMs: firstAssistantContentAt ? firstAssistantContentAt - startedAt : null,
          thinkingToFirstContentMs: thinkingSeenAt && firstAssistantContentAt ? firstAssistantContentAt - thinkingSeenAt : null,
        },
        scrollLatest: scrollSamples.at(-1) || null,
        composerLatest: composerSamples.at(-1) || null,
        events: events.slice(-80),
        scrollSamples: scrollSamples.slice(-30),
        composerSamples: composerSamples.slice(-30),
      };
      console.log("STREAMS_AI_TEST_REPORT", report);
      console.log(JSON.stringify(report, null, 2));
      return report;
    };

    window.StreamsAITestStop = () => {
      window.clearInterval(interval);
      observer.disconnect();
      delete window.StreamsAITestReport;
      delete window.StreamsAITestStop;
      delete window.StreamsAITestPrompts;
      console.log("Streams AI test harness stopped");
    };

    inspect();
    console.info("Streams AI test harness ready. Use StreamsAITestPrompts and StreamsAITestReport().");

    return () => {
      window.clearInterval(interval);
      observer.disconnect();
      delete window.StreamsAITestReport;
      delete window.StreamsAITestStop;
      delete window.StreamsAITestPrompts;
    };
  }, []);

  return null;
}
