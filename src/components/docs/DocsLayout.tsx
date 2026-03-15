import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface DocsLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}

export const DocsLayout: React.FC<DocsLayoutProps> = ({ children, sidebar }) => {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="flex h-16 items-center px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mr-8"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <div className="font-semibold text-lg tracking-tight">API Documentation</div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-white/10 overflow-y-auto hidden md:block">
          <div className="p-4">
            {sidebar}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
