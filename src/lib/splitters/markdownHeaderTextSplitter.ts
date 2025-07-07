interface Metadata {
  [key: string]: string;
}

interface LineWithMetadata {
  content: string;
  metadata: Metadata;
}

interface Chunk {
  pageContent: string;
  metadata: Metadata;
}

type HeaderPair = [string, string];

export class MarkdownHeaderTextSplitter {
  private readonly headersToSplitOn: HeaderPair[];
  private readonly returnEachLine: boolean;
  private readonly stripHeaders: boolean;

  constructor(
    headersToSplitOn: HeaderPair[],
    returnEachLine = false,
    stripHeaders = true,
  ) {
    this.headersToSplitOn = headersToSplitOn;
    this.returnEachLine = returnEachLine;
    this.stripHeaders = stripHeaders;
  }

  splitText(text: string): Chunk[] {
    const linesWithMetadata: LineWithMetadata[] = [];
    const lines = text.split('\n');
    let currentContent: string[] = [];
    let currentMetadata: Metadata = {};
    const initialMetadata: Metadata = {};

    for (const line of lines) {
      let foundHeader = false;

      // Check if line matches any header pattern
      for (const [header, name] of this.headersToSplitOn) {
        const pattern = new RegExp(
          `^${header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`,
        );

        if (pattern.test(line.trim())) {
          // If we have existing content, save it
          if (currentContent.length > 0) {
            linesWithMetadata.push({
              content: currentContent.join('\n'),
              metadata: { ...currentMetadata },
            });
            currentContent = [];
          }

          // Extract header text
          const headerText = line.replace(pattern, '').trim();

          // Update metadata for this header level and clear deeper levels
          const headerLevel = header.length;
          const newMetadata: Metadata = { ...initialMetadata };

          // Keep headers from higher levels
          for (const [prevHeader, prevName] of this.headersToSplitOn) {
            if (prevHeader.length < headerLevel && currentMetadata[prevName]) {
              newMetadata[prevName] = currentMetadata[prevName];
            }
          }

          // Add current header
          newMetadata[name] = headerText;
          currentMetadata = newMetadata;

          // Add header to content if not stripping
          if (!this.stripHeaders) {
            currentContent.push(line);
          }

          foundHeader = true;
          break;
        }
      }

      // If not a header, add to current content
      if (!foundHeader) {
        currentContent.push(line);
      }
    }

    // Add final section
    if (currentContent.length > 0) {
      linesWithMetadata.push({
        content: currentContent.join('\n'),
        metadata: { ...currentMetadata },
      });
    }

    // Return based on returnEachLine setting
    if (this.returnEachLine) {
      return linesWithMetadata.map((chunk) => ({
        pageContent: chunk.content,
        metadata: chunk.metadata,
      }));
    } else {
      return this.aggregateLinesToChunks(linesWithMetadata);
    }
  }

  aggregateLinesToChunks(linesWithMetadata: LineWithMetadata[]): Chunk[] {
    const aggregatedChunks: Chunk[] = [];
    let currentChunk: { content: string[]; metadata: Metadata } | null = null;

    for (const line of linesWithMetadata) {
      if (
        !currentChunk ||
        !this.metadataMatches(currentChunk.metadata, line.metadata)
      ) {
        // Start new chunk
        if (currentChunk) {
          aggregatedChunks.push({
            pageContent: currentChunk.content.join('\n'),
            metadata: currentChunk.metadata,
          });
        }
        currentChunk = {
          content: [line.content],
          metadata: line.metadata,
        };
      } else {
        // Add to existing chunk
        currentChunk.content.push(line.content);
      }
    }

    // Add final chunk
    if (currentChunk) {
      aggregatedChunks.push({
        pageContent: currentChunk.content.join('\n'),
        metadata: currentChunk.metadata,
      });
    }

    return aggregatedChunks;
  }

  metadataMatches(metadata1: Metadata, metadata2: Metadata): boolean {
    const keys1 = Object.keys(metadata1);
    const keys2 = Object.keys(metadata2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (metadata1[key] !== metadata2[key]) return false;
    }

    return true;
  }
}
