import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ExpressODataHandler } from '../src/express-odata-handler';
import type { TableSchema, ForeignKeyRelationship } from 'odata-sqlite-contracts';

describe('🚀 ExpressODataHandler - Express Integration', () => {
  let app: express.Application;
  let handler: ExpressODataHandler;
  let mockConnection: any;
  let productsSchema: TableSchema;
  let customersSchema: TableSchema;
  let relationships: ForeignKeyRelationship[];

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock connection with proper SQLite-like interface
    mockConnection = {
      prepare: vi.fn((sql: string) => ({
        all: vi.fn((...params: any[]) => {
          // Mock data based on the SQL query
          if (sql.includes('SELECT * FROM products')) {
            return [
              { id: 1, name: 'Laptop', price: 1200.00, category_id: 1 },
              { id: 2, name: 'Mouse', price: 25.00, category_id: 2 },
              { id: 3, name: 'Keyboard', price: 75.00, category_id: 2 },
              { id: 4, name: 'Monitor', price: 300.00, category_id: 1 },
              { id: 5, name: 'Headphones', price: 150.00, category_id: 3 }
            ];
          }
          if (sql.includes('SELECT * FROM Categories')) {
            return [
              { id: 1, name: 'Electronics', description: 'Electronic devices' },
              { id: 2, name: 'Accessories', description: 'Computer accessories' },
              { id: 3, name: 'Audio', description: 'Audio equipment' }
            ];
          }
          if (sql.includes('COUNT(*)')) {
            return [{ count: 5 }];
          }
          return [];
        }),
        get: vi.fn((...params: any[]) => {
          if (sql.includes('SELECT * FROM products WHERE id = ?')) {
            const id = params[0];
            if (id === 1) {
              return { id: 1, name: 'Laptop', price: 1200.00, category_id: 1 };
            }
          }
          if (sql.includes('COUNT(*)')) {
            return { count: 5 };
          }
          return null;
        }),
        run: vi.fn((...params: any[]) => ({
          lastInsertRowid: 6,
          changes: 1
        }))
      }))
    };

    // Define test schemas
    productsSchema = {
      name: 'products',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
        { name: 'category_id', type: 'INTEGER', primaryKey: false, nullable: false }
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

    const categoriesSchema = {
      name: 'Categories',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'description', type: 'TEXT', primaryKey: false, nullable: true }
      ]
    };

    relationships = [
      {
        fromTable: 'products',
        fromColumn: 'category_id',
        toTable: 'Categories',
        toColumn: 'id',
        name: 'category'
      }
    ];

    handler = new ExpressODataHandler({
      connection: mockConnection,
      schemas: {
        'Products': productsSchema,
        'Customers': customersSchema,
        'Categories': categoriesSchema
      },
      relationships,
      searchConfig: [
        {
          table: 'products',
          ftsTable: 'products_fts',
          columns: ['name']
        }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('🚀 Route Registration', () => {
    it('should register OData routes for a resource', () => {
      const router = handler.createODataRouter('Products', '/api/odata');

      expect(router).toBeDefined();
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.put).toBe('function');
      expect(typeof router.delete).toBe('function');
    });

    it('should register routes with correct paths', () => {
      const router = handler.createODataRouter('Products', '/api/odata');
      
      // Check that router has the expected methods
      expect(router).toBeDefined();
      expect(typeof router.get).toBe('function');
      expect(typeof router.post).toBe('function');
      expect(typeof router.put).toBe('function');
      expect(typeof router.delete).toBe('function');
    });

    it('should register $count endpoint', async () => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
      
      mockConnection.query.mockResolvedValue([{ count: 2 }]);
      
      const response = await request(app)
        .get('/api/odata/Products/$count')
        .expect(200);
      
      expect(response).toBeDefined();
    });

    it('should register $metadata endpoint', async () => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
      
      const response = await request(app)
        .get('/api/odata/$metadata')
        .expect(200);
      
      expect(response).toBeDefined();
    });
  });

  describe('🚀 GET Endpoints', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should handle GET /Products', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 },
        { id: 2, name: 'Smartphone X', price: 800.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products')
        .expect(200);

      expect(response.body['@odata.context']).toBe('/api/odata/$metadata#Products');
      expect(response.body.value).toHaveLength(2);
      expect(response.body.value[0].name).toBe('Laptop Pro');
    });

    it('should handle GET /Products with $filter', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$filter=price gt 1000')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
      expect(response.body.value[0].price).toBe(1200.00);
    });

    it('should handle GET /Products with $expand', async () => {
      mockConnection.query.mockResolvedValue([
        { 
          id: 1, 
          name: 'Laptop Pro', 
          price: 1200.00,
          category_id: 1,
          category_name: 'Computers'
        }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$expand=category')
        .expect(200);

      expect(response.body.value[0].category_name).toBeDefined();
      expect(response.body.value[0].category_name).toBe('Computers');
    });

    it('should handle GET /Products with $search', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$search=laptop')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
    });

    it('should handle GET /Products with $compute', async () => {
      mockConnection.query.mockResolvedValue([
        { 
          id: 1, 
          name: 'Laptop Pro', 
          price: 1200.00,
          price_with_tax: 1320.00
        }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$compute=price * 1.1 as price_with_tax')
        .expect(200);

      expect(response.body.value[0].price_with_tax).toBe(1320.00);
    });

    it('should handle GET /Products with $top and $skip', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 2, name: 'Smartphone X', price: 800.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$top=1&$skip=1')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
      expect(response.body.value[0].id).toBe(2);
    });

    it('should handle GET /Products with $orderby', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 },
        { id: 2, name: 'Smartphone X', price: 800.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$orderby=price desc')
        .expect(200);

      expect(response.body.value[0].price).toBe(1200.00);
      expect(response.body.value[1].price).toBe(800.00);
    });

    it('should handle GET /Products(1)', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products(1)')
        .expect(200);

      expect(response.body['@odata.context']).toBe('/api/odata/$metadata#Products/$entity');
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Laptop Pro');
    });

    it('should handle GET /Products/$count', async () => {
      mockConnection.query.mockResolvedValue([{ count: 5 }]);

      const response = await request(app)
        .get('/api/odata/Products/$count')
        .expect(200);

      expect(response.text).toBe('5');
    });

    it('should handle GET /$metadata', async () => {
      const response = await request(app)
        .get('/api/odata/$metadata')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/xml');
      expect(response.text).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(response.text).toContain('<edmx:Edmx Version="4.0"');
    });

    it('should handle navigation properties', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Computers' }
      ]);

      const response = await request(app)
        .get('/api/odata/Products(1)/category')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
      expect(response.body.value[0].name).toBe('Computers');
    });
  });

  describe('🚀 POST Endpoints', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should handle POST /Products', async () => {
      const newProduct = { name: 'New Product', price: 500.00, category_id: 1 };
      mockConnection.query.mockResolvedValue([{ id: 3, ...newProduct }]);

      const response = await request(app)
        .post('/api/odata/Products')
        .send(newProduct)
        .expect(201);

      expect(response.body['@odata.context']).toBe('/api/odata/$metadata#Products/$entity');
      expect(response.body.id).toBe(3);
      expect(response.body.name).toBe('New Product');
    });

    it('should validate required fields', async () => {
      const invalidProduct = { name: 'New Product' }; // Missing required fields

      const response = await request(app)
        .post('/api/odata/Products')
        .send(invalidProduct)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Required field');
    });

    it('should handle database errors', async () => {
      mockConnection.query.mockRejectedValue(new Error('Database error'));

      const newProduct = { name: 'New Product', price: 500.00, category_id: 1 };

      const response = await request(app)
        .post('/api/odata/Products')
        .send(newProduct)
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Database error');
    });
  });

  describe('🚀 PUT Endpoints', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should handle PUT /Products(1)', async () => {
      const updatedProduct = { name: 'Updated Product', price: 600.00, category_id: 1 };
      mockConnection.query.mockResolvedValue([{ id: 1, ...updatedProduct }]);

      const response = await request(app)
        .put('/api/odata/Products(1)')
        .send(updatedProduct)
        .expect(200);

      expect(response.body['@odata.context']).toBe('/api/odata/$metadata#Products/$entity');
      expect(response.body.id).toBe(1);
      expect(response.body.name).toBe('Updated Product');
    });

    it('should return 404 for non-existent resource', async () => {
      mockConnection.query.mockResolvedValue([]);

      const updatedProduct = { name: 'Updated Product', price: 600.00, category_id: 1 };

      const response = await request(app)
        .put('/api/odata/Products(999)')
        .send(updatedProduct)
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Resource not found');
    });
  });

  describe('🚀 DELETE Endpoints', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should handle DELETE /Products(1)', async () => {
      mockConnection.query.mockResolvedValue({ changes: 1 });

      await request(app)
        .delete('/api/odata/Products(1)')
        .expect(204);
    });

    it('should return 404 for non-existent resource', async () => {
      mockConnection.query.mockResolvedValue({ changes: 0 });

      const response = await request(app)
        .delete('/api/odata/Products(999)')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Resource not found');
    });
  });

  describe('🚀 Error Handling', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should handle resource not found', async () => {
      const response = await request(app)
        .get('/api/odata/Nonexistent')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Resource not found');
    });

    it('should handle invalid query parameters', async () => {
      const response = await request(app)
        .get('/api/odata/Products?$filter=invalid')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Invalid filter');
    });

    it('should handle database errors', async () => {
      mockConnection.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/odata/Products')
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Database connection failed');
    });

    it('should handle unsupported methods', async () => {
      const response = await request(app)
        .patch('/api/odata/Products')
        .expect(405);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Method not allowed');
    });
  });

  describe('🚀 Middleware Integration', () => {
    it('should work with custom middleware', async () => {
      // Add custom middleware
      app.use((req, res, next) => {
        req.headers['x-custom-header'] = 'test-value';
        next();
      });

      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);

      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
    });

    it('should work with authentication middleware', async () => {
      // Mock authentication middleware
      app.use((req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });

      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);

      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      // Should fail without auth
      await request(app)
        .get('/api/odata/Products')
        .expect(401);

      // Should succeed with auth
      const response = await request(app)
        .get('/api/odata/Products')
        .set('Authorization', 'Bearer token')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
    });
  });

  describe('🚀 Multiple Resources', () => {
    it('should handle multiple resources on same app', async () => {
      const productsRouter = handler.createODataRouter('Products', '/api/odata');
      const customersRouter = handler.createODataRouter('Customers', '/api/odata');

      app.use('/api/odata', productsRouter);
      app.use('/api/odata', customersRouter);

      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const productsResponse = await request(app)
        .get('/api/odata/Products')
        .expect(200);

      expect(productsResponse.body.value).toHaveLength(1);

      mockConnection.query.mockResolvedValue([
        { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com' }
      ]);

      const customersResponse = await request(app)
        .get('/api/odata/Customers')
        .expect(200);

      expect(customersResponse.body.value).toHaveLength(1);
    });
  });

  describe('🚀 OData v4 Compliance', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should return proper OData v4 response format', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products')
        .expect(200);

      expect(response.body).toHaveProperty('@odata.context');
      expect(response.body).toHaveProperty('value');
      expect(Array.isArray(response.body.value)).toBe(true);
    });

    it('should return proper OData v4 error format', async () => {
      const response = await request(app)
        .get('/api/odata/Nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
    });

    it('should handle $count with proper format', async () => {
      mockConnection.query.mockResolvedValue([{ count: 5 }]);

      const response = await request(app)
        .get('/api/odata/Products/$count')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toBe('5');
    });

    it('should handle $metadata with proper XML format', async () => {
      const response = await request(app)
        .get('/api/odata/$metadata')
        .expect(200);

      expect(response.headers['content-type']).toContain('application/xml');
      expect(response.text).toContain('<?xml version="1.0" encoding="utf-8"?>');
      expect(response.text).toContain('<edmx:Edmx Version="4.0"');
      expect(response.text).toContain('<EntityType Name="Products"');
    });
  });

  describe('🚀 Complex Queries', () => {
    beforeEach(() => {
      const router = handler.createODataRouter('Products', '/api/odata');
      app.use('/api/odata', router);
    });

    it('should handle complex combined queries', async () => {
      mockConnection.query.mockResolvedValue([
        { 
          id: 1, 
          name: 'Laptop Pro', 
          price: 1200.00,
          price_with_tax: 1320.00,
          category_id: 1,
          category_name: 'Computers'
        }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$filter=price gt 1000&$expand=category&$search=laptop&$compute=price * 1.1 as price_with_tax&$orderby=price desc&$top=10')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
      expect(response.body.value[0].price_with_tax).toBe(1320.00);
      expect(response.body.value[0].category).toBeDefined();
    });

    it('should handle $apply aggregations', async () => {
      mockConnection.query.mockResolvedValue([
        { category_id: 1, avg_price: 1000.00, total_products: 5 }
      ]);

      const response = await request(app)
        .get('/api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price,price with count as total_products))')
        .expect(200);

      expect(response.body.value).toHaveLength(1);
      expect(response.body.value[0].avg_price).toBe(1000.00);
      expect(response.body.value[0].total_products).toBe(5);
    });
  });
});
