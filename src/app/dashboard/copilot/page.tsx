"use client";

import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import PreviewPanel from './components/PreviewPanel';
import { Icons } from './components/Icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Conversation {
  id: string;
  title: string;
  date: string;
  preview: string;
  updatedAt: Date;
}

export default function CopilotPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'grid' | 'chat'>('grid');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const { data: conversations = [], isLoading: loading } = useQuery({
    queryKey: ['copilot-chats'],
    queryFn: async () => {
      const res = await fetch('/api/copilot/chats');
      if (!res.ok) throw new Error('Failed to fetch');
      const { data } = await res.json();
      return data.map((c: any) => ({
        ...c,
        updatedAt: new Date(c.updatedAt)
      }));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/copilot/chat/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: (data: void, variables: string) => {
        queryClient.invalidateQueries({ queryKey: ['copilot-chats'] });
        if (activeChatId === variables) {
             setActiveChatId(null);
             setViewMode('grid');
        }
    }
  });

  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLanguage, setPreviewLanguage] = useState('jsx');
  const [previewMode, setPreviewMode] = useState('preview');

  const handleCreateNewChat = () => {
    setActiveChatId(null); // Use null for new chat
    setViewMode('chat');
  };

  const handleOpenChat = (id: string) => {
    setActiveChatId(id);
    setViewMode('chat');
  };

  const handleBackToGrid = () => {
    setViewMode('grid');
    setActiveChatId(null);
    queryClient.invalidateQueries({ queryKey: ['copilot-chats'] });
  };

  const handleDeleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleOpenNewTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      window.open(`/dashboard/copilot/${id}`, '_blank');
  };

  const onChatCreated = (newId: string) => {
      setActiveChatId(newId);
      queryClient.invalidateQueries({ queryKey: ['copilot-chats'] });
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -m-6 lg:-m-8 overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 h-14 flex-shrink-0">
           <div className="flex items-center gap-2">
             {viewMode === 'chat' && (
                <button 
                  onClick={handleBackToGrid}
                  className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors mr-1"
                  title="Back to Chats"
                >
                  <div className="w-5 h-5 flex items-center justify-center rotate-180">
                     {Icons.arrowRight || "<-"} 
                  </div>
                </button>
             )}
             <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {Icons.sparkles}
               </div>
               <h1 className="text-sm font-semibold text-zinc-200">
                  {viewMode === 'grid' ? 'Copilot Chats' : 'Conversation'}
               </h1>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             {viewMode === 'chat' && (
               <button
                 onClick={() => setPreviewOpen(!previewOpen)}
                 className={`p-1.5 rounded-lg transition-colors ${previewOpen ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}
                 title="Toggle Preview"
               >
                 {Icons.panelRight}
               </button>
             )}
           </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="flex-1 overflow-y-auto p-8">
               <div className="max-w-7xl mx-auto">
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {/* New Chat Card */}
                    <button 
                      onClick={handleCreateNewChat}
                      className="group flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900/50 transition-all duration-200"
                    >
                       <div className="w-12 h-12 rounded-full bg-zinc-900 group-hover:bg-emerald-500/10 flex items-center justify-center mb-3 transition-colors">
                          <div className="text-zinc-400 group-hover:text-emerald-500 transition-colors">
                            {Icons.plus}
                          </div>
                       </div>
                       <span className="font-medium text-zinc-300 group-hover:text-emerald-400 transition-colors">New Chat</span>
                    </button>

                    {/* Existing Chat Cards */}
                    {conversations.map((chat: Conversation) => (
                      <div
                        key={chat.id}
                        role="button"
                        onClick={() => handleOpenChat(chat.id)}
                        className="group flex flex-col h-48 p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl hover:bg-zinc-900/80 hover:border-zinc-700 transition-all duration-200 text-left relative overflow-hidden cursor-pointer"
                      >
                         <div className="flex items-start justify-between mb-3 w-full">
                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-zinc-100 transition-colors">
                               {Icons.messageSquare || Icons.messageCircle}
                            </div>
                            <span className="text-xs text-zinc-500">{chat.date}</span>
                         </div>
                         
                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                            <button
                               onClick={(e) => handleOpenNewTab(e, chat.id)}
                               className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 rounded-lg transition-colors"
                               title="Open in New Tab"
                            >
                               {Icons.externalLink}
                            </button>
                            <button
                               onClick={(e) => handleDeleteChat(e, chat.id)}
                               className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                               title="Delete Chat"
                            >
                               {Icons.trash}
                            </button>
                         </div>
                         
                         <h3 className="font-medium text-zinc-200 mb-2 line-clamp-1 group-hover:text-emerald-400 transition-colors">{chat.title}</h3>
                         <p className="text-sm text-zinc-500 line-clamp-3 leading-relaxed">
                           {chat.preview}
                         </p>
                         
                         <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          )}

          {/* Chat View */}
          {viewMode === 'chat' && (
             <>
               <div className="flex-1 min-w-0">
                  <ChatInterface 
                    key={activeChatId || 'new'} 
                    chatId={activeChatId}
                    onChatCreated={onChatCreated}
                    previewOpen={previewOpen} 
                    setPreviewOpen={setPreviewOpen}
                    previewCode={previewCode}
                    setPreviewCode={setPreviewCode}
                    setPreviewLanguage={setPreviewLanguage}
                  />
               </div>

               {/* Preview Area (Only in Chat Mode) */}
               {previewOpen && (
                 <div className="w-[400px] xl:w-[450px] flex-shrink-0 border-l border-zinc-800 transition-all duration-300 hidden lg:block">
                    <PreviewPanel 
                      isVisible={previewOpen} 
                      code={previewCode} 
                      language={previewLanguage}
                      previewMode={previewMode}
                      setPreviewMode={setPreviewMode}
                      chatId={activeChatId}
                    />
                 </div>
               )}
               {/* Mobile/Tablet Preview Toggle Overlay could go here if needed */}
             </>
          )}

        </div>
      </div>
    </div>
  );
}
