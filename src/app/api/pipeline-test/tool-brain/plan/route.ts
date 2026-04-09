import { NextResponse } from "next/server";
import { generatePlan } from "@/lib/pipeline-test/toolBrain";

export async function POST(req: Request) {
  const { prompt, mode } = await req.json();
  return NextResponse.json(generatePlan({ prompt, mode }));
}
