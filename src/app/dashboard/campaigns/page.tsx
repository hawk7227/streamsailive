"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'sent' | 'paused';
  channels: {
    email: boolean;
    sms: boolean;
    mms: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [showLeadsDialog, setShowLeadsDialog] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading: loading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Campaign[];
    }
  });

  const { data: campaignLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['campaign-leads', selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      
      const { data, error } = await supabase
        .from('campaign_leads')
        .select('lead_id, leads!inner(*)')
        .eq('campaign_id', selectedCampaignId);
      
      if (error) throw error;
      return (data || []).map((item: any) => item.leads) as Lead[];
    },
    enabled: !!selectedCampaignId
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    }
  });

  const removeLeadMutation = useMutation({
    mutationFn: async ({ campaignId, leadId }: { campaignId: string, leadId: string }) => {
      const { error } = await supabase
        .from('campaign_leads')
        .delete()
        .eq('campaign_id', campaignId)
        .eq('lead_id', leadId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads', selectedCampaignId] });
    }
  });

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete campaign:', error);
    }
  };

  const handleViewLeads = (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    setSelectedCampaignId(campaignId);
    setShowLeadsDialog(true);
  };

  const handleRemoveLead = async (leadId: string) => {
    if (!selectedCampaignId) return;
    if (!confirm('Are you sure you want to remove this lead from the campaign?')) return;
    
    try {
      await removeLeadMutation.mutateAsync({ campaignId: selectedCampaignId, leadId });
    } catch (error) {
      console.error('Failed to remove lead:', error);
    }
  };

  const handleOpenCampaign = (id: string) => {
    router.push(`/dashboard/campaigns/${id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-zinc-500/10 text-zinc-400';
      case 'scheduled': return 'bg-blue-500/10 text-blue-400';
      case 'sent': return 'bg-emerald-500/10 text-emerald-400';
      case 'paused': return 'bg-amber-500/10 text-amber-400';
      default: return 'bg-zinc-500/10 text-zinc-400';
    }
  };

  const getActiveChannels = (channels: Campaign['channels']) => {
    const active = [];
    if (channels.email) active.push('📧 Email');
    if (channels.sms) active.push('💬 SMS');
    if (channels.mms) active.push('🖼️ MMS');
    return active.join(' • ') || 'No channels';
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] -m-6 lg:-m-8 overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 h-14 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              📧
            </div>
            <h1 className="text-lg font-semibold text-zinc-200">
              My Campaigns
            </h1>
          </div>
          
          <button
            onClick={() => router.push('/dashboard/campaigns/new')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Campaign
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-3xl mb-4">
                  📧
                </div>
                <h2 className="text-2xl font-bold text-zinc-300 mb-2">No campaigns yet</h2>
                <p className="text-zinc-500 mb-6">Create your first email/SMS/MMS campaign to get started</p>
                <button
                  onClick={() => router.push('/dashboard/campaigns/new')}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                >
                  Create Campaign
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    role="button"
                    onClick={() => handleOpenCampaign(campaign.id)}
                    className="group flex flex-col h-48 p-5 bg-zinc-900/30 border border-zinc-800 rounded-2xl hover:bg-zinc-900/80 hover:border-zinc-700 transition-all duration-200 text-left relative overflow-hidden cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-3 w-full">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center group-hover:text-zinc-100 transition-colors">
                          📧
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(campaign.status)}`}>
                          {campaign.status}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(campaign.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <button
                        onClick={(e) => handleViewLeads(e, campaign.id)}
                        className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-blue-400 hover:bg-zinc-700 rounded-lg transition-colors"
                        title="View Leads"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, campaign.id)}
                        className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded-lg transition-colors"
                        title="Delete Campaign"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    <h3 className="font-medium text-zinc-200 mb-2 line-clamp-1 group-hover:text-indigo-400 transition-colors">
                      {campaign.name}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                      {getActiveChannels(campaign.channels)}
                    </p>
                    
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/50 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leads Dialog */}
      {showLeadsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLeadsDialog(false)}>
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl m-4" onClick={(e) => e.stopPropagation()}>
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                  👥
                </div>
                <h2 className="text-lg font-semibold text-zinc-200">Campaign Leads</h2>
              </div>
              <button
                onClick={() => setShowLeadsDialog(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-zinc-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Dialog Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
              {leadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-zinc-700 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : campaignLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-3xl mb-4">
                    👥
                  </div>
                  <h3 className="text-xl font-bold text-zinc-300 mb-2">No leads yet</h3>
                  <p className="text-zinc-500">This campaign doesn't have any leads assigned yet.</p>
                </div>
              ) : (
                <div className="p-6 space-y-3">
                  {campaignLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-4 bg-zinc-800/30 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-zinc-200 mb-1">{lead.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {lead.email}
                          </span>
                          {lead.phone && (
                            <span className="flex items-center gap-1.5">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {lead.phone}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveLead(lead.id)}
                        className="ml-4 p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-700/50 rounded-lg transition-colors"
                        title="Remove lead from campaign"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
