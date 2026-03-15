import { getSiteConfig } from '@/lib/config';

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AssistantContext {
  type: string;
  prompt: string;
  settings: Record<string, string>;
}

export interface AssistantAction {
  type: "update_prompt" | "update_settings";
  payload: any;
}

export interface AssistantResponse {
  reply: string;
  action?: AssistantAction;
}

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_prompt",
      description: "Update the user's prompt with improved or suggested text.",
      parameters: {
        type: "object",
        properties: {
          new_prompt: {
            type: "string",
            description: "The new prompt text to set.",
          },
        },
        required: ["new_prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_settings",
      description: "Update generation settings like aspect ratio, duration, or quality.",
      parameters: {
        type: "object",
        properties: {
          key: {
            type: "string",
            enum: ["aspectRatio", "duration", "quality", "style", "speed"],
            description: "The setting key to update.",
          },
          value: {
            type: "string",
            description: "The new value for the setting (e.g., '16:9', '16s', '4K Ultra HD', 'Cyberpunk', 'Fast').",
          },
        },
        required: ["key", "value"],
      },
    },
  },
];

const buildSystemPrompt = (context: AssistantContext) => {
  const config = getSiteConfig();
  const settingsInfo = Object.entries(context.settings)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  // Use the template from config, replacing placeholders
  return config.copilotAssistantPrompt
    .replace(/\{\{type\}\}/g, context.type)
    .replace(/\{\{prompt\}\}/g, context.prompt)
    .replace(/\{\{settings\}\}/g, settingsInfo);
};

export async function createAssistantChatResponse(
  messages: ChatMessage[],
  context: AssistantContext
): Promise<AssistantResponse> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const systemMessage: ChatMessage = {
    role: "system",
    content: buildSystemPrompt(context),
  };

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      tools: TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message ?? "OpenAI request failed");
  }

  const payload = await response.json();
  const choice = payload.choices?.[0];
  const message = choice?.message;

  if (!message) {
    throw new Error("OpenAI response missing content");
  }

  let reply = message.content || "";
  let action: AssistantAction | undefined;

  // Handle tool calls
  if (message.tool_calls?.length > 0) {
    const toolCall = message.tool_calls[0];
    const args = JSON.parse(toolCall.function.arguments);

    if (toolCall.function.name === "update_prompt") {
      action = { type: "update_prompt", payload: args.new_prompt };
      if (!reply) reply = "I've updated your prompt.";
    } else if (toolCall.function.name === "update_settings") {
      action = {
        type: "update_settings",
        payload: { key: args.key, value: args.value },
      };
      if (!reply) reply = `I've updated the ${args.key} to ${args.value}.`;
    }
  }

  return { reply, action };
}
