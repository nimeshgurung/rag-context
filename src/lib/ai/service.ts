import 'dotenv/config';
import { generateObject, LanguageModel } from 'ai';
import { z } from 'zod';
import { defaultModel } from './models';

export async function generateObjectFromPrompt<T extends z.ZodTypeAny>({
  prompt,
  systemPrompt,
  schema,
  model = defaultModel,
}: {
  prompt: string;
  systemPrompt: string;
  schema: T;
  model?: LanguageModel;
}): Promise<z.infer<T>> {
  const { object } = await generateObject({
    model,
    schema,
    prompt,
    system: systemPrompt,
  });
  return object;
}
