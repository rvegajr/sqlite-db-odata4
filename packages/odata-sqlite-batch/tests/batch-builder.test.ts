import { describe, it, expect, beforeEach } from 'vitest';
import { BatchBuilder } from '../src/batch-builder';
import type { BatchRequest, BatchResponse, BatchOperation } from '../src/batch-types';

describe('🚀 BatchBuilder - OData v4 Batch Operations', () => {
  let batchBuilder: BatchBuilder;

  beforeEach(() => {
    batchBuilder = new BatchBuilder();
  });

  describe('🚀 Batch Request Parsing', () => {
    it('should parse simple batch request', () => {
      const batchContent = `--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"New Product","price":100.00,"category_id":1}

--changeset_boundary--
--batch_boundary--`;

      const result = batchBuilder.parseBatchRequest(batchContent);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.method).toBe('POST');
      expect(result.operations[0]?.url).toBe('/api/odata/Products');
      expect(result.operations[0]?.body).toEqual({
        name: 'New Product',
        price: 100.00,
        category_id: 1
      });
    });

    it('should parse multiple operations in changeset', () => {
      const batchContent = `--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"Product 1","price":100.00}

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"Product 2","price":200.00}

--changeset_boundary--
--batch_boundary--`;

      const result = batchBuilder.parseBatchRequest(batchContent);

      expect(result.operations).toHaveLength(2);
      expect(result.operations[0]?.method).toBe('POST');
      expect(result.operations[0]?.body?.name).toBe('Product 1');
      expect(result.operations[1]?.method).toBe('POST');
      expect(result.operations[1]?.body?.name).toBe('Product 2');
    });

    it('should parse GET operations without body', () => {
      const batchContent = `--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

GET /api/odata/Products HTTP/1.1

--changeset_boundary--
--batch_boundary--`;

      const result = batchBuilder.parseBatchRequest(batchContent);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.method).toBe('GET');
      expect(result.operations[0]?.url).toBe('/api/odata/Products');
      expect(result.operations[0]?.body).toBeUndefined();
    });

    it('should parse operations with query parameters', () => {
      const batchContent = `--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

GET /api/odata/Products?$filter=price gt 100&$top=5 HTTP/1.1

--changeset_boundary--
--batch_boundary--`;

      const result = batchBuilder.parseBatchRequest(batchContent);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.method).toBe('GET');
      expect(result.operations[0]?.url).toBe('/api/odata/Products?$filter=price gt 100&$top=5');
    });

    it('should handle operations with headers', () => {
      const batchContent = `--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

PUT /api/odata/Products(1) HTTP/1.1
Content-Type: application/json
If-Match: "etag123"

{"name":"Updated Product","price":150.00}

--changeset_boundary--
--batch_boundary--`;

      const result = batchBuilder.parseBatchRequest(batchContent);

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]?.method).toBe('PUT');
      expect(result.operations[0]?.headers).toContain('Content-Type: application/json');
      expect(result.operations[0]?.headers).toContain('If-Match: "etag123"');
    });
  });

  describe('🚀 Batch Response Generation', () => {
    it('should generate batch response for successful operations', () => {
      const operations: BatchOperation[] = [
        {
          method: 'POST',
          url: '/api/odata/Products',
          body: { name: 'New Product', price: 100.00 },
          headers: ['Content-Type: application/json']
        }
      ];

      const results = [
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: { id: 1, name: 'New Product', price: 100.00 }
        }
      ];

      const result = batchBuilder.generateBatchResponse(operations, results);

      expect(result).toContain('--batch_boundary');
      expect(result).toContain('HTTP/1.1 201 Created');
      expect(result).toContain('Content-Type: application/json');
      expect(result).toContain('{"id":1,"name":"New Product","price":100}');
    });

    it('should generate batch response for failed operations', () => {
      const operations: BatchOperation[] = [
        {
          method: 'POST',
          url: '/api/odata/Products',
          body: { name: 'Invalid Product' },
          headers: ['Content-Type: application/json']
        }
      ];

      const results = [
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: { code: 'BadRequest', message: 'Invalid data' } }
        }
      ];

      const result = batchBuilder.generateBatchResponse(operations, results);

      expect(result).toContain('HTTP/1.1 400 Bad Request');
      expect(result).toContain('{"error":{"code":"BadRequest","message":"Invalid data"}}');
    });

    it('should generate batch response for mixed success/failure', () => {
      const operations: BatchOperation[] = [
        {
          method: 'POST',
          url: '/api/odata/Products',
          body: { name: 'Valid Product', price: 100.00 },
          headers: ['Content-Type: application/json']
        },
        {
          method: 'POST',
          url: '/api/odata/Products',
          body: { name: 'Invalid Product' },
          headers: ['Content-Type: application/json']
        }
      ];

      const results = [
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: { id: 1, name: 'Valid Product', price: 100.00 }
        },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: { error: { code: 'BadRequest', message: 'Invalid data' } }
        }
      ];

      const result = batchBuilder.generateBatchResponse(operations, results);

      expect(result).toContain('HTTP/1.1 201 Created');
      expect(result).toContain('HTTP/1.1 400 Bad Request');
    });
  });

  describe('🚀 Batch Execution', () => {
    it('should execute batch operations in transaction', async () => {
      const mockConnection = {
        transaction: (fn: Function) => fn(),
        prepare: (sql: string) => ({
          run: () => ({ lastInsertRowid: 1, changes: 1 }),
          get: () => ({ id: 1, name: 'New Product', price: 100.00 }),
          all: () => [{ id: 1, name: 'New Product', price: 100.00 }]
        })
      };

      const operations: BatchOperation[] = [
        {
          method: 'POST',
          url: '/api/odata/Products',
          body: { name: 'New Product', price: 100.00 },
          headers: ['Content-Type: application/json']
        }
      ];

      const result = await batchBuilder.executeBatch(operations, mockConnection as any, {
        schemas: {
          'Products': {
            name: 'Products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
              { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
              { name: 'price', type: 'REAL', primaryKey: false, nullable: false }
            ]
          }
        }
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe(201);
    });

    it('should rollback transaction on error', async () => {
      const mockConnection = {
        transaction: (fn: Function) => {
          try {
            fn();
          } catch (error) {
            // Simulate rollback
            throw error;
          }
        },
        prepare: (sql: string) => ({
          run: () => { throw new Error('Database error'); },
          get: () => null,
          all: () => []
        })
      };

      const operations: BatchOperation[] = [
        {
          method: 'POST',
          url: '/api/odata/Products',
          body: { name: 'New Product', price: 100.00 },
          headers: ['Content-Type: application/json']
        }
      ];

      const result = await batchBuilder.executeBatch(operations, mockConnection as any, {
        schemas: {
          'Products': {
            name: 'Products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
              { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
              { name: 'price', type: 'REAL', primaryKey: false, nullable: false }
            ]
          }
        }
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe(500);
    });
  });

  describe('🚀 Query Operations', () => {
    it('should handle GET operations in batch', async () => {
      const mockConnection = {
        transaction: (fn: Function) => fn(),
        prepare: (sql: string) => ({
          run: () => ({ lastInsertRowid: 1, changes: 1 }),
          get: () => ({ id: 1, name: 'Product', price: 100.00 }),
          all: () => [{ id: 1, name: 'Product', price: 100.00 }]
        })
      };

      const operations: BatchOperation[] = [
        {
          method: 'GET',
          url: '/api/odata/Products',
          headers: []
        }
      ];

      const result = await batchBuilder.executeBatch(operations, mockConnection as any, {
        schemas: {
          'Products': {
            name: 'Products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
              { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
              { name: 'price', type: 'REAL', primaryKey: false, nullable: false }
            ]
          }
        }
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe(200);
    });

    it('should handle PUT operations in batch', async () => {
      const mockConnection = {
        transaction: (fn: Function) => fn(),
        prepare: (sql: string) => ({
          run: () => ({ lastInsertRowid: 1, changes: 1 }),
          get: () => ({ id: 1, name: 'Updated Product', price: 150.00 }),
          all: () => []
        })
      };

      const operations: BatchOperation[] = [
        {
          method: 'PUT',
          url: '/api/odata/Products(1)',
          body: { name: 'Updated Product', price: 150.00 },
          headers: ['Content-Type: application/json']
        }
      ];

      const result = await batchBuilder.executeBatch(operations, mockConnection as any, {
        schemas: {
          'Products': {
            name: 'Products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
              { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
              { name: 'price', type: 'REAL', primaryKey: false, nullable: false }
            ]
          }
        }
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe(200);
    });

    it('should handle DELETE operations in batch', async () => {
      const mockConnection = {
        transaction: (fn: Function) => fn(),
        prepare: (sql: string) => ({
          run: () => ({ lastInsertRowid: 1, changes: 1 }),
          get: () => null,
          all: () => []
        })
      };

      const operations: BatchOperation[] = [
        {
          method: 'DELETE',
          url: '/api/odata/Products(1)',
          headers: []
        }
      ];

      const result = await batchBuilder.executeBatch(operations, mockConnection as any, {
        schemas: {
          'Products': {
            name: 'Products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
              { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
              { name: 'price', type: 'REAL', primaryKey: false, nullable: false }
            ]
          }
        }
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe(204);
    });
  });

  describe('🚀 Error Handling', () => {
    it('should handle invalid batch format', () => {
      const invalidContent = 'Invalid batch content';

      expect(() => {
        batchBuilder.parseBatchRequest(invalidContent);
      }).toThrow('Invalid batch format');
    });

    it('should handle missing content type', () => {
      const batchContent = `--batch_boundary
--changeset_boundary
Content-Type: application/http

POST /api/odata/Products HTTP/1.1

{"name":"Product"}

--changeset_boundary--
--batch_boundary--`;

      expect(() => {
        batchBuilder.parseBatchRequest(batchContent);
      }).toThrow('Missing Content-Type in batch request');
    });

    it('should handle unsupported HTTP methods', async () => {
      const operations: BatchOperation[] = [
        {
          method: 'PATCH',
          url: '/api/odata/Products(1)',
          body: { name: 'Updated Product' },
          headers: ['Content-Type: application/json']
        }
      ];

      const mockConnection = {
        transaction: (fn: Function) => fn(),
        prepare: (sql: string) => ({
          run: () => ({ lastInsertRowid: 1, changes: 1 }),
          get: () => null,
          all: () => []
        })
      };

      const result = await batchBuilder.executeBatch(operations, mockConnection as any, {
        schemas: {
          'Products': {
            name: 'Products',
            columns: [
              { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
              { name: 'name', type: 'TEXT', primaryKey: false, nullable: false }
            ]
          }
        }
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.status).toBe(405);
    });
  });

  describe('🚀 Batch Validation', () => {
    it('should validate batch request structure', () => {
      const batchRequest: BatchRequest = {
        operations: [
          {
            method: 'POST',
            url: '/api/odata/Products',
            body: { name: 'Product', price: 100.00 },
            headers: ['Content-Type: application/json']
          }
        ]
      };

      const result = batchBuilder.validateBatchRequest(batchRequest);

      expect(result.isValid).toBe(true);
    });

    it('should reject batch with too many operations', () => {
      const operations: BatchOperation[] = Array(1001).fill(null).map((_, i) => ({
        method: 'GET',
        url: `/api/odata/Products(${i})`,
        headers: []
      }));

      const batchRequest: BatchRequest = { operations };

      const result = batchBuilder.validateBatchRequest(batchRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch cannot contain more than 1000 operations');
    });

    it('should reject batch with invalid URLs', () => {
      const batchRequest: BatchRequest = {
        operations: [
          {
            method: 'POST',
            url: 'invalid-url',
            body: { name: 'Product' },
            headers: ['Content-Type: application/json']
          }
        ]
      };

      const result = batchBuilder.validateBatchRequest(batchRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });
  });
});
