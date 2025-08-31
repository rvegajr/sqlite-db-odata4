import type { TableSchema } from 'odata-sqlite-contracts';

export interface BatchOperation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  body?: any;
  headers: string[];
}

export interface BatchRequest {
  operations: BatchOperation[];
}

export interface BatchResult {
  status: number;
  headers: Record<string, string>;
  body?: any;
}

export interface BatchResponse {
  results: BatchResult[];
}

export interface BatchValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface BatchConfig {
  schemas: { [resourceName: string]: TableSchema };
  maxOperations?: number;
  timeout?: number;
}

export interface IBatchBuilder {
  parseBatchRequest(content: string): BatchRequest;
  generateBatchResponse(operations: BatchOperation[], results: BatchResult[]): string;
  executeBatch(
    operations: BatchOperation[], 
    connection: any, 
    config: BatchConfig
  ): Promise<BatchResponse>;
  validateBatchRequest(request: BatchRequest): BatchValidationResult;
}

export interface BatchExecutionContext {
  connection: any;
  config: BatchConfig;
  operation: BatchOperation;
  index: number;
}

export interface BatchOperationResult {
  success: boolean;
  status: number;
  headers: Record<string, string>;
  body?: any;
  error?: string;
}
