import 'dotenv/config';
import { createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';

// Initialize OpenAI client
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Groq client
export const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

// Define models
export const models = {
  'gpt-4.1-mini': openai('gpt-4.1-mini'),
  'meta-llama/llama-4-scout-17b-16e-instruct': groq(
    'meta-llama/llama-4-scout-17b-16e-instruct',
  ),
  'text-embedding-3-small': openai.embedding('text-embedding-3-small'),
};

// Default model
export const defaultModel = models['gpt-4.1-mini'];

// Function to get a model by name
export function getModel(modelName: keyof typeof models) {
  return models[modelName];
}
