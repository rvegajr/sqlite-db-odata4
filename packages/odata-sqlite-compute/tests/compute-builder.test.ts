import { describe, it, expect, beforeEach } from 'vitest';
import { ComputeBuilder } from '../src/compute-builder';
import type { TableSchema } from 'odata-sqlite-contracts';

describe('🧮 ComputeBuilder - Computed Properties', () => {
  let computeBuilder: ComputeBuilder;
  let ordersSchema: TableSchema;
  let productsSchema: TableSchema;
  let customersSchema: TableSchema;

  beforeEach(() => {
    computeBuilder = new ComputeBuilder();
    
    // Define test schemas
    ordersSchema = {
      name: 'orders',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'customer_id', type: 'INTEGER', primaryKey: false, nullable: false },
        { name: 'subtotal', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'tax_amount', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'shipping_amount', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'discount_amount', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'order_date', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };

    productsSchema = {
      name: 'products',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'cost', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'weight', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'length', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'width', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'height', type: 'REAL', primaryKey: false, nullable: false }
      ]
    };

    customersSchema = {
      name: 'customers',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'first_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'last_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'email', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'birth_date', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'registration_date', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };
  });

  describe('🧮 Basic Arithmetic Computations', () => {
    it('should compute total amount from subtotal, tax, and shipping', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      expect(result.sql).toContain('SELECT *, (subtotal + tax_amount + shipping_amount) as total_amount');
      expect(result.sql).toContain('FROM orders');
    });

    it('should compute profit margin from price and cost', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      expect(result.sql).toContain('SELECT *, ((price - cost) / price * 100) as profit_margin_percent');
      expect(result.sql).toContain('FROM products');
    });

    it('should compute volume from dimensions', () => {
      const computeExpressions = [
        { expression: 'length * width * height', as: 'volume' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      expect(result.sql).toContain('SELECT *, (length * width * height) as volume');
      expect(result.sql).toContain('FROM products');
    });

    it('should compute net amount after discount', () => {
      const computeExpressions = [
        { expression: 'subtotal - discount_amount', as: 'net_amount' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      expect(result.sql).toContain('SELECT *, (subtotal - discount_amount) as net_amount');
      expect(result.sql).toContain('FROM orders');
    });
  });

  describe('🧮 Multiple Computed Properties', () => {
    it('should compute multiple properties in single query', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' },
        { expression: 'subtotal - discount_amount', as: 'net_amount' },
        { expression: 'tax_amount + shipping_amount', as: 'additional_costs' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      expect(result.sql).toContain('(subtotal + tax_amount + shipping_amount) as total_amount');
      expect(result.sql).toContain('(subtotal - discount_amount) as net_amount');
      expect(result.sql).toContain('(tax_amount + shipping_amount) as additional_costs');
    });

    it('should compute product metrics', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' },
        { expression: 'length * width * height', as: 'volume' },
        { expression: 'price * 1.1', as: 'price_with_markup' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      expect(result.sql).toContain('((price - cost) / price * 100) as profit_margin_percent');
      expect(result.sql).toContain('(length * width * height) as volume');
      expect(result.sql).toContain('(price * 1.1) as price_with_markup');
    });
  });

  describe('🧮 String Computations', () => {
    it('should compute full name from first and last name', () => {
      const computeExpressions = [
        { expression: "first_name || ' ' || last_name", as: 'full_name' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(first_name || ' ' || last_name) as full_name");
      expect(result.sql).toContain('FROM customers');
    });

    it('should compute email domain', () => {
      const computeExpressions = [
        { expression: "SUBSTR(email, INSTR(email, '@') + 1)", as: 'email_domain' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(SUBSTR(email, INSTR(email, '@') + 1)) as email_domain");
    });

    it('should compute uppercase name', () => {
      const computeExpressions = [
        { expression: 'UPPER(first_name)', as: 'first_name_upper' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      expect(result.sql).toContain('(UPPER(first_name)) as first_name_upper');
    });
  });

  describe('🧮 Date and Time Computations', () => {
    it('should compute customer age', () => {
      const computeExpressions = [
        { expression: "CAST((julianday('now') - julianday(birth_date)) / 365.25 AS INTEGER)", as: 'age' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(CAST((julianday('now') - julianday(birth_date)) / 365.25 AS INTEGER)) as age");
    });

    it('should compute days since registration', () => {
      const computeExpressions = [
        { expression: "CAST(julianday('now') - julianday(registration_date) AS INTEGER)", as: 'days_since_registration' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(CAST(julianday('now') - julianday(registration_date) AS INTEGER)) as days_since_registration");
    });

    it('should compute order age in days', () => {
      const computeExpressions = [
        { expression: "CAST(julianday('now') - julianday(order_date) AS INTEGER)", as: 'order_age_days' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(CAST(julianday('now') - julianday(order_date) AS INTEGER)) as order_age_days");
    });
  });

  describe('🧮 Conditional Computations', () => {
    it('should compute discount status', () => {
      const computeExpressions = [
        { expression: "CASE WHEN discount_amount > 0 THEN 'Yes' ELSE 'No' END", as: 'has_discount' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(CASE WHEN discount_amount > 0 THEN 'Yes' ELSE 'No' END) as has_discount");
    });

    it('should compute profit category', () => {
      const computeExpressions = [
        { expression: "CASE WHEN (price - cost) > 50 THEN 'High' WHEN (price - cost) > 20 THEN 'Medium' ELSE 'Low' END", as: 'profit_category' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(CASE WHEN (price - cost) > 50 THEN 'High' WHEN (price - cost) > 20 THEN 'Medium' ELSE 'Low' END) as profit_category");
    });

    it('should compute customer tier', () => {
      const computeExpressions = [
        { expression: "CASE WHEN julianday('now') - julianday(registration_date) > 365 THEN 'Long-term' WHEN julianday('now') - julianday(registration_date) > 90 THEN 'Medium-term' ELSE 'New' END", as: 'customer_tier' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      expect(result.sql).toContain("(CASE WHEN julianday('now') - julianday(registration_date) > 365 THEN 'Long-term' WHEN julianday('now') - julianday(registration_date) > 90 THEN 'Medium-term' ELSE 'New' END) as customer_tier");
    });
  });

  describe('🧮 Complex Mathematical Computations', () => {
    it('should compute weighted average', () => {
      const computeExpressions = [
        { expression: '(price * weight) / weight', as: 'weighted_average_price' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      expect(result.sql).toContain('((price * weight) / weight) as weighted_average_price');
    });

    it('should compute tax rate percentage', () => {
      const computeExpressions = [
        { expression: '(tax_amount / subtotal) * 100', as: 'tax_rate_percent' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      expect(result.sql).toContain('((tax_amount / subtotal) * 100) as tax_rate_percent');
    });

    it('should compute shipping cost per unit', () => {
      const computeExpressions = [
        { expression: 'weight / (length * width * height)', as: 'density' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      expect(result.sql).toContain('(weight / (length * width * height)) as density');
    });
  });

  describe('🧮 Compute with Filtering', () => {
    it('should combine compute with WHERE clause', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' }
      ];
      const filter = 'subtotal > 100';
      
      const result = computeBuilder.buildComputeWithFilter(
        'orders',
        ordersSchema,
        computeExpressions,
        filter
      );

      expect(result.sql).toContain('WHERE subtotal > 100');
      expect(result.sql).toContain('(subtotal + tax_amount + shipping_amount) as total_amount');
    });

    it('should handle complex filtering with compute', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' }
      ];
      const filter = 'price > 50 AND cost > 0';
      
      const result = computeBuilder.buildComputeWithFilter(
        'products',
        productsSchema,
        computeExpressions,
        filter
      );

      expect(result.sql).toContain('WHERE price > 50 AND cost > 0');
      expect(result.sql).toContain('((price - cost) / price * 100) as profit_margin_percent');
    });
  });

  describe('🧮 Compute with Ordering', () => {
    it('should order by computed property', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' }
      ];
      const orderBy = 'total_amount DESC';
      
      const result = computeBuilder.buildComputeWithOrdering(
        'orders',
        ordersSchema,
        computeExpressions,
        orderBy
      );

      expect(result.sql).toContain('ORDER BY total_amount DESC');
      expect(result.sql).toContain('(subtotal + tax_amount + shipping_amount) as total_amount');
    });

    it('should handle multiple order by fields including computed', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' }
      ];
      const orderBy = 'profit_margin_percent DESC, price ASC';
      
      const result = computeBuilder.buildComputeWithOrdering(
        'products',
        productsSchema,
        computeExpressions,
        orderBy
      );

      expect(result.sql).toContain('ORDER BY profit_margin_percent DESC, price ASC');
      expect(result.sql).toContain('((price - cost) / price * 100) as profit_margin_percent');
    });
  });

  describe('🧮 Complex Compute Scenarios', () => {
    it('should handle complete compute with all clauses', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' },
        { expression: 'subtotal - discount_amount', as: 'net_amount' }
      ];
      const filter = 'subtotal > 100';
      const orderBy = 'total_amount DESC';
      
      const result = computeBuilder.buildComplexCompute(
        'orders',
        ordersSchema,
        computeExpressions,
        filter,
        orderBy
      );

      expect(result.sql).toContain('WHERE subtotal > 100');
      expect(result.sql).toContain('(subtotal + tax_amount + shipping_amount) as total_amount');
      expect(result.sql).toContain('(subtotal - discount_amount) as net_amount');
      expect(result.sql).toContain('ORDER BY total_amount DESC');
    });

    it('should handle e-commerce product analytics', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' },
        { expression: 'length * width * height', as: 'volume' },
        { expression: "CASE WHEN (price - cost) > 50 THEN 'High' WHEN (price - cost) > 20 THEN 'Medium' ELSE 'Low' END", as: 'profit_category' }
      ];
      const filter = 'price > 10 AND cost > 0';
      const orderBy = 'profit_margin_percent DESC, volume ASC';
      
      const result = computeBuilder.buildComplexCompute(
        'products',
        productsSchema,
        computeExpressions,
        filter,
        orderBy
      );

      expect(result.sql).toContain('WHERE price > 10 AND cost > 0');
      expect(result.sql).toContain('((price - cost) / price * 100) as profit_margin_percent');
      expect(result.sql).toContain('(length * width * height) as volume');
      expect(result.sql).toContain("(CASE WHEN (price - cost) > 50 THEN 'High' WHEN (price - cost) > 20 THEN 'Medium' ELSE 'Low' END) as profit_category");
      expect(result.sql).toContain('ORDER BY profit_margin_percent DESC, volume ASC');
    });
  });

  describe('🧮 Error Handling and Validation', () => {
    it('should validate compute expressions', () => {
      const computeExpressions: any[] = [];
      
      expect(() => {
        computeBuilder.buildComputeQuery(
          'orders',
          ordersSchema,
          computeExpressions
        );
      }).toThrow('At least one compute expression must be specified');
    });

    it('should validate expression syntax', () => {
      const computeExpressions = [
        { expression: 'invalid syntax', as: 'test' }
      ];
      
      expect(() => {
        computeBuilder.buildComputeQuery(
          'orders',
          ordersSchema,
          computeExpressions
        );
      }).toThrow('Invalid compute expression syntax');
    });

    it('should validate field references exist in schema', () => {
      const computeExpressions = [
        { expression: 'non_existent_field + 1', as: 'test' }
      ];
      
      expect(() => {
        computeBuilder.buildComputeQuery(
          'orders',
          ordersSchema,
          computeExpressions
        );
      }).toThrow('Field "non_existent_field" not found in table "orders"');
    });

    it('should validate alias names', () => {
      const computeExpressions = [
        { expression: 'subtotal + 1', as: '' }
      ];
      
      expect(() => {
        computeBuilder.buildComputeQuery(
          'orders',
          ordersSchema,
          computeExpressions
        );
      }).toThrow('Compute alias cannot be empty');
    });
  });

  describe('🧮 Performance Optimizations', () => {
    it('should generate efficient compute queries', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' },
        { expression: 'subtotal - discount_amount', as: 'net_amount' }
      ];
      
      const startTime = performance.now();
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.sql).toContain('total_amount');
      expect(result.sql).toContain('net_amount');
    });

    it('should handle large compute configurations efficiently', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' },
        { expression: 'subtotal - discount_amount', as: 'net_amount' },
        { expression: 'tax_amount + shipping_amount', as: 'additional_costs' },
        { expression: '(tax_amount / subtotal) * 100', as: 'tax_rate_percent' },
        { expression: "CASE WHEN discount_amount > 0 THEN 'Yes' ELSE 'No' END", as: 'has_discount' }
      ];
      
      const startTime = performance.now();
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.sql).toContain('total_amount');
      expect(result.sql).toContain('net_amount');
      expect(result.sql).toContain('additional_costs');
      expect(result.sql).toContain('tax_rate_percent');
      expect(result.sql).toContain('has_discount');
    });
  });

  describe('🧮 Real-World Business Scenarios', () => {
    it('should handle order total calculations', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' },
        { expression: 'subtotal - discount_amount', as: 'net_amount' },
        { expression: '(tax_amount / subtotal) * 100', as: 'tax_rate_percent' },
        { expression: "CASE WHEN discount_amount > 0 THEN 'Discounted' ELSE 'Full Price' END", as: 'pricing_status' }
      ];
      const filter = 'subtotal > 50';
      const orderBy = 'total_amount DESC';
      
      const result = computeBuilder.buildComplexCompute(
        'orders',
        ordersSchema,
        computeExpressions,
        filter,
        orderBy
      );

      expect(result.sql).toContain('WHERE subtotal > 50');
      expect(result.sql).toContain('(subtotal + tax_amount + shipping_amount) as total_amount');
      expect(result.sql).toContain('(subtotal - discount_amount) as net_amount');
      expect(result.sql).toContain('((tax_amount / subtotal) * 100) as tax_rate_percent');
      expect(result.sql).toContain("(CASE WHEN discount_amount > 0 THEN 'Discounted' ELSE 'Full Price' END) as pricing_status");
      expect(result.sql).toContain('ORDER BY total_amount DESC');
    });

    it('should handle product profitability analysis', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' },
        { expression: 'price - cost', as: 'profit_amount' },
        { expression: 'length * width * height', as: 'volume' },
        { expression: "CASE WHEN (price - cost) > 50 THEN 'High' WHEN (price - cost) > 20 THEN 'Medium' ELSE 'Low' END", as: 'profit_category' },
        { expression: 'price * 1.1', as: 'suggested_price_with_markup' }
      ];
      const filter = 'price > 10 AND cost > 0';
      const orderBy = 'profit_margin_percent DESC, volume ASC';
      
      const result = computeBuilder.buildComplexCompute(
        'products',
        productsSchema,
        computeExpressions,
        filter,
        orderBy
      );

      expect(result.sql).toContain('WHERE price > 10 AND cost > 0');
      expect(result.sql).toContain('((price - cost) / price * 100) as profit_margin_percent');
      expect(result.sql).toContain('(price - cost) as profit_amount');
      expect(result.sql).toContain('(length * width * height) as volume');
      expect(result.sql).toContain("(CASE WHEN (price - cost) > 50 THEN 'High' WHEN (price - cost) > 20 THEN 'Medium' ELSE 'Low' END) as profit_category");
      expect(result.sql).toContain('(price * 1.1) as suggested_price_with_markup');
      expect(result.sql).toContain('ORDER BY profit_margin_percent DESC, volume ASC');
    });
  });
});
