import { SlopChunk } from '../types';
import { OpenAPIV3 } from 'openapi-types';
import { createHash } from 'crypto';
import yaml from 'js-yaml';

function generateDeterministicId(
  libraryId: string,
  contentType: string,
  content: string,
  extra?: string,
): string {
  const input = `${libraryId}-${contentType}-${content}${extra ? `-${extra}` : ''}`;
  return createHash('sha256').update(input).digest('hex');
}

export function convertToSlopChunks(
  libraryId: string,
  spec: OpenAPIV3.Document,
): SlopChunk[] {
  const chunks: SlopChunk[] = [];

  // 1. Create API Overview Chunk
  const overviewText = yaml.dump({
    info: spec.info,
    servers: spec.servers,
  });

  chunks.push({
    id: generateDeterministicId(libraryId, 'API_OVERVIEW', overviewText),
    libraryId,
    contentType: 'API_OVERVIEW',
    originalText: overviewText,
    metadata: {
      title: spec.info.title,
      version: spec.info.version,
    },
  });

  // 2. Create Operation Chunks
  for (const path in spec.paths) {
    const pathItem = spec.paths[path];
    if (pathItem) {
      for (const method in pathItem) {
        if (
          [
            'get',
            'post',
            'put',
            'delete',
            'patch',
            'options',
            'head',
            'trace',
          ].includes(method)
        ) {
          const operation = pathItem[
            method as keyof typeof pathItem
          ] as OpenAPIV3.OperationObject;
          if (operation) {
            const operationText = yaml.dump({
              path,
              method: method.toUpperCase(),
              ...operation,
            });

            chunks.push({
              id: generateDeterministicId(
                libraryId,
                'OPERATION',
                operationText,
                `${path}-${method}`,
              ),
              libraryId,
              contentType: 'OPERATION',
              originalText: operationText,
              metadata: {
                path,
                method: method.toUpperCase(),
                summary: operation.summary,
                operationId: operation.operationId,
              },
            });
          }
        }
      }
    }
  }

  // 3. Create Schema Definition Chunks
  if (spec.components && spec.components.schemas) {
    for (const schemaName in spec.components.schemas) {
      const schema = spec.components.schemas[schemaName];
      if (schema) {
        const schemaText = yaml.dump({
          [schemaName]: schema,
        });

        chunks.push({
          id: generateDeterministicId(
            libraryId,
            'SCHEMA_DEFINITION',
            schemaText,
            schemaName,
          ),
          libraryId,
          contentType: 'SCHEMA_DEFINITION',
          originalText: schemaText,
          metadata: {
            schemaName,
          },
        });
      }
    }
  }

  return chunks;
}
