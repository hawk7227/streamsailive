"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AIAssistant, { type ProactiveMessage } from "@/components/dashboard/AIAssistant";

type ActionPayload = Record<string, unknown>;

type ParentToEmbedMessage =
  | { type: "PIPELINE_ASSISTANT_INIT"; payload?: { context?: Record<string, unknown>; proactiveMessage?: ProactiveMessage | null } }
  | { type: "PIPELINE_ASSISTANT_CONTEXT"; payload?: { context?: Record<string, unknown> } }
  | { type: "PIPELINE_ASSISTANT_PROACTIVE"; payload?: { proactiveMessage?: ProactiveMessage | null } };

type EmbedToParentMessage = {
  type: "PIPELINE_ASSISTANT_ACTION";
  action: string;
  payload?: ActionPayload;
};

function postAction(action: string, payload: ActionPayload = {}) {
  if (typeof window === "undefined") return;
  const message: EmbedToParentMessage = { type: "PIPELINE_ASSISTANT_ACTION", action, payload };
  window.parent.postMessage(message, window.location.origin);
}

export default function PipelineAssistantEmbed() {
  const [context, setContext] = useState<Record<string, unknown>>({ type: "pipeline" });
  const [proactiveMessage, setProactiveMessage] = useState<ProactiveMessage | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent<ParentToEmbedMessage>) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "PIPELINE_ASSISTANT_INIT") {
        if (data.payload?.context) setContext(data.payload.context);
        setProactiveMessage(data.payload?.proactiveMessage ?? null);
        return;
      }
      if (data.type === "PIPELINE_ASSISTANT_CONTEXT") {
        if (data.payload?.context) setContext(data.payload.context);
        return;
      }
      if (data.type === "PIPELINE_ASSISTANT_PROACTIVE") {
        setProactiveMessage(data.payload?.proactiveMessage ?? null);
      }
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "PIPELINE_ASSISTANT_READY" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const actionProps = useMemo(() => ({
    onApplyPrompt: (prompt: string) => postAction("update_prompt", { value: prompt }),
    onUpdateSettings: (key: string, value: string) => postAction("update_settings", { key, value }),
    onGenerateImage: (conceptId?: string, prompt?: string) => postAction("generate_image", { conceptId, prompt }),
    onGenerateVideo: (conceptId?: string, prompt?: string) => postAction("generate_video", { conceptId, prompt }),
    onGenerateSong: (prompt?: string) => postAction("generate_song", { prompt }),
    onBuildStoryBible: (storyText?: string) => postAction("build_story_bible", { storyText }),
    onRunPipeline: () => postAction("run_pipeline"),
    onRunStep: (stepId: string, data?: Record<string, unknown>) => postAction("run_step", { stepId, data }),
    onSelectConcept: (conceptId: string) => postAction("select_concept", { conceptId }),
    onApproveOutput: (type: string, url: string) => postAction("approve_output", { type, url }),
    onOpenStepConfig: (stepId: string) => postAction("open_step_config", { stepId }),
    onSetNiche: (nicheId: string) => postAction("set_niche", { nicheId }),
    onUpdateImagePrompt: (value: string) => postAction("update_image_prompt", { value }),
    onUpdateVideoPrompt: (value: string) => postAction("update_video_prompt", { value }),
    onUpdateStrategyPrompt: (value: string) => postAction("update_strategy_prompt", { value }),
    onUpdateCopyPrompt: (value: string) => postAction("update_copy_prompt", { value }),
    onUpdateI2VPrompt: (value: string) => postAction("update_i2v_prompt", { value }),
    onUpdateQAInstruction: (value: string) => postAction("update_qa_instruction", { value }),
  }), []);

  return (
    <div style={{ height: "100vh", background: "#050816", overflow: "hidden" }}>
      <AIAssistant
        context={context}
        proactiveMessage={proactiveMessage}
        {...actionProps}
      />
    </div>
  );
}
