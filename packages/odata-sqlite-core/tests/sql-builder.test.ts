import { describe, it, expect } from 'vitest';
import { SQLBuilder } from '../src/sql-builder';
import type { ODataQuery, TableSchema } from 'odata-sqlite-contracts';

describe('SQLBuilder', () => {
  const sqlBuilder = new SQLBuilder();
  const mockSchema: TableSchema = {
    name: 'products',
    columns: [
      { name: 'id', type: 'INTEGER', primaryKey: true },
      { name: 'name', type: 'TEXT' },
      { name: 'price', type: 'REAL' },
      { name: 'category', type: 'TEXT' },
      { name: 'created_at', type: 'TEXT' }
    ]
  };

  describe('buildSelectQuery', () => {
    it('should build basic SELECT query', () => {
      const query: ODataQuery = {
        top: 10,
        select: ['id', 'name', 'price']
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT id, name, price FROM products');
      expect(result.sql).toContain('LIMIT 10');
      expect(result.params).toHaveLength(0);
    });

    it('should build query with WHERE clause', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'eq',
          field: 'category',
          value: 'electronics'
        }
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT * FROM products');
      expect(result.sql).toContain('WHERE category = ?');
      expect(result.params).toHaveLength(1);
      expect(result.params[0]).toBe('electronics');
    });

    it('should build query with ORDER BY', () => {
      const query: ODataQuery = {
        orderBy: [
          { field: 'name', direction: 'asc' },
          { field: 'price', direction: 'desc' }
        ]
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT * FROM products');
      expect(result.sql).toContain('ORDER BY name ASC, price DESC');
    });

    it('should build query with complex filter', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'gt',
            field: 'price',
            value: 100
          },
          right: {
            operator: 'eq',
            field: 'category',
            value: 'electronics'
          }
        }
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT * FROM products');
      expect(result.sql).toContain('WHERE (price > ? AND category = ?)');
      expect(result.params).toHaveLength(2);
      expect(result.params[0]).toBe(100);
      expect(result.params[1]).toBe('electronics');
    });

    it('should build query with SKIP and TOP', () => {
      const query: ODataQuery = {
        top: 20,
        skip: 40
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT * FROM products');
      expect(result.sql).toContain('LIMIT 20 OFFSET 40');
    });

    it('should handle field mapping', () => {
      const query: ODataQuery = {
        select: ['productId', 'productName'],
        filter: {
          operator: 'eq',
          field: 'productId',
          value: 1
        }
      };

      const fieldMap = {
        'productId': 'id',
        'productName': 'name'
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema, fieldMap);
      
      expect(result.sql).toContain('SELECT id, name FROM products');
      expect(result.sql).toContain('WHERE id = ?');
      expect(result.params[0]).toBe(1);
    });
  });

  describe('buildCountQuery', () => {
    it('should build basic COUNT query', () => {
      const query: ODataQuery = {};

      const result = sqlBuilder.buildCountQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT COUNT(*) as count FROM products');
      expect(result.params).toHaveLength(0);
    });

    it('should build COUNT query with WHERE clause', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'gt',
          field: 'price',
          value: 50
        }
      };

      const result = sqlBuilder.buildCountQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('SELECT COUNT(*) as count FROM products');
      expect(result.sql).toContain('WHERE price > ?');
      expect(result.params).toHaveLength(1);
      expect(result.params[0]).toBe(50);
    });
  });

  describe('filter building', () => {
    it('should handle comparison operators', () => {
      const operators = [
        { op: 'eq', sql: '=' },
        { op: 'ne', sql: '!=' },
        { op: 'lt', sql: '<' },
        { op: 'le', sql: '<=' },
        { op: 'gt', sql: '>' },
        { op: 'ge', sql: '>=' }
      ];

      operators.forEach(({ op, sql }) => {
        const query: ODataQuery = {
          filter: {
            operator: op as any,
            field: 'price',
            value: 100
          }
        };

        const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
        expect(result.sql).toContain(`price ${sql} ?`);
        expect(result.params[0]).toBe(100);
      });
    });

    it('should handle logical operators', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'or',
          left: {
            operator: 'eq',
            field: 'category',
            value: 'electronics'
          },
          right: {
            operator: 'eq',
            field: 'category',
            value: 'books'
          }
        }
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('WHERE (category = ? OR category = ?)');
      expect(result.params).toHaveLength(2);
      expect(result.params[0]).toBe('electronics');
      expect(result.params[1]).toBe('books');
    });

    it('should handle IN operator', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'in',
          field: 'category',
          value: ['electronics', 'books', 'clothing']
        }
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('WHERE category IN (?, ?, ?)');
      expect(result.params).toHaveLength(3);
      expect(result.params).toEqual(['electronics', 'books', 'clothing']);
    });

    it('should handle string functions', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'contains',
          field: 'name',
          value: 'phone'
        }
      };

      const result = sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      
      expect(result.sql).toContain('WHERE name LIKE ?');
      expect(result.params[0]).toBe('%phone%');
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported operator', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'unsupported' as any,
          field: 'name',
          value: 'test'
        }
      };

      expect(() => {
        sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      }).toThrow('Unsupported operator: unsupported');
    });

    it('should validate field exists in schema', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'eq',
          field: 'nonexistent_field',
          value: 'test'
        }
      };

      expect(() => {
        sqlBuilder.buildSelectQuery(query, 'products', mockSchema);
      }).toThrow('Field nonexistent_field not found in schema');
    });
  });
});
