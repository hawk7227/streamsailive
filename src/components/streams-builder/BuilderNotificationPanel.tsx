"use client";

import type { StreamsBuilderNotification } from "@/lib/streams-builder/notifications";

function severityClass(severity: StreamsBuilderNotification["severity"]) {
  if (severity === "success") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-100";
  if (severity === "error") return "border-red-400/40 bg-red-400/10 text-red-100";
  if (severity === "warning") return "border-amber-400/40 bg-amber-400/10 text-amber-100";
  return "border-sky-400/40 bg-sky-400/10 text-sky-100";
}

export default function BuilderNotificationPanel({
  notifications,
  onToggleRead,
}: {
  notifications: StreamsBuilderNotification[];
  onToggleRead: (notification: StreamsBuilderNotification) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-700 bg-slate-950/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-300">Notifications</p>
          <h2 className="mt-1 text-xl font-black text-white">Builder activity</h2>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-300">
          {notifications.filter((item) => !item.read).length} unread
        </span>
      </div>
      {notifications.length ? (
        <div className="grid gap-3">
          {notifications.map((notification) => (
            <article key={notification.id} className={`rounded-2xl border p-4 ${severityClass(notification.severity)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black">{notification.title}</h3>
                  <p className="mt-1 text-xs opacity-85">{notification.message}</p>
                  <p className="mt-2 text-[11px] opacity-70">{notification.createdAt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleRead(notification)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-black"
                >
                  {notification.read ? "Unread" : "Read"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-400">No real notifications found yet.</p>
      )}
    </section>
  );
}
