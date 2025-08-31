import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDatabaseManager, TestDatabaseConfig } from '../../utils/test-db';
import { SQLBuilder } from '../../../packages/odata-sqlite-core/src/sql-builder';
import type { ODataQuery, TableSchema } from '../../../packages/odata-sqlite-contracts/src';

describe('🎯 Real-World E-commerce Scenarios', () => {
  let dbManager: TestDatabaseManager;
  let connection: any;
  let sqlBuilder: SQLBuilder;
  let productSchema: TableSchema;
  let customerSchema: TableSchema;
  let orderSchema: TableSchema;

  beforeAll(async () => {
    // Create test database with e-commerce data
    const config: TestDatabaseConfig = {
      type: 'memory',
      dataset: 'ecommerce',
      volume: 'medium', // 1000 records
      options: {
        enableFTS: true,
        enableTriggers: true,
        seedData: true
      }
    };

    dbManager = new TestDatabaseManager(config);
    connection = await dbManager.createDatabase();
    sqlBuilder = new SQLBuilder();

    // Get table schemas
    productSchema = await dbManager.getTableSchema('products');
    customerSchema = await dbManager.getTableSchema('customers');
    orderSchema = await dbManager.getTableSchema('orders');
  });

  afterAll(async () => {
    await dbManager.cleanup();
  });

  describe('🛍️ Product Catalog Scenarios', () => {
    it('should find products by price range with pagination', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'ge',
            field: 'price',
            value: 100
          },
          right: {
            operator: 'le',
            field: '500',
            value: 500
          }
        },
        orderBy: [{ field: 'price', direction: 'asc' }],
        top: 20,
        skip: 0,
        select: ['id', 'name', 'price', 'brand']
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(20);
      
      // Verify price range
      result.forEach(product => {
        expect(product.price).toBeGreaterThanOrEqual(100);
        expect(product.price).toBeLessThanOrEqual(500);
      });

      // Verify sorting
      for (let i = 1; i < result.length; i++) {
        expect(result[i].price).toBeGreaterThanOrEqual(result[i - 1].price);
      }
    });

    it('should search products by brand and category', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'eq',
            field: 'brand',
            value: 'Apple'
          },
          right: {
            operator: 'eq',
            field: 'category_id',
            value: 1
          }
        },
        select: ['id', 'name', 'brand', 'category_id', 'price'],
        orderBy: [{ field: 'price', direction: 'desc' }]
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      result.forEach(product => {
        expect(product.brand).toBe('Apple');
        expect(product.category_id).toBe(1);
      });
    });

    it('should find products with high ratings and in stock', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'ge',
            field: 'rating_average',
            value: 4.0
          },
          right: {
            operator: 'gt',
            field: 'stock_quantity',
            value: 0
          }
        },
        select: ['id', 'name', 'rating_average', 'stock_quantity', 'price'],
        orderBy: [
          { field: 'rating_average', direction: 'desc' },
          { field: 'price', direction: 'asc' }
        ],
        top: 10
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(10);
      
      result.forEach(product => {
        expect(product.rating_average).toBeGreaterThanOrEqual(4.0);
        expect(product.stock_quantity).toBeGreaterThan(0);
      });
    });

    it('should find products by multiple colors using IN operator', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'in',
          field: 'color',
          value: ['Red', 'Blue', 'Black']
        },
        select: ['id', 'name', 'color', 'price'],
        orderBy: [{ field: 'color', direction: 'asc' }]
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      result.forEach(product => {
        expect(['Red', 'Blue', 'Black']).toContain(product.color);
      });
    });
  });

  describe('👥 Customer Management Scenarios', () => {
    it('should find high-value customers with recent activity', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'ge',
            field: 'total_spent',
            value: 1000
          },
          right: {
            operator: 'eq',
            field: 'status',
            value: 'active'
          }
        },
        select: ['id', 'first_name', 'last_name', 'total_spent', 'total_orders'],
        orderBy: [{ field: 'total_spent', direction: 'desc' }],
        top: 50
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'customers', customerSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'customers', customerSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(50);
      
      result.forEach(customer => {
        expect(customer.total_spent).toBeGreaterThanOrEqual(1000);
        expect(customer.status).toBe('active');
      });
    });

    it('should find customers by registration date range', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'ge',
            field: 'registration_date',
            value: '2023-01-01'
          },
          right: {
            operator: 'le',
            field: 'registration_date',
            value: '2023-12-31'
          }
        },
        select: ['id', 'email', 'registration_date', 'total_orders'],
        orderBy: [{ field: 'registration_date', direction: 'desc' }]
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'customers', customerSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'customers', customerSchema).sql
      );

      expect(result).toBeDefined();
      result.forEach(customer => {
        const regDate = new Date(customer.registration_date);
        expect(regDate.getFullYear()).toBe(2023);
      });
    });
  });

  describe('📦 Order Management Scenarios', () => {
    it('should find orders by status and amount range', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'eq',
            field: 'status',
            value: 'delivered'
          },
          right: {
            operator: 'and',
            left: {
              operator: 'ge',
              field: 'total_amount',
              value: 100
            },
            right: {
              operator: 'le',
              field: 'total_amount',
              value: 1000
            }
          }
        },
        select: ['id', 'order_number', 'total_amount', 'status', 'created_at'],
        orderBy: [{ field: 'total_amount', direction: 'desc' }],
        top: 25
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'orders', orderSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'orders', orderSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(25);
      
      result.forEach(order => {
        expect(order.status).toBe('delivered');
        expect(order.total_amount).toBeGreaterThanOrEqual(100);
        expect(order.total_amount).toBeLessThanOrEqual(1000);
      });
    });

    it('should find orders by payment status and date range', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'eq',
            field: 'payment_status',
            value: 'paid'
          },
          right: {
            operator: 'ge',
            field: 'created_at',
            value: '2023-06-01'
          }
        },
        select: ['id', 'order_number', 'payment_status', 'total_amount', 'created_at'],
        orderBy: [{ field: 'created_at', direction: 'desc' }]
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'orders', orderSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'orders', orderSchema).sql
      );

      expect(result).toBeDefined();
      result.forEach(order => {
        expect(order.payment_status).toBe('paid');
        const orderDate = new Date(order.created_at);
        expect(orderDate.getTime()).toBeGreaterThanOrEqual(new Date('2023-06-01').getTime());
      });
    });
  });

  describe('🔍 Advanced Search Scenarios', () => {
    it('should find products with complex filter combinations', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'or',
            left: {
              operator: 'eq',
              field: 'brand',
              value: 'Apple'
            },
            right: {
              operator: 'eq',
              field: 'brand',
              value: 'Samsung'
            }
          },
          right: {
            operator: 'and',
            left: {
              operator: 'ge',
              field: 'price',
              value: 200
            },
            right: {
              operator: 'le',
              field: 'price',
              value: 800
            }
          }
        },
        select: ['id', 'name', 'brand', 'price', 'rating_average'],
        orderBy: [{ field: 'rating_average', direction: 'desc' }],
        top: 15
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(15);
      
      result.forEach(product => {
        expect(['Apple', 'Samsung']).toContain(product.brand);
        expect(product.price).toBeGreaterThanOrEqual(200);
        expect(product.price).toBeLessThanOrEqual(800);
      });
    });

    it('should find products excluding certain categories', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'ne',
            field: 'category_id',
            value: 1
          },
          right: {
            operator: 'ne',
            field: 'category_id',
            value: 2
          }
        },
        select: ['id', 'name', 'category_id', 'price'],
        orderBy: [{ field: 'category_id', direction: 'asc' }]
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      result.forEach(product => {
        expect(product.category_id).not.toBe(1);
        expect(product.category_id).not.toBe(2);
      });
    });
  });

  describe('📊 Analytics Scenarios', () => {
    it('should count products by category', async () => {
      const query: ODataQuery = {
        select: ['category_id'],
        count: true
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildCountQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.get(sqlQuery.params);
        },
        sqlBuilder.buildCountQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
    });

    it('should find products with pagination and count', async () => {
      const query: ODataQuery = {
        filter: {
          operator: 'eq',
          field: 'is_active',
          value: 1
        },
        select: ['id', 'name', 'price'],
        top: 10,
        skip: 20,
        count: true
      };

      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(query, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(query, 'products', productSchema).sql
      );

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('⚡ Performance Validation', () => {
    it('should complete complex queries within performance limits', async () => {
      const complexQuery: ODataQuery = {
        filter: {
          operator: 'and',
          left: {
            operator: 'ge',
            field: 'price',
            value: 50
          },
          right: {
            operator: 'and',
            left: {
              operator: 'eq',
              field: 'is_active',
              value: 1
            },
            right: {
              operator: 'ge',
              field: 'stock_quantity',
              value: 5
            }
          }
        },
        select: ['id', 'name', 'price', 'brand', 'category_id'],
        orderBy: [
          { field: 'price', direction: 'desc' },
          { field: 'name', direction: 'asc' }
        ],
        top: 100
      };

      const startTime = performance.now();
      
      const result = await dbManager.measureQueryTime(
        async () => {
          const sqlQuery = sqlBuilder.buildSelectQuery(complexQuery, 'products', productSchema);
          const stmt = await connection.prepare(sqlQuery.sql);
          return await stmt.all(sqlQuery.params);
        },
        sqlBuilder.buildSelectQuery(complexQuery, 'products', productSchema).sql
      );

      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(100);
      expect(queryTime).toBeLessThan(100); // Should complete within 100ms
    });
  });
});
