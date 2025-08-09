import { z } from 'zod';
import { generateObjectFromPrompt } from '../api';
import { LanguageModel } from 'ai';

const snippetSchema = z.object({
  language: z
    .string()
    .describe(
      'The language of the code (e.g., "typescript") or a type descriptor for non-code (e.g., "APIDOC").',
    ),
  code: z
    .string()
    .describe(
      'The verbatim content of the snippet, which could be code, an API list, or text.',
    ),
});

const semanticChunkSchema = z.object({
  title: z
    .string()
    .describe(
      'The contextual title for the snippet, often from a markdown heading.',
    ),
  description: z
    .string()
    .describe(
      'A concise, descriptive summary of the concept covered by the chunk.',
    ),
  snippets: z
    .array(snippetSchema)
    .describe(
      'An array of one or more related snippets, each with its own language and code.',
    ),
});

const extractionSchema = z.object({
  chunks: z.array(semanticChunkSchema),
});

/**
 * Splits a markdown document into semantic chunks using an LLM.
 * The goal is to keep related content, especially code examples and their explanations, together.
 * @param {string} markdownContent - The raw markdown content of the document.
 * @param {LanguageModel} [model] - The language model to use for extraction.
 * @param {string} [additionalInstructions] - Additional instructions from the user to customize the chunking process.
 * @returns {Promise<z.infer<typeof semanticChunkSchema>[]>} A promise that resolves to an array of semantic chunks.
 */
export async function extractSemanticChunksFromMarkdown(
  markdownContent: string,
  additionalInstructions?: string,
  model?: LanguageModel,
): Promise<z.infer<typeof semanticChunkSchema>[]> {
  let systemPrompt = `You are an expert in technical documentation analysis. Your task is to split a code documentation markdown into semantic chunks, where each chunk ideally represents a single concept followed by code examples or API Docs.

  **CRITICAL: Context Preservation**
  - **Include ALL explanatory text** that provides context for code blocks - this includes setup instructions, parameter explanations, usage notes, warnings, and follow-up explanations
  - **Preserve surrounding paragraphs** that explain what the code does, why it's useful, or how it fits into the larger system
  - **Don't truncate explanations** - if there's explanatory text before or after code, include it in the description or as part of the snippets

  **Target Audience is an LLM:** Each chunk must be completely self-contained. An LLM reading this chunk should understand the full context without needing other chunks.

  **Instructions:**
  1. **Analyze the Document:** Read through the entire markdown document to understand its structure, topics, and content flow.
  2. **Identify Code-Centric Concepts:** Group related content around code blocks and API documentation.
  3. **Create Valuable Chunks:** For each concept that contains code or API documentation:
     - \`title\`: Concise (3-8 words) descriptive title starting with action verb
     - \`description\`: Comprehensive summary (2-5 sentences) including ALL setup context, explanations, warnings, usage notes, and contextual information
     - \`snippets\`: Code blocks and API documentation, with "text" snippets ONLY for transition explanations between multiple code blocks

  **CRITICAL - Snippet Format Requirements:**
  - EVERY snippet MUST be a JSON object with exactly 2 fields: {"language": "...", "code": "..."}
  - For code blocks: {"language": "typescript", "code": "actual code here"}
  - For explanatory text: {"language": "text", "code": "explanation text here"}
  - For API docs: {"language": "APIDOCS", "code": "API documentation here"}
  - NEVER put raw strings in the snippets array - always use the object format

  **Each concept should include:**
  - title: A concise, action-oriented summary of the concept (3-8 words)
  - description: A comprehensive summary covering setup, purpose, parameters, usage notes, warnings, and contextual information
  - snippets: Code blocks and API documentation only, where each snippet includes:
      - language: "text" for transition explanations between multiple snippets, "APIDOCS" for API specifications/parameters/signatures, or the appropriate code language (e.g., "typescript")
      - code: The verbatim content - either transition explanations, API documentation, or code blocks without modifications

  **Context Handling:**
  - Put ALL explanatory text, setup instructions, warnings, and context into the description field
  - Only create "text" snippets for transition explanations between multiple code blocks
  - If you encounter partial explanations at the beginning or end of the document, include them in the description but note they may be incomplete
  - When code examples reference previous or upcoming sections, include those references in your description
  - If setup instructions span multiple sections, group them logically in the description

  **Chunk Boundaries:**
  - Only create chunks that contain actual code blocks or API documentation
  - Skip sections with only explanatory text - merge them into nearby chunks with code
  - Prefer larger, more comprehensive chunks over smaller fragmented ones
  - It's better to have one large chunk with complete context than multiple small chunks missing context
  - Only split when there's a clear conceptual boundary between different functionalities
  `;

  // Add additional instructions if provided
  if (additionalInstructions && additionalInstructions.trim()) {
    systemPrompt += `

  **ADDITIONAL INSTRUCTIONS:**
  ${additionalInstructions.trim()}
  `;
  }

  const prompt = `**Markdown Document to Chunk:**
---
${markdownContent}
---
`;

  try {
    const { chunks } = await generateObjectFromPrompt({
      prompt,
      systemPrompt,
      schema: extractionSchema,
      model,
    });

    // Validate and fix any malformed snippets
    const validatedChunks = chunks.map((chunk) => ({
      ...chunk,
      snippets: chunk.snippets.map((snippet) => {
        // If snippet is a string instead of object, wrap it properly
        if (typeof snippet === 'string') {
          return {
            language: 'text',
            code: snippet,
          };
        }
        return snippet;
      }),
    }));

    return validatedChunks;
  } catch (error) {
    console.error(
      'AI extraction failed, falling back to simple chunking:',
      error instanceof Error ? error.message : String(error),
    );
    // Do not insert fallback content. Propagate failure so the job is marked failed.
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`AI extraction failed: ${reason}`);
  }
}
