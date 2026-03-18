"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { JsonViewer } from "@/components/pipeline/JsonViewer";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  Edge,
  MarkerType,
  getOutgoers,
} from "reactflow";
import "reactflow/dist/style.css";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Save,
  Play,
  Trash2,
} from "lucide-react";
import { PipelineNode } from "@/components/pipeline/NodeTypes";
import { VideoEditorSidebar } from "@/components/pipeline/nodes/VideoEditorSidebar";
import { ImageEditorSidebar } from "@/components/pipeline/nodes/ImageEditorSidebar";

const AICreativeGovernanceConsole = dynamic(
  () => import("@/components/admin/AICreativeGovernanceConsole"),
  { ssr: false }
);

// Initial Node Data for Palette
const nodeTypesList = [
  {
    type: "scriptWriter",
    label: "Script Writer",
    subLabel: "",
    icon: "📝",
    content: "Input: Product description<br>Output: Video script",
    iconBg: "bg-blue-500/15",
    category: "Content Generation",
  },
  {
    type: "voiceGenerator",
    label: "Voice Generator",
    subLabel: "",
    icon: "🎙️",
    content: "Input: {{step1.script}}<br>Voice: Rachel",
    iconBg: "bg-emerald-500/15",
    category: "Content Generation",
  },
  {
    type: "videoGenerator",
    label: "Video Generator",
    subLabel: "",
    icon: "🎬",
    content: "Input: {{step2.audio}}<br>Style: Cinematic",
    iconBg: "bg-pink-500/15",
    category: "Content Generation",
  },
  {
    type: "imageGenerator",
    label: "Image Generator",
    subLabel: "",
    icon: "🖼️",
    content: "Prompt: {{script.scene}}<br>Ratio: 16:9",
    iconBg: "bg-purple-500/15",
    category: "Content Generation",
  },
  {
    type: "videoEditor",
    label: "Video Editor",
    subLabel: "",
    icon: "✂️",
    content: "Input: Video buffer",
    iconBg: "bg-purple-500/15",
    category: "Post-Processing",
  },
  {
    type: "imageEditor",
    label: "Image Editor",
    subLabel: "",
    icon: "🎨",
    content: "Input: Image buffer",
    iconBg: "bg-purple-500/15",
    category: "Post-Processing",
  },
  {
    type: "httpRequest",
    label: "HTTP Request",
    subLabel: "Call External API",
    icon: "🌐",
    content: "GET https://api.example.com",
    iconBg: "bg-orange-500/15",
    category: "Actions",
  },
  {
    type: "zapierWebhook",
    label: "Zapier Webhook",
    subLabel: "Send to Zapier",
    icon: "⚡",
    content: "POST https://hooks.zapier.com/...",
    iconBg: "bg-amber-500/15",
    category: "Actions",
  },
  {
    type: "webhook",
    label: "Webhook",
    subLabel: "Listen for events",
    icon: "🔗",
    content: "Waiting for events...",
    iconBg: "bg-cyan-500/15",
    category: "Triggers",
  },
  {
    type: "webhookResponse",
    label: "Webhook Response",
    subLabel: "Return data to caller",
    icon: "wk",
    content: "Response: {{step1.output}}",
    iconBg: "bg-cyan-500/15",
    category: "Actions",
  },
  {
    type: "schedule",
    label: "Schedule",
    subLabel: "Run periodically",
    icon: "📅",
    content: "Runs every 1 hour",
    iconBg: "bg-green-500/15",
    category: "Triggers",
  },
];

const SidebarItem = ({ item, onDragStart }: any) => (
  <div
    className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-grab hover:bg-white/10 transition-colors group"
    draggable
    onDragStart={(event) => onDragStart(event, item)}
  >
    <span className="text-xl group-hover:scale-110 transition-transform">
      {item.icon}
    </span>
    <div>
      <p className="text-sm font-medium text-white">{item.label}</p>
      <p className="text-[10px] text-gray-500">{item.subLabel}</p>
    </div>
  </div>
);

export default function PipelineBuilder() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const isLoadingRef = useRef(true);
  const isRuntimePatchRef = useRef(false);

  const onNodesChangeWrapped = useCallback((changes: any) => {
    onNodesChange(changes);
    if (isLoadingRef.current || isRuntimePatchRef.current) return;
    if (changes.some((c: any) => c.type !== "select")) {
      setIsDirty(true);
    }
  }, [onNodesChange]);

  const onEdgesChangeWrapped = useCallback((changes: any) => {
    onEdgesChange(changes);
    if (isLoadingRef.current || isRuntimePatchRef.current) return;
    if (changes.some((c: any) => c.type !== "select")) {
      setIsDirty(true);
    }
  }, [onEdgesChange]);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  const [pipelineName, setPipelineName] = useState("Untitled Pipeline");
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [listeningNodeId, _setListeningNodeId] = useState<string | null>(null);
  const listeningNodeRef = useRef<string | null>(null);

  const setListeningNodeId = useCallback((id: string | null) => {
    _setListeningNodeId(id);
    listeningNodeRef.current = id;
  }, []);

  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const nodeTypes = useMemo(() => ({ pipelineNode: PipelineNode }), []);

  useEffect(() => {
    if (!id) return;

    const fetchPipeline = async () => {
      isLoadingRef.current = true;
      try {
        const { data, error } = await supabase
          .from("pipelines")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        if (data) {
          setPipelineName(data.name);
          setNodes(data.nodes || []);
          setEdges(data.edges || []);
          setIsActive(data.status === "active");
        }
      } catch (error) {
        console.error("Error loading pipeline:", error);
      } finally {
        setLoading(false);
        setTimeout(() => {
          isLoadingRef.current = false;
        }, 100);
      }
    };

    fetchPipeline();

    const pollInterval = setInterval(async () => {
      if (!listeningNodeRef.current) return;

      const currentListeningId = listeningNodeRef.current;

      try {
        const { data } = await supabase
          .from("pipelines")
          .select("nodes")
          .eq("id", id)
          .single();

        if (data && data.nodes) {
          const updatedNode = data.nodes.find((n: any) => n.id === currentListeningId);
          if (updatedNode && updatedNode.data.lastRun) {
            setListeningNodeId(null);
            setNodes(data.nodes);
            setSelectedNode((curr: any) => {
              if (curr && curr.id === currentListeningId) {
                return updatedNode;
              }
              return curr;
            });
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    const channel = supabase
      .channel(`pipeline:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pipelines",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (!saving) {
            const newData = payload.new as any;
            if (newData && newData.nodes) {
              setNodes(() => {
                const currentListeningId = listeningNodeRef.current;

                if (currentListeningId) {
                  const updatedNode = newData.nodes.find((n: any) => n.id === currentListeningId);
                  if (updatedNode && updatedNode.data.lastRun) {
                    setListeningNodeId(null);
                    setSelectedNode((curr: any) => {
                      if (curr && curr.id === currentListeningId) {
                        return updatedNode;
                      }
                      return curr;
                    });
                  }
                }
                return newData.nodes;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [id, saving, supabase, setEdges, setNodes, setListeningNodeId]);

  const onDragStart = (event: React.DragEvent, nodeType: any) => {
    event.dataTransfer.setData("application/reactflow", JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const typeData = event.dataTransfer.getData("application/reactflow");
      if (!typeData) return;

      const item = JSON.parse(typeData);

      if (["webhook", "schedule"].includes(item.type)) {
        const hasTrigger = nodes.some((n: any) => ["webhook", "schedule"].includes(n.data.type));
        if (hasTrigger) {
          alert("You can only have one trigger (Webhook or Schedule) per pipeline.");
          return;
        }
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newItem = { ...item };

      if (["scriptWriter", "voiceGenerator", "videoGenerator", "imageGenerator", "httpRequest", "zapierWebhook"].includes(item.type)) {
        const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        newItem.label = `${item.label} ${suffix}`;
      }

      const newNode = {
        id: crypto.randomUUID(),
        type: "pipelineNode",
        position,
        data: { ...newItem },
      };

      setNodes((nds) => nds.concat(newNode));
      setIsDirty(true);
    },
    [reactFlowInstance, nodes, setNodes]
  );

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) =>
      addEdge(
        { ...params, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
        eds
      )
    );
    setIsDirty(true);
  }, [setEdges]);

  const onNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedNode(node);
  };

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [tempName, setTempName] = useState("");

  const internalSave = async (nodesToSave: any, nameToSave: string, activeStatus: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("pipelines")
        .update({
          name: nameToSave,
          nodes: nodesToSave,
          edges,
          status: activeStatus ? "active" : "inactive",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      setIsDirty(false);
    } catch (error) {
      console.error("Error saving pipeline:", error);
    } finally {
      setSaving(false);
    }
  };

  const savePipeline = async (nodesToSaveOrEvent: any = nodes, isUserAction: boolean = false) => {
    let nodesToSave = nodes;
    if (Array.isArray(nodesToSaveOrEvent)) {
      nodesToSave = nodesToSaveOrEvent;
    }

    const isEvent = nodesToSaveOrEvent && nodesToSaveOrEvent.preventDefault;
    const effectiveIsUserAction = isUserAction || isEvent;
    void effectiveIsUserAction;

    const currentName = pipelineName;
    await internalSave(nodesToSave, currentName, isActive);
  };

  const confirmRenameAndSave = async () => {
    setPipelineName(tempName);
    setShowRenameDialog(false);
    await internalSave(nodes, tempName, isActive);
  };

  const runNode = async (node: any, context: any = {}) => {
    if (node.data.type === "webhook") {
      if (!node.data.output) throw new Error("Webhook has no data. Please listen for an event first.");
      return typeof node.data.output === "string" ? JSON.parse(node.data.output) : node.data.output;
    }

    if (node.data.type === "imageEditor") {
      if (!node.data.output) throw new Error("No image data. Please save changes in the editor first.");

      isRuntimePatchRef.current = true;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, status: "completed" } }
            : n
        )
      );
      setTimeout(() => {
        isRuntimePatchRef.current = false;
      }, 0);
      return node.data.output;
    }

    isRuntimePatchRef.current = true;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, status: "running" } }
          : n
      )
    );
    setTimeout(() => {
      isRuntimePatchRef.current = false;
    }, 0);

    try {
      const response = await fetch("/api/pipeline/run-node", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: node.data.type,
          data: node.data,
          context,
        }),
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      isRuntimePatchRef.current = true;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: "completed",
                  output: JSON.stringify(result.output, null, 2),
                  generationId: result.generationId,
                },
              }
            : n
        )
      );
      setTimeout(() => {
        isRuntimePatchRef.current = false;
      }, 0);

      return result.output;
    } catch (error) {
      console.error("Node Execution Failed:", error);
      isRuntimePatchRef.current = true;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, status: "error", error: String(error) } }
            : n
        )
      );
      setTimeout(() => {
        isRuntimePatchRef.current = false;
      }, 0);
      throw error;
    }
  };

  const runPipeline = async () => {
    if (isDirty) {
      await savePipeline(nodes, false);
    }
    setRunning(true);

    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "pending", output: null } })));

    try {
      const executionQueue: any[] = nodes.filter((n) => !edges.some((e) => e.target === n.id));
      const nodeOutputs = new Map();

      while (executionQueue.length > 0) {
        const currentNode = executionQueue.shift();

        const context: any = {};
        nodeOutputs.forEach((val, key) => {
          const n = nodes.find((nd) => nd.id === key);
          if (n) {
            const labelKey = n.data.label.toLowerCase().replace(/\s+/g, "_");
            context[labelKey] = val;
          }
        });

        const output = await runNode(currentNode, context);
        nodeOutputs.set(currentNode.id, output);

        const children = getOutgoers(currentNode, nodes, edges);
        for (const child of children) {
          if (!executionQueue.find((n) => n.id === child.id)) {
            executionQueue.push(child);
          }
        }
      }
    } catch (error) {
      console.error("Pipeline Execution Failed", error);
    } finally {
      setRunning(false);
    }
  };

  const updateNodeData = useCallback((key: string, value: any) => {
    if (!selectedNode) return;
    const nodeId = selectedNode.id;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, [key]: value },
          };
        }
        return node;
      })
    );

    setSelectedNode((curr: any) => {
      if (curr && curr.id === nodeId) {
        return {
          ...curr,
          data: { ...curr.data, [key]: value },
        };
      }
      return curr;
    });

    setIsDirty(true);
  }, [selectedNode, setNodes]);

  if (loading) {
    return <div className="h-screen bg-[#0a0a0f] flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] text-white">
      <header className="h-14 bg-[#12121a] border-b border-white/[0.08] px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/pipeline"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="w-px h-6 bg-white/[0.08]"></div>
          <div>
            <input
              type="text"
              value={pipelineName}
              onChange={(e) => {
                setPipelineName(e.target.value);
                setIsDirty(true);
              }}
              className="bg-transparent text-white font-semibold focus:outline-none"
            />
            <p className="text-[10px] text-gray-500">
              {isDirty ? "Unsaved changes" : saving ? "Saving..." : "Last saved just now"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-4 bg-[#1a1a24] px-3 py-1.5 rounded-lg border border-white/[0.08]">
            <span className={`w-2 h-2 rounded-full ${isActive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-gray-500"}`}></span>
            <span className="text-xs text-gray-300 font-medium mr-2">{isActive ? "Active" : "Inactive"}</span>
            <button
              onClick={async () => {
                const newStatus = !isActive;
                setIsActive(newStatus);
                setIsDirty(true);
                await internalSave(nodes, pipelineName, newStatus);
              }}
              className={`relative w-8 h-4 rounded-full transition-colors ${isActive ? "bg-emerald-500/20" : "bg-white/10"}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isActive ? "left-4.5 bg-emerald-500" : "left-0.5 bg-gray-400"}`}
                style={{ left: isActive ? "18px" : "2px" }}
              ></div>
            </button>
          </div>

          <button
            onClick={(e) => savePipeline(nodes, true)}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-sm text-gray-400 hover:bg-white/5 flex items-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={runPipeline}
            disabled={running || nodes.length === 0}
            className={`px-3 py-1.5 rounded-lg bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 flex items-center gap-2 ${running ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {running ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Run"}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-[#12121a] border-r border-white/[0.08] flex flex-col p-4 gap-6 overflow-y-auto">
          <div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search steps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#1a1a24] border border-white/[0.08] text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {["Triggers", "Content Generation", "Post-Processing", "Actions"].map((category) => {
              const categoryNodes = nodeTypesList.filter(
                (n) =>
                  n.category === category &&
                  (n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    n.subLabel?.toLowerCase().includes(searchQuery.toLowerCase()))
              );

              if (categoryNodes.length === 0) return null;

              return (
                <div key={category} className="mb-6">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-3">{category}</p>
                  <div className="space-y-2">
                    {categoryNodes.map((item) => (
                      <SidebarItem key={item.type} item={item} onDragStart={onDragStart} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChangeWrapped}
              onEdgesChange={onEdgesChangeWrapped}
              onConnect={onConnect}
              onInit={setReactFlowInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-[#0a0a0f]"
            >
              <Background color="#2a2a35" gap={16} />
              <Controls className="!bg-[#12121a] !border-white/[0.08] [&>button]:!fill-white [&>button]:!border-b-white/[0.08]" />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {selectedNode ? (
          <div className="w-[420px] bg-[#12121a] border-l border-white/[0.08] p-4 flex flex-col overflow-y-auto">
            <div className="mb-6 pb-4 border-b border-white/[0.08]">
              <h3 className="font-semibold">{selectedNode.data.label}</h3>
              <p className="text-xs text-gray-500">ID: {selectedNode.id}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2">Label</label>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => updateNodeData("label", e.target.value)}
                  className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              {["scriptWriter", "videoGenerator", "imageGenerator", "voiceGenerator"].includes(selectedNode.data.type) && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Prompt / Input</label>
                  <textarea
                    value={selectedNode.data.content?.replace(/<br>/g, "\n") || ""}
                    onChange={(e) => updateNodeData("content", e.target.value.replace(/\n/g, "<br>"))}
                    className="w-full px-3 py-2 h-24 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Enter your prompt here (use {{variable}})..."
                  />
                </div>
              )}

              {selectedNode.data.type === "videoEditor" && (
                <VideoEditorSidebar node={selectedNode} updateNodeData={updateNodeData} />
              )}

              {selectedNode.data.type === "imageEditor" && (
                <ImageEditorSidebar node={selectedNode} updateNodeData={updateNodeData} />
              )}

              {selectedNode.data.type === "httpRequest" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Request URL</label>
                    <input
                      type="text"
                      value={selectedNode.data.url || ""}
                      onChange={(e) => updateNodeData("url", e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500 font-mono"
                      placeholder="https://api.example.com/v1/resource"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Method</label>
                    <select
                      value={selectedNode.data.method || "GET"}
                      onChange={(e) => updateNodeData("method", e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                      <option value="DELETE">DELETE</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.data.type === "voiceGenerator" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Speaker Name</label>
                  <select
                    value={selectedNode.data.speaker || "Rachel"}
                    onChange={(e) => updateNodeData("speaker", e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Rachel">Rachel (American, Calm)</option>
                    <option value="Drew">Drew (American, News)</option>
                    <option value="Clyde">Clyde (Deep, Narrative)</option>
                    <option value="Mimi">Mimi (Childish)</option>
                  </select>
                </div>
              )}

              {selectedNode.data.type === "videoGenerator" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Duration (seconds)</label>
                    <input
                      type="range"
                      min="2"
                      max="10"
                      step="1"
                      value={selectedNode.data.duration || 4}
                      onChange={(e) => updateNodeData("duration", e.target.value)}
                      className="w-full accent-indigo-500"
                    />
                    <div className="text-right text-xs text-gray-400">{selectedNode.data.duration || 4}s</div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Quality</label>
                    <select
                      value={selectedNode.data.quality || "1080p"}
                      onChange={(e) => updateNodeData("quality", e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                      <option value="720p">720p (Fast)</option>
                      <option value="1080p">1080p (Standard)</option>
                      <option value="4k">4k (High Quality)</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.data.type === "imageGenerator" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Aspect Ratio</label>
                  <select
                    value={selectedNode.data.aspectRatio || "16:9"}
                    onChange={(e) => updateNodeData("aspectRatio", e.target.value)}
                    className="w-full px-3 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="1:1">1:1 (Square)</option>
                    <option value="4:3">4:3 (Classic)</option>
                  </select>
                </div>
              )}

              {!["scriptWriter", "voiceGenerator", "videoGenerator", "imageGenerator", "webhook", "httpRequest", "zapierWebhook"].includes(selectedNode.data.type) && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2">Description</label>
                  <textarea
                    value={selectedNode.data.content?.replace(/<br>/g, "\n") || ""}
                    onChange={(e) => updateNodeData("content", e.target.value.replace(/\n/g, "<br>"))}
                    className="w-full px-3 py-2 h-24 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-sm focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              )}

              {selectedNode.data.output && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs text-gray-500">Output Variables</label>
                    <span className="text-[10px] text-indigo-400">Click to copy path</span>
                  </div>
                  <JsonViewer data={selectedNode.data.output} nodeLabel={selectedNode.data.label} />
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-white/[0.08]">
              <button
                onClick={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setSelectedNode(null);
                }}
                className="w-full py-2 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium hover:bg-red-500/20 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Step
              </button>
            </div>
          </div>
        ) : (
          <div className="w-[520px] bg-[#12121a] border-l border-white/[0.08] overflow-y-auto">
            <AICreativeGovernanceConsole />
          </div>
        )}
      </div>

      {showRenameDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#12121a] border border-white/[0.08] rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2">Name your Pipeline</h3>
            <p className="text-sm text-gray-400 mb-6">
              Give your new pipeline a descriptive name to help you identify it later.
            </p>

            <div className="space-y-4">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a24] border border-white/[0.08] rounded-lg text-white focus:outline-none focus:border-indigo-500 placeholder-gray-600"
                placeholder="My Awesome Pipeline"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRenameAndSave();
                }}
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowRenameDialog(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRenameAndSave}
                  disabled={!tempName.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Pipeline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
