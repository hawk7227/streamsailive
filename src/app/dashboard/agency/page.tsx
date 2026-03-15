"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SubAccount {
  id: string;
  sub_account_plan: "starter" | "professional";
  workspace_id: string | null;
  workspace_name: string | null;
  invitation_email: string;
  status: "pending" | "accepted" | "cancelled" | "expired";
  created_at: string;
  updated_at: string;
  invitation_url?: string | null;
}

interface Limits {
  starter: {
    total: number;
    used: number;
    remaining: number;
  };
  professional: {
    total: number;
    used: number;
    remaining: number;
  };
}

export default function AgencyDashboardPage() {
  const { plan, refreshWorkspace } = useAuth();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [formEmail, setFormEmail] = useState("");
  const [formWorkspaceName, setFormWorkspaceName] = useState("");
  const [formPlan, setFormPlan] = useState<"starter" | "professional">("starter");
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = useState<string | null>(null);

  const loadSubAccounts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/agency/sub-accounts");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to load sub-accounts");
      }

      setSubAccounts(data.subAccounts ?? []);
      setLimits(data.limits ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sub-accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (plan?.key === "enterprise") {
      void loadSubAccounts();
    }
  }, [plan?.key, loadSubAccounts]);

  // Check if user has enterprise plan
  if (plan?.key !== "enterprise") {
    return (
      <div className="animate-fade-in">
        <div className="bg-bg-secondary border border-border-color rounded-[20px] p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Enterprise Plan Required</h2>
          <p className="text-text-muted">
            Agency features are only available for Enterprise plan users.
          </p>
        </div>
      </div>
    );
  }

  const handleCreateSubAccount = async () => {
    if (!formEmail || !formEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/agency/sub-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formEmail,
          plan: formPlan,
          workspaceName: formWorkspaceName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to create sub-account");
      }

      // Reload sub-accounts
      await loadSubAccounts();
      setIsModalOpen(false);
      setFormEmail("");
      setFormWorkspaceName("");
      setFormPlan("starter");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create sub-account");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSubAccount = async (id: string) => {
    const account = subAccounts.find((a) => a.id === id);
    const isAccepted = account?.status === "accepted";
    
    const confirmMessage = isAccepted
      ? `Are you sure you want to delete this client account?\n\nThis will permanently delete:\n- The workspace and all its data\n- All generations and usage data\n- All team members\n- All workspace invitations\n\nThis action cannot be undone.`
      : "Are you sure you want to cancel this invitation?";

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`/api/agency/sub-accounts/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to delete sub-account");
      }

      await loadSubAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete sub-account");
    }
  };

  const filteredSubAccounts = subAccounts.filter((account) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "pending" && account.status === "pending") ||
      (filter === "active" && account.status === "accepted") ||
      (filter === "cancelled" && account.status === "cancelled") ||
      (filter === account.sub_account_plan);
    const matchesSearch = account.invitation_email
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const canCreateStarter = limits ? limits.starter.remaining > 0 : false;
  const canCreateProfessional = limits ? limits.professional.remaining > 0 : false;
  const canCreateAny = canCreateStarter || canCreateProfessional;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-accent-indigo to-accent-pink rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-7 h-7"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="text-[32px] font-bold leading-tight">
                Agency Dashboard
              </h1>
              <p className="text-accent-purple font-medium text-sm">
                Managing {subAccounts.filter((a) => a.status !== "cancelled" && a.status !== "expired").length} client workspaces
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canCreateAny}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-indigo to-accent-pink text-white rounded-xl font-bold text-sm transition-all hover:shadow-[0_8px_25px_rgba(168,85,247,0.35)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-[18px] h-[18px]"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Client
          </button>
        </div>

        {/* Limits Stats */}
        {limits && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            <div className="bg-bg-secondary border border-border-color rounded-[20px] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-300 flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-[22px] h-[22px]"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                  </div>
                  <span className="text-[13px] text-text-muted font-medium">
                    Starter Sub-Accounts
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-[28px] font-bold">
                  {limits.starter.used} / {limits.starter.total}
                </p>
                <span className="text-sm text-text-muted">
                  ({limits.starter.remaining} remaining)
                </span>
              </div>
              <div className="mt-4 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{
                    width: `${(limits.starter.used / limits.starter.total) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="bg-bg-secondary border border-border-color rounded-[20px] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-[22px] h-[22px]"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    </svg>
                  </div>
                  <span className="text-[13px] text-text-muted font-medium">
                    Professional Sub-Accounts
                  </span>
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-[28px] font-bold">
                  {limits.professional.used} / {limits.professional.total}
                </p>
                <span className="text-sm text-text-muted">
                  ({limits.professional.remaining} remaining)
                </span>
              </div>
              <div className="mt-4 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{
                    width: `${(limits.professional.used / limits.professional.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-[400px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-color rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-purple focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)] transition-all placeholder:text-text-muted"
            placeholder="Search clients..."
          />
        </div>
        <div className="flex bg-bg-secondary border border-border-color rounded-xl p-1 overflow-x-auto">
          {["all", "pending", "active", "starter", "professional"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all capitalize whitespace-nowrap ${
                filter === t
                  ? "bg-white text-black shadow-sm"
                  : "text-text-secondary hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-indigo"></div>
        </div>
      ) : (
        <>
          {/* Sub-Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredSubAccounts.map((account) => (
              <div
                key={account.id}
                className="group relative bg-bg-secondary border border-border-color rounded-[20px] p-6 transition-all duration-300 hover:border-border-hover hover:-translate-y-1 hover:shadow-2xl overflow-hidden"
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-[52px] h-[52px] rounded-[14px] bg-gradient-to-br from-accent-indigo to-accent-purple flex items-center justify-center font-bold text-lg text-white">
                      {account.invitation_email.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg truncate max-w-[150px]">
                        {account.workspace_name || account.invitation_email}
                      </h3>
                      <p className="text-[13px] text-text-muted truncate max-w-[150px]">
                        {account.invitation_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize ${
                        account.sub_account_plan === "starter"
                          ? "bg-blue-500/10 text-blue-300"
                          : "bg-indigo-500/10 text-indigo-300"
                      }`}
                    >
                      {account.sub_account_plan}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        account.status === "accepted"
                          ? "bg-accent-emerald/10 text-accent-emerald"
                          : account.status === "pending"
                          ? "bg-accent-amber/10 text-accent-amber"
                          : "bg-zinc-500/10 text-zinc-400"
                      }`}
                    >
                      {account.status === "accepted" ? "active" : account.status}
                    </span>
                  </div>
                </div>

                {account.status === "pending" && account.invitation_url && (
                  <div className="mb-4 p-3 bg-bg-tertiary rounded-xl">
                    <p className="text-xs text-text-muted mb-2">Invitation Link:</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={account.invitation_url}
                        readOnly
                        className="flex-1 px-3 py-2 bg-bg-secondary border border-border-color rounded-lg text-xs text-text-primary"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(account.invitation_url!);
                        }}
                        className="px-3 py-2 bg-accent-purple/10 text-accent-purple rounded-lg text-xs font-medium hover:bg-accent-purple/20 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border-color">
                  <div className="text-[13px] text-text-muted">
                    Created {new Date(account.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    {account.status === "accepted" && account.workspace_id && (
                      <button
                        onClick={async () => {
                          if (!account.workspace_id) return;
                          setSwitchingWorkspaceId(account.workspace_id);
                          try {
                            const response = await fetch("/api/team/workspaces", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ workspaceId: account.workspace_id }),
                            });
                            const data = await response.json();

                            if (!response.ok) {
                              throw new Error(data?.error ?? "Unable to switch workspace");
                            }

                            await refreshWorkspace();
                            // Navigate to dashboard
                            window.location.href = "/dashboard";
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Unable to switch workspace");
                            setSwitchingWorkspaceId(null);
                          }
                        }}
                        disabled={switchingWorkspaceId === account.workspace_id}
                        className="px-4 py-2 rounded-lg text-xs font-medium bg-accent-indigo/10 text-accent-indigo hover:bg-accent-indigo/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {switchingWorkspaceId === account.workspace_id ? (
                          <>
                            <svg
                              className="animate-spin h-3 w-3"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Switching...
                          </>
                        ) : (
                          "Login as Client"
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteSubAccount(account.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                        account.status === "accepted"
                          ? "text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          : "text-text-muted hover:bg-bg-tertiary hover:text-white"
                      }`}
                    >
                      {account.status === "accepted" ? "Delete" : "Cancel"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Client Card */}
            <div
              onClick={() => canCreateAny && setIsModalOpen(true)}
              className={`group bg-bg-secondary border-2 border-dashed border-border-color rounded-[20px] p-6 flex flex-col items-center justify-center min-h-[280px] transition-all ${
                canCreateAny
                  ? "cursor-pointer hover:border-accent-purple hover:bg-accent-purple/5"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4 transition-colors ${
                  canCreateAny
                    ? "group-hover:bg-accent-purple/10 group-hover:text-accent-purple text-text-muted"
                    : "text-text-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-7 h-7"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span
                className={`font-semibold transition-colors ${
                  canCreateAny
                    ? "text-text-secondary group-hover:text-text-primary"
                    : "text-text-muted"
                }`}
              >
                {canCreateAny ? "Add New Client" : "Limit Reached"}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-[480px] bg-bg-secondary border border-border-color rounded-3xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border-color">
              <h2 className="text-xl font-bold">Add New Client</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormEmail("");
                  setFormWorkspaceName("");
                  setFormPlan("starter");
                  setError("");
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:bg-bg-tertiary hover:text-white transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Client Email
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-color rounded-xl text-text-primary text-[15px] focus:outline-none focus:border-accent-purple focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)] transition-all placeholder:text-text-muted"
                  placeholder="client@example.com"
                />
                <p className="text-xs text-text-muted">
                  An invitation will be sent to this email address
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Workspace Name <span className="text-text-muted">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formWorkspaceName}
                  onChange={(e) => setFormWorkspaceName(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-color rounded-xl text-text-primary text-[15px] focus:outline-none focus:border-accent-purple focus:shadow-[0_0_0_3px_rgba(168,85,247,0.1)] transition-all placeholder:text-text-muted"
                  placeholder="Client Company Name"
                />
                <p className="text-xs text-text-muted">
                  If not provided, workspace name will be generated from email
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Plan Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setFormPlan("starter")}
                    disabled={!canCreateStarter}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-center ${
                      formPlan === "starter"
                        ? "bg-accent-indigo/10 border-accent-indigo text-accent-indigo"
                        : canCreateStarter
                        ? "bg-bg-tertiary border-border-color text-text-secondary hover:text-white hover:border-border-hover"
                        : "bg-bg-tertiary border-border-color text-text-muted opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Starter
                    {limits && (
                      <span className="block text-xs mt-1 opacity-70">
                        {limits.starter.remaining} remaining
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setFormPlan("professional")}
                    disabled={!canCreateProfessional}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors text-center ${
                      formPlan === "professional"
                        ? "bg-accent-indigo/10 border-accent-indigo text-accent-indigo"
                        : canCreateProfessional
                        ? "bg-bg-tertiary border-border-color text-text-secondary hover:text-white hover:border-border-hover"
                        : "bg-bg-tertiary border-border-color text-text-muted opacity-50 cursor-not-allowed"
                    }`}
                  >
                    Professional
                    {limits && (
                      <span className="block text-xs mt-1 opacity-70">
                        {limits.professional.remaining} remaining
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border-color flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormEmail("");
                  setFormWorkspaceName("");
                  setFormPlan("starter");
                  setError("");
                }}
                className="px-5 py-3 rounded-xl font-bold text-sm text-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSubAccount}
                disabled={creating || !formEmail || !formEmail.includes("@")}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-pink text-white font-bold text-sm transition-all hover:shadow-[0_8px_25px_rgba(168,85,247,0.35)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                {creating ? "Creating..." : "Create Invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
