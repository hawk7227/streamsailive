"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { user, profile, updateProfile, membershipRole, workspaceLoading } =
    useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      name: profile?.full_name || "",
      email: user?.email || "",
    }));
    setProfileImage(profile?.avatar_url || null);
  }, [profile, user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      if (activeTab === "profile") {
        const { error } = await updateProfile({
          full_name: formData.name.trim(),
          avatar_url: profileImage,
        });

        if (error) {
          setMessage({ type: "error", text: error });
        } else {
          setMessage({ type: "success", text: "Settings updated successfully!" });
        }
      } else {
        if (formData.newPassword !== formData.confirmPassword) {
          setMessage({ type: "error", text: "Passwords do not match." });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password: formData.newPassword,
        });

        if (error) {
          setMessage({ type: "error", text: error.message });
        } else {
          setMessage({ type: "success", text: "Password updated successfully!" });
          setFormData((prev) => ({
            ...prev,
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          }));
        }
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to update settings. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
  ];

  if (workspaceLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-text-secondary text-sm">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (membershipRole === "member") {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-text-secondary text-sm">
            Manage your account settings and preferences
          </p>
        </div>
        <div className="bg-bg-secondary border border-border-color rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-2">Access restricted</h2>
          <p className="text-sm text-text-secondary">
            Your role does not allow access to settings. Please contact an admin
            or the workspace owner if you need changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Settings</h1>
        <p className="text-text-secondary text-sm">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-accent-indigo text-accent-indigo"
                : "border-transparent text-text-secondary hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 lg:p-8">
        {activeTab === "profile" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Image */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-indigo to-accent-purple flex items-center justify-center text-2xl font-bold text-white overflow-hidden">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.email?.charAt(0).toUpperCase() || "U"
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-accent-indigo border-2 border-bg-secondary flex items-center justify-center cursor-pointer hover:bg-accent-purple transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-4 h-4"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </label>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Profile Picture</h3>
                <p className="text-sm text-text-muted mb-2">
                  Upload a new profile image (max 5MB)
                </p>
                <button
                  type="button"
                  onClick={() => setProfileImage(null)}
                  className="text-sm text-accent-indigo hover:underline"
                >
                  Remove image
                </button>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-4 py-3 rounded-xl border border-border-color bg-bg-tertiary text-white placeholder-text-muted focus:outline-none focus:border-accent-indigo"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-border-color bg-bg-tertiary text-text-muted cursor-not-allowed opacity-60"
                placeholder="your@email.com"
              />
              <p className="text-xs text-text-muted mt-2">
                Email cannot be changed for security reasons
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple text-white font-medium hover:shadow-lg hover:shadow-accent-indigo/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        {activeTab === "password" && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-xl border border-border-color bg-bg-tertiary text-white placeholder-text-muted focus:outline-none focus:border-accent-indigo"
                placeholder="Enter your current password"
                required
              />
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                New Password
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-xl border border-border-color bg-bg-tertiary text-white placeholder-text-muted focus:outline-none focus:border-accent-indigo"
                placeholder="Enter your new password"
                required
                minLength={8}
              />
              <p className="text-xs text-text-muted mt-2">
                Password must be at least 8 characters long
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className="w-full px-4 py-3 rounded-xl border border-border-color bg-bg-tertiary text-white placeholder-text-muted focus:outline-none focus:border-accent-indigo"
                placeholder="Confirm your new password"
                required
              />
              {formData.newPassword &&
                formData.confirmPassword &&
                formData.newPassword !== formData.confirmPassword && (
                  <p className="text-xs text-accent-red mt-2">
                    Passwords do not match
                  </p>
                )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={
                  isLoading ||
                  formData.newPassword !== formData.confirmPassword ||
                  !formData.newPassword
                }
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-accent-indigo to-accent-purple text-white font-medium hover:shadow-lg hover:shadow-accent-indigo/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        )}

        {/* Message */}
        {message && (
          <div
            className={`mt-4 p-4 rounded-xl ${
              message.type === "success"
                ? "bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/20"
                : "bg-accent-red/10 text-accent-red border border-accent-red/20"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
