"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Action {
  type: "update_prompt" | "update_settings";
  payload: any;
}

interface AIAssistantProps {
  context: {
    type: string;
    prompt: string;
    settings: Record<string, string>;
  };
  onApplyPrompt?: (prompt: string) => void;
  onUpdateSettings?: (key: string, value: string) => void;
}

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  content: "Hi! I can help you refine your prompt or suggest ideas. What's on your mind?",
};

const SUGGESTIONS = [
  "Enhance my prompt",
  "Fix grammar",
  "Make it cinematic",
  "Cyberpunk style",
  "Nature documentary style",
];

export default function AIAssistant({
  context,
  onApplyPrompt,
  onUpdateSettings,
}: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("streamsai_chat_history");
    const lastContext = localStorage.getItem("streamsai_last_context_type");
    
    let history: Message[] = [INITIAL_MESSAGE];
    
    if (saved) {
      try {
        history = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }

    // Check for context switch
    if (lastContext && lastContext !== context.type) {
      history.push({
        role: "system",
        content: `Context switched to ${context.type} generation.`,
      });
      localStorage.setItem("streamsai_last_context_type", context.type);
    } else if (!lastContext) {
      localStorage.setItem("streamsai_last_context_type", context.type);
    }

    setMessages(history);
    setIsLoaded(true);
  }, []); // Only runs once on mount

  // Save history on change, but only after initial load
  useEffect(() => {
    if (isLoaded) {
      // Ensure DOM has painted before scrolling.
      requestAnimationFrame(scrollToBottom);
      localStorage.setItem("streamsai_chat_history", JSON.stringify(messages));
    }
  }, [messages, isLoaded]);

  const handleClearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    localStorage.removeItem("streamsai_chat_history");
  };

  const handleSuggestionClick = (suggestion: string) => {
    submitMessage(suggestion);
  };

  const performAction = (action: Action) => {
    if (action.type === "update_prompt" && onApplyPrompt) {
      onApplyPrompt(action.payload);
    } else if (action.type === "update_settings" && onUpdateSettings) {
      onUpdateSettings(action.payload.key, action.payload.value);
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          context,
        }),
      });

      if (!response.ok) throw new Error("Failed to search");

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);

      if (data.action) {
        performAction(data.action);
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    submitMessage(input);
    setInput("");
  };

  return (
    <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden flex flex-col h-[500px]">
      <div className="px-5 py-4 border-b border-border-color flex items-center justify-between bg-bg-secondary">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-linear-to-br from-accent-indigo to-accent-purple flex items-center justify-center text-sm">
            🤖
          </div>
          <span className="font-medium text-sm">AI Assistant</span>
          <span className="px-2 py-0.5 rounded text-[10px] bg-accent-emerald/10 text-accent-emerald">
            Active
          </span>
        </div>
        <button
          type="button"
          onClick={handleClearChat}
          className="text-text-muted hover:text-white transition-colors p-1"
          title="Clear Chat"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${
              msg.role === "user" ? "justify-end" : msg.role === "system" ? "justify-center my-2" : "justify-start"
            }`}
          >
            {msg.role === "system" ? (
               <div className="text-[10px] uppercase tracking-wider text-text-muted bg-bg-tertiary/50 px-3 py-1 rounded-full border border-white/5">
                 {msg.content}
               </div>
            ) : (
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-accent-indigo text-white rounded-br-sm"
                  : "bg-bg-tertiary border border-border-color text-text-secondary rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
            )}
          </div>
        ))}
        {messages.length === 1 && !isLoading && (
          <div className="flex flex-wrap gap-2 mt-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 rounded-full border border-border-color bg-bg-tertiary text-xs text-text-secondary hover:border-accent-indigo hover:text-accent-indigo transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-bg-tertiary border border-border-color px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border-color bg-bg-secondary">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything or request a prompt..."
            className="w-full pl-4 pr-10 py-3 rounded-xl border border-border-color bg-bg-tertiary text-sm text-white focus:outline-none focus:border-accent-indigo placeholder-text-muted"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-accent-indigo hover:bg-accent-indigo/10 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
