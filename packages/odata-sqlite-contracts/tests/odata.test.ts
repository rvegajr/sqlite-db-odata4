import { describe, it, expect } from 'vitest';
import type { 
  ODataQuery, 
  ODataResult, 
  ODataOrderByField, 
  ODataSortDirection,
  ODataFilterOperator,
  ODataFilterExpression
} from '../src/odata';

describe('OData Query Interfaces', () => {
  describe('ODataQuery', () => {
    it('should support basic query parameters', () => {
      const query: ODataQuery = {
        top: 10,
        skip: 20,
        select: ['id', 'name'],
        orderBy: [{ field: 'name', direction: 'asc' }],
        count: true
      };

      expect(query.top).toBe(10);
      expect(query.skip).toBe(20);
      expect(query.select).toEqual(['id', 'name']);
      expect(query.count).toBe(true);
    });

    it('should support filter expressions', () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'eq',
            field: 'status',
            value: 'active'
          },
          right: {
            operator: 'gt',
            field: 'price',
            value: 100
          }
        }
      };

      expect(query.filter).toBeDefined();
      expect(query.filter?.operator).toBe('and');
    });

    it('should support expand operations', () => {
      const query: ODataQuery = {
        expand: [
          { path: 'customer' },
          { path: 'orderItems' }
        ]
      };

      expect(query.expand).toHaveLength(2);
      expect(query.expand?.[0].path).toBe('customer');
    });
  });

  describe('ODataResult', () => {
    it('should contain value array and optional metadata', () => {
      const result: ODataResult<{ id: number; name: string }> = {
        value: [
          { id: 1, name: 'Product 1' },
          { id: 2, name: 'Product 2' }
        ],
        count: 2,
        nextLink: 'http://api.example.com/odata/Products?$skip=20'
      };

      expect(result.value).toHaveLength(2);
      expect(result.count).toBe(2);
      expect(result.nextLink).toBeDefined();
    });

    it('should work with empty results', () => {
      const result: ODataResult<any> = {
        value: []
      };

      expect(result.value).toHaveLength(0);
      expect(result.count).toBeUndefined();
      expect(result.nextLink).toBeUndefined();
    });
  });

  describe('ODataOrderByField', () => {
    it('should support ascending and descending sort', () => {
      const ascSort: ODataOrderByField = {
        field: 'name',
        direction: 'asc'
      };

      const descSort: ODataOrderByField = {
        field: 'price',
        direction: 'desc'
      };

      expect(ascSort.direction).toBe('asc');
      expect(descSort.direction).toBe('desc');
    });
  });

  describe('ODataSortDirection', () => {
    it('should only allow valid sort directions', () => {
      const validDirections: ODataSortDirection[] = ['asc', 'desc'];
      
      expect(validDirections).toContain('asc');
      expect(validDirections).toContain('desc');
    });
  });

  describe('ODataFilterExpression', () => {
    it('should support comparison operators', () => {
      const eqFilter: ODataFilterExpression = {
        operator: 'eq',
        field: 'status',
        value: 'active'
      };

      const gtFilter: ODataFilterExpression = {
        operator: 'gt',
        field: 'price',
        value: 100
      };

      expect(eqFilter.operator).toBe('eq');
      expect(gtFilter.operator).toBe('gt');
    });

    it('should support logical operators', () => {
      const andFilter: ODataFilterExpression = {
        operator: 'and',
        left: {
          operator: 'eq',
          field: 'category',
          value: 'electronics'
        },
        right: {
          operator: 'gt',
          field: 'price',
          value: 50
        }
      };

      expect(andFilter.operator).toBe('and');
      expect(andFilter.left).toBeDefined();
      expect(andFilter.right).toBeDefined();
    });
  });

  describe('ODataFilterOperator', () => {
    it('should include all supported operators', () => {
      const operators: ODataFilterOperator[] = [
        'eq', 'ne', 'lt', 'le', 'gt', 'ge',
        'and', 'or', 'not',
        'in', 'contains', 'startswith', 'endswith'
      ];

      expect(operators).toContain('eq');
      expect(operators).toContain('and');
      expect(operators).toContain('contains');
    });
  });
});
