"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Calendar, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Pipeline = {
  id: string;
  name: string;
  description: string;
  status: string;
  updated_at: string;
};

function PipelineCardSkeleton() {
  return (
    <div className="bg-[#12121a] border border-white/[0.08] rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] to-transparent animate-pulse" />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/[0.06]" />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
        <div className="h-5 w-2/3 rounded bg-white/[0.06] mb-3" />
        <div className="space-y-2 mb-4">
          <div className="h-3 w-full rounded bg-white/[0.06]" />
          <div className="h-3 w-5/6 rounded bg-white/[0.06]" />
        </div>
        <div className="flex items-center gap-4 border-t border-white/[0.05] pt-4">
          <div className="h-3 w-24 rounded bg-white/[0.06]" />
          <div className="h-5 w-16 rounded-full bg-white/[0.06]" />
        </div>
      </div>
    </div>
  );
}

export default function PipelineListPage() {
  const [creating, setCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: pipelines = [],
    isLoading: isLoadingPipelines,
    isFetching: isFetchingPipelines,
  } = useQuery({
    queryKey: ["pipelines"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("pipelines")
        .insert([
          {
            user_id: user.id,
            name,
            description: "A new workflow pipeline",
            nodes: [],
            edges: [],
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data as Pipeline;
    },
    onMutate: async (name: string) => {
      setCreating(true);
      await queryClient.cancelQueries({ queryKey: ["pipelines"] });
      const prev = queryClient.getQueryData<Pipeline[]>(["pipelines"]) ?? [];
      const tempId = `temp-${crypto.randomUUID()}`;
      const optimistic: Pipeline = {
        id: tempId,
        name,
        description: "A new workflow pipeline",
        status: "inactive",
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<Pipeline[]>(["pipelines"], [optimistic, ...prev]);
      return { prev, tempId };
    },
    onError: (_err, _name, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["pipelines"], ctx.prev);
      setCreating(false);
    },
    onSuccess: (created, _name, ctx) => {
      queryClient.setQueryData<Pipeline[]>(["pipelines"], (old = []) =>
        old.map((p) => (p.id === ctx?.tempId ? created : p)),
      );
      setShowCreateDialog(false);
      setDraftName("");
      router.push(`/pipeline/${created.id}`);
    },
    onSettled: () => {
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("pipelines")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ["pipelines"] });
      const prev = queryClient.getQueryData<Pipeline[]>(["pipelines"]) ?? [];
      queryClient.setQueryData<Pipeline[]>(["pipelines"], (old = []) =>
        old.map((p) => (p.id === id ? { ...p, name, updated_at: new Date().toISOString() } : p)),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["pipelines"], ctx.prev);
    },
    onSuccess: () => {
      setShowRenameDialog(false);
      setSelectedPipeline(null);
      setDraftName("");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["pipelines"] });
      const prev = queryClient.getQueryData<Pipeline[]>(["pipelines"]) ?? [];
      queryClient.setQueryData<Pipeline[]>(["pipelines"], (old = []) => old.filter((p) => p.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["pipelines"], ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

  const openCreate = () => {
    setDraftName("");
    setShowCreateDialog(true);
  };

  const submitCreate = async () => {
    const name = draftName.trim();
    if (!name) return;
    try {
      await createMutation.mutateAsync(name);
    } catch (error) {
      console.error("Error creating pipeline:", error);
    }
  };

  const openRename = (e: React.MouseEvent, pipeline: Pipeline) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedPipeline(pipeline);
    setDraftName(pipeline.name ?? "");
    setShowRenameDialog(true);
  };

  const submitRename = async () => {
    const name = draftName.trim();
    if (!selectedPipeline || !name || name === selectedPipeline.name) {
      setShowRenameDialog(false);
      return;
    }
    try {
      await renameMutation.mutateAsync({ id: selectedPipeline.id, name });
    } catch (error) {
      console.error("Error renaming pipeline:", error);
    }
  };

  const deletePipeline = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this pipeline?")) return;

    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting pipeline:", error);
    }
  };

  const pipelinesLoading = isLoadingPipelines || isFetchingPipelines;

  return (
    <div className="text-white min-h-screen flex flex-col bg-[#0a0a0f] font-sans">
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12121a] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Create pipeline</h2>
            <p className="mt-2 text-sm text-gray-400">Enter a name for your new pipeline.</p>
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitCreate();
                }
              }}
              placeholder="Pipeline name"
              className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#0f0f16] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setDraftName("");
                }}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitCreate()}
                disabled={!draftName.trim() || createMutation.isPending}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRenameDialog && selectedPipeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12121a] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white">Rename pipeline</h2>
            <p className="mt-2 text-sm text-gray-400">Update the name for this pipeline.</p>
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitRename();
                }
              }}
              placeholder="Pipeline name"
              className="mt-4 w-full rounded-xl border border-white/[0.08] bg-[#0f0f16] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setSelectedPipeline(null);
                  setDraftName("");
                }}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitRename()}
                disabled={!draftName.trim() || renameMutation.isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {renameMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={openCreate}
              disabled={creating || createMutation.isPending}
              className="group flex flex-col items-center justify-center h-40 sm:h-48 rounded-2xl border-2 border-dashed border-white/[0.10] hover:border-indigo-500/50 hover:bg-white/[0.03] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div className="w-12 h-12 rounded-full bg-[#0f0f16] group-hover:bg-indigo-500/10 flex items-center justify-center mb-3 transition-colors">
                <div className="text-gray-400 group-hover:text-indigo-300 transition-colors">
                  {creating || createMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-5 h-5" />
                  )}
                </div>
              </div>
              <span className="font-medium text-gray-200 group-hover:text-indigo-300 transition-colors">
                Create Pipeline
              </span>
            </button>
          </div>
        </div>
        {pipelinesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 9 }).map((_, idx) => (
              <PipelineCardSkeleton key={idx} />
            ))}
          </div>
        ) : pipelines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#12121a] border border-white/[0.08] flex items-center justify-center mb-6">
              <Plus className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No pipelines yet</h2>
            <p className="text-gray-500 mb-8 max-w-md">
              Create your first pipeline to start automating your content creation
              workflow using AI tools.
            </p>
            <button
              onClick={openCreate}
              disabled={creating || createMutation.isPending}
              className="px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
            >
              Start Building
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pipelines.map((pipeline: Pipeline) => (
              <Link
                key={pipeline.id}
                href={`/pipeline/${pipeline.id}`}
                className="group block bg-[#12121a] border border-white/[0.08] rounded-2xl p-5 hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.1)] transition-all relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                      <span className="text-2xl">⚡</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => openRename(e, pipeline)}
                        className="p-2 rounded-lg text-gray-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        title="Rename Pipeline"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => deletePipeline(e, pipeline.id)}
                        className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        title="Delete Pipeline"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-2 group-hover:text-indigo-400 transition-colors">
                    {pipeline.name}
                  </h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                    {pipeline.description || "No description provided."}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-600 border-t border-white/[0.05] pt-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(pipeline.updated_at).toLocaleDateString()}
                    </div>
                    <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {pipeline.status}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
