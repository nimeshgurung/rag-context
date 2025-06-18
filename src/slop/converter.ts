import { SlopChunk } from '../types';
import { OpenAPIV3 } from 'openapi-types';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';

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
    id: uuidv4(),
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
              id: uuidv4(),
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
          id: uuidv4(),
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
