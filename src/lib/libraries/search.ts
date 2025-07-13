import { ragService } from '../rag/service';
import { LibrarySearchResult } from '../types';

export async function searchLibraries(
  libraryName: string,
): Promise<LibrarySearchResult[]> {
  return ragService.searchLibraries(libraryName);
}

export async function fetchLibraryDocumentation(
  context7CompatibleLibraryID: string,
  options: { tokens?: number; topic?: string } = {},
): Promise<string> {
  const rows = await ragService.fetchLibraryDocumentation(
    context7CompatibleLibraryID,
    options,
  );

  if (rows.length === 0) {
    return 'No documentation found for this library.';
  }

  const formattedResults = rows.map((row: Record<string, unknown>) => {
    const contentType = row.content_type as string;
    const title = row.title as string;
    const description = row.description as string;
    const originalText = row.original_text as string;
    const metadata = row.metadata as Record<string, unknown> | undefined;

    switch (contentType) {
      case 'code-example':
        return `
### ${title || 'Code Example'} \n\n
**Description:** ${description || 'N/A'} \n\n
\`\`\`${(metadata?.language as string) || ''}
${originalText}
\`\`\` \n\n
        `.trim();
      case 'guide':
        return `
## ${title || 'Guide'}
${originalText}
        `.trim();
      default:
        return originalText;
    }
  });

  return formattedResults.join('\n\n---\n\n');
}
