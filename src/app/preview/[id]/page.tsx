"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { extractCodeFromContent } from '../../dashboard/copilot/utils';
import PreviewPanel from '../../dashboard/copilot/components/PreviewPanel';

export default function PreviewPage() {
    const params = useParams();
    const chatId = params?.id as string;
    
    // State required for PreviewPanel
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('jsx');
    const [previewMode, setPreviewMode] = useState('preview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (chatId) {
            setLoading(true);
            fetch(`/api/copilot/chat/${chatId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.data) {
                         // Prioritize finding the latest HTML content from landing_pages
                         if (data.data.landingPage?.html_content) {
                            setCode(data.data.landingPage.html_content);
                            setLanguage('html');
                       } else if (data.data.messages) {
                           // Check last message for code
                           const lastMsg = data.data.messages[data.data.messages.length - 1];
                           if (lastMsg?.role === 'assistant') {
                               const extracted = extractCodeFromContent(lastMsg.content);
                               if (extracted) {
                                   setCode(extracted.code);
                                   setLanguage(extracted.language);
                               } else {
                                   setError('No code found in the latest message.');
                               }
                           } else {
                               setError('No assistant messages found.');
                           }
                       } else {
                            setError('No chat data found.');
                       }
                    }
                })
                .catch(err => {
                    console.error(err);
                    setError('Failed to load chat.');
                })
                .finally(() => setLoading(false));
        }
    }, [chatId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p>Loading preview...</p>
                </div>
            </div>
        );
    }

    if (error && !code) {
        // If error but we have code (e.g. from cache or partial load), we might still want to show it.
        // But here if !code, show error.
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
                <div className="text-center">
                    <p className="text-red-400 mb-2">Unable to load preview</p>
                    <p className="text-sm text-zinc-500">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen overflow-hidden bg-zinc-950">
             <PreviewPanel 
                isVisible={true}
                code={code}
                language={language}
                previewMode={previewMode}
                setPreviewMode={setPreviewMode}
                chatId={chatId}
             />
        </div>
    );
}
