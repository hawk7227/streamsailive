"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/formatters";

export default function AnalyticsPage() {
  const [animatedValues, setAnimatedValues] = useState({
    generations: 0,
    timeSaved: 0,
    projects: 0,
    teamMembers: 0,
  });
  const [chartData, setChartData] = useState({
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    generations: [0, 0, 0, 0, 0, 0, 0],
    timeSaved: [0, 0, 0, 0, 0, 0, 0],
    projects: [0, 0, 0, 0, 0, 0, 0],
  });
  const [distribution, setDistribution] = useState<
    Array<{ type: string; percentage: number }>
  >([
    { type: "video", percentage: 0 },
    { type: "image", percentage: 0 },
    { type: "voice", percentage: 0 },
    { type: "script", percentage: 0 },
  ]);
  const [recentActivity, setRecentActivity] = useState<
    Array<{ id: string; type: string; created_at: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/analytics");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load analytics");
        }

        if (isMounted) {
          setChartData(data.chart);
          setDistribution(data.distribution);
          setRecentActivity(data.recentActivity ?? []);
          setAnimatedValues({
            generations: data.totals.generations,
            timeSaved: data.totals.timeSavedHours,
            projects: data.totals.projects,
            teamMembers: data.totals.teamMembers,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load analytics");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, []);

  const maxValue = Math.max(...chartData.generations, 1);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Analytics</h1>
          <p className="text-text-secondary text-sm">
            Track your content creation performance
          </p>
        </div>
        <div className="flex gap-3">
          <select className="px-4 py-2 rounded-xl border border-border-color bg-bg-secondary text-white text-sm focus:outline-none focus:border-accent-indigo">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
            <option>Last 90 days</option>
            <option>All time</option>
          </select>
        </div>
      </div>
      {error && (
        <div className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Generations",
            value: animatedValues.generations.toLocaleString(),
            icon: "⚡",
            bgClass: "bg-accent-indigo/10",
          },
          {
            label: "Time Saved (hours)",
            value: animatedValues.timeSaved,
            icon: "⏱️",
            bgClass: "bg-accent-emerald/10",
          },
          {
            label: "Projects Created",
            value: animatedValues.projects,
            icon: "📁",
            bgClass: "bg-accent-amber/10",
          },
          {
            label: "Team Members",
            value: animatedValues.teamMembers,
            icon: "👥",
            bgClass: "bg-accent-purple/10",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-bg-secondary border border-border-color rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl ${stat.bgClass} flex items-center justify-center text-2xl`}
              >
                {stat.icon}
              </div>
            </div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generations Chart */}
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Generations Over Time</h3>
              <p className="text-sm text-text-muted">Last 7 days</p>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {chartData.generations.map((value, i) => {
              const height = (value / maxValue) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col justify-end h-full">
                    <div
                      className="w-full bg-linear-to-t from-accent-indigo to-accent-purple rounded-t-lg transition-all duration-1000 ease-out hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        animation: `growUp 1s ease-out ${i * 0.1}s both`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted">
                    {chartData.labels[i] ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time Saved Chart */}
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold mb-1">Time Saved</h3>
              <p className="text-sm text-text-muted">Hours per day</p>
            </div>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {chartData.timeSaved.map((value, i) => {
              const maxTime = Math.max(...chartData.timeSaved, 1);
              const height = (value / maxTime) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col justify-end h-full">
                    <div
                      className="w-full bg-linear-to-t from-accent-emerald to-accent-blue rounded-t-lg transition-all duration-1000 ease-out hover:opacity-80"
                      style={{
                        height: `${height}%`,
                        animation: `growUp 1s ease-out ${i * 0.1}s both`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-text-muted">
                    {chartData.labels[i] ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Content Type Distribution</h3>
          <div className="space-y-4">
            {distribution.map((item, i) => {
              const gradient =
                item.type === "video"
                  ? "from-accent-indigo to-accent-purple"
                  : item.type === "image"
                  ? "from-accent-orange to-accent-red"
                  : item.type === "voice"
                  ? "from-accent-purple to-accent-pink"
                  : "from-accent-emerald to-accent-blue";
              const label =
                item.type.charAt(0).toUpperCase() + item.type.slice(1);

              return (
                <div key={item.type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-sm text-text-muted">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-linear-to-r ${gradient} rounded-full transition-all duration-1000 ease-out`}
                      style={{
                        width: `${item.percentage}%`,
                        animation: `slideIn 1s ease-out ${i * 0.2}s both`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <h3 className="text-lg font-semibold mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivity.length === 0 && (
              <div className="text-sm text-text-muted">
                {loading ? "Loading activity..." : "No recent activity yet."}
              </div>
            )}
            {recentActivity.map((activity) => {
              const icon =
                activity.type === "video"
                  ? "🎬"
                  : activity.type === "image"
                  ? "🖼️"
                  : activity.type === "voice"
                  ? "🎙️"
                  : "📝";
              const label =
                activity.type.charAt(0).toUpperCase() + activity.type.slice(1);

              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary hover:bg-bg-primary transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent-indigo/10 flex items-center justify-center text-xl">
                    {icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label} generated by You</p>
                    <p className="text-xs text-text-muted">
                      {formatRelativeTime(activity.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
