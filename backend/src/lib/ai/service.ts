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

const HeaderAnalysisSchema = z.object({
  recommendedHeaderLevels: z.array(
    z.object({
      level: z.number().min(1).max(6),
      symbol: z.string(),
      reasoning: z.string(),
    }),
  ),
  confidence: z.number().min(0).max(1),
  sampleSections: z.array(z.string()).max(3),
});

export async function analyzeMarkdownHeaders(markdown: string) {
  return generateObjectFromPrompt({
    prompt: `Analyze this markdown document and recommend optimal header levels for semantic chunking:

${markdown.substring(0, 8000)}${markdown.length > 8000 ? '...' : ''}`,

    systemPrompt: `You are analyzing markdown structure for semantic chunking. Your goal is to identify header levels that create meaningful, self-contained sections for RAG/embedding purposes.

Consider:
- Natural topic boundaries
- Section coherence and completeness
- Balanced chunk sizes (not too granular, not too broad)
- Hierarchical structure preservation

Recommend 1-3 header levels that best capture individual semantic units.`,

    schema: HeaderAnalysisSchema,
  });
}
