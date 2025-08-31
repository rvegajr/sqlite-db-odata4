import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ComputeBuilder } from '../src/compute-builder';
import type { TableSchema } from 'odata-sqlite-contracts';

describe('🧮 ComputeBuilder - Integration Tests with Real SQLite Database', () => {
  let db: Database.Database;
  let computeBuilder: ComputeBuilder;
  let ordersSchema: TableSchema;
  let productsSchema: TableSchema;
  let customersSchema: TableSchema;

  beforeEach(() => {
    // Create in-memory SQLite database for testing
    db = new Database(':memory:');
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

    // Create tables
    db.exec(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        customer_id INTEGER NOT NULL,
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL,
        shipping_amount REAL NOT NULL,
        discount_amount REAL NOT NULL,
        order_date TEXT NOT NULL
      );

      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        weight REAL NOT NULL,
        length REAL NOT NULL,
        width REAL NOT NULL,
        height REAL NOT NULL
      );

      CREATE TABLE customers (
        id INTEGER PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        registration_date TEXT NOT NULL
      );
    `);

    // Seed data
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, customer_id, subtotal, tax_amount, shipping_amount, discount_amount, order_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertProduct = db.prepare(`
      INSERT INTO products (id, name, price, cost, weight, length, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCustomer = db.prepare(`
      INSERT INTO customers (id, first_name, last_name, email, birth_date, registration_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Insert test data
    insertOrder.run(1, 1, 100.00, 8.50, 5.00, 10.00, '2024-01-15');
    insertOrder.run(2, 1, 250.00, 21.25, 8.00, 25.00, '2024-02-20');
    insertOrder.run(3, 2, 75.00, 6.38, 3.00, 0.00, '2024-03-10');
    insertOrder.run(4, 3, 500.00, 42.50, 15.00, 50.00, '2024-04-05');

    insertProduct.run(1, 'Laptop Pro', 1200.00, 800.00, 2.5, 35.0, 24.0, 2.0);
    insertProduct.run(2, 'Smartphone X', 800.00, 500.00, 0.2, 15.0, 7.5, 0.8);
    insertProduct.run(3, 'Tablet Air', 600.00, 350.00, 0.5, 25.0, 18.0, 0.7);
    insertProduct.run(4, 'Wireless Headphones', 150.00, 80.00, 0.3, 18.0, 15.0, 8.0);
    insertProduct.run(5, 'Gaming Mouse', 80.00, 45.00, 0.1, 12.0, 6.0, 4.0);

    insertCustomer.run(1, 'John', 'Doe', 'john.doe@email.com', '1990-05-15', '2020-01-10');
    insertCustomer.run(2, 'Jane', 'Smith', 'jane.smith@email.com', '1985-08-22', '2019-03-15');
    insertCustomer.run(3, 'Bob', 'Johnson', 'bob.johnson@email.com', '1995-12-03', '2021-06-20');
  });

  afterEach(() => {
    db.close();
  });

  describe('🧮 Real Database Integration Tests', () => {
    it('should execute basic arithmetic computation and return correct results', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );

      // Execute the generated SQL
      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(4);
      
      // Verify calculations
      expect(rows[0].total_amount).toBeCloseTo(113.50); // 100 + 8.50 + 5.00
      expect(rows[1].total_amount).toBeCloseTo(279.25); // 250 + 21.25 + 8.00
      expect(rows[2].total_amount).toBeCloseTo(84.38);  // 75 + 6.38 + 3.00
      expect(rows[3].total_amount).toBeCloseTo(557.50); // 500 + 42.50 + 15.00
    });

    it('should execute profit margin calculation with real data', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(5);
      
      // Verify profit margin calculations
      expect(rows[0].profit_margin_percent).toBeCloseTo(33.33); // (1200-800)/1200*100
      expect(rows[1].profit_margin_percent).toBeCloseTo(37.5);  // (800-500)/800*100
      expect(rows[2].profit_margin_percent).toBeCloseTo(41.67); // (600-350)/600*100
      expect(rows[3].profit_margin_percent).toBeCloseTo(46.67); // (150-80)/150*100
      expect(rows[4].profit_margin_percent).toBeCloseTo(43.75); // (80-45)/80*100
    });

    it('should execute string concatenation with real customer data', () => {
      const computeExpressions = [
        { expression: "first_name || ' ' || last_name", as: 'full_name' }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'customers',
        customersSchema,
        computeExpressions
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(3);
      
      // Verify string concatenation
      expect(rows[0].full_name).toBe('John Doe');
      expect(rows[1].full_name).toBe('Jane Smith');
      expect(rows[2].full_name).toBe('Bob Johnson');
    });

    it('should execute conditional computation with real data', () => {
      const computeExpressions = [
        { 
          expression: "CASE WHEN price > 500 THEN 'High' WHEN price > 200 THEN 'Medium' ELSE 'Low' END", 
          as: 'price_category' 
        }
      ];
      
      const result = computeBuilder.buildComputeQuery(
        'products',
        productsSchema,
        computeExpressions
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(5);
      
      // Verify conditional categorization
      expect(rows[0].price_category).toBe('High');   // Laptop Pro: 1200
      expect(rows[1].price_category).toBe('High');   // Smartphone X: 800
      expect(rows[2].price_category).toBe('High');   // Tablet Air: 600
      expect(rows[3].price_category).toBe('Low');    // Headphones: 150
      expect(rows[4].price_category).toBe('Low');    // Gaming Mouse: 80
    });

    it('should execute multiple computed properties in single query', () => {
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

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(4);
      
      // Verify first order calculations
      const firstOrder = rows[0];
      expect(firstOrder.total_amount).toBeCloseTo(113.50);    // 100 + 8.50 + 5.00
      expect(firstOrder.net_amount).toBeCloseTo(90.00);       // 100 - 10.00
      expect(firstOrder.additional_costs).toBeCloseTo(13.50); // 8.50 + 5.00
    });

    it('should execute compute with filtering', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' }
      ];
      const filter = 'price > 500';
      
      const result = computeBuilder.buildComputeWithFilter(
        'products',
        productsSchema,
        computeExpressions,
        filter
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(3); // Only products with price > 500
      
      // Verify filtered results
      expect(rows[0].profit_margin_percent).toBeCloseTo(33.33); // Laptop Pro
      expect(rows[1].profit_margin_percent).toBeCloseTo(37.5);  // Smartphone X
      expect(rows[2].profit_margin_percent).toBeCloseTo(41.67); // Tablet Air
    });

    it('should execute compute with ordering', () => {
      const computeExpressions = [
        { expression: '(price - cost) / price * 100', as: 'profit_margin_percent' }
      ];
      const orderBy = 'profit_margin_percent DESC';
      
      const result = computeBuilder.buildComputeWithOrdering(
        'products',
        productsSchema,
        computeExpressions,
        orderBy
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(5);
      
      // Verify ordering (highest to lowest profit margin)
      expect(rows[0].profit_margin_percent).toBeCloseTo(46.67); // Headphones
      expect(rows[1].profit_margin_percent).toBeCloseTo(43.75); // Gaming Mouse
      expect(rows[2].profit_margin_percent).toBeCloseTo(41.67); // Tablet Air
      expect(rows[3].profit_margin_percent).toBeCloseTo(37.5);  // Smartphone X
      expect(rows[4].profit_margin_percent).toBeCloseTo(33.33); // Laptop Pro
    });

    it('should execute complex compute with all clauses', () => {
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

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(2); // Only orders with subtotal > 100
      
      // Verify ordering by total_amount DESC
      expect(rows[0].total_amount).toBeCloseTo(557.50); // Order 4: 500 + 42.50 + 15.00
      expect(rows[1].total_amount).toBeCloseTo(279.25); // Order 2: 250 + 21.25 + 8.00
    });
  });

  describe('🧮 Advanced Helper Methods with Real Data', () => {
    it('should execute arithmetic compute helper method', () => {
      const result = computeBuilder.buildArithmeticCompute(
        'orders',
        ordersSchema,
        'subtotal',
        '+',
        'tax_amount',
        'subtotal_with_tax'
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(4);
      expect(rows[0].subtotal_with_tax).toBeCloseTo(108.50); // 100 + 8.50
      expect(rows[1].subtotal_with_tax).toBeCloseTo(271.25); // 250 + 21.25
    });

    it('should execute string concatenation compute helper method', () => {
      const result = computeBuilder.buildStringConcatenationCompute(
        'customers',
        customersSchema,
        ['first_name', 'last_name'],
        ' ',
        'full_name'
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(3);
      expect(rows[0].full_name).toBe('John Doe');
      expect(rows[1].full_name).toBe('Jane Smith');
      expect(rows[2].full_name).toBe('Bob Johnson');
    });

    it('should execute conditional compute helper method', () => {
      const result = computeBuilder.buildConditionalCompute(
        'products',
        productsSchema,
        'price > 500',
        "'High Value'",
        "'Standard'",
        'value_category'
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(5);
      expect(rows[0].value_category).toBe('High Value'); // Laptop Pro: 1200
      expect(rows[1].value_category).toBe('High Value'); // Smartphone X: 800
      expect(rows[2].value_category).toBe('High Value'); // Tablet Air: 600
      expect(rows[3].value_category).toBe('Standard');   // Headphones: 150
      expect(rows[4].value_category).toBe('Standard');   // Gaming Mouse: 80
    });

    it('should execute date compute helper method for age calculation', () => {
      const result = computeBuilder.buildDateCompute(
        'customers',
        customersSchema,
        'birth_date',
        'age',
        'customer_age'
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(3);
      expect(rows[0].customer_age).toBeGreaterThan(30); // John born 1990
      expect(rows[1].customer_age).toBeGreaterThan(35); // Jane born 1985
      expect(rows[2].customer_age).toBeGreaterThan(25); // Bob born 1995
    });

    it('should execute aggregate compute helper method', () => {
      const result = computeBuilder.buildAggregateCompute(
        'products',
        productsSchema,
        'avg',
        'price',
        'average_price'
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(1);
      expect(rows[0].average_price).toBeCloseTo(566.0); // (1200+800+600+150+80)/5
    });

    it('should execute string function compute helper method', () => {
      const result = computeBuilder.buildStringFunctionCompute(
        'customers',
        customersSchema,
        'upper',
        'first_name',
        'first_name_upper'
      );

      const stmt = db.prepare(result.sql);
      const rows = stmt.all();

      expect(rows).toHaveLength(3);
      expect(rows[0].first_name_upper).toBe('JOHN');
      expect(rows[1].first_name_upper).toBe('JANE');
      expect(rows[2].first_name_upper).toBe('BOB');
    });
  });

  describe('🧮 Error Handling with Real Database', () => {
    it('should handle invalid field references gracefully', () => {
      const computeExpressions = [
        { expression: 'nonexistent_field + 1', as: 'invalid_computation' }
      ];
      
      expect(() => {
        computeBuilder.buildComputeQuery(
          'orders',
          ordersSchema,
          computeExpressions
        );
      }).toThrow('Field "nonexistent_field" not found in table "orders"');
    });

    it('should handle invalid SQL syntax gracefully', () => {
      const computeExpressions = [
        { expression: 'subtotal + + tax_amount', as: 'invalid_syntax' } // Invalid double operator
      ];
      
      expect(() => {
        computeBuilder.buildComputeQuery(
          'orders',
          ordersSchema,
          computeExpressions
        );
      }).toThrow('Invalid compute expression syntax');
    });

    it('should handle empty alias gracefully', () => {
      const computeExpressions = [
        { expression: 'subtotal + tax_amount', as: '' }
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

  describe('🧮 Performance Tests with Real Data', () => {
    it('should handle large dataset efficiently', () => {
      // Insert 1000 additional orders for performance testing
      const insertOrder = db.prepare(`
        INSERT INTO orders (id, customer_id, subtotal, tax_amount, shipping_amount, discount_amount, order_date)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (let i = 5; i <= 1004; i++) {
        insertOrder.run(
          i,
          (i % 3) + 1,
          50 + (i * 10),
          4.25 + (i * 0.85),
          2 + (i * 0.5),
          i % 2 === 0 ? 5 : 0,
          '2024-01-01'
        );
      }

      const computeExpressions = [
        { expression: 'subtotal + tax_amount + shipping_amount', as: 'total_amount' }
      ];
      
      const startTime = Date.now();
      const result = computeBuilder.buildComputeQuery(
        'orders',
        ordersSchema,
        computeExpressions
      );
      const buildTime = Date.now() - startTime;

      const stmt = db.prepare(result.sql);
      const startQueryTime = Date.now();
      const rows = stmt.all();
      const queryTime = Date.now() - startQueryTime;

      expect(rows).toHaveLength(1004);
      expect(buildTime).toBeLessThan(100); // Should build SQL quickly
      expect(queryTime).toBeLessThan(1000); // Should query efficiently
    });
  });
});
