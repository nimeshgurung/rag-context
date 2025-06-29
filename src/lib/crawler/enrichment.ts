import { z } from 'zod';
import { generateObjectFromPrompt } from '../api';
import { EnrichedItem } from '../types';

/**
 * Enriches a code snippet with a title and description using an LLM.
 * @param {string} code - The clean code snippet.
 * @param {string} contextMarkdown - The surrounding documentation context in Markdown.
 * @returns {Promise<object>} A promise that resolves to the enriched data object.
 */
export async function getEnrichedDataFromLLM(
  code: string,
  contextMarkdown: string,
): Promise<EnrichedItem> {
  const systemPrompt = `You are an expert programmer and technical writer.
Your task is to generate a concise, informative title and a brief description for a given code snippet.
You will be provided with the code snippet and the surrounding markdown content from the documentation page where it was found.

**Instructions:**
1.  **Analyze the Code:** Understand the purpose of the code snippet. What does it do? What concepts does it demonstrate?
2.  **Analyze the Context:** Read the surrounding markdown to understand the broader context. The title and description should be relevant to this context.
3.  **Generate Title:** Create a short, descriptive title (5-10 words). The title should be easy to understand and should summarize the main purpose of the code.
4.  **Generate Description:** Write a brief description (1-3 sentences). The description should explain what the code does and how it relates to the documentation's topic. Mention any important functions, classes, or concepts demonstrated.
5.  **Identify Language:** Determine the programming language of the snippet (e.g., "typescript", "javascript", "python").
6.  **Output Format:** Respond with a JSON object with the following structure:
    {
      "title": "Your Generated Title",
      "description": "Your generated description.",
      "language": "The programming language you identified",
      "code": "Formatted code snippet with correct indentation and return it."
    }`;

  const prompt = `**Context from Documentation Page:**
---
${contextMarkdown}
---

**Code Snippet:**
\`\`\`
${code}
\`\`\``;

  const object = await generateObjectFromPrompt({
    prompt,
    systemPrompt,
    schema: z.object({
      title: z.string(),
      description: z.string(),
      language: z.string(),
      formattedCode: z.string(),
    }),
  });

  return { ...object, code: object.formattedCode };
}
