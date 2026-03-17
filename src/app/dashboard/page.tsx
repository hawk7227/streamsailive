import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentWorkspaceSelection } from "@/lib/team-server";
import { formatRelativeTime, truncateText } from "@/lib/formatters";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = "there";
  let monthGenerations = 0;
  let totalGenerations = 0;
  let recentGenerations: Array<{
    id: string;
    type: string;
    prompt: string;
    title: string | null;
    duration: string | null;
    aspect_ratio: string | null;
    created_at: string;
  }> = [];

  let workspaceSelection: Awaited<
    ReturnType<typeof getCurrentWorkspaceSelection>
  > | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    displayName =
      profile?.full_name?.split(" ")[0] ??
      profile?.email?.split("@")[0] ??
      user.email?.split("@")[0] ??
      "there";

    const admin = createAdminClient();
    workspaceSelection = await getCurrentWorkspaceSelection(admin, user);
    const workspaceId = workspaceSelection.current.workspace.id;
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString();

    // Cache stat queries for 30 seconds per workspace to avoid DB round-trips
    // on every page render. unstable_cache is keyed by workspace ID.
    const fetchStats = unstable_cache(
      async () => {
        const [{ count: totalCount }, { count: monthCount }, recent] =
          await Promise.all([
            admin
              .from("generations")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", workspaceId),
            admin
              .from("generations")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", workspaceId)
              .gte("created_at", monthStart),
            admin
              .from("generations")
              .select(
                "id, type, prompt, title, duration, aspect_ratio, created_at"
              )
              .eq("workspace_id", workspaceId)
              .order("created_at", { ascending: false })
              .limit(4),
          ]);
        return { totalCount, monthCount, recentData: recent.data ?? [] };
      },
      [`dashboard-stats-${workspaceId}`],
      { revalidate: 30 }
    );

    const { totalCount, monthCount, recentData } = await fetchStats();
    totalGenerations = totalCount ?? 0;
    monthGenerations = monthCount ?? 0;
    recentGenerations = recentData;
  }

  const timeSavedHours = Math.round((totalGenerations * 5) / 6) / 10;
  let teamMembers = user ? 1 : 0;

  if (user && workspaceSelection) {
    const admin = createAdminClient();
    const workspaceId = workspaceSelection.current.workspace.id;

    const fetchTeamCount = unstable_cache(
      async () => {
        const { count } = await admin
          .from("workspace_members")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId);
        return count ?? 1;
      },
      [`dashboard-team-${workspaceId}`],
      { revalidate: 30 }
    );

    teamMembers = await fetchTeamCount();

  }

  const typeConfig = {
    video: {
      label: "Video",
      typeClass: "bg-accent-indigo/10 text-[#a5b4fc]",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" />
        </svg>
      ),
      activityIcon: "🎬",
    },
    voice: {
      label: "Voice",
      typeClass: "bg-accent-purple/10 text-[#d8b4fe]",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        </svg>
      ),
      activityIcon: "🎙️",
    },
    image: {
      label: "Image",
      typeClass: "bg-[#f97316]/10 text-[#fdba74]",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      ),
      activityIcon: "🖼️",
    },
    script: {
      label: "Script",
      typeClass: "bg-accent-emerald/10 text-[#6ee7b7]",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      activityIcon: "📝",
    },
  } as const;

  const recentProjects = recentGenerations.map((generation) => {
    const config = typeConfig[generation.type as keyof typeof typeConfig] ?? typeConfig.video;
    const meta =
      generation.type === "video"
        ? generation.duration ?? "Video"
        : generation.type === "image"
        ? generation.aspect_ratio ?? "Image"
        : generation.type === "script"
        ? "Script"
        : "Voice";

    return {
      id: generation.id,
      name: truncateText(generation.title ?? generation.prompt, 36),
      time: formatRelativeTime(generation.created_at),
      meta,
      type: config.label,
      typeClass: config.typeClass,
      icon: config.icon,
    };
  });

  const recentActivity = recentGenerations.map((generation) => {
    const config = typeConfig[generation.type as keyof typeof typeConfig] ?? typeConfig.video;
    return {
      id: generation.id,
      action: `${config.label} generated`,
      user: "You",
      time: formatRelativeTime(generation.created_at),
      icon: config.activityIcon,
    };
  });
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">
            Good morning, {displayName} 👋
          </h1>
          <p className="text-text-secondary text-sm">
            Here's what's happening with your content today.
          </p>
        </div>

      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            title: "Create Video",
            desc: "Generate AI videos from text",
            href: "/dashboard/video",
            icon: (
              <>
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </>
            ),
            bg: "bg-gradient-to-br from-accent-indigo to-accent-blue",
          },
          {
            title: "Generate Voice",
            desc: "Natural text-to-speech",
            href: "/dashboard/voice",
            icon: (
              <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </>
            ),
            bg: "bg-gradient-to-br from-accent-purple to-accent-pink",
          },
          {
            title: "Create Image",
            desc: "AI image generation",
            href: "/dashboard/image",
            icon: (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </>
            ),
            bg: "bg-gradient-to-br from-[#f97316] to-[#ef4444]",
          },
          {
            title: "Write Script",
            desc: "AI copywriting assistant",
            href: "/dashboard/script",
            icon: (
              <>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </>
            ),
            bg: "bg-gradient-to-br from-accent-emerald to-[#14b8a6]",
          },
        ].map((action, i) => (
          <Link
            key={i}
            href={action.href}
            className="group bg-bg-secondary border border-border-color rounded-2xl p-6 cursor-pointer transition-all hover:border-border-hover hover:-translate-y-0.5 hover:shadow-lg block"
          >
            <div
              className={`w-12 h-12 rounded-[14px] flex items-center justify-center mb-4 text-white ${action.bg}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-6 h-6"
              >
                {action.icon}
              </svg>
            </div>
            <h3 className="font-semibold mb-1">{action.title}</h3>
            <p className="text-[13px] text-text-muted">{action.desc}</p>
          </Link>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: "Generations this month",
            value: monthGenerations.toString(),
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            ),
            color: "text-accent-indigo",
            bg: "bg-accent-indigo/10",
          },
          {
            label: "Time saved",
            value: `${timeSavedHours}h`,
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ),
            color: "text-accent-emerald",
            bg: "bg-accent-emerald/10",
          },
          {
            label: "Projects created",
            value: totalGenerations.toString(),
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            ),
            color: "text-accent-amber",
            bg: "bg-[#f59e0b1a]", // accent-amber with low opacity
          },
          {
            label: "Team members",
            value: teamMembers.toString(),
            icon: (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            ),
            color: "text-accent-purple",
            bg: "bg-accent-purple/10",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-bg-secondary border border-border-color rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-10 h-10 rounded-[10px] flex items-center justify-center ${stat.bg} ${stat.color}`}
              >
                <div className="w-5 h-5">{stat.icon}</div>
              </div>
            </div>
            <div className="text-[28px] font-bold mb-1">{stat.value}</div>
            <div className="text-[13px] text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        {/* Recent Projects */}
        <div className="bg-bg-secondary border border-border-color rounded-[20px] overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border-color">
            <h3 className="font-semibold">Recent Projects</h3>
            <Link
              href="/dashboard/library"
              className="text-[13px] font-medium text-accent-indigo hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="p-3 space-y-1">
            {recentProjects.length === 0 && (
              <div className="p-4 text-sm text-text-muted">
                No projects created yet.
              </div>
            )}
            {recentProjects.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/library?preview=${project.id}`}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-bg-tertiary transition-colors cursor-pointer group"
              >
                <div className="w-16 h-12 rounded-lg bg-bg-tertiary group-hover:bg-bg-primary flex items-center justify-center flex-shrink-0 text-text-muted transition-colors">
                  <div className="w-6 h-6">{project.icon}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm mb-1 truncate">
                    {project.name}
                  </h4>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="w-3.5 h-3.5"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {project.time}
                    </span>
                    <span>{project.meta}</span>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${project.typeClass}`}
                >
                  {project.type}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-bg-secondary border border-border-color rounded-[20px] overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-border-color">
            <h3 className="font-semibold">Activity</h3>
          </div>
          <div className="p-3 space-y-2">
            {recentActivity.length === 0 && (
              <div className="p-4 text-sm text-text-muted">
                No recent activity yet.
              </div>
            )}
            {recentActivity.map((activity) => (
              <Link
                key={activity.id}
                href={`/dashboard/library?preview=${activity.id}`}
                className="flex gap-3 p-3 rounded-xl hover:bg-bg-tertiary transition-colors"
              >
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 bg-bg-tertiary">
                  <div className="text-lg">{activity.icon}</div>
                </div>
                <div>
                  <p className="text-[13px] mb-0.5">
                    <strong className="font-semibold">{activity.user}</strong>{" "}
                    {activity.action.toLowerCase()}
                  </p>
                  <p className="text-xs text-text-muted">{activity.time}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
