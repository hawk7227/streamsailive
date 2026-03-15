"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "@/components/dashboard/Sidebar";
import { useSiteConfig } from "@/hooks/useSiteConfig";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading } = useAuth();
  const config = useSiteConfig();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-indigo"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  const userInitials = user.email
    ?.split("@")[0]
    .slice(0, 2)
    .toUpperCase() || "U";

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="flex-1 lg:ml-[260px] p-6 lg:p-8">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center bg-bg-secondary border border-border-color rounded-xl"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-6 h-6"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                <img
                  src={config.logoUrl}
                  alt={config.appName}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-base font-bold text-white">{config.appName}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-indigo to-accent-purple flex items-center justify-center font-bold text-sm">
            {userInitials}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
