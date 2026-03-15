"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  createGeneration,
  deleteGeneration,
  type GenerationRecord,
} from "@/lib/generations";
import { formatRelativeTime, truncateText } from "@/lib/formatters";
import AIAssistant from "@/components/dashboard/AIAssistant";
import { useQueryClient } from "@tanstack/react-query";
import { useGenerationsQuery, usePrependGeneration } from "@/hooks/use-generations-query";

import QuickTemplates, { Template } from "@/components/dashboard/QuickTemplates";

const TEMPLATE_STORAGE_KEY = "streamsai.voice.templates";

type VoiceTemplate = Template & {
  prompt: string;
  style: string;
  speed: string;
};

const DEFAULT_TEMPLATES: VoiceTemplate[] = [
  {
    id: "storytelling",
    name: "Storytelling",
    icon: "📖",
    uses: "4.5k",
    prompt: "Once upon a time, in a land far far away...",
    style: "Narrator",
    speed: "Slow",
    isDefault: true,
  },
  {
    id: "ad-read",
    name: "Ad Read",
    icon: "📢",
    uses: "3.2k",
    prompt: "This episode is brought to you by...",
    style: "Professional",
    speed: "Normal",
    isDefault: true,
  },
  {
    id: "casual-chat",
    name: "Casual Chat",
    icon: "🗣️",
    uses: "2.8k",
    prompt: "Hey guys, just wanted to give you a quick update...",
    style: "Casual",
    speed: "Normal",
    isDefault: true,
  },
  {
    id: "disclaimer",
    name: "Disclaimer",
    icon: "⚡",
    uses: "1.2k",
    prompt: "Terms and conditions apply. See website for details.",
    style: "Professional",
    speed: "Fast",
    isDefault: true,
  },
];

export default function VoicePage() {
  const { usage, usageLoading, incrementUsage } = useAuth();
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("Natural");
  const [speed, setSpeed] = useState("Normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [previewItem, setPreviewItem] = useState<GenerationRecord | null>(null);

  // React Query cache – instant data on back-navigation
  const queryClient = useQueryClient();
  const { historyItems, historyLoading, historyError } = useGenerationsQuery({ type: "voice", limit: 8 });
  const prependGeneration = usePrependGeneration();

  const isLimitReached =
    typeof usage?.limit === "number" && usage.used >= usage.limit;

  const pendingItems = historyItems.filter(item => item.status === "pending" || item.status === "processing");

  const handleGenerate = async () => {
    if (isLimitReached || usageLoading || isSubmitting) {
      return;
    }

    if (!text.trim()) {
      setUsageError("Please enter text for the voiceover.");
      return;
    }

    setUsageError("");
    setIsSubmitting(true);

    const { error } = await incrementUsage(1);
    if (error) {
      setUsageError(error);
      setIsSubmitting(false);
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticRecord: GenerationRecord = {
      id: tempId,
      type: "voice",
      prompt: text,
      title: truncateText(text, 48),
      status: "processing",
      aspect_ratio: null,
      duration: null,
      quality: speed,
      style: voice,
      output_url: null,
      external_id: null,
      favorited: false,
      progress: null,
      created_at: new Date().toISOString()
    };

    // Inject immediately
    prependGeneration(optimisticRecord);
    setIsSubmitting(false);

    try {
      const created = await createGeneration({
        type: "voice",
        prompt: text,
        title: truncateText(text, 48),
        style: voice,
        quality: speed,
      });

      // Replace optimistic record safely inside the cache
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "voice"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );

    } catch (createError) {
      // Mark as failed
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? { ...optimisticRecord, status: "failed" } : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "voice"], (old = []) => 
        old.map(item => item.id === tempId ? { ...optimisticRecord, status: "failed" } : item)
      );

      setUsageError(
        createError instanceof Error
          ? createError.message
          : "Unable to save generation"
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this voice generation?")) return;
    
    setIsDeleting(true);
    try {
      await deleteGeneration(id);
      
      // Update cache to remove item
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.filter(item => item.id !== id)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "voice"], (old = []) => 
        old.filter(item => item.id !== id)
      );
      
      if (previewItem?.id === id) {
        setPreviewItem(null);
      }
    } catch (error) {
       alert(error instanceof Error ? error.message : "Failed to delete generation");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTemplateApply = (template: Template) => {
    const t = template as VoiceTemplate;
    setText(t.prompt);
    setVoice(t.style);
    setSpeed(t.speed);
  };

  const tabs = [
    { id: "script", label: "Script", icon: "📝" },
    { id: "voice", label: "Voice", icon: "🎙️" },
    { id: "image", label: "Image", icon: "🖼️" },
    { id: "video", label: "Video", icon: "🎬" },
  ];

  return (
    <>
    <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
      <div className="space-y-6">
        {/* Product Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/dashboard/${tab.id}`}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition-all ${
                tab.id === "voice"
                  ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                  : "border-border-color bg-bg-secondary text-text-secondary hover:border-accent-indigo/50"
              }`}
            >
              <span className="text-xl">{tab.icon}</span> {tab.label}
            </Link>
          ))}
        </div>



        {/* Templates Bar */}
        <QuickTemplates
          storageKey={TEMPLATE_STORAGE_KEY}
          defaultTemplates={DEFAULT_TEMPLATES}
          onApply={handleTemplateApply}
        />

        {/* Main Generation Panel */}
        <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border-color flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-purple to-accent-pink flex items-center justify-center">
                🎙️
              </div>
              <span className="font-semibold">Voice Generation</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>✨</span> Enter text to convert to speech
                </div>
                <span className="text-xs text-text-muted">
                  {text.length} / 5000
                </span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-48 px-4 py-4 rounded-xl border border-border-color bg-bg-tertiary text-white text-[15px] leading-relaxed resize-none focus:outline-none focus:border-accent-indigo placeholder-text-muted"
                placeholder="Type or paste the text you want to convert to speech..."
                maxLength={5000}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Voice Style
                </p>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-border-color bg-bg-secondary text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-accent-indigo"
                >
                  <option>Natural</option>
                  <option>Professional</option>
                  <option>Casual</option>
                  <option>Narrator</option>
                </select>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Speed
                </p>
                <select
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-border-color bg-bg-secondary text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-accent-indigo"
                >
                  <option>Slow</option>
                  <option>Normal</option>
                  <option>Fast</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLimitReached || usageLoading || isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-purple to-accent-pink text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-accent-purple/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLimitReached
                ? "Limit Reached"
                : isSubmitting
                ? "Generating..."
                : "✨ Generate Voice"}
            </button>
            {usageError && (
              <p className="text-xs text-accent-red">{usageError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* AI Assistant */}
        <AIAssistant
          context={{
            type: "voice",
            prompt: text,
            settings: { voice, speed },
          }}
          onApplyPrompt={(newText) => setText(newText)}
          onUpdateSettings={(key, value) => {
            if (key === "voice") setVoice(value);
            if (key === "speed") setSpeed(value);
          }}
        />
      </div>
    </div>

    {/* Recent Voices Grid - Moved to bottom, full width */}
    <div className="max-w-[1600px] mx-auto mt-8">
      <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <span className="text-2xl">🎙️</span> Recent Voices
      </h3>

      {historyLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-bg-secondary border border-border-color p-4 h-48 animate-pulse flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-bg-tertiary"></div>
              <div className="w-3/4 h-3 bg-bg-tertiary rounded"></div>
              <div className="w-1/2 h-3 bg-bg-tertiary rounded"></div>
            </div>
          ))}
        </div>
      )}

      {historyError && (
        <div className="p-6 rounded-2xl bg-accent-red/10 border border-accent-red/20 text-accent-red text-center">
          {historyError}
        </div>
      )}

      {!historyLoading && !historyError && historyItems.length === 0 && (
        <div className="border border-dashed border-border-color rounded-2xl py-16 flex flex-col items-center justify-center text-text-muted">
          <span className="text-4xl mb-4 opacity-50">🎙️</span>
          <p>No voices generated yet.</p>
          <p className="text-sm mt-1">Ready to create engaging audio content.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pendingItems.map((item) => (
          <div key={item.id} className="relative group rounded-2xl overflow-hidden bg-bg-secondary border border-accent-purple/30 shadow-lg shadow-accent-purple/5 h-48 flex items-center justify-center animate-pulse">
            <div className="flex flex-col items-center gap-4 relative z-10 w-full px-6">
              <div className="w-10 h-10 rounded-full border-2 border-accent-purple/20 border-t-accent-purple animate-spin" />
              <div className="text-center w-full">
                <span className="text-sm font-medium text-accent-purple">Synthesizing...</span>
                <p className="text-xs text-text-muted mt-2 truncate w-full">
                  {item.title ?? "Voice generation"}
                </p>
              </div>
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-tr from-accent-purple/5 to-transparent pointer-events-none" />
          </div>
        ))}
        {!historyLoading &&
          !historyError &&
          historyItems
            .filter((item) => item.status === "completed")
            .map((item) => (
              <div
                key={item.id}
                onClick={() => setPreviewItem(item)}
                className="group relative bg-bg-secondary border border-border-color rounded-2xl p-5 hover:border-accent-purple/50 hover:shadow-lg hover:shadow-accent-purple/5 transition-all cursor-pointer h-48 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-purple/20 to-accent-pink/20 flex items-center justify-center text-xl">
                    🎙️
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted bg-bg-tertiary px-2 py-1 rounded-md">
                      {item.style && `${item.style} • `}
                      {item.quality && `${item.quality} • `}
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </div>
                
                <h4 className="text-sm font-medium mb-2 line-clamp-2 text-white group-hover:text-accent-purple transition-colors">
                  {item.title ?? "Generated Voice"}
                </h4>
                
                <p className="text-xs text-text-muted line-clamp-2 mt-auto">
                  {item.prompt}
                </p>
              </div>
            ))}
      </div>
    </div>
      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="w-full max-w-3xl bg-bg-secondary border border-border-color rounded-2xl shadow-xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border-color flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {truncateText(previewItem.title ?? previewItem.prompt, 80)}
                </h3>
                <p className="text-[11px] text-text-muted">
                  VOICE • {formatRelativeTime(previewItem.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDelete(previewItem.id)}
                  disabled={isDeleting}
                  className="text-text-muted hover:text-accent-red flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Delete generation"
                >
                  {isDeleting ? "⏳" : "🗑️"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="text-text-muted hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {previewItem.output_url ? (
                <audio
                  className="w-full"
                  controls
                  src={previewItem.output_url}
                />
              ) : (
                <div className="w-full rounded-xl border border-dashed border-border-color flex items-center justify-center text-xs text-text-muted px-4 py-10">
                  No audio URL set yet.
                </div>
              )}
              <p className="text-xs text-text-muted">
                {previewItem.style && `${previewItem.style} • `}
                {previewItem.quality && `${previewItem.quality} • `}
                {formatRelativeTime(previewItem.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
