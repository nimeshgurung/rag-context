import * as fs from 'fs/promises';
import * as path from 'path';
import { DocsSourcesConfig } from '../types';

export async function loadConfig(): Promise<DocsSourcesConfig> {
  const configPath = path.join(process.cwd(), 'config', 'docs-sources.json');
  try {
    const fileContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(fileContent) as DocsSourcesConfig;
  } catch (error) {
    console.error(
      `Error loading or parsing config file at ${configPath}:`,
      error,
    );
    throw error;
  }
}
