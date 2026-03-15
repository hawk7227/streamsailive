"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  integration: {
    id: string;
    name: string;
    description: string;
    existingCredentials?: Record<string, string>;
  };
  onSave: (config: any) => Promise<void>;
}

export default function IntegrationModal({
  isOpen,
  onClose,
  integration,
  onSave,
}: IntegrationModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({});

  // Pre-populate form with existing credentials when reconfiguring
  useEffect(() => {
    if (integration.existingCredentials) {
      setFormData(integration.existingCredentials);
    } else {
      setFormData({});
    }
  }, [integration.existingCredentials, integration.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error("Failed to save integration:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (key: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const renderFormFields = () => {
    switch (integration.id) {
      case "facebook":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Page Access Token
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Facebook Page Access Token"
                value={formData.access_token || ""}
                onChange={(e) => updateField("access_token", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Page ID
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Facebook Page ID"
                value={formData.page_id || ""}
                onChange={(e) => updateField("page_id", e.target.value)}
                required
              />
            </div>
          </>
        );

      case "instagram":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Access Token
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Instagram Access Token"
                value={formData.access_token || ""}
                onChange={(e) => updateField("access_token", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Instagram Business Account ID
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Instagram Business Account ID"
                value={formData.account_id || ""}
                onChange={(e) => updateField("account_id", e.target.value)}
                required
              />
            </div>
          </>
        );

      case "tiktok":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Access Token
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your TikTok Access Token"
                value={formData.access_token || ""}
                onChange={(e) => updateField("access_token", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Open ID
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your TikTok Open ID"
                value={formData.open_id || ""}
                onChange={(e) => updateField("open_id", e.target.value)}
                required
              />
            </div>
          </>
        );

      case "youtube":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Client ID
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your YouTube OAuth Client ID"
                value={formData.client_id || ""}
                onChange={(e) => updateField("client_id", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Client Secret
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your YouTube OAuth Client Secret"
                value={formData.client_secret || ""}
                onChange={(e) => updateField("client_secret", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Refresh Token
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your YouTube Refresh Token"
                value={formData.refresh_token || ""}
                onChange={(e) => updateField("refresh_token", e.target.value)}
                required
              />
            </div>
          </>
        );

      case "twitter":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                API Key
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Twitter API Key"
                value={formData.api_key || ""}
                onChange={(e) => updateField("api_key", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                API Secret
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Twitter API Secret"
                value={formData.api_secret || ""}
                onChange={(e) => updateField("api_secret", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Access Token
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Twitter Access Token"
                value={formData.access_token || ""}
                onChange={(e) => updateField("access_token", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Access Token Secret
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your Twitter Access Token Secret"
                value={formData.access_token_secret || ""}
                onChange={(e) =>
                  updateField("access_token_secret", e.target.value)
                }
                required
              />
            </div>
          </>
        );

      case "linkedin":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Access Token
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your LinkedIn Access Token"
                value={formData.access_token || ""}
                onChange={(e) => updateField("access_token", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Organization ID (Optional)
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your LinkedIn Organization ID"
                value={formData.organization_id || ""}
                onChange={(e) => updateField("organization_id", e.target.value)}
              />
            </div>
          </>
        );

      case "smtp":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                SMTP Host
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="e.g., smtp.gmail.com"
                value={formData.host || ""}
                onChange={(e) => updateField("host", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Port
              </label>
              <input
                type="number"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="e.g., 587"
                value={formData.port || ""}
                onChange={(e) => updateField("port", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Username / Email
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="your-email@example.com"
                value={formData.username || ""}
                onChange={(e) => updateField("username", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter your SMTP password"
                value={formData.password || ""}
                onChange={(e) => updateField("password", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                From Name
              </label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Your Name or Company"
                value={formData.from_name || ""}
                onChange={(e) => updateField("from_name", e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use_tls"
                className="w-4 h-4 rounded border-border-color bg-bg-tertiary focus:ring-accent-indigo"
                checked={formData.use_tls === "true"}
                onChange={(e) => updateField("use_tls", e.target.checked ? "true" : "false")}
              />
              <label htmlFor="use_tls" className="text-sm text-text-primary">
                Use TLS/SSL
              </label>
            </div>
          </>
        );

      case "webhook":
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Webhook URL
              </label>
              <input
                type="url"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="https://your-webhook-url.com/endpoint"
                value={formData.webhook_url || ""}
                onChange={(e) => updateField("webhook_url", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-text-primary">
                Secret Key (Optional)
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-border-color focus:border-accent-indigo focus:outline-none text-text-primary"
                placeholder="Enter webhook secret for validation"
                value={formData.secret_key || ""}
                onChange={(e) => updateField("secret_key", e.target.value)}
              />
            </div>
          </>
        );

      default:
        return (
          <div className="text-text-secondary">
            Configuration for {integration.name} coming soon.
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-bg-secondary border border-border-color rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-bg-secondary border-b border-border-color px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {integration.existingCredentials ? "Edit" : "Configure"} {integration.name}
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              {integration.existingCredentials 
                ? "Update your connection settings" 
                : integration.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {renderFormFields()}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-border-color text-text-secondary hover:text-white hover:border-accent-indigo transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-accent-indigo hover:bg-accent-indigo/80 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save Integration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
