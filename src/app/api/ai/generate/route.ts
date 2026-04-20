import { NextRequest, NextResponse } from 'next/server';
import { toErrorMessage } from "@/lib/utils/error";
import OpenAI from 'openai';
import { getSiteConfigSync } from '@/lib/config';
import { OPENAI_API_KEY } from "@/lib/env";

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { prompt, maxTokens = 100 } = await request.json();

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt is required' },
                { status: 400 }
            );
        }

        if (!OPENAI_API_KEY) {
            return NextResponse.json(
                { error: 'OpenAI API key is not configured' },
                { status: 500 }
            );
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: getSiteConfigSync().marketingCopywriterPrompt
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: maxTokens,
            temperature: 0.7,
        });

        const content = completion.choices[0]?.message?.content || '';

        return NextResponse.json({ content });
    } catch (error: unknown) {
        console.error('OpenAI API error:', error);
        return NextResponse.json(
            { error: toErrorMessage(error) || 'Failed to generate content' },
            { status: 500 }
        );
    }
}
