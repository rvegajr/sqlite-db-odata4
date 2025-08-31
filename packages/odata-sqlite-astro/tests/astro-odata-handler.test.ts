import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AstroODataHandler } from '../src/astro-odata-handler';
import type { TableSchema, ForeignKeyRelationship } from 'odata-sqlite-contracts';

// Mock Astro's APIRoute types
type APIContext = {
  request: Request;
  params: Record<string, string>;
  redirect: (url: string) => Response;
};

describe('🚀 AstroODataHandler - Astro Integration', () => {
  let handler: AstroODataHandler;
  let mockConnection: any;
  let productsSchema: TableSchema;
  let customersSchema: TableSchema;
  let relationships: ForeignKeyRelationship[];

  beforeEach(() => {
    // Mock connection
    mockConnection = {
      query: vi.fn(),
      prepare: vi.fn(),
      close: vi.fn()
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

    relationships = [
      {
        fromTable: 'products',
        fromColumn: 'category_id',
        toTable: 'categories',
        toColumn: 'id',
        name: 'category'
      }
    ];

    handler = new AstroODataHandler({
      connection: mockConnection,
      schemas: {
        'Products': productsSchema,
        'Customers': customersSchema
      },
      relationships,
      searchConfig: [
        {
          table: 'products',
          ftsTable: 'products_fts',
          columns: ['name', 'description']
        }
      ]
    });
  });

  describe('🚀 API Route Handler Creation', () => {
    it('should create GET handler for OData queries', async () => {
      const getHandler = handler.createGetHandler();

      expect(getHandler).toBeInstanceOf(Function);
    });

    it('should create POST handler for creating resources', async () => {
      const postHandler = handler.createPostHandler();

      expect(postHandler).toBeInstanceOf(Function);
    });

    it('should create PUT handler for updating resources', async () => {
      const putHandler = handler.createPutHandler();

      expect(putHandler).toBeInstanceOf(Function);
    });

    it('should create DELETE handler for deleting resources', async () => {
      const deleteHandler = handler.createDeleteHandler();

      expect(deleteHandler).toBeInstanceOf(Function);
    });

    it('should create universal handler for all HTTP methods', async () => {
      const universalHandler = handler.createUniversalHandler();

      expect(universalHandler).toBeInstanceOf(Function);
    });
  });

  describe('🚀 Query Parameter Parsing', () => {
    it('should parse basic OData query parameters', async () => {
      const url = new URL('http://localhost:3000/api/odata/Products?$filter=price gt 100&$top=10');
      const searchParams = url.searchParams;

      const parsedQuery = handler.parseODataQuery(searchParams);

      expect(parsedQuery.filter).toEqual({
        field: 'price',
        operator: 'gt',
        value: 100
      });
      expect(parsedQuery.top).toBe(10);
    });

    it('should parse $expand parameters', async () => {
      const url = new URL('http://localhost:3000/api/odata/Products?$expand=category');
      const searchParams = url.searchParams;

      const parsedQuery = handler.parseODataQuery(searchParams);

      expect(parsedQuery.expand).toEqual([
        { path: 'category' }
      ]);
    });

    it('should parse $search parameters', async () => {
      const url = new URL('http://localhost:3000/api/odata/Products?$search=phone');
      const searchParams = url.searchParams;

      const parsedQuery = handler.parseODataQuery(searchParams);

      expect(parsedQuery.search).toBe('phone');
    });

    it('should parse $apply parameters', async () => {
      const url = new URL('http://localhost:3000/api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price))');
      const searchParams = url.searchParams;

      const parsedQuery = handler.parseODataQuery(searchParams);

      expect(parsedQuery.apply).toEqual({
        groupBy: ['category_id'],
        aggregates: [
          { source: 'price', op: 'avg', as: 'avg_price' }
        ]
      });
    });

    it('should parse $compute parameters', async () => {
      const url = new URL('http://localhost:3000/api/odata/Products?$compute=price * 1.1 as price_with_tax');
      const searchParams = url.searchParams;

      const parsedQuery = handler.parseODataQuery(searchParams);

      expect(parsedQuery.compute).toEqual([
        { expression: 'price * 1.1', as: 'price_with_tax' }
      ]);
    });

    it('should parse complex combined queries', async () => {
      const url = new URL('http://localhost:3000/api/odata/Products?$filter=price gt 100&$expand=category&$search=phone&$compute=price * 1.1 as price_with_tax&$orderby=price desc&$top=10&$skip=20');
      const searchParams = url.searchParams;

      const parsedQuery = handler.parseODataQuery(searchParams);

      expect(parsedQuery.filter).toEqual({
        field: 'price',
        operator: 'gt',
        value: 100
      });
      expect(parsedQuery.expand).toEqual([
        { path: 'category' }
      ]);
      expect(parsedQuery.search).toBe('phone');
      expect(parsedQuery.compute).toEqual([
        { expression: 'price * 1.1', as: 'price_with_tax' }
      ]);
      expect(parsedQuery.orderBy).toEqual([
        { field: 'price', direction: 'desc' }
      ]);
      expect(parsedQuery.top).toBe(10);
      expect(parsedQuery.skip).toBe(20);
    });
  });

  describe('🚀 Resource Resolution', () => {
    it('should resolve resource from URL path', async () => {
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const resource = handler.resolveResource(context);

      expect(resource).toBe('Products');
    });

    it('should resolve resource with ID from URL path', async () => {
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products(1)'),
        params: { path: 'Products(1)' },
        redirect: vi.fn()
      };

      const { resource, id } = handler.resolveResourceWithId(context);

      expect(resource).toBe('Products');
      expect(id).toBe('1');
    });

    it('should handle nested paths correctly', async () => {
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products/1/category'),
        params: { path: 'Products/1/category' },
        redirect: vi.fn()
      };

      const { resource, id, navigation } = handler.resolveNavigationPath(context);

      expect(resource).toBe('Products');
      expect(id).toBe('1');
      expect(navigation).toBe('category');
    });
  });

  describe('🚀 Response Formatting', () => {
    it('should format successful GET response as OData v4', async () => {
      const data = [
        { id: 1, name: 'Laptop Pro', price: 1200.00 },
        { id: 2, name: 'Smartphone X', price: 800.00 }
      ];

      const response = handler.formatODataResponse({
        data,
        count: 2,
        context: 'Products',
        baseUrl: 'http://localhost:3000/api/odata'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const responseData = await response.json();
      expect(responseData['@odata.context']).toBe('http://localhost:3000/api/odata/$metadata#Products');
      expect(responseData.value).toEqual(data);
      expect(responseData['@odata.count']).toBe(2);
    });

    it('should format single resource response', async () => {
      const data = { id: 1, name: 'Laptop Pro', price: 1200.00 };

      const response = handler.formatSingleResourceResponse({
        data,
        context: 'Products',
        baseUrl: 'http://localhost:3000/api/odata'
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const responseData = await response.json();
      expect(responseData['@odata.context']).toBe('http://localhost:3000/api/odata/$metadata#Products/$entity');
      expect(responseData).toEqual({
        '@odata.context': 'http://localhost:3000/api/odata/$metadata#Products/$entity',
        ...data
      });
    });

    it('should format error response as OData v4', async () => {
      const error = new Error('Resource not found');

      const response = handler.formatErrorResponse(error, 404);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const responseData = await response.json();
      expect(responseData.error).toBeDefined();
      expect(responseData.error.code).toBe('404');
      expect(responseData.error.message).toBe('Resource not found');
    });

    it('should format validation error response', async () => {
      const validationError = new Error('Invalid filter expression: Field "nonexistent_field" not found');

      const response = handler.formatErrorResponse(validationError, 400);

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');

      const responseData = await response.json();
      expect(responseData.error.code).toBe('400');
      expect(responseData.error.message).toBe('Invalid filter expression: Field "nonexistent_field" not found');
    });
  });

  describe('🚀 GET Handler Functionality', () => {
    it('should handle basic GET request', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 },
        { id: 2, name: 'Smartphone X', price: 800.00 }
      ]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.value).toHaveLength(2);
    });

    it('should handle GET request with filtering', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products?$filter=price gt 1000'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.value).toHaveLength(1);
    });

    it('should handle GET request with expand', async () => {
      mockConnection.query.mockResolvedValue([
        { 
          id: 1, 
          name: 'Laptop Pro', 
          price: 1200.00,
          category_id: 1,
          category_name: 'Computers'
        }
      ]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products?$expand=category'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.value[0].category).toBeDefined();
    });

    it('should handle GET request with search', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products?$search=laptop'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.value).toHaveLength(1);
    });

    it('should handle GET request with compute', async () => {
      mockConnection.query.mockResolvedValue([
        { 
          id: 1, 
          name: 'Laptop Pro', 
          price: 1200.00,
          price_with_tax: 1320.00
        }
      ]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products?$compute=price * 1.1 as price_with_tax'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.value[0].price_with_tax).toBe(1320.00);
    });

    it('should handle GET request for single resource', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products(1)'),
        params: { path: 'Products(1)' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.id).toBe(1);
      expect(responseData.name).toBe('Laptop Pro');
    });

    it('should handle $count request', async () => {
      mockConnection.query.mockResolvedValue([{ count: 5 }]);

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products/$count'),
        params: { path: 'Products/$count' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      const count = await response.text();
      expect(count).toBe('5');
    });

    it('should handle $metadata request', async () => {
      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/$metadata'),
        params: { path: '$metadata' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/xml');
    });
  });

  describe('🚀 POST Handler Functionality', () => {
    it('should handle POST request for creating resource', async () => {
      const newProduct = { name: 'New Product', price: 500.00 };
      mockConnection.query.mockResolvedValue([{ id: 3, ...newProduct }]);

      const postHandler = handler.createPostHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        }),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await postHandler(context);

      expect(response.status).toBe(201);
      const responseData = await response.json();
      expect(responseData.id).toBe(3);
      expect(responseData.name).toBe('New Product');
    });
  });

  describe('🚀 PUT Handler Functionality', () => {
    it('should handle PUT request for updating resource', async () => {
      const updatedProduct = { name: 'Updated Product', price: 600.00 };
      mockConnection.query.mockResolvedValue([{ id: 1, ...updatedProduct }]);

      const putHandler = handler.createPutHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products(1)', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        }),
        params: { path: 'Products(1)' },
        redirect: vi.fn()
      };

      const response = await putHandler(context);

      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.id).toBe(1);
      expect(responseData.name).toBe('Updated Product');
    });
  });

  describe('🚀 DELETE Handler Functionality', () => {
    it('should handle DELETE request for deleting resource', async () => {
      mockConnection.query.mockResolvedValue([]);

      const deleteHandler = handler.createDeleteHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products(1)', {
          method: 'DELETE'
        }),
        params: { path: 'Products(1)' },
        redirect: vi.fn()
      };

      const response = await deleteHandler(context);

      expect(response.status).toBe(204);
    });
  });

  describe('🚀 Universal Handler Functionality', () => {
    it('should route GET requests to GET handler', async () => {
      mockConnection.query.mockResolvedValue([
        { id: 1, name: 'Laptop Pro', price: 1200.00 }
      ]);

      const universalHandler = handler.createUniversalHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await universalHandler(context);

      expect(response.status).toBe(200);
    });

    it('should route POST requests to POST handler', async () => {
      const newProduct = { name: 'New Product', price: 500.00 };
      mockConnection.query.mockResolvedValue([{ id: 3, ...newProduct }]);

      const universalHandler = handler.createUniversalHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newProduct)
        }),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await universalHandler(context);

      expect(response.status).toBe(201);
    });

    it('should route PUT requests to PUT handler', async () => {
      const updatedProduct = { name: 'Updated Product', price: 600.00 };
      mockConnection.query.mockResolvedValue([{ id: 1, ...updatedProduct }]);

      const universalHandler = handler.createUniversalHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products(1)', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProduct)
        }),
        params: { path: 'Products(1)' },
        redirect: vi.fn()
      };

      const response = await universalHandler(context);

      expect(response.status).toBe(200);
    });

    it('should route DELETE requests to DELETE handler', async () => {
      mockConnection.query.mockResolvedValue([]);

      const universalHandler = handler.createUniversalHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products(1)', {
          method: 'DELETE'
        }),
        params: { path: 'Products(1)' },
        redirect: vi.fn()
      };

      const response = await universalHandler(context);

      expect(response.status).toBe(204);
    });

    it('should return 405 for unsupported methods', async () => {
      const universalHandler = handler.createUniversalHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products', {
          method: 'PATCH'
        }),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await universalHandler(context);

      expect(response.status).toBe(405);
    });
  });

  describe('🚀 Error Handling', () => {
    it('should handle resource not found', async () => {
      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Nonexistent'),
        params: { path: 'Nonexistent' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(404);
      const responseData = await response.json();
      expect(responseData.error.message).toContain('Resource not found');
    });

    it('should handle database errors', async () => {
      mockConnection.query.mockRejectedValue(new Error('Database connection failed'));

      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(500);
      const responseData = await response.json();
      expect(responseData.error.message).toContain('Database connection failed');
    });

    it('should handle invalid query parameters', async () => {
      const getHandler = handler.createGetHandler();
      const context: APIContext = {
        request: new Request('http://localhost:3000/api/odata/Products?$filter=invalid'),
        params: { path: 'Products' },
        redirect: vi.fn()
      };

      const response = await getHandler(context);

      expect(response.status).toBe(400);
      const responseData = await response.json();
      expect(responseData.error.message).toContain('Invalid query');
    });
  });
});
