"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Calendar, MoreVertical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Pipeline = {
  id: string;
  name: string;
  description: string;
  status: string;
  updated_at: string;
};

export default function PipelineListPage() {
  const [creating, setCreating] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pipelines = [], isLoading: loading } = useQuery({
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
  });

  const createPipeline = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("pipelines")
        .insert([
          {
            user_id: user.id,
            name: "New Pipeline",
            description: "A new workflow pipeline",
            nodes: [],
            edges: [],
          },
        ])
        .select()
        .single();

      if (error) throw error;
      router.push(`/pipeline/${data.id}`);
    } catch (error) {
      console.error("Error creating pipeline:", error);
      setCreating(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipelines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
  });

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

  return (
    <div className="text-white min-h-screen flex flex-col bg-[#0a0a0f] font-sans">
      <header className="h-16 bg-[#12121a] border-b border-white/[0.08] px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </Link>
          <div className="w-px h-6 bg-white/[0.08]"></div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            My Pipelines
          </h1>
        </div>
        <button
          onClick={createPipeline}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all disabled:opacity-50"
        >
          {creating ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create Pipeline
        </button>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
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
              onClick={createPipeline}
              disabled={creating}
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
                    <button
                      onClick={(e) => deletePipeline(e, pipeline.id)}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
