import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

// Initialize OpenAI client
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateObjectFromPrompt<T extends z.ZodTypeAny>({
  prompt,
  systemPrompt,
  schema,
  model = 'gpt-4o-mini',
}: {
  prompt: string;
  systemPrompt: string;
  schema: T;
  model?: string;
}): Promise<z.infer<T>> {
  const { object } = await generateObject({
    model: openai(model),
    schema,
    prompt,
    system: systemPrompt,
  });
  return object;
}
