"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import IntegrationModal from "@/components/integrations/IntegrationModal";

const integrations = [
  {
    category: "Integrations",
    items: [
      {
        id: "smtp",
        name: "SMTP",
        description: "Email Service",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-accent-emerald">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 6l-10 7L2 6" />
          </svg>
        ),
        connected: false,
      },
    ],
  },
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set());
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testEmailModalOpen, setTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Fetch integrations from database
  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch("/api/integrations?workflow_id=default-workflow");
      const data = await response.json();
      
      if (data.integrations) {
        const connected = new Set<string>(
          data.integrations
            .filter((i: any) => i.is_active)
            .map((i: any) => i.integration_type as string)
        );
        setConnectedIntegrations(connected);
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (item: any) => {
    setSelectedIntegration(item);
    
    // If integration is already connected, fetch existing credentials
    if (connectedIntegrations.has(item.id)) {
      try {
        const response = await fetch(`/api/integrations/credentials?workflow_id=default-workflow&integration_type=${item.id}`);
        const data = await response.json();
        
        if (data.credentials) {
          setSelectedIntegration({ ...item, existingCredentials: data.credentials });
        }
      } catch (error) {
        console.error("Failed to fetch existing credentials:", error);
      }
    }
    
    setIsModalOpen(true);
  };

  const handleDisconnect = async (integrationType: string) => {
    if (!confirm("Are you sure you want to disconnect this integration?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/integrations?workflow_id=default-workflow&integration_type=${integrationType}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        await fetchIntegrations();
      }
    } catch (error) {
      console.error("Failed to disconnect integration:", error);
    }
  };

  const handleSaveIntegration = async (formData: any) => {
    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow_id: "default-workflow",
          integration_type: selectedIntegration.id,
          integration_name: selectedIntegration.name,
          credentials: formData,
          config: {},
        }),
      });

      if (response.ok) {
        await fetchIntegrations();
        setIsModalOpen(false);
      } else {
        const error = await response.json();
        alert(`Failed to save integration: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to save integration:", error);
      alert("Failed to save integration. Please try again.");
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      alert("Please enter a test email address");
      return;
    }

    setSendingTestEmail(true);
    try {
      const response = await fetch("/api/integrations/test-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          workflow_id: "default-workflow",
          test_email: testEmailAddress,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Test email sent successfully to ${testEmailAddress}!`);
        setTestEmailModalOpen(false);
        setTestEmailAddress("");
      } else {
        alert(`❌ Failed to send test email: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to send test email:", error);
      alert("❌ Failed to send test email. Please try again.");
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-2">
          Integrations
        </h1>
        <p className="text-text-secondary">
          Connect your favorite tools and platforms to automate your workflow
        </p>
      </div>

      <div className="space-y-8">
        {integrations.map((section) => (
          <div key={section.category}>
            <h2 className="text-lg font-semibold mb-4 text-text-primary">
              {section.category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {section.items.map((item) => {
                const isConnected = connectedIntegrations.has(item.id);
                
                return (
                  <div
                    key={item.id}
                    className="group bg-bg-secondary border border-border-color hover:border-accent-indigo/50 rounded-2xl p-5 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(99,102,241,0.1)] relative overflow-hidden"
                  >
                    {isConnected && (
                      <div className="absolute top-0 right-0 p-4">
                        <button
                          onClick={() => handleDisconnect(item.id)}
                          className="text-text-muted hover:text-red-500 transition-colors"
                          title="Disconnect"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-5 h-5"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col h-full">
                      <div className="mb-4 p-3 bg-bg-tertiary rounded-xl w-fit group-hover:scale-110 transition-transform duration-300">
                        {item.icon}
                      </div>

                      <div className="mb-4">
                        <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                        <p className="text-sm text-text-muted">{item.description}</p>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border-color/50">
                        {isConnected ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-accent-emerald text-sm font-medium">
                                <div className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                                Connected
                              </div>
                              <button
                                onClick={() => handleConnect(item)}
                                className="text-xs text-text-muted hover:text-accent-indigo transition-colors"
                              >
                                Reconfigure
                              </button>
                            </div>
                            {item.id === "smtp" && (
                              <button
                                onClick={() => setTestEmailModalOpen(true)}
                                className="w-full py-2 rounded-lg border border-accent-emerald/30 bg-accent-emerald/5 text-sm font-medium text-accent-emerald hover:bg-accent-emerald/10 hover:border-accent-emerald/50 transition-all flex items-center justify-center gap-2"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  className="w-4 h-4"
                                >
                                  <path d="M22 2L11 13" />
                                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                                </svg>
                                Send Test Email
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleConnect(item)}
                            className="w-full py-2 rounded-lg border border-border-color text-sm font-medium text-text-secondary hover:text-white hover:border-accent-indigo hover:bg-accent-indigo/10 transition-all"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedIntegration && (
        <IntegrationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          integration={selectedIntegration}
          onSave={handleSaveIntegration}
        />
      )}

      {/* Test Email Modal */}
      {testEmailModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl max-w-md w-full">
            <div className="border-b border-border-color px-6 py-4">
              <h2 className="text-xl font-bold text-text-primary">Send Test Email</h2>
              <p className="text-sm text-text-secondary mt-1">
                Enter an email address to test your SMTP configuration
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-text-primary">
                  Test Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                  placeholder="test@example.com"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !sendingTestEmail) {
                      handleSendTestEmail();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setTestEmailModalOpen(false);
                    setTestEmailAddress("");
                  }}
                  className="flex-1 px-4 py-2 rounded-lg border border-border-color text-text-secondary hover:text-white hover:border-accent-indigo transition-all"
                  disabled={sendingTestEmail}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={sendingTestEmail || !testEmailAddress}
                  className="flex-1 px-4 py-2 rounded-lg bg-accent-emerald hover:bg-accent-emerald/80 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingTestEmail ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-4 h-4"
                      >
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                      </svg>
                      Send Test Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
