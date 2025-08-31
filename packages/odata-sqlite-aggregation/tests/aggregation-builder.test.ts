import { describe, it, expect, beforeEach } from 'vitest';
import { AggregationBuilder } from '../src/aggregation-builder';
import type { TableSchema } from 'odata-sqlite-contracts';

describe('📊 AggregationBuilder - GROUP BY and Aggregations', () => {
  let aggregationBuilder: AggregationBuilder;
  let ordersSchema: TableSchema;
  let productsSchema: TableSchema;
  let customersSchema: TableSchema;

  beforeEach(() => {
    aggregationBuilder = new AggregationBuilder();
    
    // Define test schemas
    ordersSchema = {
      name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'customer_id', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'order_date', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'total_amount', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'status', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'region', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };

    productsSchema = {
      name: 'products',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'category', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'stock_quantity', type: 'INTEGER', primaryKey: false, nullable: false }
      ]
    };

    customersSchema = {
      name: 'customers',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'first_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'last_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'email', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'region', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };
  });

  describe('📊 Basic Aggregation Functions', () => {
    it('should generate COUNT aggregation', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'id', op: 'count', as: 'order_count' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT region, COUNT(id) as order_count');
      expect(result.sql).toContain('FROM orders');
      expect(result.sql).toContain('GROUP BY region');
    });

    it('should generate SUM aggregation', () => {
      const groupByFields = ['status'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT status, SUM(total_amount) as total_revenue');
      expect(result.sql).toContain('GROUP BY status');
    });

    it('should generate AVG aggregation', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'avg', as: 'average_order_value' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT region, AVG(total_amount) as average_order_value');
      expect(result.sql).toContain('GROUP BY region');
    });

    it('should generate MIN aggregation', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'min', as: 'min_price' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'products',
        productsSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT category, MIN(price) as min_price');
      expect(result.sql).toContain('GROUP BY category');
    });

    it('should generate MAX aggregation', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'max', as: 'max_price' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'products',
        productsSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT category, MAX(price) as max_price');
      expect(result.sql).toContain('GROUP BY category');
    });
  });

  describe('📊 Multiple Aggregations', () => {
    it('should handle multiple aggregations on same field', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' },
        { source: 'total_amount', op: 'avg', as: 'average_order' },
        { source: 'total_amount', op: 'min', as: 'min_order' },
        { source: 'total_amount', op: 'max', as: 'max_order' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SUM(total_amount) as total_revenue');
      expect(result.sql).toContain('AVG(total_amount) as average_order');
      expect(result.sql).toContain('MIN(total_amount) as min_order');
      expect(result.sql).toContain('MAX(total_amount) as max_order');
    });

    it('should handle multiple aggregations on different fields', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'avg', as: 'avg_price' },
        { source: 'stock_quantity', op: 'sum', as: 'total_stock' },
        { source: 'id', op: 'count', as: 'product_count' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'products',
        productsSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('AVG(price) as avg_price');
      expect(result.sql).toContain('SUM(stock_quantity) as total_stock');
      expect(result.sql).toContain('COUNT(id) as product_count');
    });
  });

  describe('📊 Multiple Group By Fields', () => {
    it('should handle multiple group by fields', () => {
      const groupByFields = ['region', 'status'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT region, status, SUM(total_amount) as total_revenue');
      expect(result.sql).toContain('GROUP BY region, status');
    });

    it('should handle complex group by with multiple aggregations', () => {
      const groupByFields = ['region', 'status', 'order_date'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'daily_revenue' },
        { source: 'id', op: 'count', as: 'daily_orders' }
      ];
      
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );

      expect(result.sql).toContain('SELECT region, status, order_date');
      expect(result.sql).toContain('SUM(total_amount) as daily_revenue');
      expect(result.sql).toContain('COUNT(id) as daily_orders');
      expect(result.sql).toContain('GROUP BY region, status, order_date');
    });
  });

  describe('📊 Aggregation with Filtering', () => {
    it('should combine aggregation with WHERE clause', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      const filter = 'status = "completed"';
      
      const result = aggregationBuilder.buildAggregationWithFilter(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates,
        filter
      );

      expect(result.sql).toContain('WHERE status = "completed"');
      expect(result.sql).toContain('GROUP BY region');
    });

    it('should handle complex filtering with aggregations', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'avg', as: 'avg_price' }
      ];
      const filter = 'stock_quantity > 0 AND price > 10';
      
      const result = aggregationBuilder.buildAggregationWithFilter(
        'products',
        productsSchema,
        groupByFields,
        aggregates,
        filter
      );

      expect(result.sql).toContain('WHERE stock_quantity > 0 AND price > 10');
      expect(result.sql).toContain('GROUP BY category');
    });
  });

  describe('📊 HAVING Clauses', () => {
    it('should generate HAVING clause for aggregation results', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      const having = 'total_revenue > 1000';
      
      const result = aggregationBuilder.buildAggregationWithHaving(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates,
        having
      );

      expect(result.sql).toContain('HAVING total_revenue > 1000');
    });

    it('should handle complex HAVING conditions', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'avg', as: 'avg_price' },
        { source: 'id', op: 'count', as: 'product_count' }
      ];
      const having = 'avg_price > 50 AND product_count > 5';
      
      const result = aggregationBuilder.buildAggregationWithHaving(
        'products',
        productsSchema,
        groupByFields,
        aggregates,
        having
      );

      expect(result.sql).toContain('HAVING avg_price > 50 AND product_count > 5');
    });
  });

  describe('📊 Aggregation with Ordering', () => {
    it('should order aggregation results', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      const orderBy = 'total_revenue DESC';
      
      const result = aggregationBuilder.buildAggregationWithOrdering(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates,
        orderBy
      );

      expect(result.sql).toContain('ORDER BY total_revenue DESC');
    });

    it('should handle multiple order by fields', () => {
      const groupByFields = ['region', 'status'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      const orderBy = 'total_revenue DESC, region ASC';
      
      const result = aggregationBuilder.buildAggregationWithOrdering(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates,
        orderBy
      );

      expect(result.sql).toContain('ORDER BY total_revenue DESC, region ASC');
    });
  });

  describe('📊 Complex Aggregation Scenarios', () => {
    it('should handle complete aggregation with all clauses', () => {
      const groupByFields = ['region', 'status'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' },
        { source: 'id', op: 'count', as: 'order_count' }
      ];
      const filter = 'order_date >= "2024-01-01"';
      const having = 'total_revenue > 1000';
      const orderBy = 'total_revenue DESC';
      
      const result = aggregationBuilder.buildComplexAggregation(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates,
        filter,
        having,
        orderBy
      );

      expect(result.sql).toContain('WHERE order_date >= "2024-01-01"');
      expect(result.sql).toContain('GROUP BY region, status');
      expect(result.sql).toContain('HAVING total_revenue > 1000');
      expect(result.sql).toContain('ORDER BY total_revenue DESC');
    });

    it('should handle e-commerce analytics aggregation', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'avg', as: 'avg_price' },
        { source: 'stock_quantity', op: 'sum', as: 'total_stock' },
        { source: 'id', op: 'count', as: 'product_count' }
      ];
      const filter = 'stock_quantity > 0';
      const having = 'avg_price > 25 AND product_count > 3';
      const orderBy = 'avg_price DESC, total_stock DESC';
      
      const result = aggregationBuilder.buildComplexAggregation(
        'products',
        productsSchema,
        groupByFields,
        aggregates,
        filter,
        having,
        orderBy
      );

      expect(result.sql).toContain('WHERE stock_quantity > 0');
      expect(result.sql).toContain('GROUP BY category');
      expect(result.sql).toContain('HAVING avg_price > 25 AND product_count > 3');
      expect(result.sql).toContain('ORDER BY avg_price DESC, total_stock DESC');
    });
  });

  describe('📊 Error Handling and Validation', () => {
    it('should validate group by fields exist in schema', () => {
      const groupByFields = ['non_existent_field'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      
      expect(() => {
        aggregationBuilder.buildAggregationQuery(
          'orders',
          ordersSchema,
          groupByFields,
          aggregates
        );
      }).toThrow('Field "non_existent_field" not found in table "orders"');
    });

    it('should validate aggregate source fields exist', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'non_existent_field', op: 'sum', as: 'total_revenue' }
      ];
      
      expect(() => {
        aggregationBuilder.buildAggregationQuery(
          'orders',
          ordersSchema,
          groupByFields,
          aggregates
        );
      }).toThrow('Field "non_existent_field" not found in table "orders"');
    });

    it('should validate aggregation operators', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'invalid_op', as: 'total_revenue' }
      ];
      
      expect(() => {
        aggregationBuilder.buildAggregationQuery(
          'orders',
          ordersSchema,
          groupByFields,
          aggregates
        );
      }).toThrow('Unsupported aggregation operator: invalid_op');
    });

    it('should require at least one group by field', () => {
      const groupByFields: string[] = [];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' }
      ];
      
      expect(() => {
        aggregationBuilder.buildAggregationQuery(
          'orders',
          ordersSchema,
          groupByFields,
          aggregates
        );
      }).toThrow('At least one group by field must be specified');
    });

    it('should require at least one aggregation', () => {
      const groupByFields = ['region'];
      const aggregates: any[] = [];
      
      expect(() => {
        aggregationBuilder.buildAggregationQuery(
          'orders',
          ordersSchema,
          groupByFields,
          aggregates
        );
      }).toThrow('At least one aggregation must be specified');
    });
  });

  describe('📊 Performance Optimizations', () => {
    it('should generate efficient aggregation queries', () => {
      const groupByFields = ['region', 'status'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' },
        { source: 'id', op: 'count', as: 'order_count' }
      ];
      
      const startTime = performance.now();
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.sql).toContain('GROUP BY region, status');
    });

    it('should handle large aggregation configurations efficiently', () => {
      const groupByFields = ['region', 'status', 'order_date'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_revenue' },
        { source: 'total_amount', op: 'avg', as: 'avg_revenue' },
        { source: 'total_amount', op: 'min', as: 'min_revenue' },
        { source: 'total_amount', op: 'max', as: 'max_revenue' },
        { source: 'id', op: 'count', as: 'order_count' }
      ];
      
      const startTime = performance.now();
      const result = aggregationBuilder.buildAggregationQuery(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.sql).toContain('GROUP BY region, status, order_date');
    });
  });

  describe('📊 Real-World Analytics Scenarios', () => {
    it('should handle sales analytics by region', () => {
      const groupByFields = ['region'];
      const aggregates = [
        { source: 'total_amount', op: 'sum', as: 'total_sales' },
        { source: 'total_amount', op: 'avg', as: 'avg_order_value' },
        { source: 'id', op: 'count', as: 'order_count' }
      ];
      const filter = 'status = "completed"';
      const having = 'total_sales > 5000';
      const orderBy = 'total_sales DESC';
      
      const result = aggregationBuilder.buildComplexAggregation(
        'orders',
        ordersSchema,
        groupByFields,
        aggregates,
        filter,
        having,
        orderBy
      );

      expect(result.sql).toContain('WHERE status = "completed"');
      expect(result.sql).toContain('GROUP BY region');
      expect(result.sql).toContain('HAVING total_sales > 5000');
      expect(result.sql).toContain('ORDER BY total_sales DESC');
    });

    it('should handle inventory analytics by category', () => {
      const groupByFields = ['category'];
      const aggregates = [
        { source: 'price', op: 'avg', as: 'avg_price' },
        { source: 'stock_quantity', op: 'sum', as: 'total_stock' },
        { source: 'stock_quantity', op: 'avg', as: 'avg_stock' },
        { source: 'id', op: 'count', as: 'product_count' }
      ];
      const filter = 'stock_quantity > 0';
      const having = 'total_stock > 100 AND avg_price > 20';
      const orderBy = 'total_stock DESC, avg_price DESC';
      
      const result = aggregationBuilder.buildComplexAggregation(
        'products',
        productsSchema,
        groupByFields,
        aggregates,
        filter,
        having,
        orderBy
      );

      expect(result.sql).toContain('WHERE stock_quantity > 0');
      expect(result.sql).toContain('GROUP BY category');
      expect(result.sql).toContain('HAVING total_stock > 100 AND avg_price > 20');
      expect(result.sql).toContain('ORDER BY total_stock DESC, avg_price DESC');
    });
  });
});
