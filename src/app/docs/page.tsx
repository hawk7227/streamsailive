"use client";

import React, { useState, useEffect } from "react";
import { DocsLayout } from "@/components/docs/DocsLayout";
import { CodeBlock } from "@/components/docs/CodeBlock";
import { Play, Loader2, Key, BookOpen, Terminal, CheckCircle2, AlertCircle } from "lucide-react";

// --- Types & Data ---

type HttpMethod = "GET" | "POST" | "DELETE" | "PUT";
type ViewMode = "read" | "try";

interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
  options?: string[];
}

interface ApiResponse {
  status: number;
  description: string;
  schema: Record<string, any>;
}

interface ApiEndpoint {
  id: string;
  title: string;
  method: HttpMethod;
  path: string;
  description: string;
  details: string;
  params: ApiParam[];
  bodyParams?: ApiParam[];
  responses: ApiResponse[];
}

const COMMON_PARAMS = [
    { name: "prompt", type: "string", required: true, description: "The text description of the content you want to generate. Be specific for better results." },
    { name: "aspectRatio", type: "string", required: false, description: "The desired aspect ratio. Common values are 16:9, 9:16, or 1:1." },
    { name: "duration", type: "string", required: false, description: "Target duration for video/audio content (e.g., '10s', '30s')." },
    { name: "quality", type: "string", required: false, description: "Quality preset. 'hd' costs 1 credit, '4k' costs 2 credits." }
];

const ENDPOINTS: Record<string, ApiEndpoint[]> = {
  "Generations": [
    {
      id: "list-generations",
      title: "List Generations",
      method: "GET",
      path: "/api/v1/generations",
      description: "Retrieve a paginated list of all content generations.",
      details: "Returns a list of your generations. The generations are returned in sorted order, with the most recent generations appearing first. The response includes details such as the generation status, prompt, and output URL.",
      params: [
        { name: "limit", type: "integer", required: false, description: "Limit response count (max 100).", default: "10" },
        { name: "offset", type: "integer", required: false, description: "Skip N items.", default: "0" },
        { name: "type", type: "string", required: false, description: "Filter by type.", options: ["video", "image", "script", "voice"] },
      ],
      responses: [
        {
          status: 200,
          description: "Successful response",
          schema: {
            data: [
              {
                id: "gen_123456789",
                type: "video",
                prompt: "A futuristic city skyline",
                status: "completed",
                output_url: "https://api.streamsai.com/v1/outputs/gen_123.mp4",
                created_at: "2024-03-20T14:30:00Z"
              }
            ]
          }
        }
      ]
    },
    {
       id: "get-generation",
       title: "Get Generation",
       method: "GET",
       path: "/api/v1/generations/:id",
       description: "Retrieve a specific generation by ID.",
       details: "Get the status and details of a specific generation. Use this endpoint to poll for completion when a job is in 'processing' status.",
       params: [
           { name: "id", type: "string", required: true, description: " The ID of the generation to retrieve." }
       ],
       responses: [
           {
               status: 200,
               description: "Generation details",
               schema: {
                   data: {
                       id: "gen_987654321",
                       status: "processing", // OR completed
                       output_url: null, // OR url
                       created_at: "2024-03-20T14:35:00Z"
                   }
               }
           }
       ]
    }
  ],
  "Create Content": [
    {
      id: "create-video",
      title: "Create Video",
      method: "POST",
      path: "/api/v1/generations",
      description: "Generate a video from text.",
      details: "Start a video generation job. Returns a job ID with status 'processing'. Poll the Get Generation endpoint to check for completion.",
      params: [],
      bodyParams: [
        { name: "type", type: "string", required: true, description: "Must be 'video'.", default: "video", options: ["video"] },
        { name: "prompt", type: "string", required: true, description: "The text description of the video content. Be specific for better results." },
        { name: "aspectRatio", type: "string", required: false, description: "The desired aspect ratio (e.g., 16:9, 9:16).", default: "16:9" },
        { name: "duration", type: "string", required: false, description: "Target duration (e.g., '10s', '30s').", default: "10s" },
        { name: "quality", type: "string", required: false, description: "Quality preset. 'hd' (1 credit) or '4k' (2 credits).", default: "hd" }
      ],
      responses: [
        {
          status: 200,
          description: "Job created",
          schema: { data: { id: "gen_video_123", status: "processing" } }
        }
      ]
    },
    {
      id: "create-voice",
      title: "Create Voice",
      method: "POST",
      path: "/api/v1/generations",
      description: "Generate voiceover audio from text.",
      details: "Start a voice generation job. Returns a job ID with status 'processing'.",
      params: [],
      bodyParams: [
        { name: "type", type: "string", required: true, description: "Must be 'voice'.", default: "voice", options: ["voice"] },
        { name: "prompt", type: "string", required: true, description: "The text/script to be spoken." },
        { name: "duration", type: "string", required: false, description: "Approximate duration (optional constraint).", default: "30s" }
      ],
      responses: [
         {
          status: 200,
          description: "Job created",
          schema: { data: { id: "gen_voice_123", status: "processing" } }
        }
      ]
    },
    {
      id: "create-image",
      title: "Create Image",
      method: "POST",
      path: "/api/v1/generations",
      description: "Generate an image from text.",
      details: "Start an image generation job. Returns a job ID with status 'processing'.",
      params: [],
      bodyParams: [
        { name: "type", type: "string", required: true, description: "Must be 'image'.", default: "image", options: ["image"] },
        { name: "prompt", type: "string", required: true, description: "Detailed description of the image." },
        { name: "aspectRatio", type: "string", required: false, description: "Image dimensions (e.g., 1:1, 16:9).", default: "1:1" },
        { name: "quality", type: "string", required: false, description: "Image quality preset.", default: "hd" }
      ],
      responses: [
         {
          status: 200,
          description: "Job created",
          schema: { data: { id: "gen_image_123", status: "processing" } }
        }
      ]
    },
    {
      id: "create-script",
      title: "Create Script",
      method: "POST",
      path: "/api/v1/generations",
      description: "Generate a script from a prompt.",
      details: "Start a script generation job. Returns a job ID with status 'processing'.",
      params: [],
      bodyParams: [
        { name: "type", type: "string", required: true, description: "Must be 'script'.", default: "script", options: ["script"] },
        { name: "prompt", type: "string", required: true, description: "Topic or outline for the script." }
      ],
      responses: [
         {
          status: 200,
          description: "Job created",
          schema: { data: { id: "gen_script_123", status: "processing" } }
        }
      ]
    },
  ],
  "Usage": [
    {
      id: "get-usage",
      title: "Retrieve Usage",
      method: "GET",
      path: "/api/v1/usage",
      description: "Get current credit usage.",
      details: "Retrieves the current usage statistics for your workspace.",
      params: [],
      responses: [
        {
          status: 200,
          description: "Usage data",
          schema: {
            data: {
              period_start: "2024-03-01",
              generations_used: 145,
            }
          }
        }
      ]
    },
  ],
};

// --- Helper Functions ---

const generateCurl = (endpoint: ApiEndpoint, params: Record<string, string>, apiKey: string, baseUrl: string, isTryMode: boolean) => {
  let url = `${baseUrl}${endpoint.path}`;
  
  // Handle path params like :id
  endpoint.params.forEach(p => {
      if(url.includes(`:${p.name}`)) {
          url = url.replace(`:${p.name}`, params[p.name] || (isTryMode ? "" : "gen_123"));
      }
  });

  const keyToUse = isTryMode && apiKey ? apiKey : "sk_live_...";
  
  const queryParams = endpoint.params
    .filter(p => !url.includes(p.name)) // exclude path params
    .filter((p) => isTryMode ? params[p.name] : true) 
    .filter((p) => isTryMode ? true : p.required) 
    .map((p) => `${p.name}=${encodeURIComponent(isTryMode ? params[p.name] || "" : p.default || "value")}`)
    .join("&");

  if (isTryMode && queryParams) url += `?${queryParams}`;

  let cmd = `curl ${endpoint.method === "POST" ? "-X POST " : ""}"${url}" \\
  -H "Authorization: Bearer ${keyToUse}"`;

  if (endpoint.bodyParams?.length) {
    const body: Record<string, any> = {};
    endpoint.bodyParams.forEach((p) => {
      if (isTryMode) {
        if (params[p.name]) body[p.name] = params[p.name];
        // Auto-fill hidden type param if valid
        if (p.name === "type" && p.options?.length === 1) body[p.name] = p.options[0];
      } else {
         body[p.name] = p.default || "value";
      }
    });

    if (Object.keys(body).length > 0) {
      cmd += ` \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2)}'`;
    }
  }

  return cmd;
};

const generateJs = (endpoint: ApiEndpoint, params: Record<string, string>, apiKey: string, baseUrl: string, isTryMode: boolean) => {
  let url = `${baseUrl}${endpoint.path}`;
  endpoint.params.forEach(p => {
      if(url.includes(`:${p.name}`)) {
           url = url.replace(`:${p.name}`, params[p.name] || (isTryMode ? "" : "gen_123"));
      }
  });

  const keyToUse = isTryMode && apiKey ? apiKey : "sk_live_...";

  const options: Record<string, any> = {
    method: endpoint.method,
    headers: {
      "Authorization": `Bearer ${keyToUse}`,
    },
  };

  if (endpoint.bodyParams?.length) {
      options.headers["Content-Type"] = "application/json";
      const body: Record<string, any> = {};
      endpoint.bodyParams.forEach((p) => {
        if (isTryMode) {
           if(params[p.name]) body[p.name] = params[p.name]; 
            if (p.name === "type" && p.options?.length === 1) body[p.name] = p.options[0];
        } else {
           body[p.name] = p.default || "value";
        }
      });
      options.body = body;
  }

  const bodyStr = options.body ? `\n  body: JSON.stringify(${JSON.stringify(options.body, null, 2).replace(/\n/g, "\n  ")})` : "";

  return `const response = await fetch("${url}", {
  method: "${options.method}",
  headers: {
    "Authorization": "Bearer ${keyToUse}",
    "Content-Type": "application/json"
  },${bodyStr}
});

const data = await response.json();
console.log(data);`;
};

const generatePython = (endpoint: ApiEndpoint, params: Record<string, string>, apiKey: string, baseUrl: string, isTryMode: boolean) => {
  let url = `${baseUrl}${endpoint.path}`;
  endpoint.params.forEach(p => {
      if(url.includes(`:${p.name}`)) {
           url = url.replace(`:${p.name}`, params[p.name] || (isTryMode ? "" : "gen_123"));
      }
  });

  const keyToUse = isTryMode && apiKey ? apiKey : "sk_live_...";
  
  let pythonCode = `import requests

url = "${url}"
headers = {
    "Authorization": "Bearer ${keyToUse}",
    "Content-Type": "application/json"
}\n`;

  if (endpoint.bodyParams?.length) {
      const body: Record<string, any> = {};
      endpoint.bodyParams.forEach((p) => {
          if(isTryMode) {
              if(params[p.name]) body[p.name] = params[p.name];
              if (p.name === "type" && p.options?.length === 1) body[p.name] = p.options[0];
          } else {
              body[p.name] = p.default || "value";
          }
      });
      pythonCode += `data = ${JSON.stringify(body, null, 4)}\n`;
  }

  pythonCode += `
response = requests.${endpoint.method.toLowerCase()}(
    url, 
    headers=headers,`;
  
  if (endpoint.bodyParams?.length) pythonCode += `\n    json=data`;

  pythonCode += `
)

print(response.json())`;

  return pythonCode;
};


// --- Main Page Component ---

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState("curl");
  const [viewMode, setViewMode] = useState<ViewMode>("read");
  const [apiKey, setApiKey] = useState("");
  const [selectedEndpointId, setSelectedEndpointId] = useState("list-generations");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  useEffect(() => {
    setBaseUrl(appUrl);
  }, []);

  const selectedEndpoint = Object.values(ENDPOINTS)
    .flat()
    .find((e) => e.id === selectedEndpointId) || ENDPOINTS["Generations"][0];

  const handleParamChange = (name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  };

  const executeRequest = async () => {
    setIsLoading(true);
    setResponse(null);

    let urlStr = `${baseUrl}${selectedEndpoint.path}`;
    
    // Handle path params
    selectedEndpoint.params.forEach(p => {
        if(urlStr.includes(`:${p.name}`)) {
            if(paramValues[p.name]) {
                urlStr = urlStr.replace(`:${p.name}`, paramValues[p.name]);
            } else {
                // If required param missing in path, should validation error, for now let it fail or use placeholder
                // But typically UI shouldn't allow send implies button disabled
            }
        }
    });

    const url = new URL(urlStr);
    
    selectedEndpoint.params.forEach(p => {
        if(!selectedEndpoint.path.includes(p.name) && paramValues[p.name]) {
            url.searchParams.append(p.name, paramValues[p.name]);
        }
    });

    const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        }
    };

    if (selectedEndpoint.bodyParams && Object.keys(paramValues).some(k => selectedEndpoint.bodyParams?.some(bp => bp.name === k)) || selectedEndpoint.bodyParams?.some(p => p.name === 'type' && p.options?.length === 1)) {
        const body: Record<string, any> = {};
        selectedEndpoint.bodyParams?.forEach(p => {
            if(paramValues[p.name]) body[p.name] = paramValues[p.name];
            // Force type for split endpoints
            if(p.name === 'type' && p.options?.length === 1) body[p.name] = p.options[0];
        })
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url.toString(), options);
        let data;
        try {
            data = await res.json();
        } catch {
            data = { error: "Failed to parse JSON response", status: res.status };
        }
        setResponse({ status: res.status, data });
    } catch (error) {
        setResponse({ error: "Network request failed", details: String(error) });
    } finally {
        setIsLoading(false);
    }
  };

  const getCodeSnippet = () => {
      const isTry = viewMode === "try";
      switch(activeTab) {
          case 'js':
              return generateJs(selectedEndpoint, paramValues, apiKey, baseUrl, isTry);
          case 'python':
              return generatePython(selectedEndpoint, paramValues, apiKey, baseUrl, isTry);
          default:
              return generateCurl(selectedEndpoint, paramValues, apiKey, baseUrl, isTry);
      }
  }

  return (
    <DocsLayout
      sidebar={
         <nav className="space-y-8">
          {Object.entries(ENDPOINTS).map(([category, endpoints]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-2">
                {category}
              </h3>
              <ul className="space-y-1">
                {endpoints.map((endpoint) => (
                  <li key={endpoint.id}>
                    <button
                      onClick={() => {
                          setSelectedEndpointId(endpoint.id);
                          // Dont clear if switching between similar? No clear is safer
                          setParamValues({}); 
                          setResponse(null);
                      }}
                      className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-all duration-200 border-l-2 ${
                        selectedEndpointId === endpoint.id
                          ? "bg-white/5 text-indigo-400 border-indigo-500 font-medium"
                          : "text-gray-400 hover:text-white hover:bg-white/5 border-transparent"
                      }`}
                    >
                      {endpoint.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      }
    >
      <div className="space-y-12 pb-24">
        
        {/* Header & Toggle */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-bold tracking-tight text-white">{selectedEndpoint.title}</h1>
                    <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tracking-wide ${
                        selectedEndpoint.method === "GET"
                        ? "bg-blue-500/20 text-blue-400"
                        : selectedEndpoint.method === "POST"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                    >
                    {selectedEndpoint.method}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 font-mono text-sm">
                    <span className="text-gray-600 select-none">Base URL</span>
                    <span className="bg-white/5 py-1 px-2 rounded">{baseUrl}{selectedEndpoint.path}</span>
                </div>
                <p className="text-lg text-gray-300 leading-relaxed">
                    {selectedEndpoint.details}
                </p>
            </div>

            {/* Mode Toggle */}
            <div className="bg-[#0d1117] p-1 rounded-lg border border-white/10 flex items-center shadow-lg">
                <button
                    onClick={() => setViewMode("read")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        viewMode === "read" 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-gray-400 hover:text-white"
                    }`}
                >
                    <BookOpen size={16} />
                    Read
                </button>
                <button
                    onClick={() => setViewMode("try")}
                     className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                        viewMode === "try" 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "text-gray-400 hover:text-white"
                    }`}
                >
                    <Terminal size={16} />
                    Try It
                </button>
            </div>
        </div>

        {/* --- READ MODE CONTENT --- */}
        {viewMode === "read" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                
                {/* Left: Params & Explanations */}
                <div className="space-y-12">
                     {/* Parameters Table */}
                    {(selectedEndpoint.params.length > 0 || selectedEndpoint.bodyParams?.length) && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-semibold text-white border-b border-white/10 pb-2">Parameters</h3>
                            
                            {/* Query Params */}
                            {selectedEndpoint.params.length > 0 && selectedEndpoint.params.map((param) => (
                                <div key={param.name} className="group border-b border-white/5 pb-4 last:border-0">
                                    <div className="flex items-baseline gap-3">
                                        <code className="text-indigo-400 font-bold text-sm bg-indigo-950/30 px-1.5 py-0.5 rounded">{param.name}</code>
                                        <span className="text-xs text-gray-500 font-mono">{param.type}</span>
                                        {param.required && <span className="text-xs text-red-400 font-medium">required</span>}
                                    </div>
                                    <p className="mt-2 text-sm text-gray-300 leading-relaxed">{param.description}</p>
                                    {param.default && (
                                        <div className="mt-1 text-xs text-gray-500">Default: <code className="text-gray-400 bg-white/5 px-1 rounded">{param.default}</code></div>
                                    )}
                                </div>
                            ))}

                             {/* Body Params */}
                             {selectedEndpoint.bodyParams && selectedEndpoint.bodyParams.length > 0 && (
                                 <div className="pt-4">
                                     <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Body Parameters</h4>
                                     {selectedEndpoint.bodyParams.map((param) => (
                                        <div key={param.name} className="group border-b border-white/5 pb-4 last:border-0 mb-4">
                                            <div className="flex items-baseline gap-3">
                                                <code className="text-indigo-400 font-bold text-sm bg-indigo-950/30 px-1.5 py-0.5 rounded">{param.name}</code>
                                                <span className="text-xs text-gray-500 font-mono">{param.type}</span>
                                                {param.required && <span className="text-xs text-red-400 font-medium">required</span>}
                                            </div>
                                            <p className="mt-2 text-sm text-gray-300 leading-relaxed">{param.description}</p>
                                            {param.options && param.options.length > 1 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {param.options.map(opt => (
                                                        <span key={opt} className="text-xs border border-white/10 px-1.5 py-0.5 rounded text-gray-400 bg-white/5">{opt}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                 </div>
                             )}
                        </div>
                    )}

                    {/* Returns */}
                    <div className="space-y-4">
                         <h3 className="text-xl font-semibold text-white border-b border-white/10 pb-2">Responses</h3>
                         {selectedEndpoint.responses.map((resp, idx) => (
                             <div key={idx} className="space-y-4">
                                 <div className="flex items-center gap-2">
                                     <span className="w-2 h-2 rounded-full bg-green-500" />
                                     <span className="font-mono text-green-400">{resp.status}</span>
                                     <span className="text-sm text-gray-400">{resp.description}</span>
                                 </div>
                                 <div className="bg-[#0d1117] rounded-lg border border-white/10 overflow-hidden">
                                     <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                         <span className="text-xs text-gray-500 font-mono">application/json</span>
                                     </div>
                                     <pre className="p-4 text-sm font-mono text-gray-300 overflow-x-auto">
                                         {JSON.stringify(resp.schema, null, 2)}
                                     </pre>
                                 </div>
                             </div>
                         ))}
                    </div>
                </div>

                {/* Right: Code Examples (Sticky) */}
                <div className="relative">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-[#0d1117] rounded-xl border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
                            <div className="flex items-center justify-between border-b border-white/5 bg-white/5 pr-2">
                                <div className="flex">
                                    {["curl", "js", "python"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${
                                        activeTab === tab
                                            ? "border-indigo-500 text-white bg-white/5"
                                            : "border-transparent text-gray-500 hover:text-gray-300"
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                    ))}
                                </div>
                            </div>
                             <CodeBlock 
                                code={getCodeSnippet()} 
                                language={activeTab} 
                                className="!border-0 !rounded-none !bg-transparent text-sm"
                            />
                        </div>
                        
                        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/10 rounded-xl p-6">
                            <h4 className="flex items-center gap-2 font-medium text-indigo-300 mb-2">
                                <AlertCircle size={16} />
                                Need help?
                            </h4>
                            <p className="text-sm text-indigo-200/60 leading-relaxed">
                                Join our <a href="#" className="underline decoration-indigo-500/50 hover:decoration-indigo-500">Discord developer community</a> for support and troubleshooting.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- TRY IT MODE CONTENT --- */}
        {viewMode === "try" && (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Form Section */}
                <div className="space-y-8">
                     {/* Auth Input */}
                     <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <Key size={16} className="text-indigo-400" />
                            <span>Authentication</span>
                        </div>
                        <input 
                            type="password" 
                            placeholder="Enter your API Key (sk_...)" 
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono placeholder:text-gray-600"
                        />
                        <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> Your key is never stored on our servers.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-white/10 pb-4">
                            <h3 className="text-lg font-medium text-white">Parameters</h3>
                            <button 
                                onClick={() => setParamValues({})}
                                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                                Clear all
                            </button>
                        </div>
                        
                        <div className="space-y-6">
                            {[...(selectedEndpoint.params || []), ...(selectedEndpoint.bodyParams || [])].map((param) => {
                                // Skip hidden type params in Try Mode if they are fixed
                                if(param.name === "type" && param.options?.length === 1) return null;
                                
                                return (
                                <div key={param.name} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                         <label className="text-sm font-medium text-gray-300 font-mono">
                                             {param.name}
                                         </label>
                                         <span className="text-[10px] text-gray-500 bg-white/5 py-0.5 px-1.5 rounded border border-white/5 uppercase tracking-wide">
                                             {param.type}
                                         </span>
                                    </div>
                                    
                                    {param.options && param.options.length > 1 ? (
                                        <select 
                                            value={paramValues[param.name] || ""}
                                            onChange={(e) => handleParamChange(param.name, e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:bg-black focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
                                        >
                                            <option value="">Select an option...</option>
                                            {param.options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            placeholder={param.default ? `e.g. ${param.default}` : ""}
                                            value={paramValues[param.name] || ""}
                                            onChange={(e) => handleParamChange(param.name, e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:bg-black focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none placeholder:text-gray-600"
                                        />
                                    )}
                                    <p className="text-xs text-gray-500">{param.description}</p>
                                </div>
                            )})}
                        </div>
                    </div>
                </div>

                {/* Playground Output */}
                 <div className="space-y-6 sticky top-24 h-fit">
                    <div className="bg-[#0d1117] rounded-xl border border-white/10 overflow-hidden shadow-2xl ring-1 ring-white/5">
                        <div className="flex border-b border-white/5">
                            {["curl", "js", "python"].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-3 text-xs font-mono uppercase tracking-wider transition-colors ${
                                activeTab === tab
                                    ? "bg-white/5 text-white border-b-2 border-indigo-500"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                }`}
                            >
                                {tab}
                            </button>
                            ))}
                        </div>
                        
                        <div className="max-h-[300px] overflow-y-auto">
                             <CodeBlock 
                                code={getCodeSnippet()} 
                                language={activeTab} 
                                className="!border-0 !rounded-none !bg-transparent text-sm"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white/5 border-t border-white/5 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${apiKey ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`} />
                                <span className="text-xs text-gray-400 font-medium">
                                    {apiKey ? "Ready" : "Auth Required"}
                                </span>
                            </div>
                            <button
                                onClick={executeRequest}
                                disabled={isLoading}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/20"
                            >
                                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                                Send Request
                            </button>
                        </div>
                    </div>

                     {/* Response Viewer */}
                    {response && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-backwards">
                            <div className="flex items-center justify-between px-1">
                                <h3 className="text-sm font-medium text-gray-400">Response</h3>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                                    response.status >= 200 && response.status < 300 
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                    {response.status || 'Error'}
                                </span>
                            </div>
                            <CodeBlock 
                                code={JSON.stringify(response.data || response, null, 2)}
                                language="json"
                                className="!bg-[#0d1117] !border-white/10 shadow-xl"
                            />
                        </div>
                    )}
                </div>
             </div>
        )}

      </div>
    </DocsLayout>
  );
}
