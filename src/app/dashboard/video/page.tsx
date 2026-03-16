"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  createGeneration,
  deleteGeneration,
  listGenerations,
  type GenerationRecord,
} from "@/lib/generations";
import { formatRelativeTime, truncateText } from "@/lib/formatters";
import AIAssistant from "@/components/dashboard/AIAssistant";
import { useGenerationsQuery, usePrependGeneration } from "@/hooks/use-generations-query";
import { useQueryClient } from "@tanstack/react-query";

import QuickTemplates, { Template } from "@/components/dashboard/QuickTemplates";

const TEMPLATE_STORAGE_KEY = "streamsai.video.templates";

type VideoTemplate = Template & {
  prompt: string;
  aspectRatio: string;
  duration: string;
  quality: string;
};



const DEFAULT_TEMPLATES: VideoTemplate[] = [
  {
    id: "product-demo",
    name: "Product Demo",
    icon: "🎥",
    uses: "2.4k",
    prompt:
      "A sleek product demo showcasing a smartphone rotating in soft studio light, clean background, crisp reflections",
    aspectRatio: "16:9",
    duration: "8s",
    quality: "1080p Full HD",
    isDefault: true,
  },
  {
    id: "social-reel",
    name: "Social Reel",
    icon: "📱",
    uses: "1.8k",
    prompt:
      "Fast-paced montage of lifestyle shots with dynamic cuts, vibrant colors, and energetic transitions",
    aspectRatio: "9:16",
    duration: "8s",
    quality: "1080p Full HD",
    isDefault: true,
  },
  {
    id: "corporate-intro",
    name: "Corporate Intro",
    icon: "🏢",
    uses: "1.2k",
    prompt:
      "Corporate intro with aerial city skyline, modern office interiors, and subtle motion graphics",
    aspectRatio: "16:9",
    duration: "16s",
    quality: "4K Ultra HD",
    isDefault: true,
  },
  {
    id: "tutorial",
    name: "Tutorial",
    icon: "🎓",
    uses: "980",
    prompt:
      "Screen-record style tutorial with clear callouts, smooth zooms, and minimal background",
    aspectRatio: "16:9",
    duration: "16s",
    quality: "1080p Full HD",
    isDefault: true,
  },
  {
    id: "ecommerce",
    name: "E-commerce",
    icon: "🛍️",
    uses: "756",
    prompt:
      "Lifestyle product showcase with soft natural light, shallow depth of field, and clean typography",
    aspectRatio: "1:1",
    duration: "8s",
    quality: "1080p Full HD",
    isDefault: true,
  },
];

export default function VideoPage() {
  const { usage, usageLoading, incrementUsage } = useAuth();
  const [prompt, setPrompt] = useState(
    "A breathtaking aerial view of a futuristic city at sunset, with flying cars weaving between towering glass skyscrapers, neon lights beginning to glow"
  );
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("8s");
  const [quality, setQuality] = useState("1080p Full HD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usageError, setUsageError] = useState("");
  const [showTypeDialog, setShowTypeDialog] = useState(false);

  // React Query cache – instant data on back-navigation
  const { historyItems, historyLoading, historyError } = useGenerationsQuery({ type: "video", limit: 12 });
  const prependGeneration = usePrependGeneration();
  const queryClient = useQueryClient();

  const [previewItem, setPreviewItem] = useState<GenerationRecord | null>(null);

  const pendingVideos = useMemo(() => {
    return historyItems.filter(item => item.type === "video" && (item.status === "pending" || item.status === "processing"));
  }, [historyItems]);

  const promptAnalysis = useMemo(() => {
    const p = prompt.toLowerCase();
    
    // Check various criteria
    const isDetailed = p.length > 30;
    const visualKeywords = ['light', 'color', 'vibrant', 'bright', 'dark', 'neon', 'glow', 'shadow', 'colorful', 'contrast', 'texture', 'sharp', 'soft', 'blur', 'clear', 'reflection'];
    const isVisual = visualKeywords.some(kw => p.includes(kw));
    const styleKeywords = ['style', 'cinematic', '3d', 'realistic', 'cartoon', 'anime', 'illustration', 'sketch', 'painting', 'photoreal', 'render', 'unreal', 'cyberpunk', 'vintage', 'modern', 'minimal', 'corporate'];
    const hasStyle = styleKeywords.some(kw => p.includes(kw));
    const cameraKeywords = ['angle', 'shot', 'view', 'close-up', 'close up', 'wide', 'aerial', 'drone', 'pan', 'zoom', 'lens', '35mm', '85mm', 'perspective', 'tracking', 'tilt', 'macro'];
    const hasCameraAngle = cameraKeywords.some(kw => p.includes(kw));

    let score = 0;
    if (isDetailed) score += 25;
    if (isVisual) score += 25;
    if (hasStyle) score += 25;
    if (hasCameraAngle) score += 25;

    if (prompt.length > 0 && score === 0) score = 10;
    if (prompt.length === 0) score = 0;

    let text = "Needs detail";
    let colorClass = "text-text-secondary";
    let hexColor = "#6b7280";

    if (score >= 75) {
      text = "Excellent prompt";
      colorClass = "text-accent-emerald";
      hexColor = "#10b981";
    } else if (score >= 50) {
      text = "Good prompt quality";
      colorClass = "text-accent-indigo"; 
      hexColor = "#6366f1"; 
    } else if (score > 0) {
      text = "Basic prompt";
      colorClass = "text-accent-orange";
      hexColor = "#f97316"; 
    }

    const degrees = Math.round((score / 100) * 360);

    return { score, text, colorClass, hexColor, degrees, isDetailed, isVisual, hasStyle, hasCameraAngle };
  }, [prompt]);

  const isLimitReached =
    typeof usage?.limit === "number" && usage.used >= usage.limit;

  const handleGenerateClick = () => {
    if (isLimitReached || usageLoading || !prompt.trim() || isSubmitting) {
      return;
    }
    setShowTypeDialog(true);
  };

  const confirmGenerate = async (type: "full" | "preview") => {
    setShowTypeDialog(false);
    
    if (isLimitReached || usageLoading || !prompt.trim() || isSubmitting) {
      return;
    }

    setUsageError("");
    
    // Save current values for optimistic update and API call
    const currentPrompt = prompt;
    const currentAspectRatio = aspectRatio;
    const currentDuration = type === "preview" ? "4s" : duration;
    const currentQuality = type === "preview" ? "720p HD" : quality;
    const isPreview = type === "preview";

    setPrompt("");
    setIsSubmitting(true);

    const { error } = await incrementUsage(1);
    if (error) {
      setUsageError(error);
      setIsSubmitting(false);
      return;
    }

    // --- Optimistic UI for immediate queue feedback ---
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticRecord: GenerationRecord = {
      id: tempId,
      type: "video",
      prompt: currentPrompt,
      title: truncateText(currentPrompt, 48),
      status: "processing", // shows up in our "Queue"
      aspect_ratio: currentAspectRatio,
      duration: currentDuration,
      quality: currentQuality,
      style: null,
      output_url: null,
      external_id: null,
      is_preview: isPreview,
      favorited: false,
      progress: null,
      created_at: new Date().toISOString()
    };

    // Inject immediately
    prependGeneration(optimisticRecord);
    setIsSubmitting(false);

    try {
      const created = await createGeneration({
        type: "video",
        prompt: currentPrompt,
        title: truncateText(currentPrompt, 48),
        status: "pending",
        aspectRatio: currentAspectRatio,
        duration: currentDuration,
        quality: currentQuality,
        isPreview,
      });
      
      // Replace optimistic record with the real one from DB
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "video"], (old = []) => 
        old.map(item => item.id === tempId ? created : item)
      );
    } catch (createError) {
      // Mark optimistic record as failed
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.map(item => item.id === tempId ? { ...optimisticRecord, status: "failed" } : item)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "video"], (old = []) => 
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
    if (!confirm("Are you sure you want to delete this video?")) return;
    
    setIsDeleting(true);
    try {
      await deleteGeneration(id);
      
      // Update cache to remove item
      queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => 
        old.filter(item => item.id !== id)
      );
      queryClient.setQueryData<GenerationRecord[]>(["generations", "video"], (old = []) => 
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

  const handleGenerateFullFromPreview = (item: GenerationRecord) => {
    setPreviewItem(null);
    setShowTypeDialog(false);
    
    setPrompt(item.prompt);
    if (item.aspect_ratio) setAspectRatio(item.aspect_ratio);
    
    // We want a full video, so use decent defaults if they don't have good ones selected
    setDuration("8s"); 
    setQuality("1080p Full HD");
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tabs = [
    { id: "script", label: "Script", icon: "📝" },
    { id: "voice", label: "Voice", icon: "🎙️" },
    { id: "image", label: "Image", icon: "🖼️" },
    { id: "video", label: "Video", icon: "🎬" },
  ];



  // NOTE: history data is now served from React Query cache above.
  // No manual useEffect fetch needed.

  // Polling logic for pending videos
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const checkStatus = async () => {
      // If there are pending videos, trigger cron and refetch
      if (pendingVideos.length > 0) {
        try {
          // Trigger the cron job to poll OpenAI before fetching the list
          await fetch('/api/cron/check-videos').catch(console.error);

          const recentGenerations = await listGenerations({ limit: 12 });
          
          // Update in the React Query cache, ensuring optimistic items are NOT wiped out
          queryClient.setQueryData<GenerationRecord[]>(["generations", "all"], (old = []) => {
             const optimisticItems = old.filter(item => item.id.startsWith("temp-"));
             return [...optimisticItems, ...recentGenerations];
          });
        } catch(e) {
          console.error("Polling error:", e);
        }
      }
      
      // Re-evaluate if we need to poll again
      // We rely on the closure state, but it will be updated on next render check
      // However, simplified approach: if we have pending videos right now, queue next poll.
      // If the recent fetch cleared them, the next poll will gracefully exit.
      if (pendingVideos.length > 0) {
         timeout = setTimeout(checkStatus, 5000);
      }
    };

    if (pendingVideos.length > 0) {
      timeout = setTimeout(checkStatus, 5000); // 5 sec interval
    }

    return () => clearTimeout(timeout);
  }, [pendingVideos.length, queryClient]);

  const handleTemplateApply = (template: Template) => {
    const t = template as VideoTemplate;
    setPrompt(t.prompt);
    setAspectRatio(t.aspectRatio);
    setDuration(t.duration);
    setQuality(t.quality);
  };





  return (
    <>
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        {/* Left Column */}
        <div className="space-y-6">
        {/* Product Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={`/dashboard/${tab.id}`}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-medium whitespace-nowrap transition-all ${
                tab.id === "video"
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
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-accent-indigo to-accent-purple flex items-center justify-center">
                🎬
              </div>
              <span className="font-semibold">Video Generation</span>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-lg border border-border-color text-text-secondary text-xs hover:bg-bg-tertiary transition-colors">
                🕐 History
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-border-color text-text-secondary text-xs hover:bg-bg-tertiary transition-colors"
              >
                ⭐ Templates
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Prompt */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span>✨</span> Describe your video
                </div>
                <span className="text-xs text-text-muted">
                  {prompt.length} / 500
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full h-36 px-4 py-4 rounded-xl border border-border-color bg-bg-tertiary text-white text-[15px] leading-relaxed resize-none focus:outline-none focus:border-accent-indigo placeholder-text-muted"
                placeholder="Describe your video..."
                maxLength={500}
              />

              {/* Prompt Score */}
              <div className="flex items-center gap-4 mt-3 p-4 bg-bg-tertiary rounded-xl">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center relative"
                  style={{
                    background:
                      `conic-gradient(${promptAnalysis.hexColor} 0deg, ${promptAnalysis.hexColor} ${promptAnalysis.degrees}deg, #1a1a24 ${promptAnalysis.degrees}deg)`,
                  }}
                >
                  <div className="absolute inset-1 bg-bg-tertiary rounded-full"></div>
                  <span className={`relative text-sm font-bold ${promptAnalysis.colorClass}`}>
                    {promptAnalysis.score}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">{promptAnalysis.text}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className={`flex items-center gap-1 text-xs ${promptAnalysis.isDetailed ? promptAnalysis.colorClass : "text-text-muted"}`}>
                      {promptAnalysis.isDetailed ? "✓" : "○"} Detailed
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${promptAnalysis.isVisual ? promptAnalysis.colorClass : "text-text-muted"}`}>
                      {promptAnalysis.isVisual ? "✓" : "○"} Visual
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${promptAnalysis.hasStyle ? promptAnalysis.colorClass : "text-text-muted"}`}>
                      {promptAnalysis.hasStyle ? "✓" : "○"} Add style
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${promptAnalysis.hasCameraAngle ? promptAnalysis.colorClass : "text-text-muted"}`}>
                      {promptAnalysis.hasCameraAngle ? "✓" : "○"} Camera angle
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Aspect Ratio
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setAspectRatio("16:9")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium flex flex-col items-center transition-colors ${
                      aspectRatio === "16:9"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    <span className="text-lg mb-0.5">🖥️</span> 16:9
                  </button>
                  <button
                    onClick={() => setAspectRatio("9:16")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium flex flex-col items-center transition-colors ${
                      aspectRatio === "9:16"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    <span className="text-lg mb-0.5">📱</span> 9:16
                  </button>
                  <button
                    onClick={() => setAspectRatio("1:1")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium flex flex-col items-center transition-colors ${
                      aspectRatio === "1:1"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    <span className="text-lg mb-0.5">⬜</span> 1:1
                  </button>
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Duration
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setDuration("4s")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      duration === "4s"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    4s
                  </button>
                  <button
                    onClick={() => setDuration("8s")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      duration === "8s"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    8s
                  </button>
                  <button
                    onClick={() => setDuration("16s")}
                    className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
                      duration === "16s"
                        ? "border-accent-indigo bg-accent-indigo/10 text-accent-indigo"
                        : "border-border-color bg-bg-secondary text-text-secondary"
                    }`}
                  >
                    16s
                  </button>
                </div>
              </div>
              <div className="bg-bg-tertiary rounded-xl p-4">
                <p className="text-[10px] uppercase tracking-wider text-text-muted mb-3">
                  Quality
                </p>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-border-color bg-bg-secondary text-white text-sm appearance-none cursor-pointer focus:outline-none focus:border-accent-indigo"
                >
                  <option>1080p Full HD</option>
                  <option>720p HD</option>
                  <option>4K Ultra HD</option>
                </select>
              </div>
            </div>

            {/* Generate */}
            <button
              type="button"
              onClick={handleGenerateClick}
              disabled={isLimitReached || usageLoading || !prompt.trim() || isSubmitting}
              className="w-full py-4 rounded-xl bg-linear-to-r from-accent-indigo to-accent-purple text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-accent-indigo/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLimitReached
                ? "Limit Reached"
                : isSubmitting
                ? "Generating..."
                : "✨ Generate Video"}
            </button>
            {usageError && (
              <p className="text-xs text-accent-red">{usageError}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - AI Assistant & History */}
      <div className="space-y-6">
        {/* AI Assistant */}
        <AIAssistant
          context={{
            type: "video",
            prompt,
            settings: { aspectRatio, duration, quality },
          }}
          onApplyPrompt={(newPrompt) => setPrompt(newPrompt)}
          onUpdateSettings={(key, value) => {
            if (key === "aspectRatio") setAspectRatio(value);
            if (key === "duration") setDuration(value);
            if (key === "quality") setQuality(value);
          }}
        />
      </div>
    </div>

    {/* Bottom Section: History */}
    <div className="max-w-[1600px] mx-auto mt-8 space-y-8">
        
        {/* History Gallery Section */}
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-medium mb-0">Recent Video Generations</h3>
          </div>
          
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
            <p className="text-xs text-text-muted">No generations yet</p>
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
                      <div className="w-8 h-8 rounded-full border-[3px] border-t-accent-indigo border-r-transparent border-b-accent-purple border-l-transparent animate-spin mb-2"></div>
                      <p className="text-[10px] font-medium animate-pulse text-accent-indigo px-2 text-center">
                        {"Generating video..."}
                        <br />
                        {item.progress ? `(${item.progress}%)` : ""}
                      </p>
                    </div>
                  ) : item.output_url ? (
                    <div className="aspect-square w-full">
                      {item.type === "video" ? (
                          <video
                            src={item.output_url}
                            className="w-full h-full object-cover bg-black"
                            muted
                          />
                      ) : (
                          <img
                            src={item.output_url}
                            alt={item.title ?? item.prompt}
                            className="w-full h-full object-cover bg-black"
                          />
                      )}
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
                       {item.duration && <span>{item.duration}</span>}
                       {item.duration && <span>•</span>}
                       {item.aspect_ratio && <span>{item.aspect_ratio}</span>}
                       {(item.style || item.quality) && <span>• {item.style || item.quality}</span>}
                    </p>
                  </div>
                  
                  {/* Icon Badge */}
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-md bg-black/60 border border-white/10 flex items-center justify-center backdrop-blur-md">
                      <span className="text-[10px]">
                          {item.type === "video" ? "🎬" : item.type === "image" ? "🖼️" : item.type === "script" ? "📝" : "🎙️"}
                      </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>



      {showTypeDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setShowTypeDialog(false)}
        >
          <div
            className="w-full max-w-md bg-bg-secondary border border-border-color rounded-2xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Generate Video</h3>
            <p className="text-sm text-text-muted mb-6">
              Choose how you want to generate this video. You can create a low-quality preview first to check the result, or go straight to a full generation.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={() => confirmGenerate("preview")}
                className="w-full flex items-start gap-3 p-4 rounded-xl border border-border-color hover:border-accent-indigo hover:bg-bg-tertiary transition-all text-left"
              >
                <span className="text-2xl">👀</span>
                <div>
                  <span className="block font-medium mb-1">Preview Video</span>
                  <span className="text-xs text-text-muted">
                    Fast generation, 4s duration, 720p HD. Good for testing prompts.
                  </span>
                </div>
              </button>

              <button
                onClick={() => confirmGenerate("full")}
                className="w-full flex items-start gap-3 p-4 rounded-xl border border-border-color hover:border-accent-indigo hover:bg-bg-tertiary transition-all text-left"
              >
                <span className="text-2xl">✨</span>
                <div>
                  <span className="block font-medium mb-1">Full Video</span>
                  <span className="text-xs text-text-muted">
                    High quality, selected duration {duration}, and {quality}.
                  </span>
                </div>
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTypeDialog(false)}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="w-full max-w-3xl bg-bg-secondary border border-border-color rounded-2xl shadow-xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border-color flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">
                  {truncateText(previewItem.title ?? previewItem.prompt, 80)}
                </h3>
                <p className="text-[11px] text-text-muted">
                  VIDEO {previewItem.is_preview ? "(PREVIEW) " : ""}• {formatRelativeTime(previewItem.created_at)}
                </p>
              </div>
              <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
                {previewItem.type === "video" && previewItem.is_preview && (
                  <button
                    onClick={() => handleGenerateFullFromPreview(previewItem)}
                    className="flex-1 sm:flex-none min-h-[44px] px-4 py-2 rounded-lg border border-accent-indigo text-accent-indigo text-sm font-medium hover:bg-accent-indigo/10 transition-colors whitespace-nowrap"
                  >
                    ✨ Generate Full Video
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(previewItem.id)}
                  disabled={isDeleting}
                  className="min-h-[44px] min-w-[44px] text-text-muted hover:text-accent-red flex items-center justify-center transition-colors disabled:opacity-50"
                  title="Delete generation"
                >
                  {isDeleting ? "⏳" : "🗑️"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="min-h-[44px] min-w-[44px] text-text-muted hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-0 bg-black relative">
              {previewItem.type === "video" && (
                <div className="space-y-3">
                  {previewItem.output_url ? (
                    <video
                      className="w-full rounded-xl border border-border-color bg-black"
                      controls
                      src={previewItem.output_url}
                    />
                  ) : (
                    <div className="w-full aspect-video rounded-xl border border-dashed border-border-color flex items-center justify-center text-xs text-text-muted">
                      Wait for video generation
                    </div>
                  )}
                  {previewItem.duration && previewItem.output_url && (
                    <p className="text-[11px] text-text-muted">
                      Duration: {previewItem.duration}
                    </p>
                  )}
                </div>
              )}
              {previewItem.type === "image" && (
                <div className="space-y-3">
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
                </div>
              )}
              {previewItem.type === "voice" && (
                <div className="space-y-3">
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
              )}
              {previewItem.type === "script" && (
                <div className="space-y-3">
                  <div className="max-h-[340px] overflow-y-auto rounded-xl border border-border-color bg-bg-tertiary p-4 text-sm whitespace-pre-wrap">
                    {previewItem.prompt}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
