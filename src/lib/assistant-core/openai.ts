import "@/lib/env"; // validates required env vars at module load
import { OPENAI_API_KEY } from "@/lib/env";
import OpenAI from "openai";

export const client = new OpenAI({ apiKey: OPENAI_API_KEY });
