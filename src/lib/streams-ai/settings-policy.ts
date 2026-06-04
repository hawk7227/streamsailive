export type StreamsSettingsCategory =
  | "general"
  | "notifications"
  | "personalization"
  | "apps"
  | "schedules"
  | "billing"
  | "data-controls"
  | "storage"
  | "security"
  | "trusted-contact"
  | "account";

export type StreamsSettingType = "select" | "toggle" | "text" | "button" | "danger";

export type StreamsSettingDefinition = {
  category: StreamsSettingsCategory;
  key: string;
  label: string;
  description?: string;
  type: StreamsSettingType;
  defaultValue: string | boolean;
  options?: string[];
  actionLabel?: string;
  disabled?: boolean;
};

export type StreamsSettingsTab = {
  id: StreamsSettingsCategory;
  label: string;
  icon: string;
  title: string;
  description: string;
};

export const STREAMS_SETTINGS_TABS: StreamsSettingsTab[] = [
  { id: "general", label: "General", icon: "gear", title: "General", description: "Appearance, language, voice, dictation, and core account preferences." },
  { id: "notifications", label: "Notifications", icon: "bell", title: "Notifications", description: "Choose how Streams notifies you about tasks, projects, responses, usage, billing, and account activity." },
  { id: "personalization", label: "Personalization", icon: "spark", title: "Personalization", description: "Control assistant tone, memory, project context, and default workspace behavior." },
  { id: "apps", label: "Apps", icon: "apps", title: "Apps", description: "Manage connected apps, extensions, repository access, and integration readiness." },
  { id: "schedules", label: "Schedules", icon: "clock", title: "Schedules", description: "Manage reminders, recurring checks, scheduled reports, and automation delivery." },
  { id: "billing", label: "Billing", icon: "card", title: "Billing", description: "Manage plan, invoices, payment method, spending limits, and usage-credit billing preferences." },
  { id: "data-controls", label: "Data controls", icon: "database", title: "Data controls", description: "Control exports, retention, training/privacy preferences, and account data actions." },
  { id: "storage", label: "Storage", icon: "box", title: "Storage", description: "Review storage, downloads, generated assets, uploads, and cleanup preferences." },
  { id: "security", label: "Security", icon: "key", title: "Security", description: "Manage account protection, sessions, workspace access, MFA readiness, and trusted recovery." },
  { id: "trusted-contact", label: "Trusted contact", icon: "life", title: "Trusted contact", description: "Choose recovery contacts and account-safety contacts for critical account events." },
  { id: "account", label: "Account", icon: "user", title: "Account", description: "Manage identity, profile, workspace ownership, and account lifecycle controls." },
];

export const STREAMS_SETTING_DEFINITIONS: StreamsSettingDefinition[] = [
  { category: "general", key: "appearance", label: "Appearance", type: "select", defaultValue: "System", options: ["System", "Light", "Dark"] },
  { category: "general", key: "contrast", label: "Contrast", type: "select", defaultValue: "System", options: ["System", "Standard", "High contrast"] },
  { category: "general", key: "accentColor", label: "Accent color", type: "select", defaultValue: "Black", options: ["Black", "Blue", "Green", "Purple", "Orange"] },
  { category: "general", key: "language", label: "Language", type: "select", defaultValue: "Auto-detect", options: ["Auto-detect", "English", "Spanish", "French", "German"] },
  { category: "general", key: "dictation", label: "Enable Dictation", description: "Use dictation in the chat composer.", type: "toggle", defaultValue: true },
  { category: "general", key: "spokenLanguage", label: "Spoken language", description: "For best results, select the language you mainly speak.", type: "select", defaultValue: "Auto-detect", options: ["Auto-detect", "English", "Spanish", "French", "German"] },
  { category: "general", key: "voice", label: "Voice", description: "Preview and choose the default voice for read-aloud and voice mode.", type: "select", defaultValue: "Spruce", options: ["Spruce", "Juniper", "Ember", "Cove", "Maple"] },

  { category: "notifications", key: "codex", label: "Codex tasks", description: "Get notified about code/build tasks.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "groupChats", label: "Group chats", description: "Receive notifications for new messages from group chats.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "projects", label: "Projects", description: "Get notified when you receive an invitation to a shared project.", type: "select", defaultValue: "Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "dailyUpdates", label: "Pulse daily updates", description: "Receive a morning summary when something new needs attention.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "tasks", label: "Pulse tasks", description: "Get notified when scheduled tasks you created have updates.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "recommendations", label: "Recommendations", description: "Stay in the loop on new tools, tips, and features from Streams.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "responses", label: "Responses", description: "Get notified when long-running research, image, video, or build requests finish.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "usage", label: "Usage", description: "Get notified when limits reset or when usage credits are low.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "billing", label: "Billing", description: "Get payment, invoice, subscription, and spend-limit notices.", type: "select", defaultValue: "Email", options: ["Off", "Push", "Email", "Push, Email"] },

  { category: "personalization", key: "tone", label: "Assistant tone", description: "Choose the default response style.", type: "select", defaultValue: "Balanced", options: ["Direct", "Balanced", "Detailed", "Creative"] },
  { category: "personalization", key: "memory", label: "Project memory", description: "Let Streams use saved project context when answering.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "previewMode", label: "Inline preview behavior", description: "Choose how previews appear while you build.", type: "select", defaultValue: "Concept + progress", options: ["Off", "Concept only", "Concept + progress", "Always show"] },
  { category: "personalization", key: "defaultMode", label: "Default workspace mode", type: "select", defaultValue: "Chat", options: ["Chat", "Generate", "Build", "Editor", "Research"] },

  { category: "apps", key: "github", label: "GitHub", description: "Connect repositories for code, builds, and project work.", type: "button", defaultValue: "Setup required", actionLabel: "Connect" },
  { category: "apps", key: "google", label: "Google Workspace", description: "Connect calendar, files, contacts, and mail when available.", type: "button", defaultValue: "Setup required", actionLabel: "Connect" },
  { category: "apps", key: "domains", label: "Domains", description: "Connect domain and deployment providers.", type: "button", defaultValue: "Setup required", actionLabel: "Connect" },
  { category: "apps", key: "apiKeys", label: "Provider keys", description: "Manage connected provider keys and integrations.", type: "button", defaultValue: "Setup required", actionLabel: "Manage" },

  { category: "schedules", key: "dailyBrief", label: "Daily brief", description: "Receive daily build/project summary.", type: "select", defaultValue: "Off", options: ["Off", "Morning", "Afternoon", "Evening"] },
  { category: "schedules", key: "taskDigest", label: "Task digest", description: "Choose how often task updates are bundled.", type: "select", defaultValue: "Daily", options: ["Off", "Daily", "Weekly"] },
  { category: "schedules", key: "automationChecks", label: "Automation checks", description: "Allow recurring checks for watched tasks.", type: "toggle", defaultValue: true },

  { category: "billing", key: "billingCenter", label: "Billing center", description: "Open plan, invoice, and payment method controls.", type: "button", defaultValue: "Setup ready", actionLabel: "Open" },
  { category: "billing", key: "autoReload", label: "Usage credit auto-reload", description: "Automatically add usage credits when balance gets low.", type: "toggle", defaultValue: false },
  { category: "billing", key: "monthlySpendLimit", label: "Monthly spend limit", description: "Protect paid usage with a monthly cap.", type: "select", defaultValue: "$100", options: ["$0", "$50", "$100", "$250", "$500", "$1000"] },
  { category: "billing", key: "invoiceDelivery", label: "Invoice delivery", type: "select", defaultValue: "Email", options: ["Off", "Email"] },

  { category: "data-controls", key: "exportData", label: "Export data", description: "Request a copy of account, project, chat, and asset metadata.", type: "button", defaultValue: "Setup ready", actionLabel: "Request export" },
  { category: "data-controls", key: "chatRetention", label: "Chat retention", description: "Choose how long account chat history is retained.", type: "select", defaultValue: "Until deleted", options: ["30 days", "90 days", "1 year", "Until deleted"] },
  { category: "data-controls", key: "trainingPreference", label: "Improve models for this account", description: "Allow or disable future product improvement use where supported.", type: "toggle", defaultValue: false },
  { category: "data-controls", key: "deleteAccount", label: "Delete account", description: "Protected destructive action that requires account verification.", type: "danger", defaultValue: "Protected", actionLabel: "Start deletion" },

  { category: "storage", key: "assetRetention", label: "Generated asset retention", type: "select", defaultValue: "Until deleted", options: ["30 days", "90 days", "1 year", "Until deleted"] },
  { category: "storage", key: "downloadOriginals", label: "Keep downloadable originals", type: "toggle", defaultValue: true },
  { category: "storage", key: "storageCleanup", label: "Storage cleanup", description: "Review old generated assets and unused uploads.", type: "button", defaultValue: "Ready", actionLabel: "Review" },

  { category: "security", key: "mfa", label: "Multi-factor authentication", description: "Add an authenticator app or text-based verification when supported.", type: "button", defaultValue: "Setup ready", actionLabel: "Set up MFA" },
  { category: "security", key: "activeSessions", label: "Active sessions", description: "Review devices and sessions signed in to this account.", type: "button", defaultValue: "Ready", actionLabel: "Review" },
  { category: "security", key: "securityAlerts", label: "Security alerts", description: "Receive alerts for important account security events.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },

  { category: "trusted-contact", key: "contactEmail", label: "Trusted contact email", description: "Email for critical recovery and account safety notices.", type: "text", defaultValue: "" },
  { category: "trusted-contact", key: "recoveryAllowed", label: "Allow recovery contact", description: "Let the trusted contact help with account recovery when supported.", type: "toggle", defaultValue: false },

  { category: "account", key: "displayName", label: "Display name", type: "text", defaultValue: "" },
  { category: "account", key: "workspaceName", label: "Default workspace name", type: "text", defaultValue: "Personal workspace" },
  { category: "account", key: "accountStatus", label: "Account status", type: "button", defaultValue: "Active", actionLabel: "View status" },
];

export function getSettingsForCategory(category: StreamsSettingsCategory) {
  return STREAMS_SETTING_DEFINITIONS.filter((definition) => definition.category === category);
}

export function getSettingDefinition(category: string, settingKey: string) {
  return STREAMS_SETTING_DEFINITIONS.find((definition) => definition.category === category && definition.key === settingKey) || null;
}
