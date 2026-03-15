"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// --- Types & Interfaces ---
interface ChannelConfig {
  email: boolean;
  sms: boolean;
  mms: boolean;
}

interface Lead {
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
}

export default function CampaignBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const campaignId = params?.id as string | undefined;

  // --- State ---
  const [panels, setPanels] = useState({ leads: true, config: true });
  const [channels, setChannels] = useState<ChannelConfig>({ email: true, sms: false, mms: false });
  const [activePreview, setActivePreview] = useState<"email" | "sms" | "mms">("email");
  
  // Content State
  const [campaignName, setCampaignName] = useState("Email/SMS/MMS Campaign");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [mmsMessage, setMmsMessage] = useState("");
  const [mmsMediaUrl, setMmsMediaUrl] = useState("");

  // Leads State
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [selectedTestLead, setSelectedTestLead] = useState<Lead | null>(null);

  // Scheduling State
  const [scheduledAt, setScheduledAt] = useState<string>("");

  // Preview State
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);

  // Modals State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // AI Generation State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTargetField, setAiTargetField] = useState<'emailSubject' | 'emailBody' | 'sms' | 'mms' | null>(null);
  const [aiCustomPrompt, setAiCustomPrompt] = useState("");
  const [aiSelectedTemplate, setAiSelectedTemplate] = useState<string>("");

  // Load existing campaign if editing
  useEffect(() => {
    if (campaignId && campaignId !== 'new') {
      loadCampaign(campaignId);
    }
  }, [campaignId]);

  // Update preview lead when leads change or preview lead selected
  useEffect(() => {
      if (leads.length > 0 && !previewLead) {
          setPreviewLead(leads[0]);
      }
  }, [leads, previewLead]);

  const loadCampaign = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setCampaignName(data.name || 'Email/SMS/MMS Campaign');
        setChannels(data.channels || { email: true, sms: false, mms: false });
        setEmailSubject(data.email_subject || '');
        setEmailBody(data.email_body || '');
        setSmsMessage(data.sms_message || '');
        setMmsMessage(data.mms_message || '');
        setMmsMediaUrl(data.mms_media_url || '');
        if (data.scheduled_at) {
            setScheduledAt(new Date(data.scheduled_at).toISOString().slice(0, 16));
        }
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
      alert('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const saveCampaign = async (status: 'draft' | 'scheduled' | 'sent' = 'draft') => {
    setSaving(true);
    try {
      console.log('Starting campaign save...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current workspace from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('current_workspace_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profile?.current_workspace_id) {
        throw new Error('No workspace selected');
      }

      const campaignData = {
        name: campaignName,
        status,
        channels,
        email_subject: emailSubject,
        email_body: emailBody,
        sms_message: smsMessage,
        mms_message: mmsMessage,
        mms_media_url: mmsMediaUrl,
        user_id: user.id,
        workspace_id: profile.current_workspace_id,
        scheduled_at: status === 'scheduled' ? new Date(scheduledAt).toISOString() : null
      };

      if (campaignId && campaignId !== 'new') {
        // Update existing campaign
        const { error } = await supabase
          .from('campaigns')
          .update(campaignData)
          .eq('id', campaignId);
        
        if (error) throw error;
        alert(status === 'scheduled' ? 'Campaign scheduled successfully!' : 'Campaign updated successfully!');
      } else {
        // Create new campaign
        const { error } = await supabase
          .from('campaigns')
          .insert([campaignData]);
        
        if (error) throw error;
        alert(status === 'scheduled' ? 'Campaign scheduled successfully!' : 'Campaign saved successfully!');
        router.push('/dashboard/campaigns');
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      alert(`Failed to save campaign: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
      closeModal();
    }
  };

  // Helper functions for leads management
  const parseCSV = (text: string) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const phoneIdx = headers.findIndex(h => h.includes('phone'));
    const nameIdx = headers.findIndex(h => h.includes('name'));
    const companyIdx = headers.findIndex(h => h.includes('company'));
    
    const parsedLeads = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length > 0 && values[0]) {
        parsedLeads.push({
          email: emailIdx >= 0 ? values[emailIdx] : undefined,
          phone: phoneIdx >= 0 ? values[phoneIdx] : undefined,
          name: nameIdx >= 0 ? values[nameIdx] : undefined,
          company: companyIdx >= 0 ? values[companyIdx] : undefined,
        });
      }
    }
    return parsedLeads;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsedLeads = parseCSV(text);
      setLeads(prev => [...prev, ...parsedLeads]);
      alert(`Successfully imported ${parsedLeads.length} leads!`);
    };
    reader.readAsText(file);
  };

  const handlePasteLeads = () => {
    const parsedLeads = parseCSV(pasteText);
    if (parsedLeads.length > 0) {
      setLeads(prev => [...prev, ...parsedLeads]);
      setPasteText("");
      closeModal();
      alert(`Successfully added ${parsedLeads.length} leads!`);
    } else {
      alert('No valid leads found. Please check the format.');
    }
  };

  const downloadSampleCSV = () => {
    const csv = 'email,phone,name,company\njohn@example.com,+1234567890,John Doe,Acme Corp\njane@example.com,+0987654321,Jane Smith,Tech Inc';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leads_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      alert('Please enter an email address');
      return;
    }
    
    try {
      const response = await fetch('/api/campaigns/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testEmail,
          subject: emailSubject || 'Test Email',
          body: emailBody || 'This is a test email.',
          lead: selectedTestLead // Send selected lead data for substitution
        }),
      });
      
      if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to send test email');
      }

      alert('Test email sent successfully!');
      // reset test email state but keep modal open if they want to send another or close it?
      // let's close it for better UX flow
      closeModal(); 
    } catch (error) {
      console.error('Test email error:', error);
      alert(`Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // AI Generation Templates
  const aiTemplates = [
    {
      id: 'product_launch',
      name: 'Product Launch',
      description: 'Announce a new product or feature',
      prompt: 'Write a compelling {type} for a product launch campaign. The message should be exciting, professional, and highlight the key benefits of the new product.'
    },
    {
      id: 'promotion',
      name: 'Promotional Campaign',
      description: 'Promote a sale or special offer',
      prompt: 'Create an engaging {type} for a promotional campaign. Include urgency and highlight the special offer or discount.'
    },
    {
      id: 'newsletter',
      name: 'Newsletter',
      description: 'Regular newsletter update',
      prompt: 'Write a friendly {type} for a newsletter campaign. Keep it informative and engaging with a conversational tone.'
    },
    {
      id: 'event',
      name: 'Event Invitation',
      description: 'Invite to an event or webinar',
      prompt: 'Create an inviting {type} for an event campaign. Make it engaging and include a clear call-to-action to register or attend.'
    },
    {
      id: 'follow_up',
      name: 'Follow-up',
      description: 'Follow up with leads or customers',
      prompt: 'Write a warm {type} for a follow-up campaign. Be friendly, helpful, and encourage engagement.'
    }
  ];

  const openAiGenerateModal = (field: 'emailSubject' | 'emailBody' | 'sms' | 'mms') => {
    setAiTargetField(field);
    setAiSelectedTemplate(aiTemplates[0].id);
    setAiCustomPrompt("");
    openModal('ai-generate');
  };

  const generateWithAI = async () => {
    if (!aiTargetField) return;
    
    setAiGenerating(true);
    try {
      // Determine the type of content we're generating
      let contentType = '';
      switch (aiTargetField) {
        case 'emailSubject':
          contentType = 'email subject line';
          break;
        case 'emailBody':
          contentType = 'email body';
          break;
        case 'sms':
          contentType = 'SMS message (max 160 characters)';
          break;
        case 'mms':
          contentType = 'MMS message (max 160 characters)';
          break;
      }

      // Get the prompt from template or custom
      const selectedTemplateData = aiTemplates.find(t => t.id === aiSelectedTemplate);
      const basePrompt = aiCustomPrompt || (selectedTemplateData?.prompt.replace('{type}', contentType) || '');
      
      const finalPrompt = `${basePrompt}\n\nPlease generate only the content without any additional explanation or formatting.`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          maxTokens: aiTargetField === 'emailBody' ? 500 : 100
        }),
      });

      if (!response.ok) throw new Error('Failed to generate content');
      
      const data = await response.json();
      const generatedContent = data.content?.trim() || '';

      // Set the generated content to the appropriate field
      switch (aiTargetField) {
        case 'emailSubject':
          setEmailSubject(generatedContent);
          break;
        case 'emailBody':
          setEmailBody(generatedContent);
          break;
        case 'sms':
          setSmsMessage(generatedContent.substring(0, 160));
          break;
        case 'mms':
          setMmsMessage(generatedContent.substring(0, 160));
          break;
      }

      closeModal();
      alert('Content generated successfully!');
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setAiGenerating(false);
    }
  };

  // Variable substitution helper for preview
  const substituteVariables = (text: string, lead: Lead | null) => {
    if (!lead || !text) return text;
    
    let processedText = text;
    const variables = {
        name: lead.name || 'John Doe',
        email: lead.email || 'john@example.com',
        phone: lead.phone || '+1234567890',
        company: lead.company || 'Acme Corp',
    };

    Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\[${key}\\]`, "gi");
        const regexMustache = new RegExp(`{{${key}}}`, "gi");
        processedText = processedText.replace(regex, value).replace(regexMustache, value);
    });

    return processedText;
  };


  // --- Actions ---
  const togglePanel = (panel: "leads" | "config") => {
    setPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };

  const toggleChannel = (channel: keyof ChannelConfig) => {
    setChannels((prev) => {
        const next = { ...prev, [channel]: !prev[channel] };
        return next;
    });
  };

  const openModal = (id: string) => setActiveModal(id);
  const closeModal = () => {
    setActiveModal(null);
  };
  
  const handleScheduleClick = () => {
    if (!scheduledAt) {
        // Set default time to tomorrow 9am if not set
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        // Format to YYYY-MM-DDTHH:mm for datetime-local input
        const isoString = tomorrow.toISOString().slice(0, 16); // Remove seconds/ms
        setScheduledAt(isoString);
    }
    openModal('schedule');
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-theme(spacing.16))] -m-6 lg:-m-8 items-center justify-center">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // --- Render Helpers ---

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -m-6 lg:-m-8">
      {/* Styles Injection for specific custom colors not in standard config */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
        .phone-mockup { box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4); }
      `}</style>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
            <div className="flex-1 max-w-md">
                 <input
                   type="text"
                   value={campaignName}
                   onChange={(e) => setCampaignName(e.target.value)}
                   className="text-2xl font-bold bg-transparent border-b border-transparent hover:border-gray-600 focus:border-indigo-500 outline-none transition-colors w-full"
                   placeholder="Campaign Name"
                 />
                <p className="text-sm text-text-muted mt-1">Send personalized campaigns with lead management</p>
            </div>
            <div className="flex gap-3">
                 <button 
                    onClick={() => openModal('test-email')}
                    className="px-4 py-2 rounded-xl border border-border-color text-sm font-medium text-text-secondary hover:text-white hover:bg-bg-tertiary transition-colors"
                 >
                    🧪 Test Email
                 </button>
                 <button 
                   onClick={() => router.push('/dashboard/campaigns')}
                   className="px-4 py-2 rounded-xl border border-border-color text-sm font-medium text-text-secondary hover:text-white hover:bg-bg-tertiary transition-colors"
                 >
                    Cancel
                 </button>
                 <button 
                   onClick={() => saveCampaign('draft')}
                   disabled={saving}
                   className="px-4 py-2 rounded-xl border border-border-color text-sm font-medium text-text-secondary hover:text-white hover:bg-bg-tertiary transition-colors disabled:opacity-50"
                 >
                    {saving ? 'Saving...' : 'Save Draft'}
                 </button>
                 <button 
                  onClick={handleScheduleClick}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple text-white text-sm font-bold shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                 >
                    {saving ? 'Saving...' : 'Schedule Campaign'}
                 </button>
            </div>
        </div>

        {/* Leads Panel */}
        <div className={`bg-bg-secondary border border-border-color rounded-2xl overflow-hidden transition-all duration-300 ${!panels.leads ? 'h-[86px]' : ''}`}>
          <div 
            className="p-5 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
            onClick={() => togglePanel('leads')}
          >
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-accent-indigo/15 flex items-center justify-center text-xl">
                👥
              </div>
              <div>
                <h3 className="font-semibold text-base">Leads & Data Sources</h3>
                <p className="text-xs text-text-muted">Import • API • Integrations</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className={`w-8 h-8 flex items-center justify-center text-text-secondary transition-transform duration-300 ${!panels.leads ? 'rotate-[-90deg]' : ''}`}>
                ▼
              </button>
            </div>
          </div>
          
          
          <div className="p-5 pt-0 border-t border-transparent">
             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                      <span>📤</span> Import Leads
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{leads.length} leads</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); downloadSampleCSV(); }}
                      className="text-xs text-accent-teal hover:text-accent-teal/80 underline"
                    >
                      Download Sample CSV
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-border-color bg-bg-tertiary text-text-secondary hover:border-accent-teal hover:text-accent-teal hover:bg-accent-teal/10 transition-all group cursor-pointer">
                         <input 
                           type="file" 
                           accept=".csv" 
                           className="hidden" 
                           onChange={handleFileUpload}
                           onClick={(e) => e.stopPropagation()}
                         />
                         <span className="text-2xl group-hover:scale-110 transition-transform">📄</span> 
                         <span className="font-medium text-sm">Upload CSV</span>
                    </label>
                    <button 
                        className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-dashed border-border-color bg-bg-tertiary text-text-secondary hover:border-accent-teal hover:text-accent-teal hover:bg-accent-teal/10 transition-all group"
                        onClick={(e) => { e.stopPropagation(); openModal('paste'); }}
                    >
                         <span className="text-2xl group-hover:scale-110 transition-transform">📋</span> 
                         <span className="font-medium text-sm">Paste Leads</span>
                    </button>
                </div>
                
                {leads.length > 0 && (
                  <div className="bg-bg-tertiary rounded-xl p-4 max-h-48 overflow-y-auto">
                    <div className="text-xs font-semibold text-text-muted mb-2">Imported Leads</div>
                    <div className="space-y-2">
                      {leads.slice(0, 5).map((lead, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs text-text-secondary group hover:bg-bg-secondary rounded-lg px-2 py-1.5 transition-colors">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span>👤</span>
                            <span className="truncate">{lead.name || 'N/A'}</span>
                            <span className="text-text-muted">•</span>
                            <span className="truncate">{lead.email || lead.phone || 'N/A'}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLeads(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-text-muted hover:text-red-400 transition-all"
                            title="Remove lead"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {leads.length > 5 && (
                        <div className="text-xs text-text-muted">
                          +{leads.length - 5} more leads
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Config Panel */}
        <div className={`bg-bg-secondary border border-border-color rounded-2xl overflow-hidden transition-all duration-300 ${!panels.config ? 'h-[86px]' : ''}`}>
             <div 
                className="p-5 flex items-center justify-between cursor-pointer hover:bg-bg-tertiary/50 transition-colors"
                onClick={() => togglePanel('config')}
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-accent-teal/15 flex items-center justify-center text-xl">
                    📧
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Campaign Config</h3>
                    <p className="text-xs text-text-muted">Email • SMS • MMS</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex gap-4 text-center">
                    <div>
                        <div className="text-sm font-semibold text-accent-teal">3</div>
                        <div className="text-[10px] uppercase text-text-muted">Channels</div>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-accent-teal">$0.18</div>
                        <div className="text-[10px] uppercase text-text-muted">Est. Cost</div>
                    </div>
                  </div>
                  <button className={`w-8 h-8 flex items-center justify-center text-text-secondary transition-transform duration-300 ${!panels.config ? 'rotate-[-90deg]' : ''}`}>
                    ▼
                  </button>
                </div>
              </div>

              <div className="p-5 pt-0">
                  {/* Channel Toggles */}
                  <div className="flex gap-3 mb-6">
                    {(['email', 'sms', 'mms'] as const).map(channel => (
                        <button 
                            key={channel}
                            onClick={(e) => { e.stopPropagation(); toggleChannel(channel); }}
                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                                channels[channel] 
                                    ? 'border-accent-teal bg-accent-teal/15 text-text-primary' 
                                    : 'border-border-color bg-bg-tertiary text-text-secondary'
                            }`}
                        >
                            <span>{channel === 'email' ? '📧' : channel === 'sms' ? '💬' : '🖼️'}</span>
                            <span className="capitalize">{channel}</span>
                        </button>
                    ))}
                  </div>

                  {/* Email Config */}
                  {channels.email && (
                    <div className="bg-bg-tertiary rounded-xl p-5 mb-4 animate-fadeIn">
                        <div className="flex justify-between items-center mb-4 border-b border-border-color pb-3">
                             <div className="flex items-center gap-2 font-semibold text-sm">
                                <span>📧</span> Email Configuration
                             </div>
                             <div className="flex items-center gap-1 text-xs text-accent-emerald">
                                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse"></span> Active
                             </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-medium text-text-secondary">Subject Line</label>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); openAiGenerateModal('emailSubject'); }}
                                      className="flex items-center gap-1 px-2 py-1 rounded bg-accent-purple/15 text-accent-purple text-[10px] font-bold hover:bg-accent-purple/25 transition-colors"
                                    >
                                        ✨ AI Generate
                                    </button>
                                </div>
                                <input 
                                    type="text" 
                                    className="w-full bg-bg-secondary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none transition-colors"
                                    placeholder="Enter subject line..."
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-medium text-text-secondary">Email Body</label>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); openAiGenerateModal('emailBody'); }}
                                      className="flex items-center gap-1 px-2 py-1 rounded bg-accent-purple/15 text-accent-purple text-[10px] font-bold hover:bg-accent-purple/25 transition-colors"
                                    >
                                        ✨ AI Generate
                                    </button>
                                </div>
                                <textarea 
                                    className="w-full min-h-[120px] bg-bg-secondary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none transition-colors resize-y"
                                    placeholder="Write your email content here. Use {{name}}, {{company}} for personalization."
                                    value={emailBody}
                                    onChange={e => setEmailBody(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                  )}

                  {/* SMS Config */}
                  {channels.sms && (
                       <div className="bg-bg-tertiary rounded-xl p-5 mb-4 animate-fadeIn">
                        <div className="flex justify-between items-center mb-4 border-b border-border-color pb-3">
                             <div className="flex items-center gap-2 font-semibold text-sm">
                                <span>💬</span> SMS Configuration
                             </div>
                             <div className="flex items-center gap-1 text-xs text-accent-emerald">
                                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse"></span> Active
                             </div>
                        </div>
                        <div>
                             <div className="flex justify-between mb-2">
                                <label className="text-xs font-medium text-text-secondary">Message</label>
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); openAiGenerateModal('sms'); }}
                                    className="flex items-center gap-1 px-2 py-1 rounded bg-accent-purple/15 text-accent-purple text-[10px] font-bold hover:bg-accent-purple/25 transition-colors"
                                  >
                                    ✨ AI Generate
                                  </button>
                                  <span className="text-xs text-text-muted">{smsMessage.length}/160</span>
                                </div>
                            </div>
                            <textarea 
                                className="w-full min-h-[80px] bg-bg-secondary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none transition-colors resize-y"
                                placeholder="Enter your SMS message..."
                                maxLength={160}
                                value={smsMessage}
                                onChange={e => setSmsMessage(e.target.value)}
                            />
                        </div>
                       </div>
                  )}

                  {/* MMS Config */}
                  {channels.mms && (
                       <div className="bg-bg-tertiary rounded-xl p-5 mb-4 animate-fadeIn">
                        <div className="flex justify-between items-center mb-4 border-b border-border-color pb-3">
                             <div className="flex items-center gap-2 font-semibold text-sm">
                                <span>🖼️</span> MMS Configuration
                             </div>
                             <div className="flex items-center gap-1 text-xs text-accent-emerald">
                                <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse"></span> Active
                             </div>
                        </div>
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-medium text-text-secondary">Message</label>
                                    <div className="flex items-center gap-3">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); openAiGenerateModal('mms'); }}
                                        className="flex items-center gap-1 px-2 py-1 rounded bg-accent-purple/15 text-accent-purple text-[10px] font-bold hover:bg-accent-purple/25 transition-colors"
                                      >
                                        ✨ AI Generate
                                      </button>
                                      <span className="text-xs text-text-muted">{mmsMessage.length}/160</span>
                                    </div>
                                </div>
                                <textarea 
                                    className="w-full min-h-[80px] bg-bg-secondary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none transition-colors resize-y"
                                    placeholder="Enter your MMS message..."
                                    maxLength={160}
                                    value={mmsMessage}
                                    onChange={e => setMmsMessage(e.target.value)}
                                />
                            </div>
                             <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-medium text-text-secondary">Media</label>
                                </div>
                                <div className="flex gap-3">
                                    <button className="flex-1 px-4 py-3 rounded-xl border border-border-color bg-bg-secondary text-text-secondary text-xs hover:text-white hover:border-accent-indigo transition-all">
                                        🖼️ Select Image
                                    </button>
                                    <input 
                                        type="text"
                                        value={mmsMediaUrl}
                                        onChange={(e) => setMmsMediaUrl(e.target.value)}
                                        className="flex-[2] bg-bg-secondary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none transition-colors"
                                        placeholder="Or paste image URL"
                                    />
                                </div>
                             </div>
                         </div>
                       </div>
                  )}
              </div>
        </div>
      </div>

      {/* Preview Panel (Right Side) */}
      <div className="w-[380px] hidden xl:flex flex-col border-l border-border-color bg-bg-secondary">
         <div className="p-6 border-b border-border-color">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-base font-semibold">Live Preview</h3>
                 {leads.length > 0 && (
                     <select 
                        className="bg-bg-tertiary border border-border-color rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-accent-indigo max-w-[150px] truncate"
                        value={leads.indexOf(previewLead!) || 0}
                        onChange={(e) => setPreviewLead(leads[parseInt(e.target.value)])}
                     >
                         {leads.map((lead, idx) => (
                             <option key={idx} value={idx}>
                                {lead.name || lead.email || `Lead #${idx+1}`}
                             </option>
                         ))}
                     </select>
                 )}
             </div>
             
             <div className="flex gap-2">
                {(['email', 'sms', 'mms'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => setActivePreview(type)}
                        className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                            activePreview === type
                                ? 'border-accent-teal bg-accent-teal/15 text-accent-teal'
                                : 'border-border-color bg-transparent text-text-secondary hover:text-white'
                        }`}
                    >
                        {type.toUpperCase()}
                    </button>
                ))}
            </div>
         </div>

         <div className="flex-1 p-6 flex flex-col items-center justify-center bg-[#0a0a0f] relative overflow-hidden">
             {/* Background decorative elements */}
             <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.05),transparent_50%)]"></div>

             {activePreview === 'email' ? (
                 <div className="w-full max-w-[320px] bg-white rounded-xl overflow-hidden shadow-2xl relative z-10 text-gray-800">
                     <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">S</div>
                         <div>
                             <div className="text-sm font-bold text-gray-900">StreamsAI</div>
                             <div className="text-[10px] text-gray-500">Just now</div>
                         </div>
                     </div>
                     <div className="p-5 min-h-[300px]">
                         <h4 className="font-bold text-gray-900 mb-2 text-sm">
                             {substituteVariables(emailSubject, previewLead) || "Your subject line here"}
                         </h4>
                         <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                             {substituteVariables(emailBody, previewLead) || "Your email body will appear here as you type. Use personalization variables like {{name}} and {{company}} to customize your message."}
                         </p>
                     </div>
                     <div className="bg-gray-50 border-t border-gray-100 p-3 flex gap-2">
                          <button className="px-3 py-1.5 rounded border border-gray-300 text-[10px] font-medium text-gray-600 bg-white">Reply</button>
                          <button className="px-3 py-1.5 rounded border border-gray-300 text-[10px] font-medium text-gray-600 bg-white">Forward</button>
                     </div>
                 </div>
             ) : (
                 <div className="phone-mockup w-[280px] bg-[#1a1a2e] rounded-[36px] p-3 shadow-2xl relative z-10">
                     <div className="bg-[#0d0d15] rounded-[28px] overflow-hidden h-[500px] flex flex-col relative">
                         {/* Status Bar */}
                        <div className="flex justify-between px-5 py-3 text-[10px] text-white opacity-80">
                            <span>Carrier</span>
                            <span>9:41</span>
                            <span>100%</span>
                        </div>
                        {/* Header */}
                        <div className="flex items-center gap-3 p-4 border-b border-white/10">
                            <span className="text-blue-400 text-lg">‹</span>
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs">👤</div>
                            <span className="text-xs font-semibold">{previewLead?.name || 'Unknown'}</span>
                        </div>
                        {/* Messages */}
                        <div className="flex-1 p-4 space-y-3">
                             <div className="max-w-[85%] bg-accent-emerald rounded-2xl rounded-tr-sm p-3 text-white text-xs leading-relaxed">
                                 {activePreview === 'sms' 
                                    ? (substituteVariables(smsMessage, previewLead) || "Your SMS message will appear here...") 
                                    : (
                                        <>
                                            <div className="w-full h-32 bg-white/20 rounded-lg flex items-center justify-center mb-2 text-2xl">📷</div>
                                            {substituteVariables(mmsMessage, previewLead) || "Your MMS message..."}
                                        </>
                                    )
                                 }
                             </div>
                        </div>
                         {/* Input Area */}
                        <div className="p-3 bg-[#1a1a26]">
                            <div className="w-full h-8 rounded-full bg-[#0d0d15] border border-white/10"></div>
                        </div>
                     </div>
                 </div>
             )}
         </div>
      </div>

       {/* Modals */}
       {activeModal === 'paste' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-secondary border border-border-color p-6 rounded-2xl w-full max-w-lg shadow-2xl transform transition-all scale-100">
            <h3 className="text-lg font-bold mb-4">Paste Leads (CSV)</h3>
            <textarea
              className="w-full h-40 bg-bg-tertiary border border-border-color rounded-xl p-4 text-sm focus:border-accent-indigo focus:outline-none mb-4 font-mono"
              placeholder="email, name, company&#10;john@example.com, John Doe, Acme Inc"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePasteLeads}
                className="px-4 py-2 rounded-xl bg-accent-indigo text-white font-medium hover:bg-accent-indigo/90 transition-colors"
              >
                Import Leads
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'ai-generate' && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-bg-secondary border border-border-color p-6 rounded-2xl w-full max-w-lg shadow-2xl">
                <h3 className="text-lg font-bold mb-4">✨ AI Content Generator</h3>
                
                <div className="mb-4">
                    <label className="text-sm font-medium text-text-secondary mb-2 block">Choose a Template</label>
                    <div className="grid grid-cols-2 gap-2">
                        {aiTemplates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => setAiSelectedTemplate(template.id)}
                                className={`p-3 rounded-xl border text-left transition-all ${
                                    aiSelectedTemplate === template.id
                                    ? 'border-accent-purple bg-accent-purple/10 text-white'
                                    : 'border-border-color bg-bg-tertiary text-text-secondary hover:border-gray-600'
                                }`}
                            >
                                <div className="font-semibold text-xs mb-1">{template.name}</div>
                                <div className="text-[10px] text-text-muted line-clamp-2">{template.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="text-sm font-medium text-text-secondary mb-2 block">Custom Instructions (Optional)</label>
                    <textarea 
                        className="w-full h-24 bg-bg-tertiary border border-border-color rounded-xl p-3 text-sm focus:border-accent-purple focus:outline-none placeholder:text-text-muted"
                        placeholder="E.g. Make it funny, focus on enterprise benefits, etc."
                        value={aiCustomPrompt}
                        onChange={(e) => setAiCustomPrompt(e.target.value)}
                    />
                </div>

                <div className="flex justify-end gap-3">
                    <button 
                        onClick={closeModal}
                        className="px-4 py-2 rounded-xl text-text-secondary hover:bg-bg-tertiary transition-colors"
                        disabled={aiGenerating}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={generateWithAI}
                        disabled={aiGenerating}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-purple to-pink-600 text-white font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                        {aiGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Generating...
                            </>
                        ) : (
                            <>✨ Generate</>
                        )}
                    </button>
                </div>
            </div>
         </div>
      )}

      {/* Test Email Modal */}
      {activeModal === 'test-email' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-secondary border border-border-color p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Send Test Email</h3>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">To Email Address</label>
                    <input
                      type="email"
                      className="w-full bg-bg-tertiary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none"
                      placeholder="your@email.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Simulate as Lead (Optional)</label>
                    <select 
                        className="w-full bg-bg-tertiary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none appearance-none"
                        onChange={(e) => {
                            const lead = leads[parseInt(e.target.value)];
                            setSelectedTestLead(lead || null);
                        }}
                        defaultValue={-1}
                    >
                        <option value={-1}>No specific lead (Raw template)</option>
                        {leads.map((lead, idx) => (
                             <option key={idx} value={idx}>
                                {lead.name || lead.email || `Lead #${idx+1}`}
                             </option>
                        ))}
                    </select>
                    <p className="text-[10px] text-text-muted mt-1">
                        Select a lead to test variable substitution (e.g. &#123;&#123;name&#125;&#125;).
                    </p>
                </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={sendTestEmail}
                className="px-4 py-2 rounded-xl bg-accent-indigo text-white font-medium hover:bg-accent-indigo/90 transition-colors"
              >
                Send Test
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Schedule Campaign Modal */}
       {activeModal === 'schedule' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-bg-secondary border border-border-color p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Schedule Campaign</h3>
            <p className="text-sm text-text-muted mb-6">
                Pick a date and time to automatically send this campaign.
            </p>
            
            <div className="space-y-4 mb-6">
                <div>
                    <label className="text-xs font-medium text-text-secondary mb-1 block">Send Date & Time</label>
                    <input
                      type="datetime-local"
                      className="w-full bg-bg-tertiary border border-border-color rounded-xl px-4 py-3 text-sm focus:border-accent-indigo focus:outline-none text-white calendar-picker-indicator:invert"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-4 py-2 rounded-xl text-text-secondary hover:bg-bg-tertiary transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button 
                onClick={() => saveCampaign('scheduled')}
                disabled={saving || !scheduledAt}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
