"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { formatRelativeTime } from "@/lib/formatters";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  canAssignRole,
  canInviteMembers,
  canRemoveMember,
  type WorkspaceRole,
} from "@/lib/team";
import type { PlanLimitValue } from "@/lib/plans";

type TeamMember = {
  id: string;
  kind: "member" | "invite";
  userId: string | null;
  name: string;
  email: string;
  role: WorkspaceRole;
  status: "active" | "pending";
  lastActiveAt: string | null;
  generations: number;
};

type WorkspaceOption = {
  workspace: {
    id: string;
    name: string | null;
    ownerId: string;
  };
  role: WorkspaceRole;
};

type WorkspaceInvite = {
  id: string;
  role: WorkspaceRole;
  createdAt: string | null;
  workspace: {
    id: string | null;
    name: string | null;
    ownerId: string | null;
  } | null;
  invitedBy?: string | null;
  isAgencySubAccount?: boolean;
  subAccountPlan?: string | null;
};

export default function TeamPage() {
  const { user, refreshWorkspace } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Workspaces Query
  const { data: workspacesData, isLoading: workspaceLoading, error: workspaceErrorObj } = useQuery({
    queryKey: ['team-workspaces'],
    queryFn: async () => {
      const response = await fetch("/api/team/workspaces", { method: "GET" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Unable to load workspaces");
      return data;
    },
    enabled: !!user,
  });

  const workspaces: WorkspaceOption[] = workspacesData?.workspaces || [];
  const currentWorkspaceId: string | null = workspacesData?.currentWorkspaceId || null;
  const workspaceError = workspaceErrorObj instanceof Error ? workspaceErrorObj.message : "";

  // Invites Query
  const { data: invitesData } = useQuery({
    queryKey: ['team-invites'],
    queryFn: async () => {
      const response = await fetch("/api/team/invitations", { method: "GET" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Unable to load invitations");
      return data;
    },
    enabled: !!user,
  });
  const invites: WorkspaceInvite[] = invitesData?.invites || [];

  // Team Query (dependent on workspace)
  const { data: teamData, isLoading: teamLoading, error: teamErrorObj } = useQuery({
    queryKey: ['team-members', currentWorkspaceId],
    queryFn: async () => {
      const response = await fetch("/api/team", { method: "GET" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Unable to load team");
      return data;
    },
    enabled: !!user,
  });

  const members: TeamMember[] = teamData?.members || [];
  const teamRole: WorkspaceRole | null = teamData?.role || null;
  const teamLimits: PlanLimitValue | null = teamData?.plan?.limits?.teamMembers || null;
  const teamCounts = teamData?.counts || null;
  const isClientWorkspace = teamData?.isClientWorkspace || false;
  const loading = teamLoading;
  const loadError = teamErrorObj instanceof Error ? teamErrorObj.message : "";

  const [inviteActionId, setInviteActionId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  const [roleModalMember, setRoleModalMember] = useState<TeamMember | null>(null);
  const [roleDraft, setRoleDraft] = useState<WorkspaceRole>("member");
  const [roleUpdateError, setRoleUpdateError] = useState("");
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [agencyWorkspaceId, setAgencyWorkspaceId] = useState<string | null>(null);

  const inviteRoleOptions = useMemo(() => {
    if (teamRole === "owner") {
      return ["member", "admin"] as WorkspaceRole[];
    }
    return ["member"] as WorkspaceRole[];
  }, [teamRole]);

  useEffect(() => {
    if (!inviteRoleOptions.includes(inviteRole)) {
      setInviteRole(inviteRoleOptions[0]);
    }
  }, [inviteRole, inviteRoleOptions]);

  // Find agency workspace when viewing a client workspace
  useEffect(() => {
    if (isClientWorkspace && workspaces.length > 0 && user) {
      // Find the agency workspace (where user is owner and not the current workspace)
      const agencyWorkspace = workspaces.find(
        (w) => w.workspace.ownerId === user.id && w.workspace.id !== currentWorkspaceId
      );
      setAgencyWorkspaceId(agencyWorkspace?.workspace.id ?? null);
    } else {
      setAgencyWorkspaceId(null);
    }
  }, [isClientWorkspace, workspaces, currentWorkspaceId, user]);

  const totalMembers = teamCounts?.total ?? members.length;
  const teamLimitReached =
    teamLimits !== null &&
    teamLimits !== "unlimited" &&
    totalMembers >= teamLimits;

  const canInvite =
    canInviteMembers(teamRole) && !teamLimitReached && !loading;

  const handleWorkspaceChange = async (workspaceId: string) => {
    if (!workspaceId || workspaceId === currentWorkspaceId) {
      return;
    }

    try {
      const response = await fetch("/api/team/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to switch workspace");
      }

      // Invalidate relevant queries
      await Promise.all([
         queryClient.invalidateQueries({ queryKey: ['team-workspaces'] }),
         queryClient.invalidateQueries({ queryKey: ['team-members'] }),
         refreshWorkspace()
      ]);
    } catch (error) {
      console.error(error); // Error handling could be improved
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setInviteActionId(inviteId);
    try {
      const response = await fetch("/api/team/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to accept invite");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['team-invites'] }),
        queryClient.invalidateQueries({ queryKey: ['team-workspaces'] }),
        queryClient.invalidateQueries({ queryKey: ['team-members'] }), // Current team might change context?
        refreshWorkspace()
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      setInviteActionId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    setInviteActionId(inviteId);
    try {
      const response = await fetch("/api/team/invitations/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to decline invite");
      }

      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
    } catch (error) {
      console.error(error);
    } finally {
      setInviteActionId(null);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesFilter = filter === "all" || member.status === filter;
    const matchesSearch =
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleInviteSubmit = async () => {
    if (!canInvite) {
      setInviteError("You do not have permission to invite members.");
      return;
    }

    if (!inviteEmail) {
      setInviteError("Email is required");
      return;
    }

    setInviteSending(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to send invite");
      }

      setInviteSuccess("Invite sent successfully.");
      setInviteEmail("");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['team-members'] }); // Assuming invite affects team list (pending members)
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "Unable to send invite"
      );
    } finally {
      setInviteSending(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    const confirmMessage =
      member.kind === "invite"
        ? `Cancel invite for ${member.email}?`
        : `Remove ${member.name} from the workspace?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch("/api/team/member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, memberType: member.kind }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to remove member");
      }

      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (error) {
      console.error(error); // Could improve error handling
    }
  };

  const openRoleModal = (member: TeamMember) => {
    setRoleModalMember(member);
    setRoleDraft(member.role);
    setRoleUpdateError("");
  };

  const handleRoleUpdate = async () => {
    if (!roleModalMember) {
      return;
    }

    setRoleUpdating(true);
    setRoleUpdateError("");
    try {
      const response = await fetch("/api/team/member", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: roleModalMember.id, role: roleDraft }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to update role");
      }

      setRoleModalMember(null);
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    } catch (error) {
      setRoleUpdateError(
        error instanceof Error ? error.message : "Unable to update role"
      );
    } finally {
      setRoleUpdating(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-accent-indigo/10 rounded-xl flex items-center justify-center text-accent-indigo">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-6 h-6"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h1 className="text-[28px] font-bold">Team Members</h1>
            <p className="text-text-secondary text-sm">
              Manage who has access to your workflow
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setInviteError("");
            setInviteSuccess("");
            setIsModalOpen(true);
          }}
          disabled={!canInvite}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
            canInvite
              ? "bg-gradient-to-r from-accent-indigo to-accent-purple text-white hover:shadow-[0_8px_25px_rgba(99,102,241,0.35)] hover:-translate-y-0.5"
              : "bg-bg-tertiary text-text-muted cursor-not-allowed"
          }`}
          title={
            teamLimitReached
              ? "Team member limit reached"
              : !canInviteMembers(teamRole)
              ? "You do not have permission to invite members"
              : undefined
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="w-[18px] h-[18px]"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
          Invite Member
        </button>
      </div>
      {workspaceError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          {workspaceError}
        </div>
      )}
      {isClientWorkspace && agencyWorkspaceId && (
        <div className="mb-6 bg-accent-indigo/10 border border-accent-indigo/20 rounded-xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-indigo/20 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5 text-accent-indigo"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <path d="M20 8v6M23 11h-6" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-accent-indigo">Viewing Client Workspace</div>
              <div className="text-sm text-text-secondary">
                You are currently viewing a client's workspace. Switch back to your agency workspace to manage clients.
              </div>
            </div>
          </div>
          <button
            onClick={async () => {
              if (agencyWorkspaceId) {
                await handleWorkspaceChange(agencyWorkspaceId);
              }
            }}
            disabled={workspaceLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-accent-indigo text-white hover:bg-accent-indigo/90 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {workspaceLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
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
              "Switch to Agency Workspace"
            )}
          </button>
        </div>
      )}
      <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Current Workflow</h2>
            <p className="text-sm text-text-secondary">
              Choose which workflow is active for generations, library, and limits.
            </p>
          </div>
          <div className="text-sm text-text-muted">
            Role:{" "}
            <span className="font-semibold capitalize text-text-primary">
              {teamRole ?? "—"}
            </span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-secondary">
              Workflow
            </label>
            <select
              value={currentWorkspaceId ?? ""}
              onChange={(e) => handleWorkspaceChange(e.target.value)}
              disabled={workspaceLoading || workspaces.length === 0}
              className="w-full px-4 py-3 bg-bg-tertiary border border-border-color rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-indigo/50 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                Select workflow
              </option>
              {workspaces.map((option) => (
                <option key={option.workspace.id} value={option.workspace.id}>
                  {option.workspace.name ?? "Workflow"} ({option.role})
                </option>
              ))}
            </select>
          </div>
          <div className="bg-bg-tertiary border border-border-color rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-text-muted">
              Active Workflow ID
            </div>
            <div className="text-sm text-text-secondary mt-2 break-all">
              {currentWorkspaceId ?? "—"}
            </div>
          </div>
        </div>
      </div>
      {invites.length > 0 && (
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Pending Workflow Invitations</h2>
              <p className="text-sm text-text-secondary">
                Accept to add another workflow to your account.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-tertiary border border-border-color rounded-xl px-4 py-3"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {invite.workspace?.name ?? "Workflow"}
                    {invite.isAgencySubAccount && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20">
                        Agency
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-text-secondary mt-0.5">
                    Role: <span className="capitalize">{invite.role}</span>
                    {invite.isAgencySubAccount && invite.subAccountPlan && (
                      <span className="ml-2">
                        • Plan:{" "}
                        <span className="capitalize font-medium">
                          {invite.subAccountPlan}
                        </span>
                      </span>
                    )}
                    {invite.createdAt
                      ? ` • Invited ${formatRelativeTime(invite.createdAt)}`
                      : ""}
                  </div>
                  {invite.invitedBy && (
                    <div className="text-xs text-text-muted mt-1">
                      Invited by {invite.invitedBy}
                    </div>
                  )}
                  {invite.isAgencySubAccount && (
                    <div className="text-xs text-accent-indigo mt-1 font-medium">
                      This will be added as a new workflow to your account
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeclineInvite(invite.id)}
                    disabled={inviteActionId === invite.id}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-white hover:bg-bg-secondary border border-border-color disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleAcceptInvite(invite.id)}
                    disabled={inviteActionId === invite.id}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-accent-indigo to-accent-purple hover:shadow-[0_8px_20px_rgba(99,102,241,0.35)] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {inviteActionId === invite.id ? "Processing..." : "Accept"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {teamLimitReached && (
        <div className="mb-6 bg-bg-secondary border border-border-color rounded-xl px-4 py-3 text-sm text-text-secondary">
          You have reached your team member limit
          {typeof teamLimits === "number"
            ? ` (${totalMembers}/${teamLimits}).`
            : "."}
          Upgrade your plan to add more members.
        </div>
      )}
      {loadError && (
        <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 hover:border-border-hover transition-colors">
          <p className="text-[13px] text-text-muted font-medium mb-2">
            Total Members
          </p>
          <p className="text-[32px] font-bold">{totalMembers}</p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 hover:border-border-hover transition-colors">
          <p className="text-[13px] text-text-muted font-medium mb-2">
            Active
          </p>
          <p className="text-[32px] font-bold text-accent-emerald">
            {teamCounts?.active ?? members.filter((m) => m.status === "active").length}
          </p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 hover:border-border-hover transition-colors">
          <p className="text-[13px] text-text-muted font-medium mb-2">
            Pending Invites
          </p>
          <p className="text-[32px] font-bold text-accent-amber">
            {teamCounts?.pending ??
              members.filter((m) => m.status === "pending").length}
          </p>
        </div>
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
            className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-color rounded-xl text-text-primary text-sm focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all placeholder:text-text-muted"
            placeholder="Search members..."
          />
        </div>
        <div className="flex gap-2">
          {["All", "Active", "Pending"].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t.toLowerCase())}
              className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                filter === t.toLowerCase()
                  ? "bg-accent-indigo/10 text-accent-indigo border border-accent-indigo/20"
                  : "bg-bg-secondary border border-border-color text-text-secondary hover:text-white hover:bg-bg-tertiary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-bg-secondary border border-border-color rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg-tertiary border-b border-border-color">
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-text-muted uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => {
                const isSelf = member.userId && member.userId === user?.id;
                const canEditRole =
                  member.kind === "member" &&
                  teamRole === "owner" &&
                  member.role !== "owner" &&
                  !isSelf;
                const canRemove =
                  member.kind === "invite"
                    ? canInviteMembers(teamRole)
                    : canRemoveMember(teamRole, member.role) &&
                      member.role !== "owner" &&
                      !isSelf;

                const lastActiveLabel = member.lastActiveAt
                  ? member.status === "pending"
                    ? `Invited ${formatRelativeTime(member.lastActiveAt)}`
                    : formatRelativeTime(member.lastActiveAt)
                  : member.status === "pending"
                  ? "Invite pending"
                  : "Active";

                return (
                  <tr
                  key={member.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      {member.status === "pending" ? (
                        <div className="w-11 h-11 rounded-full bg-bg-tertiary border border-border-color flex items-center justify-center font-bold text-[15px] border-dashed text-text-muted">
                          ?
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-accent-indigo to-accent-purple flex items-center justify-center font-bold text-[15px] text-white">
                          {member.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-[15px]">
                          {member.name}
                        </div>
                        <div className="text-[13px] text-text-muted">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium ${
                        member.role === "owner"
                          ? "bg-amber-500/10 text-amber-300"
                          : member.role === "admin"
                          ? "bg-indigo-500/10 text-indigo-300"
                          : "bg-emerald-500/10 text-emerald-300"
                      }`}
                    >
                      {member.role === "owner" && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3.5 h-3.5"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      )}
                      <span className="capitalize">{member.role}</span>
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium capitalize ${
                        member.status === "active"
                          ? "bg-emerald-500/10 text-emerald-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          member.status === "active"
                            ? "bg-accent-emerald"
                            : "bg-accent-amber"
                        }`}
                      />
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-[14px]">{lastActiveLabel}</div>
                    <div className="text-[12px] text-text-muted mt-0.5">
                      {member.generations} gens
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canEditRole && (
                        <button
                          onClick={() => openRoleModal(member)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-bg-tertiary hover:text-white transition-colors"
                          title="Change role"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4.5 h-4.5"
                          >
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                        </button>
                      )}
                      {canRemove && (
                        <button
                          onClick={() => handleRemove(member)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          title={member.kind === "invite" ? "Cancel invite" : "Remove"}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4.5 h-4.5"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
          {loading && (
            <div className="text-center py-12">
              <div className="text-text-secondary">Loading team members...</div>
            </div>
          )}
          {!loading && filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4 text-text-muted">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-8 h-8"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-1">No members found</h3>
              <p className="text-text-secondary">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-[480px] bg-bg-secondary border border-border-color rounded-3xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border-color">
              <h2 className="text-xl font-bold">Invite New Member</h2>
              <button
                onClick={() => setIsModalOpen(false)}
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
              {inviteError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {inviteSuccess}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-bg-tertiary border border-border-color rounded-xl text-text-primary text-[15px] focus:outline-none focus:border-accent-indigo focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all placeholder:text-text-muted"
                  placeholder="colleague@company.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {inviteRoleOptions.map((role) => (
                    <button
                      key={role}
                      onClick={() => setInviteRole(role)}
                      className={`px-2 py-3 rounded-xl border text-sm font-medium transition-colors text-center ${
                        inviteRole === role
                          ? "bg-accent-indigo/10 border-accent-indigo/30 text-white"
                          : "bg-bg-tertiary border-border-color text-text-secondary hover:text-white hover:border-border-hover"
                      }`}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-border-color flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-3 rounded-xl font-bold text-sm text-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteSubmit}
                disabled={inviteSending || !inviteEmail}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple text-white font-bold text-sm transition-all hover:shadow-[0_8px_25px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {inviteSending ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleModalMember && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-[420px] bg-bg-secondary border border-border-color rounded-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-border-color">
              <h2 className="text-lg font-bold">Update Role</h2>
              <button
                onClick={() => setRoleModalMember(null)}
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
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm text-text-muted">Member</div>
                <div className="text-[15px] font-semibold">
                  {roleModalMember.name}
                </div>
                <div className="text-sm text-text-secondary">
                  {roleModalMember.email}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-secondary">
                  Role
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["member", "admin"] as WorkspaceRole[]).map((role) => (
                    <button
                      key={role}
                      onClick={() => setRoleDraft(role)}
                      className={`px-2 py-3 rounded-xl border text-sm font-medium transition-colors text-center ${
                        roleDraft === role
                          ? "bg-accent-indigo/10 border-accent-indigo/30 text-white"
                          : "bg-bg-tertiary border-border-color text-text-secondary hover:text-white hover:border-border-hover"
                      }`}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {roleUpdateError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {roleUpdateError}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-border-color flex justify-end gap-3">
              <button
                onClick={() => setRoleModalMember(null)}
                className="px-5 py-3 rounded-xl font-bold text-sm text-text-secondary hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={
                  roleUpdating ||
                  !canAssignRole(teamRole, roleDraft) ||
                  roleDraft === roleModalMember.role
                }
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple text-white font-bold text-sm transition-all hover:shadow-[0_8px_25px_rgba(99,102,241,0.35)] hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {roleUpdating ? "Saving..." : "Save Role"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
