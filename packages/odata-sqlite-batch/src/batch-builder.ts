import type { 
  IBatchBuilder, 
  BatchRequest, 
  BatchOperation, 
  BatchResult, 
  BatchResponse, 
  BatchValidationResult,
  BatchConfig,
  BatchExecutionContext,
  BatchOperationResult
} from './batch-types';

export class BatchBuilder implements IBatchBuilder {
  private readonly DEFAULT_MAX_OPERATIONS = 1000;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  parseBatchRequest(content: string): BatchRequest {
    if (!content.includes('--batch_boundary')) {
      throw new Error('Invalid batch format');
    }

    const operations: BatchOperation[] = [];
    const lines = content.split('\n');
    let currentOperation: Partial<BatchOperation> | null = null;
    let inHttpSection = false;
    let bodyLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';

      // Check for changeset boundary
      if (line.startsWith('--changeset_boundary') && !line.endsWith('--')) {
        currentOperation = {
          headers: []
        };
        inHttpSection = false;
        bodyLines = [];
        continue;
      }

      // Check for HTTP method line
      if (currentOperation && !inHttpSection && this.isHttpMethodLine(line)) {
        const [method, url] = this.parseHttpMethodLine(line);
        currentOperation.method = method as 'GET' | 'POST' | 'PUT' | 'DELETE';
        currentOperation.url = url;
        inHttpSection = true;
        continue;
      }

      // Collect headers
      if (currentOperation && inHttpSection && line.includes(':')) {
        if (line.toLowerCase().startsWith('content-type:')) {
          currentOperation.headers?.push(line);
        }
        continue;
      }

      // Collect body
      if (currentOperation && inHttpSection && line && !line.includes(':')) {
        bodyLines.push(line);
        continue;
      }

      // End of operation
      if (line === '--changeset_boundary--' && currentOperation) {
        if (bodyLines.length > 0) {
          try {
            currentOperation.body = JSON.parse(bodyLines.join('\n'));
          } catch (error) {
            // If JSON parsing fails, keep as string
            currentOperation.body = bodyLines.join('\n');
          }
        }
        
        if (this.isValidOperation(currentOperation)) {
          operations.push(currentOperation as BatchOperation);
        }
        
        currentOperation = null;
        inHttpSection = false;
        bodyLines = [];
      }
    }

    return { operations };
  }

  generateBatchResponse(operations: BatchOperation[], results: BatchResult[]): string {
    if (operations.length !== results.length) {
      throw new Error('Operations and results count mismatch');
    }

    let response = '--batch_boundary\r\n';
    response += 'Content-Type: multipart/mixed; boundary=changeset_boundary\r\n\r\n';

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const result = results[i];

      if (!result) continue;

      response += '--changeset_boundary\r\n';
      response += 'Content-Type: application/http\r\n';
      response += 'Content-Transfer-Encoding: binary\r\n\r\n';

      // Status line
      response += `HTTP/1.1 ${result.status} ${this.getStatusText(result.status)}\r\n`;

      // Headers
      for (const [key, value] of Object.entries(result.headers || {})) {
        response += `${key}: ${value}\r\n`;
      }

      response += '\r\n';

      // Body
      if (result.body !== undefined) {
        if (typeof result.body === 'string') {
          response += result.body;
        } else {
          response += JSON.stringify(result.body);
        }
      }

      response += '\r\n';
    }

    response += '--changeset_boundary--\r\n';
    response += '--batch_boundary--\r\n';

    return response;
  }

  async executeBatch(
    operations: BatchOperation[], 
    connection: any, 
    config: BatchConfig
  ): Promise<BatchResponse> {
    // Validate batch request
    const validation = this.validateBatchRequest({ operations });
    if (!validation.isValid) {
      throw new Error(`Invalid batch request: ${validation.errors.join(', ')}`);
    }

    const results: BatchResult[] = [];

    // Execute in transaction if supported
    if (typeof connection.transaction === 'function') {
      try {
        await connection.transaction(async () => {
          for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            if (operation) {
              const result = await this.executeSingleOperation(operation, connection, config, i);
              results.push(result);
            }
          }
        });
      } catch (error) {
        // If transaction fails, return error results
        for (let i = 0; i < operations.length; i++) {
          results.push({
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: { code: 'InternalError', message: 'Transaction failed' } }
          });
        }
      }
    } else {
      // Execute without transaction
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (operation) {
          const result = await this.executeSingleOperation(operation, connection, config, i);
          results.push(result);
        }
      }
    }

    return { results };
  }

  validateBatchRequest(request: BatchRequest): BatchValidationResult {
    const errors: string[] = [];
    const maxOperations = this.DEFAULT_MAX_OPERATIONS;

    if (!request.operations || !Array.isArray(request.operations)) {
      errors.push('Operations must be an array');
      return { isValid: false, errors };
    }

    if (request.operations.length === 0) {
      errors.push('Batch must contain at least one operation');
    }

    if (request.operations.length > maxOperations) {
      errors.push(`Batch cannot contain more than ${maxOperations} operations`);
    }

    for (let i = 0; i < request.operations.length; i++) {
      const operation = request.operations[i];
      if (operation) {
        const operationErrors = this.validateOperation(operation, i);
        errors.push(...operationErrors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isHttpMethodLine(line: string): boolean {
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    return methods.some(method => line.startsWith(method + ' '));
  }

  private parseHttpMethodLine(line: string): [string, string] {
    const parts = line.split(' ');
    if (parts.length < 2) {
      throw new Error('Invalid HTTP method line');
    }
    return [parts[0] || '', parts[1] || ''];
  }

  private isValidOperation(operation: Partial<BatchOperation>): boolean {
    return !!(
      operation.method &&
      operation.url &&
      Array.isArray(operation.headers)
    );
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      404: 'Not Found',
      405: 'Method Not Allowed',
      500: 'Internal Server Error'
    };
    return statusTexts[status] || 'Unknown';
  }

  private async executeSingleOperation(
    operation: BatchOperation,
    connection: any,
    config: BatchConfig,
    index: number
  ): Promise<BatchResult> {
    try {
      const context: BatchExecutionContext = {
        connection,
        config,
        operation,
        index
      };

      switch (operation.method) {
        case 'GET':
          return await this.executeGetOperation(context);
        case 'POST':
          return await this.executePostOperation(context);
        case 'PUT':
          return await this.executePutOperation(context);
        case 'DELETE':
          return await this.executeDeleteOperation(context);
        default:
          return {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
            body: { error: { code: 'MethodNotAllowed', message: `Method ${operation.method} not supported` } }
          };
      }
    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { 
          error: { 
            code: 'InternalError', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          } 
        }
      };
    }
  }

  private async executeGetOperation(context: BatchExecutionContext): Promise<BatchResult> {
    const { operation, connection } = context;
    
    // Parse URL to extract resource and query parameters
    const urlParts = this.parseODataUrl(operation.url);
    const resourceName = urlParts.resource;
    const isSingleResource = urlParts.isSingleResource;
    const id = urlParts.id;

    if (!resourceName) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'BadRequest', message: 'Invalid resource name' } }
      };
    }

    try {
      let sql: string;
      let params: any[] = [];

      if (isSingleResource && id) {
        sql = `SELECT * FROM ${resourceName} WHERE id = ?`;
        params = [id];
      } else {
        sql = `SELECT * FROM ${resourceName}`;
      }

      const stmt = connection.prepare(sql);
      const result = isSingleResource ? stmt.get(...params) : stmt.all(...params);

      if (isSingleResource && !result) {
        return {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: { code: 'NotFound', message: 'Resource not found' } }
        };
      }

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: isSingleResource ? result : { value: result }
      };
    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'InternalError', message: 'Database error' } }
      };
    }
  }

  private async executePostOperation(context: BatchExecutionContext): Promise<BatchResult> {
    const { operation, connection, config } = context;
    
    const urlParts = this.parseODataUrl(operation.url);
    const resourceName = urlParts.resource;

    if (!resourceName || !operation.body) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'BadRequest', message: 'Invalid request' } }
      };
    }

    const schema = config.schemas[resourceName];
    if (!schema) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'NotFound', message: 'Schema not found' } }
      };
    }

    try {
      const columns = Object.keys(operation.body).filter(key => 
        schema.columns.some(col => col.name === key)
      );
      const values = columns.map(col => operation.body[col]);
      const placeholders = columns.map(() => '?').join(', ');

      const sql = `INSERT INTO ${resourceName} (${columns.join(', ')}) VALUES (${placeholders})`;
      const stmt = connection.prepare(sql);
      const result = stmt.run(...values);

      const insertedRecord = connection.prepare(`SELECT * FROM ${resourceName} WHERE id = ?`).get(result.lastInsertRowid);

      return {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: insertedRecord
      };
    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'InternalError', message: 'Database error' } }
      };
    }
  }

  private async executePutOperation(context: BatchExecutionContext): Promise<BatchResult> {
    const { operation, connection, config } = context;
    
    const urlParts = this.parseODataUrl(operation.url);
    const resourceName = urlParts.resource;
    const id = urlParts.id;

    if (!resourceName || !id || !operation.body) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'BadRequest', message: 'Invalid request' } }
      };
    }

    const schema = config.schemas[resourceName];
    if (!schema) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'NotFound', message: 'Schema not found' } }
      };
    }

    try {
      const columns = Object.keys(operation.body).filter(key => 
        schema.columns.some(col => col.name === key)
      );
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = [...columns.map(col => operation.body[col]), id];

      const sql = `UPDATE ${resourceName} SET ${setClause} WHERE id = ?`;
      const stmt = connection.prepare(sql);
      const result = stmt.run(...values);

      if (result.changes === 0) {
        return {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: { code: 'NotFound', message: 'Resource not found' } }
        };
      }

      const updatedRecord = connection.prepare(`SELECT * FROM ${resourceName} WHERE id = ?`).get(id);

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: updatedRecord
      };
    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'InternalError', message: 'Database error' } }
      };
    }
  }

  private async executeDeleteOperation(context: BatchExecutionContext): Promise<BatchResult> {
    const { operation, connection } = context;
    
    const urlParts = this.parseODataUrl(operation.url);
    const resourceName = urlParts.resource;
    const id = urlParts.id;

    if (!resourceName || !id) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'BadRequest', message: 'Invalid request' } }
      };
    }

    try {
      const sql = `DELETE FROM ${resourceName} WHERE id = ?`;
      const stmt = connection.prepare(sql);
      const result = stmt.run(id);

      if (result.changes === 0) {
        return {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: { error: { code: 'NotFound', message: 'Resource not found' } }
        };
      }

      return {
        status: 204,
        headers: {}
      };
    } catch (error) {
      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'InternalError', message: 'Database error' } }
      };
    }
  }

  private parseODataUrl(url: string): { resource?: string; isSingleResource: boolean; id?: string } {
    // Remove query parameters
    const cleanUrl = url.split('?')[0] || '';
    
    // Parse /api/odata/Products or /api/odata/Products(1)
    const parts = cleanUrl.split('/');
    const resourceIndex = parts.findIndex(part => part === 'odata') + 1;
    
    if (resourceIndex >= parts.length) {
      return { isSingleResource: false };
    }

    const resourcePart = parts[resourceIndex];
    
    // Check for single resource pattern: Products(1)
    const singleResourceMatch = resourcePart?.match(/^(.+)\((\d+)\)$/);
    if (singleResourceMatch) {
      const result: { resource?: string; isSingleResource: boolean; id?: string } = {
        isSingleResource: true
      };
      if (singleResourceMatch[1]) result.resource = singleResourceMatch[1];
      if (singleResourceMatch[2]) result.id = singleResourceMatch[2];
      return result;
    }

    const result: { resource?: string; isSingleResource: boolean; id?: string } = {
      isSingleResource: false
    };
    if (resourcePart) result.resource = resourcePart;
    return result;
  }

  private validateOperation(operation: BatchOperation, index: number): string[] {
    const errors: string[] = [];

    if (!operation.method) {
      errors.push(`Operation ${index}: Missing HTTP method`);
    } else if (!['GET', 'POST', 'PUT', 'DELETE'].includes(operation.method)) {
      errors.push(`Operation ${index}: Unsupported HTTP method ${operation.method}`);
    }

    if (!operation.url) {
      errors.push(`Operation ${index}: Missing URL`);
    } else if (!operation.url.startsWith('/')) {
      errors.push(`Operation ${index}: Invalid URL format`);
    }

    if (!Array.isArray(operation.headers)) {
      errors.push(`Operation ${index}: Headers must be an array`);
    }

    return errors;
  }
}
