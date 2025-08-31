import { describe, it, expect } from 'vitest';
import type { 
  IODataParser, 
  IODataExecutor, 
  ISQLBuilder,
  ExecuteOptions,
  SQLQuery,
  TableSchema
} from '../src/parser-executor';

describe('Parser and Executor Interfaces', () => {
  describe('IODataParser', () => {
    it('should parse URL into ODataQuery', () => {
      const mockParser: IODataParser = {
        parse: (url: string) => {
          // Mock implementation
          return {
            top: 10,
            skip: 0,
            select: ['id', 'name'],
            orderBy: [{ field: 'name', direction: 'asc' }]
          };
        }
      };

      const result = mockParser.parse('/odata/Products?$top=10&$select=id,name&$orderby=name asc');
      
      expect(result.top).toBe(10);
      expect(result.select).toEqual(['id', 'name']);
      expect(result.orderBy?.[0].field).toBe('name');
    });
  });

  describe('IODataExecutor', () => {
    it('should execute ODataQuery and return ODataResult', async () => {
      const mockExecutor: IODataExecutor<any> = {
        execute: async (query, connection, options) => {
          // Mock implementation
          return {
            value: [
              { id: 1, name: 'Product 1' },
              { id: 2, name: 'Product 2' }
            ],
            count: 2
          };
        }
      };

      const mockConnection = {} as any;
      const result = await mockExecutor.execute(
        { top: 10, select: ['id', 'name'] },
        mockConnection,
        { tableName: 'products' }
      );

      expect(result.value).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });

  describe('ISQLBuilder', () => {
    it('should build SELECT queries from ODataQuery', () => {
      const mockBuilder: ISQLBuilder = {
        buildSelectQuery: (query, table, schema) => {
          return {
            sql: 'SELECT id, name FROM products WHERE status = ? ORDER BY name ASC LIMIT 10',
            params: ['active']
          };
        },
        buildCountQuery: (query, table, schema) => {
          return {
            sql: 'SELECT COUNT(*) as count FROM products WHERE status = ?',
            params: ['active']
          };
        }
      };

      const query = { 
        top: 10, 
        select: ['id', 'name'],
        filter: {
          operator: 'eq',
          field: 'status',
          value: 'active'
        },
        orderBy: [{ field: 'name', direction: 'asc' }]
      };

      const selectResult = mockBuilder.buildSelectQuery(query, 'products', {} as TableSchema);
      const countResult = mockBuilder.buildCountQuery(query, 'products', {} as TableSchema);

      expect(selectResult.sql).toContain('SELECT');
      expect(selectResult.sql).toContain('LIMIT 10');
      expect(countResult.sql).toContain('COUNT(*)');
    });
  });

  describe('ExecuteOptions', () => {
    it('should support various configuration options', () => {
      const options: ExecuteOptions = {
        tableName: 'products',
        schema: {
          name: 'products',
          columns: [
            { name: 'id', type: 'INTEGER', primaryKey: true },
            { name: 'name', type: 'TEXT' },
            { name: 'price', type: 'REAL' }
          ]
        },
        limits: {
          maxTop: 1000,
          defaultPageSize: 20
        },
        fieldMap: {
          'id': 'rowid',
          'productName': 'name'
        },
        expandMap: {
          'category': {
            from: 'categories',
            localField: 'categoryId',
            foreignField: 'id',
            as: 'category'
          }
        }
      };

      expect(options.tableName).toBe('products');
      expect(options.limits?.maxTop).toBe(1000);
      expect(options.fieldMap?.['id']).toBe('rowid');
    });
  });

  describe('SQLQuery', () => {
    it('should contain SQL string and parameters', () => {
      const sqlQuery: SQLQuery = {
        sql: 'SELECT * FROM products WHERE price > ? AND category = ?',
        params: [100, 'electronics']
      };

      expect(sqlQuery.sql).toContain('SELECT');
      expect(sqlQuery.params).toHaveLength(2);
      expect(sqlQuery.params[0]).toBe(100);
    });
  });

  describe('TableSchema', () => {
    it('should define table structure', () => {
      const schema: TableSchema = {
        name: 'products',
        columns: [
          { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
          { name: 'name', type: 'TEXT', nullable: false },
          { name: 'price', type: 'REAL', nullable: true },
          { name: 'created_at', type: 'TEXT', nullable: false }
        ],
        indexes: [
          { name: 'idx_products_name', columns: ['name'] },
          { name: 'idx_products_price', columns: ['price'] }
        ]
      };

      expect(schema.name).toBe('products');
      expect(schema.columns).toHaveLength(4);
      expect(schema.columns[0].primaryKey).toBe(true);
      expect(schema.indexes).toHaveLength(2);
    });
  });
});
