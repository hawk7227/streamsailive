export type VisionsMode = "off" | "ask_first" | "automatic";

export type VisionsMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type VisionsPreviewSpec = {
  id: string;
  title: string;
  eyebrow: string;
  headline: string;
  subheadline: string;
  primaryCta: string;
  secondaryCta: string;
  accent: string;
  atmosphere: string;
  futureSelf: string;
  environment: string;
  motion: string;
  emotionalOutcome: string;
  revealMs: number;
  sections: Array<{ title: string; body: string }>;
};

export type VisionsConversation = {
  id: string;
  title: string;
  mode: VisionsMode;
  messages: VisionsMessage[];
  activePreview: VisionsPreviewSpec | null;
  createdAt: string;
  updatedAt: string;
};

export type VisionsMessageResponse = {
  conversationId: string;
  message: VisionsMessage;
  preview: VisionsPreviewSpec | null;
};
