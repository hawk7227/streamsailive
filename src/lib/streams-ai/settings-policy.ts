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
  | "parental-controls"
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
  { id: "general", label: "General", icon: "gear", title: "General", description: "Appearance, language, dictation, voice, accessibility, and default assistant behavior." },
  { id: "notifications", label: "Notifications", icon: "bell", title: "Notifications", description: "Choose how Streams alerts you about chats, builds, scheduled tasks, usage, billing, and account security." },
  { id: "personalization", label: "Personalization", icon: "spark", title: "Personalization", description: "Control style, tone, custom instructions, memory, personal context, Pulse, web search, voice, and connected-source personalization." },
  { id: "apps", label: "Apps", icon: "apps", title: "Enabled apps", description: "Manage apps, connectors, tool permissions, repository access, and external-service approvals." },
  { id: "schedules", label: "Schedules", icon: "clock", title: "Schedules", description: "Manage reminders, recurring tasks, scheduled research, task suggestions, and delivery windows." },
  { id: "billing", label: "Billing", icon: "card", title: "Billing", description: "Manage plan, invoices, payment method, usage credits, auto-reload, and spend controls." },
  { id: "data-controls", label: "Data controls", icon: "database", title: "Data controls", description: "Control chat history, temporary chats, model-improvement preference, memory deletion, exports, retention, and connected app data." },
  { id: "storage", label: "Storage", icon: "box", title: "Storage", description: "Review files, generated assets, uploads, exports, storage limits, cache, and cleanup preferences." },
  { id: "security", label: "Security", icon: "key", title: "Security", description: "Manage MFA, sessions, passkeys, passwords, login alerts, approval gates, and audit logs." },
  { id: "parental-controls", label: "Parental controls", icon: "family", title: "Parental controls", description: "Configure guardian controls, age gate, spending limits, content restrictions, quiet hours, and teen safety defaults." },
  { id: "trusted-contact", label: "Trusted contact", icon: "life", title: "Trusted contact", description: "Choose recovery contacts and account-safety contacts for critical account events." },
  { id: "account", label: "Account", icon: "user", title: "Account", description: "Manage identity, profile, email, phone, workspace ownership, organization role, and account lifecycle controls." },
];

export const STREAMS_SETTING_DEFINITIONS: StreamsSettingDefinition[] = [
  // General
  { category: "general", key: "mfaPrompt", label: "Secure your account", description: "Add multi-factor authentication before high-risk account or builder actions.", type: "button", defaultValue: "Recommended", actionLabel: "Set up MFA" },
  { category: "general", key: "appearance", label: "Appearance", description: "Choose the default interface theme.", type: "select", defaultValue: "System", options: ["System", "Light", "Dark"] },
  { category: "general", key: "contrast", label: "Contrast", description: "Choose standard or high contrast for readability.", type: "select", defaultValue: "System", options: ["System", "Standard", "High contrast"] },
  { category: "general", key: "accentColor", label: "Accent color", description: "Choose the primary UI accent color.", type: "select", defaultValue: "Black", options: ["Black", "Blue", "Green", "Purple", "Orange", "Cyan", "Gold"] },
  { category: "general", key: "language", label: "Language", description: "Choose the interface language or let Streams detect it automatically.", type: "select", defaultValue: "Auto-detect", options: ["Auto-detect", "English", "Spanish", "French", "German", "Portuguese", "Japanese", "Korean"] },
  { category: "general", key: "timezone", label: "Timezone", description: "Used for reminders, resets, billing display, and scheduled tasks.", type: "select", defaultValue: "Auto-detect", options: ["Auto-detect", "America/Phoenix", "America/Los_Angeles", "America/Chicago", "America/New_York", "UTC"] },
  { category: "general", key: "density", label: "Display density", description: "Control how compact settings, chats, cards, and editor panels appear.", type: "select", defaultValue: "Comfortable", options: ["Compact", "Comfortable", "Spacious"] },
  { category: "general", key: "dictation", label: "Enable Dictation", description: "Use dictation in the chat composer.", type: "toggle", defaultValue: true },
  { category: "general", key: "spokenLanguage", label: "Spoken language", description: "For best results, select the language you mainly speak.", type: "select", defaultValue: "Auto-detect", options: ["Auto-detect", "English", "Spanish", "French", "German", "Portuguese", "Japanese", "Korean"] },
  { category: "general", key: "voice", label: "Voice", description: "Preview and choose the default voice for read-aloud and voice mode.", type: "select", defaultValue: "Spruce", options: ["Spruce", "Juniper", "Ember", "Cove", "Maple"] },
  { category: "general", key: "separateVoice", label: "Separate Voice", description: "Keep voice mode in a separate full-screen experience without live transcripts and visuals.", type: "toggle", defaultValue: false },
  { category: "general", key: "defaultLanding", label: "Default landing view", description: "Choose what opens first when you enter Streams.", type: "select", defaultValue: "Chat", options: ["Chat", "Workspace", "Builder", "Usage", "Projects"] },

  // Notifications
  { category: "notifications", key: "responses", label: "Responses", description: "Get notified when long-running research, image, video, or build requests finish.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "codex", label: "Code/build tasks", description: "Get notified about code, repository, preview, and build task progress.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "projects", label: "Projects", description: "Get notified when you receive an invitation, comment, approval request, or project update.", type: "select", defaultValue: "Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "schedules", label: "Scheduled tasks", description: "Get alerts when reminders, recurring checks, or scheduled reports run.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "pulseDaily", label: "Pulse daily updates", description: "Receive a morning summary when something new needs attention.", type: "select", defaultValue: "Push", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "usage", label: "Usage and credits", description: "Get warnings when limits are near, reset, or paid credits are low.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "billing", label: "Billing", description: "Get payment, invoice, subscription, auto-reload, and spend-limit notices.", type: "select", defaultValue: "Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "security", label: "Security", description: "Receive login, MFA, trusted contact, and high-risk action alerts.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "recommendations", label: "Product tips", description: "Stay in the loop on new tools, tips, and features from Streams.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "notifications", key: "quietHours", label: "Quiet hours", description: "Pause non-critical notifications during selected hours.", type: "select", defaultValue: "Off", options: ["Off", "10 PM - 7 AM", "11 PM - 8 AM", "Custom"] },

  // Personalization
  { category: "personalization", key: "baseStyleTone", label: "Base style and tone", description: "Set the style and tone of how Streams responds. This does not reduce capabilities.", type: "select", defaultValue: "Default", options: ["Default", "Direct", "Warm", "Professional", "Creative", "Technical", "Concise"] },
  { category: "personalization", key: "warm", label: "Warm", description: "Make responses feel more personable without losing precision.", type: "select", defaultValue: "Default", options: ["Default", "Low", "Medium", "High"] },
  { category: "personalization", key: "enthusiastic", label: "Enthusiastic", description: "Control how much motivational energy the assistant uses.", type: "select", defaultValue: "Default", options: ["Default", "Low", "Medium", "High"] },
  { category: "personalization", key: "headersLists", label: "Headers & Lists", description: "Control how often responses use headers and lists.", type: "select", defaultValue: "Default", options: ["Default", "Less", "Balanced", "More"] },
  { category: "personalization", key: "emoji", label: "Emoji", description: "Control emoji usage in normal replies and summaries.", type: "select", defaultValue: "Default", options: ["Default", "Never", "Low", "Medium"] },
  { category: "personalization", key: "fastAnswers", label: "Fast answers", description: "Allow faster general answers when deep personalized context is not needed.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "customInstructions", label: "Custom instructions", description: "Additional behavior, style, and tone preferences.", type: "text", defaultValue: "" },
  { category: "personalization", key: "nickname", label: "Nickname", description: "What should Streams call you?", type: "text", defaultValue: "" },
  { category: "personalization", key: "occupation", label: "Occupation", description: "Used to personalize builder, research, and planning responses.", type: "text", defaultValue: "" },
  { category: "personalization", key: "moreAboutYou", label: "More about you", description: "Interests, values, or preferences to keep in mind.", type: "text", defaultValue: "" },
  { category: "personalization", key: "referenceSavedMemories", label: "Reference saved memories", description: "Let Streams save and use memories when responding.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "referenceChatHistory", label: "Reference chat history", description: "Let Streams reference previous conversations when helpful.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "memorySources", label: "Memory sources", description: "Show which saved memories, chats, files, or connected apps informed personalized answers.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "manageMemory", label: "Manage memory", description: "Review, prioritize, edit, delete, or restore saved memories.", type: "button", defaultValue: "Ready", actionLabel: "Manage" },
  { category: "personalization", key: "memoryInSuggestions", label: "Reference Memory in suggestions", description: "Let Streams use memories proactively in suggestions and Pulse-style briefings.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "showPulse", label: "Show Pulse in new chats", description: "Show proactive project, research, and build suggestions in new chats.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "webSearch", label: "Web search", description: "Let Streams automatically search the web when current information is needed.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "canvas", label: "Canvas", description: "Collaborate with Streams on text, code, plans, specs, and artifacts in an editable workspace.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "chatVoice", label: "Chat voice", description: "Enable voice conversations inside Streams.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "advancedVoice", label: "Advanced voice", description: "Use more natural, interruption-ready voice conversations when available.", type: "toggle", defaultValue: true },
  { category: "personalization", key: "connectorSearch", label: "Connector search", description: "Let Streams search connected sources when those sources are relevant to your request.", type: "toggle", defaultValue: false },
  { category: "personalization", key: "temporaryChatDefault", label: "Temporary chat default", description: "Start new chats without saving history or updating memory by default.", type: "toggle", defaultValue: false },

  // Apps
  { category: "apps", key: "enabledApps", label: "Enabled apps", description: "Manage enabled apps Streams can use in your chats.", type: "button", defaultValue: "Ready", actionLabel: "Manage" },
  { category: "apps", key: "github", label: "GitHub", description: "Connect repositories for code, builds, project work, issues, and pull requests.", type: "button", defaultValue: "Connected", actionLabel: "Manage" },
  { category: "apps", key: "googleWorkspace", label: "Google Workspace", description: "Connect Gmail, Calendar, Drive, Docs, Contacts, and Sheets when available.", type: "button", defaultValue: "Ready", actionLabel: "Connect" },
  { category: "apps", key: "slack", label: "Slack", description: "Connect project channels, team messages, and workspace context.", type: "button", defaultValue: "Ready", actionLabel: "Connect" },
  { category: "apps", key: "notion", label: "Notion", description: "Connect docs, databases, tasks, and product planning spaces.", type: "button", defaultValue: "Ready", actionLabel: "Connect" },
  { category: "apps", key: "linearJira", label: "Linear / Jira", description: "Connect tickets, roadmaps, bugs, and delivery workflows.", type: "button", defaultValue: "Ready", actionLabel: "Connect" },
  { category: "apps", key: "figmaCanva", label: "Figma / Canva", description: "Connect design files, templates, and brand assets.", type: "button", defaultValue: "Ready", actionLabel: "Connect" },
  { category: "apps", key: "vercelSupabase", label: "Vercel / Supabase", description: "Connect deployment, database, storage, and project infrastructure.", type: "button", defaultValue: "Ready", actionLabel: "Connect" },
  { category: "apps", key: "connectorSearch", label: "Search connected sources", description: "Allow connected apps to be searched when relevant to your request.", type: "toggle", defaultValue: false },
  { category: "apps", key: "approvalMode", label: "App approval mode", description: "Choose when Streams must ask before using connected apps.", type: "select", defaultValue: "Ask before external actions", options: ["Always ask", "Ask before external actions", "Ask before writes", "Allow read-only"] },
  { category: "apps", key: "revokeAll", label: "Revoke all app access", description: "Disconnect all apps and remove connected-source permissions.", type: "danger", defaultValue: "Protected", actionLabel: "Start revoke" },

  // Schedules
  { category: "schedules", key: "taskManagement", label: "Task management", description: "Create, edit, pause, resume, and delete one-time or recurring tasks.", type: "button", defaultValue: "Ready", actionLabel: "Open tasks" },
  { category: "schedules", key: "taskSuggestions", label: "Task suggestions", description: "Let Streams suggest reminders or recurring tasks based on conversations, requiring your approval.", type: "toggle", defaultValue: true },
  { category: "schedules", key: "dailyBrief", label: "Daily brief", description: "Receive daily build, project, schedule, and account summary.", type: "select", defaultValue: "Off", options: ["Off", "Morning", "Afternoon", "Evening"] },
  { category: "schedules", key: "taskDigest", label: "Task digest", description: "Choose how often task updates are bundled.", type: "select", defaultValue: "Daily", options: ["Off", "Daily", "Weekly"] },
  { category: "schedules", key: "recurringChecks", label: "Recurring checks", description: "Allow scheduled checks for watched tasks, usage, deployments, and research updates.", type: "toggle", defaultValue: true },
  { category: "schedules", key: "scheduledWebResearch", label: "Scheduled web research", description: "Let scheduled tasks browse for updates when web access is needed.", type: "toggle", defaultValue: true },
  { category: "schedules", key: "calendarSync", label: "Calendar sync", description: "Show schedules alongside connected calendar events when available.", type: "toggle", defaultValue: false },
  { category: "schedules", key: "defaultReminderChannel", label: "Default reminder channel", description: "Choose where task reminders are delivered.", type: "select", defaultValue: "Push", options: ["Push", "Email", "Push, Email", "In-app only"] },
  { category: "schedules", key: "activeTaskLimit", label: "Active task limit", description: "Control how many active automations can run at once.", type: "select", defaultValue: "10", options: ["5", "10", "25", "50"] },

  // Billing
  { category: "billing", key: "billingCenter", label: "Billing center", description: "Open plan, invoice, and payment method controls.", type: "button", defaultValue: "Ready", actionLabel: "Open" },
  { category: "billing", key: "currentPlan", label: "Current plan", description: "View the current plan and included usage.", type: "button", defaultValue: "Active", actionLabel: "View" },
  { category: "billing", key: "paymentMethod", label: "Payment method", description: "Manage the payment method used for plan and paid usage credits.", type: "button", defaultValue: "Needs payment method", actionLabel: "Manage" },
  { category: "billing", key: "usageCreditAutoReload", label: "Usage credit auto-reload", description: "Automatically add usage credits when balance gets low.", type: "toggle", defaultValue: false },
  { category: "billing", key: "reloadThreshold", label: "Auto-reload threshold", description: "Set the paid credit balance that triggers auto-reload.", type: "select", defaultValue: "$10", options: ["$5", "$10", "$25", "$50", "$100"] },
  { category: "billing", key: "reloadAmount", label: "Auto-reload amount", description: "Set how many credits are added when auto-reload runs.", type: "select", defaultValue: "$50", options: ["$25", "$50", "$100", "$250", "$500"] },
  { category: "billing", key: "monthlySpendLimit", label: "Monthly spend limit", description: "Protect paid usage with a monthly cap.", type: "select", defaultValue: "$100", options: ["$0", "$50", "$100", "$250", "$500", "$1000", "Unlimited"] },
  { category: "billing", key: "invoiceDelivery", label: "Invoice delivery", description: "Choose where receipts and invoices are sent.", type: "select", defaultValue: "Email", options: ["Off", "Email", "Email and workspace"] },
  { category: "billing", key: "billingAlerts", label: "Billing alerts", description: "Notify before renewals, failed payments, and spend-limit blocks.", type: "toggle", defaultValue: true },

  // Data controls
  { category: "data-controls", key: "chatHistory", label: "Chat history", description: "Save chats in history unless you use a temporary chat.", type: "toggle", defaultValue: true },
  { category: "data-controls", key: "temporaryChats", label: "Temporary chats", description: "Use chats that do not appear in history and do not update memory.", type: "button", defaultValue: "Available", actionLabel: "Start temporary chat" },
  { category: "data-controls", key: "trainingPreference", label: "Improve the model for everyone", description: "Allow or disable future product-improvement use where supported.", type: "toggle", defaultValue: false },
  { category: "data-controls", key: "memoryDeletion", label: "Delete memories", description: "Delete saved memories and review memory sources tied to chats, files, and apps.", type: "button", defaultValue: "Ready", actionLabel: "Manage" },
  { category: "data-controls", key: "fileLibraryData", label: "File library data", description: "Control whether uploaded files can be searched for personalization and project answers.", type: "toggle", defaultValue: true },
  { category: "data-controls", key: "connectedAppData", label: "Connected app data", description: "Manage app data used for personalization, answers, and search.", type: "button", defaultValue: "Ready", actionLabel: "Manage apps" },
  { category: "data-controls", key: "chatRetention", label: "Chat retention", description: "Choose how long account chat history is retained.", type: "select", defaultValue: "Until deleted", options: ["30 days", "90 days", "1 year", "Until deleted"] },
  { category: "data-controls", key: "exportData", label: "Export data", description: "Request a copy of account, project, chat, file, memory, and asset metadata.", type: "button", defaultValue: "Ready", actionLabel: "Request export" },
  { category: "data-controls", key: "deleteAccountData", label: "Delete account data", description: "Protected destructive action that requires account verification.", type: "danger", defaultValue: "Protected", actionLabel: "Start deletion" },

  // Storage
  { category: "storage", key: "storageOverview", label: "Storage overview", description: "Review file library, generated assets, exports, and project storage usage.", type: "button", defaultValue: "Ready", actionLabel: "Review" },
  { category: "storage", key: "fileLibraryRetention", label: "File library retention", description: "Choose how long uploaded files remain available.", type: "select", defaultValue: "Until deleted", options: ["30 days", "90 days", "1 year", "Until deleted"] },
  { category: "storage", key: "assetRetention", label: "Generated asset retention", description: "Choose how long generated images, videos, audio, and documents are retained.", type: "select", defaultValue: "Until deleted", options: ["30 days", "90 days", "1 year", "Until deleted"] },
  { category: "storage", key: "downloadOriginals", label: "Keep downloadable originals", description: "Keep original outputs available for download when storage allows.", type: "toggle", defaultValue: true },
  { category: "storage", key: "autoCleanup", label: "Auto-cleanup old drafts", description: "Automatically remove old temporary previews and drafts.", type: "toggle", defaultValue: false },
  { category: "storage", key: "exportHistory", label: "Export history", description: "Review download and export history.", type: "button", defaultValue: "Ready", actionLabel: "Open" },
  { category: "storage", key: "clearCache", label: "Clear local cache", description: "Clear local previews, thumbnails, and temporary workspace cache.", type: "button", defaultValue: "Ready", actionLabel: "Clear" },

  // Security
  { category: "security", key: "mfa", label: "Multi-factor authentication", description: "Add an authenticator app or text-based verification when supported.", type: "button", defaultValue: "Recommended", actionLabel: "Set up MFA" },
  { category: "security", key: "passkeys", label: "Passkeys", description: "Use device-bound sign-in where supported.", type: "button", defaultValue: "Ready", actionLabel: "Manage" },
  { category: "security", key: "password", label: "Password", description: "Change or reset your password.", type: "button", defaultValue: "Ready", actionLabel: "Change" },
  { category: "security", key: "activeSessions", label: "Active sessions", description: "Review devices and sessions signed in to this account.", type: "button", defaultValue: "Ready", actionLabel: "Review" },
  { category: "security", key: "loginAlerts", label: "Login alerts", description: "Receive alerts for new sign-ins and suspicious activity.", type: "select", defaultValue: "Push, Email", options: ["Off", "Push", "Email", "Push, Email"] },
  { category: "security", key: "highRiskApprovals", label: "High-risk action approvals", description: "Require approval before deployments, deletes, billing actions, or connected-app writes.", type: "toggle", defaultValue: true },
  { category: "security", key: "builderSandbox", label: "Builder action sandbox", description: "Keep code, website, and launch actions isolated before approval.", type: "toggle", defaultValue: true },
  { category: "security", key: "connectedAppApprovals", label: "Connected app approvals", description: "Ask before apps read, write, send, delete, or deploy anything.", type: "select", defaultValue: "Ask before writes", options: ["Always ask", "Ask before external actions", "Ask before writes", "Allow read-only"] },
  { category: "security", key: "securityLog", label: "Security log", description: "Review recent sign-ins, setting changes, app approvals, and protected actions.", type: "button", defaultValue: "Ready", actionLabel: "View log" },
  { category: "security", key: "signOutEverywhere", label: "Sign out everywhere", description: "End all active sessions except this one after confirmation.", type: "danger", defaultValue: "Protected", actionLabel: "Start" },

  // Parental controls
  { category: "parental-controls", key: "teenMode", label: "Teen safety mode", description: "Use age-appropriate defaults and stronger safeguards for teen accounts.", type: "toggle", defaultValue: false },
  { category: "parental-controls", key: "guardianEmail", label: "Guardian email", description: "Parent or guardian email for safety notices and approvals.", type: "text", defaultValue: "" },
  { category: "parental-controls", key: "contentRestrictions", label: "Sensitive content controls", description: "Limit sensitive content, mature topics, and unsafe outputs.", type: "select", defaultValue: "Standard", options: ["Standard", "Strict", "Teen", "Custom"] },
  { category: "parental-controls", key: "spendingControls", label: "Spending controls", description: "Require approval before plan upgrades, paid credits, or launches.", type: "select", defaultValue: "Require approval", options: ["Off", "Notify only", "Require approval", "Blocked"] },
  { category: "parental-controls", key: "timeWindows", label: "Use time windows", description: "Limit chat, voice, generation, and builder access by time of day.", type: "select", defaultValue: "Off", options: ["Off", "School nights", "Weekends only", "Custom"] },
  { category: "parental-controls", key: "appRestrictions", label: "App restrictions", description: "Restrict external apps, connector search, and write actions.", type: "select", defaultValue: "Ask before external actions", options: ["Off", "Ask before external actions", "Read-only", "Blocked"] },
  { category: "parental-controls", key: "guardianReports", label: "Guardian reports", description: "Send summary reports about usage, spending, schedules, and safety events.", type: "select", defaultValue: "Off", options: ["Off", "Weekly", "Monthly", "Important alerts only"] },

  // Trusted contact
  { category: "trusted-contact", key: "contactEmail", label: "Trusted contact email", description: "Email for critical recovery and account safety notices.", type: "text", defaultValue: "" },
  { category: "trusted-contact", key: "recoveryAllowed", label: "Allow recovery contact", description: "Let the trusted contact help with account recovery when supported.", type: "toggle", defaultValue: false },
  { category: "trusted-contact", key: "criticalAlerts", label: "Critical alerts", description: "Notify trusted contact about suspicious sign-ins, lockouts, and protected account events.", type: "toggle", defaultValue: true },
  { category: "trusted-contact", key: "spendLimitAlerts", label: "Spend-limit alerts", description: "Notify trusted contact when spend limits are reached or changed.", type: "toggle", defaultValue: false },
  { category: "trusted-contact", key: "approvalDelay", label: "Recovery delay", description: "Delay sensitive recovery changes to protect against account takeover.", type: "select", defaultValue: "24 hours", options: ["None", "12 hours", "24 hours", "72 hours"] },
  { category: "trusted-contact", key: "removeContact", label: "Remove trusted contact", description: "Remove recovery and safety-contact access after confirmation.", type: "danger", defaultValue: "Protected", actionLabel: "Remove" },

  // Account
  { category: "account", key: "displayName", label: "Display name", description: "Name shown across Streams account and workspace surfaces.", type: "text", defaultValue: "" },
  { category: "account", key: "email", label: "Email", description: "Primary account email for sign-in, notices, and receipts.", type: "button", defaultValue: "Ready", actionLabel: "Manage" },
  { category: "account", key: "phone", label: "Phone number", description: "Phone number used for account recovery, MFA, and urgent alerts when supported.", type: "button", defaultValue: "Ready", actionLabel: "Manage" },
  { category: "account", key: "workspaceName", label: "Default workspace name", description: "Name of your default Streams workspace.", type: "text", defaultValue: "Personal workspace" },
  { category: "account", key: "role", label: "Workspace role", description: "Your current role and workspace ownership status.", type: "button", defaultValue: "Owner", actionLabel: "View" },
  { category: "account", key: "organization", label: "Organization", description: "Company, team, or creator workspace connected to this account.", type: "text", defaultValue: "" },
  { category: "account", key: "accountStatus", label: "Account status", description: "Review account health, plan access, and capability availability.", type: "button", defaultValue: "Active", actionLabel: "View status" },
  { category: "account", key: "downloadProfile", label: "Download account profile", description: "Download profile, plan, and preference metadata.", type: "button", defaultValue: "Ready", actionLabel: "Download" },
  { category: "account", key: "deleteAccount", label: "Delete account", description: "Permanently delete this account after verification and retention checks.", type: "danger", defaultValue: "Protected", actionLabel: "Start deletion" },
];

export function getSettingsForCategory(category: StreamsSettingsCategory) {
  return STREAMS_SETTING_DEFINITIONS.filter((definition) => definition.category === category);
}

export function getSettingDefinition(category: string, settingKey: string) {
  return STREAMS_SETTING_DEFINITIONS.find((definition) => definition.category === category && definition.key === settingKey) || null;
}
