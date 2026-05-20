import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import "./chat-markdown.css";

function CodeBlock({ className, children }) {
  const raw = String(children || "").replace(/\n$/, "");
  const match = /language-([a-zA-Z0-9_-]+)/.exec(className || "");
  const language = match?.[1] || "";
  const isBlock = Boolean(language) || raw.includes("\n");
  const [copied, setCopied] = useState(false);

  if (!isBlock) {
    return <code className="chatInlineCode">{children}</code>;
  }

  const copyCode = async () => {
    await navigator.clipboard?.writeText(raw);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="chatCodeBlock">
      <div className="chatCodeHeader">
        <span>{language || "text"}</span>
        <button type="button" onClick={copyCode}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="chatCodePre">
        <code className={className}>{raw}</code>
      </pre>
    </div>
  );
}

export default function ChatMarkdownMessage({ content }) {
  return (
    <div className="chatMarkdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          code: CodeBlock,
          table: ({ children }) => (
            <div className="chatTableWrap">
              <table>{children}</table>
            </div>
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}
