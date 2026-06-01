"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function WakeWordLayer({ config, disabled, onWake, onStatus }) {
  const [enabled, setEnabled] = useState(false);
  const [blocked, setBlocked] = useState("");
  const workerRef = useRef(null);
  const processorRef = useRef(null);

  const stop = useCallback(async () => {
    try {
      if (processorRef.current && workerRef.current) {
        await processorRef.current.unsubscribe(workerRef.current);
      }
      await workerRef.current?.terminate?.();
    } catch {
      // cleanup only
    }

    workerRef.current = null;
    processorRef.current = null;
    setEnabled(false);
    onStatus?.("Wake word stopped.");
  }, [onStatus]);

  const start = useCallback(async () => {
    setBlocked("");

    if (disabled) {
      setBlocked("Wake word disabled while voice call is active.");
      return;
    }

    if (!config?.wakeWord?.enabled) {
      setBlocked(`Wake word not configured: ${(config?.wakeWord?.missing || []).join(", ") || "missing config"}`);
      return;
    }

    try {
      const porcupineModule = await import(/* webpackIgnore: true */ "https://esm.sh/@picovoice/porcupine-web");
      const processorModule = await import(/* webpackIgnore: true */ "https://esm.sh/@picovoice/web-voice-processor");

      const PorcupineWorker = porcupineModule.PorcupineWorker || porcupineModule.default?.PorcupineWorker;
      const WebVoiceProcessor = processorModule.WebVoiceProcessor || processorModule.default?.WebVoiceProcessor;

      if (!PorcupineWorker || !WebVoiceProcessor) {
        throw new Error("Picovoice Porcupine Web SDK did not load correctly.");
      }

      const worker = await PorcupineWorker.create(
        config.wakeWord.accessKey,
        [{ publicPath: config.wakeWord.modelPath, label: config.wakeWord.label || "Hey Streams" }],
        () => {
          onStatus?.("Wake word detected.");
          onWake?.();
        },
      );

      await WebVoiceProcessor.subscribe(worker);

      workerRef.current = worker;
      processorRef.current = WebVoiceProcessor;
      setEnabled(true);
      onStatus?.("Wake word listening for Hey Streams.");
    } catch (error) {
      setBlocked(error instanceof Error ? error.message : String(error));
      onStatus?.("Wake word blocked. Use push-to-talk fallback.");
      await stop();
    }
  }, [config, disabled, onStatus, onWake, stop]);

  useEffect(() => () => {
    stop();
  }, [stop]);

  return (
    <div className="voice-wake-card">
      <div>
        <strong>Wake Word</strong>
        <span>{enabled ? "Listening for Hey Streams" : "Fallback: push-to-talk available"}</span>
        {blocked ? <em>{blocked}</em> : null}
      </div>
      <button disabled={disabled} onClick={enabled ? stop : start} type="button">
        {enabled ? "Stop Wake" : "Enable Wake"}
      </button>
    </div>
  );
}
