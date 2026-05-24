import OpenAI from "openai";

export async function generateAITitle(content: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback to simple slicing if OpenAI is not configured
    const clean = content.replace(/\s+/g, " ").trim();
    if (!clean) return "New Chat";
    return clean.length > 30 ? `${clean.slice(0, 30)}…` : clean;
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a concise title generator. Summarize the following user prompt into a short, concise, engaging conversation title of 2 to 4 words. Do not use quotes, punctuation, or generic terms like 'Request' or 'Title'."
        },
        { role: "user", content }
      ],
      max_tokens: 15,
      temperature: 0.7,
    });

    const title = response.choices[0]?.message?.content?.trim() || "";
    return title.replace(/['"]+/g, "") || "New Chat";
  } catch (error) {
    console.error("[title-generator] Failed to generate AI title:", error);
    const clean = content.replace(/\s+/g, " ").trim();
    return clean.length > 30 ? `${clean.slice(0, 30)}…` : clean;
  }
}
