"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ChatInterface from '../components/ChatInterface';
import PreviewPanel from '../components/PreviewPanel';
import { Icons } from '../components/Icons';

export default function CopilotChatPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params?.id as string;

  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLanguage, setPreviewLanguage] = useState('jsx');
  const [previewMode, setPreviewMode] = useState('preview');

  const handleBack = () => {
    router.push('/dashboard/copilot');
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -m-6 lg:-m-8 overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 h-14 flex-shrink-0">
           <div className="flex items-center gap-2">
              <button 
                onClick={handleBack}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors mr-1"
                title="Back to Chats"
              >
                <div className="w-5 h-5 flex items-center justify-center rotate-180">
                   {Icons.arrowRight || "<-"} 
                </div>
              </button>
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {Icons.sparkles}
               </div>
               <h1 className="text-sm font-semibold text-zinc-200">
                  Conversation
               </h1>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <button
               onClick={() => setPreviewOpen(!previewOpen)}
               className={`p-1.5 rounded-lg transition-colors ${previewOpen ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
               title="Toggle Preview"
             >
               {Icons.panelRight}
             </button>
           </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
           
           {/* Chat View */}
           <div className="flex-1 min-w-0">
              <ChatInterface 
                key={chatId} 
                chatId={chatId}
                previewOpen={previewOpen} 
                setPreviewOpen={setPreviewOpen}
                previewCode={previewCode}
                setPreviewCode={setPreviewCode}
                setPreviewLanguage={setPreviewLanguage}
              />
           </div>

                {/* Preview Area */}
           {previewOpen && (
             <div className="w-[350px] xl:w-[400px] flex-shrink-0 border-l border-zinc-800 transition-all duration-300 hidden lg:block">
                <PreviewPanel 
                  isVisible={previewOpen} 
                  code={previewCode} 
                  language={previewLanguage}
                  previewMode={previewMode}
                  setPreviewMode={setPreviewMode}
                  chatId={chatId}
                />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
