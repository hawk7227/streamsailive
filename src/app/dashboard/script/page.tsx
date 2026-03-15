"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  createGeneration,
  deleteGeneration, // Added deleteGeneration import
  type GenerationRecord,
} from "@/lib/generations";
import { formatRelativeTime, truncateText } from "@/lib/formatters";
import AIAssistant from "@/components/dashboard/AIAssistant";
import { useQueryClient } from "@tanstack/react-query";
import { useGenerationsQuery, usePrependGeneration } from "@/hooks/use-generations-query";

import QuickTemplates, { Template } from "@/components/dashboard/QuickTemplates";

const TEMPLATE_STORAGE_KEY = "streamsai.script.templates";

type ScriptTemplate = Template & {
  prompt: string;
};

const DEFAULT_TEMPLATES: ScriptTemplate[] = [
  {
    id: "youtube-video",
    name: "YouTube Video",
    icon: "▶️",
    uses: "5.1k",
    prompt: "Write a script for a YouTube video about...",
    isDefault: true,
  },
  {
    id: "instagram-caption",
    name: "Instagram Caption",
    icon: "📸",
    uses: "4.2k",
    prompt: "Write an engaging Instagram caption for a photo of...",
    isDefault: true,
  },
  {
    id: "blog-post",
    name: "Blog Post",
    icon: "✍️",
    uses: "3.5k",
    prompt: "Write a comprehensive blog post about...",
    isDefault: true,
  },
  {
    id: "product-desc",
    name: "Product Desc",
    icon: "📦",
    uses: "2.1k",
    prompt: "Write a persuasive product description for...",
    isDefault: true,
  },
];

export default function ScriptPage() {
  const { usage, usageLoading, incrementUsage } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [previewItem, setPreviewItem] = useState<GenerationRecord | null>(null);

  // React Query cache – instant data on back-navigation
  const queryClient = useQueryClient();
  const { historyItems, historyLoading, historyError } = useGenerationsQuery({ type: "script", limit: 8 });
  const prependGeneration = usePrependGeneration();

  const isLimitReached =
    typeof usage?.limit === "number" && usage.used >= usage.limit;

  const pendingItems = historyItems.filter(item => item.status === "pending" || item.status === "processing");

  const handleGenerate = async () => {
    if (isLimitReached || usageLoading || isSubmitting) {
      return;
    }

    if (!prompt.trim()) {
      setUsageError("Please enter a prompt.");
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
      type: "script",
      prompt,
      title: truncateText(prompt, 48),
      status: "processing",
      aspect_ratio: null,
      duration: null,
      quality: null,
      style: null,
      output_url: null,
      external_id: null,
      favorited: false,
      progress: null,
      created_at: new Date().toISOString()
    };

    // Inject immediately
    prependGeneration(optimisticRecord);
    setIsSubmitting(false);
    
    // Clear prompt for next item
    setPrompt("");

    try {
      const created = await createGeneration({
        type: "script",
        prompt,
        title: truncateText(prompt, 48),
      });

      // Replace optimistic record with the real one safely inside the cache
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "script"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );

    } catch (createError) {
      // Mark as failed
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? { ...optimisticRecord, status: "failed" } : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "script"], (old = []) => 
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
    if (!confirm("Are you sure you want to delete this script?")) return;
    
    setIsDeleting(true);
    try {
      await deleteGeneration(id);
      
      // Update cache to remove item
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.filter(item => item.id !== id)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "script"], (old = []) => 
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
    const t = template as ScriptTemplate;
    setPrompt(t.prompt);
  };

  const tabs = [
    { id: "script", label: "Script", icon: "📝" },
    { id: "voice", label: "Voice", icon: "🎙️" },
    { id: "image", label: "Image", icon: "🖼️" },
    { id: "video", label: "Video", icon: "🎬" },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
      <div className="space-y-6">
        {/* Product Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/dashboard/${tab.id}`}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition-all ${
                tab.id === "script"
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-emerald to-accent-blue flex items-center justify-center">
                📝
              </div>
              <span className="font-semibold">Script Generation</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>✨</span> Describe your script
                </div>
                <span className="text-xs text-text-muted">
                  {prompt.length} / 2000
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-48 px-4 py-4 rounded-xl border border-border-color bg-bg-tertiary text-white text-[15px] leading-relaxed resize-none focus:outline-none focus:border-accent-indigo placeholder-text-muted"
                placeholder="What kind of script do you need? (e.g., blog post, video script, social media content...)"
                maxLength={2000}
              />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLimitReached || usageLoading || isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-emerald to-accent-blue text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-accent-emerald/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLimitReached
                ? "Limit Reached"
                : isSubmitting
                ? "Generating..."
                : "✨ Generate Script"}
            </button>
            {usageError && (
              <p className="text-xs text-accent-red">{usageError}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
      <div className="space-y-6">
        {/* AI Assistant */}
        <AIAssistant
          context={{
            type: "script",
            prompt,
            settings: {},
          }}
          onApplyPrompt={(newPrompt) => setPrompt(newPrompt)}
        />
      </div>
    </div>
    </div>

    {/* Recent Scripts Grid - Full width below main grid */}
    <div>
      <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
        <span className="text-2xl">📝</span> Recent Scripts
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
          <span className="text-4xl mb-4 opacity-50">📝</span>
          <p>No scripts generated yet.</p>
          <p className="text-sm mt-1">Ready to create engaging content.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pendingItems.map((item) => (
          <div key={item.id} className="relative group rounded-2xl overflow-hidden bg-bg-secondary border border-accent-emerald/30 shadow-lg shadow-accent-emerald/5 h-48 flex items-center justify-center animate-pulse">
            <div className="flex flex-col items-center gap-4 relative z-10 w-full px-6">
              <div className="w-10 h-10 rounded-full border-2 border-accent-emerald/20 border-t-accent-emerald animate-spin" />
              <div className="text-center w-full">
                <span className="text-sm font-medium text-accent-emerald">Drafting...</span>
                <p className="text-xs text-text-muted mt-2 truncate w-full">
                  {item.title ?? "Script formulation"}
                </p>
              </div>
            </div>
            
            <div className="absolute inset-0 bg-gradient-to-tr from-accent-emerald/5 to-transparent pointer-events-none" />
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
                className="group relative bg-bg-secondary border border-border-color rounded-2xl p-5 hover:border-accent-emerald/50 hover:shadow-lg hover:shadow-accent-emerald/5 transition-all cursor-pointer h-48 flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-emerald/20 to-accent-blue/20 flex items-center justify-center text-xl">
                    📝
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-text-muted bg-bg-tertiary px-2 py-1 rounded-md">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>
                </div>
                
                <h4 className="text-sm font-medium mb-2 line-clamp-2 text-white group-hover:text-accent-emerald transition-colors">
                  {item.title ?? "Generated Script"}
                </h4>
                
                <p className="text-xs text-text-muted line-clamp-3 mt-auto">
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
                  SCRIPT • {formatRelativeTime(previewItem.created_at)}
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
              <div className="max-h-[340px] overflow-y-auto rounded-xl border border-border-color bg-bg-tertiary p-4 text-sm whitespace-pre-wrap">
                {previewItem.prompt}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}
