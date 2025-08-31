import { describe, it, expect } from 'vitest';
import type { 
  ConnectionConfig, 
  ISQLiteConnection, 
  ITursoConnection,
  ODataQuery,
  ODataResult,
  IODataParser,
  IODataExecutor
} from 'odata-sqlite-contracts';

describe('Type Definitions', () => {
  describe('Connection Types', () => {
    it('should define valid connection configurations', () => {
      const localConfig: ConnectionConfig = {
        type: 'local',
        database: ':memory:',
        options: {
          verbose: false
        }
      };

      const tursoConfig: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'test-token',
        options: {
          syncUrl: 'https://test-sync.turso.io'
        }
      };

      expect(localConfig.type).toBe('local');
      expect(tursoConfig.type).toBe('turso');
    });

    it('should define connection interfaces', () => {
      const mockLocalConnection: ISQLiteConnection = {
        prepare: async () => ({
          run: async () => ({ changes: 0, lastInsertRowid: 0 }),
          get: async () => ({}),
          all: async () => ([])
        }),
        exec: async () => {},
        transaction: async (fn) => await fn(),
        close: async () => {}
      };

      const mockTursoConnection: ITursoConnection = {
        prepare: async () => ({
          run: async () => ({ changes: 0, lastInsertRowid: 0 }),
          get: async () => ({}),
          all: async () => ([])
        }),
        exec: async () => {},
        transaction: async (fn) => await fn(),
        close: async () => {},
        sync: async () => {}
      };

      expect(mockLocalConnection).toBeDefined();
      expect(mockTursoConnection).toBeDefined();
      expect(typeof mockTursoConnection.sync).toBe('function');
    });
  });

  describe('OData Types', () => {
    it('should define OData query structure', () => {
      const query: ODataQuery = {
        top: 10,
        skip: 0,
        select: ['id', 'name'],
        orderBy: [{ field: 'name', direction: 'asc' }],
        filter: {
          operator: 'eq',
          field: 'status',
          value: 'active'
        }
      };

      expect(query.top).toBe(10);
      expect(query.select).toEqual(['id', 'name']);
      expect(query.filter?.operator).toBe('eq');
    });

    it('should define OData result structure', () => {
      const result: ODataResult<{ id: number; name: string }> = {
        value: [
          { id: 1, name: 'Product 1' },
          { id: 2, name: 'Product 2' }
        ],
        count: 2
      };

      expect(result.value).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });

  describe('Parser and Executor Types', () => {
    it('should define parser interface', () => {
      const mockParser: IODataParser = {
        parse: (url: string) => {
          return {
            top: 10,
            select: ['id', 'name']
          };
        }
      };

      const result = mockParser.parse('/odata/Products?$top=10');
      expect(result.top).toBe(10);
    });

    it('should define executor interface', async () => {
      const mockExecutor: IODataExecutor<any> = {
        execute: async (query, connection, options) => {
          return {
            value: [{ id: 1, name: 'Test' }],
            count: 1
          };
        }
      };

      const mockConnection = {} as ISQLiteConnection;
      const result = await mockExecutor.execute(
        { top: 10 },
        mockConnection,
        { tableName: 'products' }
      );

      expect(result.value).toHaveLength(1);
      expect(result.count).toBe(1);
    });
  });
});
