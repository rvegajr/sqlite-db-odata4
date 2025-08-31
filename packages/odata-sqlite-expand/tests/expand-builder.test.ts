import { describe, it, expect, beforeEach } from 'vitest';
import { ExpandBuilder } from '../src/expand-builder';
import type { ODataExpandField, TableSchema, ForeignKeyRelationship } from 'odata-sqlite-contracts';

describe('🎯 ExpandBuilder - JOIN Operations', () => {
  let expandBuilder: ExpandBuilder;
  let ordersSchema: TableSchema;
  let customersSchema: TableSchema;
  let orderItemsSchema: TableSchema;
  let addressSchema: TableSchema;
  let relationships: ForeignKeyRelationship[];

  beforeEach(() => {
    expandBuilder = new ExpandBuilder();
    
    // Define test schemas
    ordersSchema = {
      name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'customer_id', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'order_number', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'total_amount', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'status', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };

    customersSchema = {
      name: 'customers',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'first_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'last_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'email', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };

    orderItemsSchema = {
      name: 'order_items',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'order_id', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'product_id', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'quantity', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'unit_price', type: 'REAL', primaryKey: false, nullable: false }
      ]
    };

    addressSchema = {
      name: 'customer_addresses',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'customer_id', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'street', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'city', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'country', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };

    // Define relationships
    relationships = [
      {
        fromTable: 'orders',
        fromColumn: 'customer_id',
        toTable: 'customers',
        toColumn: 'id',
        name: 'customer'
      },
      {
        fromTable: 'order_items',
        fromColumn: 'order_id',
        toTable: 'orders',
        toColumn: 'id',
        name: 'order'
      },
      {
        fromTable: 'orders',
        fromColumn: 'id',
        toTable: 'order_items',
        toColumn: 'order_id',
        name: 'order_items'
      },
      {
        fromTable: 'customers',
        fromColumn: 'id',
        toTable: 'customer_addresses',
        toColumn: 'customer_id',
        name: 'address'
      }
    ];
  });

  describe('🔗 Single Level Expand', () => {
    it('should generate LEFT JOIN for single expand', () => {
      const expand: ODataExpandField[] = [{ path: 'customer' }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.joins).toHaveLength(1);
      expect(result.joins[0]).toContain('LEFT JOIN customers');
      expect(result.joins[0]).toContain('orders.customer_id = customers.id');
      expect(result.selectFields).toContain('customers.id as customer_id');
      expect(result.selectFields).toContain('customers.first_name as customer_first_name');
    });

    it('should handle expand with field selection', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer', 
        select: ['first_name', 'email'] 
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.selectFields).toContain('customers.first_name as customer_first_name');
      expect(result.selectFields).toContain('customers.email as customer_email');
      expect(result.selectFields).not.toContain('customers.last_name');
    });

    it('should handle expand with filtering', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer',
        filter: {
          operator: 'eq',
          field: 'status',
          value: 'active'
        }
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.joins[0]).toContain('customers.status = ?');
      expect(result.parameters).toContain('active');
    });

    it('should handle expand with ordering', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer',
        orderBy: [{ field: 'first_name', direction: 'asc' }]
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.orderBy).toContain('customers.first_name ASC');
    });

    it('should handle expand with pagination', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer',
        top: 10,
        skip: 5
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });
  });

  describe('🔗 Multi-Level Expand', () => {
    it('should generate nested JOINs for multi-level expand', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'order',
        nested: [{ path: 'customer' }]
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'order_items', 
        [orderItemsSchema, ordersSchema, customersSchema, addressSchema], 
        relationships
      );

      expect(result.joins).toHaveLength(2);
      expect(result.joins[0]).toContain('LEFT JOIN orders');
      expect(result.joins[1]).toContain('LEFT JOIN customers');
      expect(result.selectFields).toContain('customers.first_name as order_customer_first_name');
    });

    it('should handle complex nested expands with filtering', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'order',
        filter: { operator: 'eq', field: 'status', value: 'pending' },
        nested: [{ 
          path: 'customer',
          filter: { operator: 'eq', field: 'status', value: 'active' }
        }]
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'order_items', 
        [orderItemsSchema, ordersSchema, customersSchema, addressSchema], 
        relationships
      );

      expect(result.joins[0]).toContain('orders.status = ?');
      expect(result.joins[1]).toContain('customers.status = ?');
      expect(result.parameters).toContain('pending');
      expect(result.parameters).toContain('active');
    });
  });

  describe('🔗 Multiple Expands', () => {
    it('should handle multiple expands at same level', () => {
      const expand: ODataExpandField[] = [
        { path: 'customer' },
        { path: 'order_items' }
      ];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.joins).toHaveLength(2);
      expect(result.joins[0]).toContain('LEFT JOIN customers');
      expect(result.joins[1]).toContain('LEFT JOIN order_items');
    });

    it('should handle multiple expands with different configurations', () => {
      const expand: ODataExpandField[] = [
        { 
          path: 'customer', 
          select: ['first_name', 'email'],
          filter: { operator: 'eq', field: 'status', value: 'active' }
        },
        { 
          path: 'order_items', 
          top: 5,
          orderBy: [{ field: 'quantity', direction: 'desc' }]
        }
      ];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.joins).toHaveLength(2);
      expect(result.selectFields).toContain('customers.first_name as customer_first_name');
      expect(result.selectFields).toContain('customers.email as customer_email');
      expect(result.orderBy).toContain('order_items.quantity DESC');
      expect(result.limit).toBe(5);
    });
  });

  describe('🔗 Error Handling', () => {
    it('should throw error for non-existent relationship', () => {
      const expand: ODataExpandField[] = [{ path: 'non_existent' }];
      
      expect(() => {
        expandBuilder.buildExpandClause(
          expand, 
          'orders', 
          [ordersSchema, customersSchema], 
          relationships
        );
      }).toThrow('Relationship "non_existent" not found for table "orders"');
    });

    it('should throw error for invalid nested expand', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer',
        nested: [{ path: 'non_existent' }]
      }];
      
      expect(() => {
        expandBuilder.buildExpandClause(
          expand, 
          'orders', 
          [ordersSchema, customersSchema], 
          relationships
        );
      }).toThrow('Relationship "non_existent" not found for table "customers"');
    });

    it('should throw error for invalid field selection', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer',
        select: ['non_existent_field']
      }];
      
      expect(() => {
        expandBuilder.buildExpandClause(
          expand, 
          'orders', 
          [ordersSchema, customersSchema], 
          relationships
        );
      }).toThrow('Field "non_existent_field" not found in table "customers"');
    });
  });

  describe('🔗 Performance Optimizations', () => {
    it('should generate efficient JOIN order', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'order',
        nested: [{ path: 'customer' }]
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'order_items', 
        [orderItemsSchema, ordersSchema, customersSchema], 
        relationships
      );

      // Should join orders first, then customers
      expect(result.joins[0]).toContain('LEFT JOIN orders');
      expect(result.joins[1]).toContain('LEFT JOIN customers');
    });

    it('should handle large expand configurations efficiently', () => {
      const expand: ODataExpandField[] = [
        { path: 'customer', select: ['first_name', 'email'] },
        { path: 'order_items', select: ['quantity', 'unit_price'] }
      ];
      
      const startTime = performance.now();
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema], 
        relationships
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.joins).toHaveLength(2);
    });
  });

  describe('🔗 Complex Real-World Scenarios', () => {
    it('should handle e-commerce order expansion', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'customer',
        select: ['first_name', 'last_name', 'email'],
        filter: { operator: 'eq', field: 'status', value: 'active' },
        nested: [{ 
          path: 'address',
          select: ['street', 'city', 'country']
        }]
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'orders', 
        [ordersSchema, customersSchema, orderItemsSchema, addressSchema], 
        relationships
      );

      expect(result.joins).toHaveLength(2);
      expect(result.selectFields).toContain('customers.first_name as customer_first_name');
      expect(result.selectFields).toContain('customers.last_name as customer_last_name');
      expect(result.selectFields).toContain('customers.email as customer_email');
    });

    it('should handle complex nested filtering', () => {
      const expand: ODataExpandField[] = [{ 
        path: 'order',
        filter: { 
          operator: 'and',
          left: { operator: 'eq', field: 'status', value: 'pending' },
          right: { operator: 'ge', field: 'total_amount', value: 100 }
        },
        nested: [{ 
          path: 'customer',
          filter: { 
            operator: 'or',
            left: { operator: 'eq', field: 'status', value: 'active' },
            right: { operator: 'eq', field: 'status', value: 'premium' }
          }
        }]
      }];
      
      const result = expandBuilder.buildExpandClause(
        expand, 
        'order_items', 
        [orderItemsSchema, ordersSchema, customersSchema], 
        relationships
      );

      expect(result.parameters).toContain('pending');
      expect(result.parameters).toContain(100);
      expect(result.parameters).toContain('active');
      expect(result.parameters).toContain('premium');
    });
  });
});
