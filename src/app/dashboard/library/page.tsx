"use client";

import { useState, useEffect } from "react";
import { listGenerations, updateGeneration, deleteGeneration, type GenerationRecord } from "@/lib/generations";
import { formatRelativeTime, truncateText } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";

interface LibraryFile {
  id: string;
  title: string;
  type: "video" | "image" | "audio" | "script";
  status: string;
  size: string;
  time: string;
  created_at: string;
  duration?: string;
  gradient: string;
  prompt: string;
  output_url: string | null;
  favorited: boolean;
  progress: number | null;
}

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [previewItem, setPreviewItem] = useState<GenerationRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasAutoOpenedPreview, setHasAutoOpenedPreview] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const previewId = searchParams.get("preview");
  
  const filters = [
    { id: "All", label: "All", icon: "" },
    { id: "Favorites", label: "Favorites", icon: "⭐" },
    { id: "Videos", label: "Videos", icon: "🎬" },
    { id: "Images", label: "Images", icon: "🖼️" },
    { id: "Audio", label: "Audio", icon: "🎙️" },
    { id: "Scripts", label: "Scripts", icon: "📝" },
  ];

  const queryClient = useQueryClient();

  const { data: files = [], isLoading: loading, error: queryError } = useQuery<LibraryFile[]>({
    queryKey: ['generations'],
    queryFn: async () => {
      // The original queryFn logic
      const data = await listGenerations({ limit: 50 });
      return data.map((item): LibraryFile => {
        const type: "video" | "image" | "audio" | "script" =
          item.type === "voice"
            ? "audio"
            : item.type === "image"
            ? "image"
            : item.type === "script"
            ? "script"
            : "video";
        const gradient =
          type === "video"
            ? "from-pink-500/20 to-purple-500/20"
            : type === "image"
            ? "from-purple-500/20 to-indigo-500/20"
            : type === "audio"
            ? "from-emerald-500/20 to-teal-500/20"
            : "from-blue-500/20 to-indigo-500/20";
  
        return {
          id: item.id,
          title: truncateText(item.title ?? item.prompt, 40),
          type,
          status: item.status,
          size: "—",
          time: formatRelativeTime(item.created_at),
          created_at: item.created_at,
          duration: item.duration ?? undefined,
          gradient,
          prompt: item.prompt,
          output_url: item.output_url,
          favorited: item.favorited,
          progress: item.progress ?? null,
        };
      });
    },
    // Keep data fresh longer for library
    staleTime: 5 * 60 * 1000, 
    refetchInterval: (query: any) => {
      const data = query.state?.data as LibraryFile[] | undefined;
      return data?.some((f) => f.status === "pending" || f.status === "processing") ? 5000 : false;
    },
  });
  
  const error = queryError instanceof Error ? queryError.message : "";

  // Call the cron job to poll OpenAI if there are pending videos
  useEffect(() => {
    const hasPendingVideos = files.some(
      (f) => f.type === "video" && (f.status === "pending" || f.status === "processing")
    );
    if (!hasPendingVideos) return;

    const interval = setInterval(() => {
      fetch("/api/cron/check-videos").catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [files]);

  useEffect(() => {
    if (!previewId) return;
    if (hasAutoOpenedPreview) return;
    if (loading) return;
    if (previewItem) return;

    const match = files.find((f) => f.id === previewId);
    if (!match) {
      setHasAutoOpenedPreview(true);
      return;
    }

    setPreviewItem({
      id: match.id,
      type:
        match.type === "audio"
          ? "voice"
          : (match.type as GenerationRecord["type"]),
      prompt: match.prompt,
      title: match.title,
      status: match.status,
      aspect_ratio: null,
      duration: match.duration ?? null,
      quality: null,
      style: null,
      output_url: match.output_url,
      favorited: match.favorited,
      created_at: match.created_at,
      external_id: null,
      progress: match.progress,
    });

    setHasAutoOpenedPreview(true);
  }, [previewId, hasAutoOpenedPreview, loading, previewItem, files]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case "video":
        return "🎬";
      case "image":
        return "🖼️";
      case "audio":
        return "🎙️";
      case "script":
        return "📝";
      default:
        return "📄";
    }
  };

  const getStatusBadge = (status: string, progress?: number | null) => {
    const normalized = (status ?? "").toLowerCase();
    if (normalized === "pending" || normalized === "processing") {
      return {
        label: progress !== null && progress !== undefined ? `Pending (${progress}%)` : "Pending",
        className:
          "bg-accent-amber/10 text-accent-amber border border-accent-amber/20",
      };
    }
    if (normalized === "failed" || normalized === "error") {
      return {
        label: "Failed",
        className:
          "bg-accent-red/10 text-accent-red border border-accent-red/20",
      };
    }
    return {
      label: "Completed",
      className:
        "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20",
    };
  };

  const handleDownload = async (e: React.MouseEvent, url: string | null, title: string) => {
    e.stopPropagation();
    if (!url) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = title || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback
      window.open(url, "_blank");
    }
  };

  const handleFavorite = async (e: React.MouseEvent, id: string, currentStatus: boolean) => {
    e.stopPropagation();
    
    // Optimistic cache update
    queryClient.setQueryData(['generations'], (oldData: any[]) => {
      return oldData?.map((f) => (f.id === id ? { ...f, favorited: !currentStatus } : f));
    });

    try {
      await updateGeneration(id, { favorited: !currentStatus });
    } catch (err) {
      // Revert on error
      queryClient.setQueryData(['generations'], (oldData: any[]) => {
        return oldData?.map((f) => (f.id === id ? { ...f, favorited: currentStatus } : f));
      });
      console.error("Failed to update favorite status:", err);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    // Optimistic removal from cache
    queryClient.setQueryData(['generations'], (oldData: any[]) =>
      oldData?.filter((f) => f.id !== id)
    );
    try {
      await deleteGeneration(id);
    } catch (err) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['generations'] });
      console.error("Failed to delete generation:", err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFiles = files.filter((file) => {
    const selectedType =
      activeFilter === "All"
        ? null
        : activeFilter === "Favorites" // Handle Favorites filter
        ? "favorites"
        : activeFilter === "Videos"
        ? "video"
        : activeFilter === "Images"
        ? "image"
        : activeFilter === "Audio"
        ? "audio"
        : activeFilter === "Scripts"
        ? "script"
        : activeFilter.toLowerCase();

    const matchesFilter =
      selectedType === "favorites"
        ? file.favorited
        : !selectedType || file.type === selectedType;
    const matchesSearch =
      !normalizedQuery || file.title.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesSearch;
  });

  const totalFiles = files.length;
  const totalSize = "—";
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedFiles = filteredFiles.slice(startIndex, endIndex);

  return (
    <div className="flex-1 flex flex-col w-full min-w-0 overflow-x-hidden">
      {/* Header */}
      <header className="h-14 bg-bg-secondary border-b border-border-color px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-semibold truncate">Library</h1>
          <span className="text-sm text-text-muted hidden md:inline">
            {totalFiles} files • {totalSize} used
          </span>
        </div>
        <div className="flex items-center gap-3">
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:p-6 lg:p-8 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto space-y-5 sm:space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative w-full lg:flex-1 lg:max-w-md">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
                🔍
              </span>
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border-color bg-bg-secondary text-white text-sm placeholder-text-muted focus:outline-none focus:border-accent-indigo/50"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 max-w-full">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => {
                    setActiveFilter(filter.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeFilter === filter.id
                      ? "bg-accent-indigo/10 text-accent-indigo"
                      : "border border-border-color text-text-secondary hover:bg-bg-tertiary"
                  }`}
                >
                  {filter.icon && <span className="mr-1">{filter.icon}</span>}
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 lg:ml-auto">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-accent-indigo/10 text-accent-indigo"
                    : "border border-border-color text-text-secondary hover:bg-bg-tertiary"
                }`}
              >
                ▦
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-accent-indigo/10 text-accent-indigo"
                    : "border border-border-color text-text-secondary hover:bg-bg-tertiary"
                }`}
              >
                ☰
              </button>
            </div>
          </div>

          {loading && (
            <>
              {/* Shimmer animation style */}
              <style>{`
                @keyframes shimmer {
                  0% { background-position: -400px 0; }
                  100% { background-position: 400px 0; }
                }
                .shimmer-line {
                  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%, transparent 100%);
                  background-size: 400px 100%;
                  animation: shimmer 1.8s ease-in-out infinite;
                }
              `}</style>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden"
                    >
                      {/* Thumbnail skeleton */}
                      <div className="aspect-video bg-bg-tertiary relative overflow-hidden">
                        <div className="shimmer-line absolute inset-0" />
                        {/* Status badge skeleton */}
                        <div className="absolute top-2 left-2 w-16 h-4 rounded-full bg-bg-secondary/60" />
                      </div>
                      {/* Text skeleton */}
                      <div className="p-3 space-y-2">
                        <div className="h-3.5 w-3/4 rounded bg-bg-tertiary relative overflow-hidden">
                          <div className="shimmer-line absolute inset-0" />
                        </div>
                        <div className="h-2.5 w-1/2 rounded bg-bg-tertiary relative overflow-hidden">
                          <div className="shimmer-line absolute inset-0" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-bg-secondary border border-border-color rounded-xl p-4 flex items-center gap-4"
                    >
                      {/* Icon skeleton */}
                      <div className="w-16 h-16 rounded-lg bg-bg-tertiary relative overflow-hidden shrink-0">
                        <div className="shimmer-line absolute inset-0" />
                      </div>
                      {/* Text skeleton */}
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-2/5 rounded bg-bg-tertiary relative overflow-hidden">
                          <div className="shimmer-line absolute inset-0" />
                        </div>
                        <div className="h-2.5 w-1/4 rounded bg-bg-tertiary relative overflow-hidden">
                          <div className="shimmer-line absolute inset-0" />
                        </div>
                      </div>
                      {/* Status skeleton */}
                      <div className="w-16 h-5 rounded-full bg-bg-tertiary relative overflow-hidden shrink-0">
                        <div className="shimmer-line absolute inset-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {!loading && error && (
            <div className="text-sm text-accent-red">{error}</div>
          )}
          {!loading && !error && displayedFiles.length === 0 && (
            <div className="text-sm text-text-muted">No files yet.</div>
          )}
          {!loading && !error && displayedFiles.length > 0 && (
            <>
              {/* File Grid */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {displayedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="bg-bg-secondary border border-border-color rounded-xl overflow-hidden group cursor-pointer hover:border-accent-indigo/30 transition-all"
                      onClick={() =>
                        setPreviewItem({
                          id: file.id,
                          type: file.type === "audio" ? "voice" : (file.type as GenerationRecord["type"]),
                          prompt: file.prompt,
                          title: file.title,
                          status: file.status,
                          aspect_ratio: null,
                          duration: file.duration ?? null,
                          quality: null,
                          style: null,
                          output_url: file.output_url,
                          favorited: file.favorited,
                          created_at: file.created_at,
                          external_id: null,
                          progress: file.progress,
                        })
                      }
                    >
                      <div
                        className={`aspect-video bg-linear-to-br ${file.gradient} flex items-center justify-center relative overflow-hidden`}
                      >
                        {/* Image preview */}
                        {file.type === "image" && file.output_url ? (
                          <img
                            src={file.output_url}
                            alt={file.title}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : file.type === "video" && file.output_url ? (
                          /* Video preview — poster frame via video element */
                          <>
                            <video
                              src={file.output_url}
                              className="absolute inset-0 w-full h-full object-cover"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            {/* Play icon overlay (always visible on video thumbs) */}
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="bg-black/50 rounded-full w-10 h-10 flex items-center justify-center text-xl">
                                ▶
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="text-4xl">{getFileIcon(file.type)}</span>
                        )}
                        <span
                          className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadge(file.status, file.progress).className}`}
                        >
                          {getStatusBadge(file.status, file.progress).label}
                        </span>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewItem({
                                id: file.id,
                                type: file.type === "audio" ? "voice" : (file.type as GenerationRecord["type"]),
                                prompt: file.prompt,
                                title: file.title,
                                status: file.status,
                                aspect_ratio: null,
                                duration: file.duration ?? null,
                                quality: null,
                                style: null,
                                output_url: file.output_url,
                                favorited: file.favorited,
                                created_at: file.created_at,
                                external_id: null,
                                progress: file.progress,
                              });
                            }}
                          >
                            {file.type === "video" || file.type === "audio"
                              ? "▶️"
                              : "👁️"}
                          </button>
                          <button 
                            className={`p-2 rounded-lg transition-colors ${
                              file.status === "pending" || file.status === "processing" 
                                ? "opacity-50 cursor-not-allowed bg-white/5" 
                                : "bg-white/10 hover:bg-white/20"
                            }`}
                            disabled={file.status === "pending" || file.status === "processing"}
                            onClick={(e) => handleDownload(e, file.output_url, file.title)}
                          >
                            ⬇️
                          </button>
                          <button 
                            className={`p-2 rounded-lg transition-colors ${file.favorited ? "bg-accent-amber text-white" : "bg-white/10 hover:bg-white/20"}`}
                            onClick={(e) => handleFavorite(e, file.id, file.favorited)}
                          >
                            ⭐
                          </button>
                          <button
                            className="p-2 rounded-lg bg-white/10 hover:bg-red-500/80 transition-colors"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: file.id, title: file.title }); }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                        {file.duration && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[10px] bg-black/60">
                            {file.duration}
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate">{file.title}</p>
                        <p className="text-xs text-text-muted">
                          {file.time} • {file.size}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="bg-bg-secondary border border-border-color rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-accent-indigo/30 transition-all cursor-pointer group"
                      onClick={() =>
                        setPreviewItem({
                          id: file.id,
                          type: file.type === "audio" ? "voice" : (file.type as GenerationRecord["type"]),
                          prompt: file.prompt,
                          title: file.title,
                          status: file.status,
                          aspect_ratio: null,
                          duration: file.duration ?? null,
                          quality: null,
                          style: null,
                          output_url: file.output_url,
                          favorited: file.favorited,
                          created_at: file.created_at,
                          external_id: null,
                          progress: file.progress,
                        })
                      }
                    >
                      <div className="flex items-start gap-3 sm:gap-4 w-full min-w-0">
                        <div
                          className={`w-16 h-16 rounded-lg bg-linear-to-br ${file.gradient} flex items-center justify-center shrink-0 overflow-hidden relative`}
                        >
                        {file.type === "image" && file.output_url ? (
                          <img
                            src={file.output_url}
                            alt={file.title}
                            className="absolute inset-0 w-full h-full object-cover rounded-lg"
                          />
                        ) : file.type === "video" && file.output_url ? (
                          <>
                            <video
                              src={file.output_url}
                              className="absolute inset-0 w-full h-full object-cover rounded-lg"
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="bg-black/50 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                                ▶
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="text-2xl">{getFileIcon(file.type)}</span>
                        )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{file.title}</p>
                              <p className="text-xs text-text-muted">
                                {file.time} • {file.size}
                                {file.duration && ` • ${file.duration}`}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${getStatusBadge(file.status, file.progress).className}`}
                            >
                              {getStatusBadge(file.status, file.progress).label}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              className="px-3 py-2 rounded-lg bg-bg-tertiary hover:bg-bg-primary transition-colors text-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewItem({
                                  id: file.id,
                                  type: file.type === "audio" ? "voice" : (file.type as GenerationRecord["type"]),
                                  prompt: file.prompt,
                                  title: file.title,
                                  status: file.status,
                                  aspect_ratio: null,
                                  duration: file.duration ?? null,
                                  quality: null,
                                  style: null,
                                  output_url: file.output_url,
                                  favorited: file.favorited,
                                  created_at: file.created_at,
                                  external_id: null,
                                  progress: file.progress,
                                });
                              }}
                            >
                              {file.type === "video" || file.type === "audio" ? "Play" : "Preview"}
                            </button>
                            <button 
                              className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                                file.status === "pending" || file.status === "processing" 
                                  ? "opacity-50 cursor-not-allowed bg-bg-tertiary" 
                                  : "bg-bg-tertiary hover:bg-bg-primary"
                              }`}
                              disabled={file.status === "pending" || file.status === "processing"}
                              onClick={(e) => handleDownload(e, file.output_url, file.title)}
                            >
                              Download
                            </button>
                            <button 
                              className={`px-3 py-2 rounded-lg transition-colors text-sm ${file.favorited ? "bg-accent-amber text-white" : "bg-bg-tertiary hover:bg-bg-primary"}`}
                              onClick={(e) => handleFavorite(e, file.id, file.favorited)}
                            >
                              {file.favorited ? "Favorited" : "Favorite"}
                            </button>
                            <button
                              className="px-3 py-2 rounded-lg bg-bg-tertiary hover:bg-red-500/80 transition-colors text-sm"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: file.id, title: file.title }); }}
                              title="Delete"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
            <p className="text-sm text-text-muted">
              Showing {totalFiles === 0 ? 0 : startIndex + 1}-
              {Math.min(endIndex, totalFiles)} of {totalFiles} files
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-border-color text-text-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                const page = currentPage <= 2 ? i + 1 : currentPage - 1 + i;
                if (page > totalPages) return null;
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      currentPage === page
                        ? "bg-accent-indigo text-white"
                        : "border border-border-color text-text-secondary hover:bg-bg-tertiary"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-border-color text-text-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </main>

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6"
          onClick={() => {
            setPreviewItem(null);
            if (previewId) router.replace("/dashboard/library", { scroll: false });
          }}
        >
          <div
            className="w-full max-w-3xl max-h-[calc(100vh-3rem)] bg-bg-secondary border border-border-color rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-border-color flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">
                  {truncateText(previewItem.title ?? previewItem.prompt, 80)}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {previewItem.type.toUpperCase()} •{" "}
                  {formatRelativeTime(previewItem.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPreviewItem(null);
                  if (previewId) router.replace("/dashboard/library", { scroll: false });
                }}
                className="text-text-muted hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              {previewItem.type === "video" && (
                <div className="space-y-3">
                  {previewItem.output_url ? (
                    <div className="w-full rounded-xl border border-border-color bg-black overflow-hidden flex items-center justify-center">
                      <video
                        className="w-full max-h-[60vh] object-contain"
                        controls
                        playsInline
                        preload="metadata"
                        src={previewItem.output_url}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-video rounded-xl border border-dashed border-border-color flex items-center justify-center text-xs text-text-muted">
                      No video URL set yet.
                    </div>
                  )}
                </div>
              )}
              {previewItem.type === "image" && (
                <div className="space-y-3">
                  {previewItem.output_url ? (
                    <img
                      src={previewItem.output_url}
                      alt={previewItem.title ?? previewItem.prompt}
                      className="w-full max-h-[60vh] object-contain rounded-xl border border-border-color bg-black"
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
                </div>
              )}
              {previewItem.type === "script" && (
                <div className="space-y-3">
                  <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-border-color bg-bg-tertiary p-4 text-sm whitespace-pre-wrap">
                    {previewItem.prompt}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm bg-bg-secondary border border-border-color rounded-2xl shadow-xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Delete item?</h3>
            <p className="text-sm text-text-muted">
              <span className="text-white font-medium">{deleteTarget.title}</span> will be permanently removed from your library.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-border-color text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
