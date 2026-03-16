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
import { useGenerationsQuery, usePrependGeneration } from "@/hooks/use-generations-query";
import { useQueryClient } from "@tanstack/react-query";

import QuickTemplates, { Template } from "@/components/dashboard/QuickTemplates";

const TEMPLATE_STORAGE_KEY = "streamsai.image.templates";

type ImageTemplate = Template & {
  prompt: string;
  aspectRatio: string;
  style: string;
};

const DEFAULT_TEMPLATES: ImageTemplate[] = [
  {
    id: "social-post",
    name: "Social Post",
    icon: "📱",
    uses: "3.2k",
    prompt: "A professional and eye-catching social media post with a clean layout and vibrant colors, engaging and minimal",
    aspectRatio: "1:1",
    style: "Realistic",
    isDefault: true,
  },
  {
    id: "website-hero",
    name: "Website Hero",
    icon: "💻",
    uses: "2.1k",
    prompt: "Stunning website hero image showing a futuristic cityscape or modern office environment, high resolution, wide angle",
    aspectRatio: "16:9",
    style: "Realistic",
    isDefault: true,
  },
  {
    id: "icon-logo",
    name: "App Icon",
    icon: "🎨",
    uses: "1.5k",
    prompt: "A modern, flat vector style app icon design, colorful gradients, simple shape, white background",
    aspectRatio: "1:1",
    style: "Cartoon",
    isDefault: true,
  },
  {
    id: "portrait-art",
    name: "Portrait Art",
    icon: "🖼️",
    uses: "980",
    prompt: "A detailed and expressive portrait of a character in a fantasy style, soft lighting, intricate details",
    aspectRatio: "9:16",
    style: "Artistic",
    isDefault: true,
  },
];

export default function ImagePage() {
  const { usage, usageLoading, incrementUsage } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("Realistic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [previewItem, setPreviewItem] = useState<GenerationRecord | null>(null);

  // React Query cache – instant data on back-navigation
  const { historyItems, historyLoading, historyError } = useGenerationsQuery({ type: "image", limit: 8 });
  const prependGeneration = usePrependGeneration();
  const queryClient = useQueryClient();

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

    // --- Optimistic UI for blocking image generation ---
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticRecord: GenerationRecord = {
      id: tempId,
      type: "image",
      prompt,
      title: truncateText(prompt, 48),
      status: "processing", // shows up in our "Queue"
      aspect_ratio: aspectRatio,
      duration: null,
      quality: null,
      style,
      output_url: null,
      external_id: null,
      favorited: false,
      progress: null,
      created_at: new Date().toISOString()
    };

    // Inject immediately
    prependGeneration(optimisticRecord);
    setIsSubmitting(false);
    
    // Clear prompt for next item since we queued it visually
    setPrompt("");

    try {
      const created = await createGeneration({
        type: "image",
        prompt,
        title: truncateText(prompt, 48),
        status: "pending",
        aspectRatio,
        style,
      });
      // Replace optimistic record with the real one
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "image"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );
    } catch (createError) {
      // Mark as failed
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? { ...optimisticRecord, status: "failed" } : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "image"], (old = []) => 
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
    if (!confirm("Are you sure you want to delete this image?")) return;
    
    setIsDeleting(true);
    try {
      await deleteGeneration(id);
      
      // Update cache to remove item
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.filter(item => item.id !== id)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "image"], (old = []) => 
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
    const t = template as ImageTemplate;
    setPrompt(t.prompt);
    setAspectRatio(t.aspectRatio);
    setStyle(t.style);
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
                tab.id === "image"
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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-orange to-accent-red flex items-center justify-center">
                🖼️
              </div>
              <span className="font-semibold">Image Generation</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>✨</span> Describe your image
                </div>
                <span className="text-xs text-text-muted">
                  {prompt.length} / 500
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-36 px-4 py-4 rounded-xl border border-border-color bg-bg-tertiary text-white text-[15px] leading-relaxed resize-none focus:outline-none focus:border-accent-indigo placeholder-text-muted"
                placeholder="A beautiful sunset over mountains with vibrant colors..."
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Aspect Ratio
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAspectRatio("16:9")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      aspectRatio === "16:9"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    16:9
                  </button>
                  <button
                    onClick={() => setAspectRatio("9:16")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      aspectRatio === "9:16"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    9:16
                  </button>
                  <button
                    onClick={() => setAspectRatio("1:1")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      aspectRatio === "1:1"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    1:1
                  </button>
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Style
                </p>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-border-color bg-bg-secondary text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-accent-indigo"
                >
                  <option>Realistic</option>
                  <option>Artistic</option>
                  <option>Cartoon</option>
                  <option>3D Render</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLimitReached || usageLoading || isSubmitting}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-orange to-accent-red text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-accent-orange/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLimitReached
                ? "Limit Reached"
                : isSubmitting
                ? "Generating..."
                : "✨ Generate Image"}
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
            type: "image",
            prompt,
            settings: { aspectRatio, style },
          }}
          onApplyPrompt={(newPrompt) => setPrompt(newPrompt)}
          onUpdateSettings={(key, value) => {
            if (key === "aspectRatio") setAspectRatio(value);
            if (key === "style") setStyle(value);
          }}
        />
      </div>
    </div>
    
    {/* Bottom Section: History */}
    <div className="max-w-[1600px] mx-auto mt-8 space-y-8">
        
        {/* History Gallery Section */}
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <h3 className="text-sm font-medium mb-4">Recent Generations</h3>
          
          {historyLoading && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-bg-tertiary border border-border-color overflow-hidden animate-pulse"
                >
                  <div className="aspect-square w-full bg-bg-secondary" />
                  <div className="p-3 space-y-2">
                    <div className="h-2.5 w-4/5 bg-bg-secondary rounded" />
                    <div className="h-2.5 w-2/5 bg-bg-secondary rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!historyLoading && historyError && (
            <p className="text-xs text-accent-red">{historyError}</p>
          )}
          {!historyLoading && !historyError && historyItems.length === 0 && (
            <p className="text-xs text-text-muted">No images generated yet</p>
          )}

          {!historyLoading && !historyError && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => item.status !== "pending" && item.status !== "processing" ? setPreviewItem(item) : undefined}
                  className={`group relative rounded-xl overflow-hidden border border-border-color bg-bg-tertiary transition-colors ${item.status !== "pending" && item.status !== "processing" ? "cursor-pointer hover:border-accent-indigo" : ""}`}
                >
                  {item.status === "pending" || item.status === "processing" ? (
                    <div className="aspect-square w-full bg-bg-secondary flex flex-col items-center justify-center gap-2 text-text-muted">
                      <div className="w-8 h-8 rounded-full border-[3px] border-t-accent-orange border-r-transparent border-b-accent-red border-l-transparent animate-spin"></div>
                      <p className="text-[10px] font-medium animate-pulse text-accent-orange px-2 text-center mt-2">
                        {"Generating..."}
                      </p>
                    </div>
                  ) : item.output_url ? (
                    <div className="aspect-square w-full">
                      <img
                        src={item.output_url}
                        alt={item.title ?? item.prompt}
                        className="w-full h-full object-cover bg-black"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square w-full flex flex-col items-center justify-center text-xs text-accent-red p-2 text-center">
                      <span>❌</span>
                      <span>Failed</span>
                    </div>
                  )}
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-end p-3">
                    <p className="text-xs text-white font-medium line-clamp-2 leading-tight drop-shadow-md mb-1">
                      {item.title ?? truncateText(item.prompt, 40)}
                    </p>
                    <p className="text-[10px] text-white/80 drop-shadow-md flex items-center gap-2">
                       {item.aspect_ratio && <span>{item.aspect_ratio}</span>}
                       {item.style && <span>• {item.style}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  IMAGE • {formatRelativeTime(previewItem.created_at)}
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
                <img
                  src={previewItem.output_url}
                  alt={previewItem.title ?? previewItem.prompt}
                  className="w-full max-h-[480px] object-contain rounded-xl border border-border-color bg-black"
                />
              ) : (
                <div className="w-full aspect-video rounded-xl border border-dashed border-border-color flex items-center justify-center text-xs text-text-muted">
                  No image URL set yet.
                </div>
              )}
              <div className="text-xs text-text-muted">
                {previewItem.aspect_ratio && `${previewItem.aspect_ratio} • `}
                {previewItem.style && `${previewItem.style} • `}
                {formatRelativeTime(previewItem.created_at)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
