# 🚀 OData v4 Astro Integration

A powerful, type-safe OData v4 integration package for Astro that provides full OData v4 compliance with SQLite support. This package makes it incredibly easy to create OData v4 APIs in your Astro projects.

## ✨ Features

- **Full OData v4 Compliance** - Complete implementation of OData v4 specification
- **Advanced Query Support** - `$expand`, `$search`, `$apply`, `$compute`, `$filter`, `$orderby`, `$top`, `$skip`
- **Type Safety** - Full TypeScript support throughout
- **Easy Integration** - Simple setup with Astro API routes
- **Multiple Database Support** - Works with local SQLite and Turso cloud databases
- **Real-time Search** - Full-text search with SQLite FTS5
- **Computed Properties** - Dynamic calculations and transformations
- **Aggregations** - Group by, sum, avg, count, min, max operations
- **Relationship Support** - Automatic JOIN operations for related data

## 🚀 Quick Start

### 1. Installation

```bash
npm install odata-sqlite-astro
```

### 2. Basic Setup

Create your API route in `src/pages/api/odata/[...path].ts`:

```typescript
import type { APIRoute } from 'astro';
import { createUniversalODataHandler } from 'odata-sqlite-astro';
import { ConnectionAdapter } from 'odata-sqlite-core';

// Define your database schemas
const productsSchema = {
  name: 'products',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
    { name: 'category_id', type: 'INTEGER', primaryKey: false, nullable: false }
  ]
};

const categoriesSchema = {
  name: 'categories',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'description', type: 'TEXT', primaryKey: false, nullable: true }
  ]
};

// Define relationships
const relationships = [
  {
    fromTable: 'products',
    fromColumn: 'category_id',
    toTable: 'categories',
    toColumn: 'id',
    name: 'category'
  }
];

// Create the OData handler
const handler = createUniversalODataHandler({
  connection: await ConnectionAdapter.create({
    type: 'local',
    database: './data.db'
  }),
  schemas: {
    'Products': productsSchema,
    'Categories': categoriesSchema
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

// Export all HTTP methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

### 3. Usage Examples

#### Basic Queries

```typescript
// Get all products
GET /api/odata/Products

// Get products with filtering
GET /api/odata/Products?$filter=price gt 100

// Get products with pagination
GET /api/odata/Products?$top=10&$skip=20

// Get products with ordering
GET /api/odata/Products?$orderby=price desc
```

#### Advanced OData v4 Features

```typescript
// Expand related data (JOIN operations)
GET /api/odata/Products?$expand=category

// Full-text search
GET /api/odata/Products?$search=laptop

// Aggregations
GET /api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price))

// Computed properties
GET /api/odata/Products?$compute=price * 1.1 as price_with_tax

// Complex combined queries
GET /api/odata/Products?$filter=price gt 100&$expand=category&$search=laptop&$compute=price * 1.1 as price_with_tax&$orderby=price desc&$top=10
```

#### CRUD Operations

```typescript
// Create a new product
POST /api/odata/Products
Content-Type: application/json

{
  "name": "New Laptop",
  "price": 1200.00,
  "category_id": 1
}

// Update a product
PUT /api/odata/Products(1)
Content-Type: application/json

{
  "name": "Updated Laptop",
  "price": 1100.00,
  "category_id": 1
}

// Delete a product
DELETE /api/odata/Products(1)

// Get a single product
GET /api/odata/Products(1)

// Get related data
GET /api/odata/Products(1)/category
```

## 🎯 Advanced Usage

### Server-Side Rendering (SSR) with OData

```typescript
// src/pages/products.astro
---
import { ConnectionAdapter } from 'odata-sqlite-core';
import { AstroODataHandler } from 'odata-sqlite-astro';

const connection = await ConnectionAdapter.create({
  type: 'local',
  database: './data.db'
});

const handler = new AstroODataHandler({
  connection,
  schemas: { 'Products': productsSchema },
  relationships
});

// Use OData queries in Astro SSR
const products = await handler.executeODataQuery('products', productsSchema, {
  filter: { field: 'price', operator: 'gt', value: 100 },
  expand: [{ path: 'category' }],
  compute: [{ expression: 'price * 1.1', as: 'price_with_tax' }],
  orderBy: [{ field: 'price', direction: 'desc' }],
  top: 10
});
---

<html>
  <head><title>Products</title></head>
  <body>
    <h1>Products</h1>
    {products.data.map(product => (
      <div>
        <h2>{product.name}</h2>
        <p>Price: ${product.price_with_tax}</p>
        <p>Category: {product.category?.name}</p>
      </div>
    ))}
  </body>
</html>
```

### Client-Side Integration

```typescript
// src/components/ProductList.astro
---
// Server-side setup
---

<div id="product-list">
  <input type="text" id="search" placeholder="Search products..." />
  <button onclick="loadProducts()">Load Products</button>
  <div id="results"></div>
</div>

<script>
  async function loadProducts() {
    const searchTerm = document.getElementById('search').value;
    
    // Use OData query parameters
    const query = new URLSearchParams({
      '$filter': `price gt 100`,
      '$search': searchTerm,
      '$expand': 'category',
      '$compute': 'price * 1.1 as price_with_tax',
      '$orderby': 'price desc',
      '$top': '10'
    });
    
    const response = await fetch(`/api/odata/Products?${query}`);
    const data = await response.json();
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = data.value.map(product => `
      <div>
        <h3>${product.name}</h3>
        <p>Price: $${product.price_with_tax}</p>
        <p>Category: ${product.category?.name}</p>
      </div>
    `).join('');
  }
</script>
```

### Turso Cloud Database Integration

```typescript
// src/pages/api/odata/[...path].ts
import { createUniversalODataHandler } from 'odata-sqlite-astro';
import { ConnectionAdapter } from 'odata-sqlite-core';

const handler = createUniversalODataHandler({
  connection: await ConnectionAdapter.create({
    type: 'turso',
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!
  }),
  schemas: {
    'Products': productsSchema,
    'Categories': categoriesSchema
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

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

## 🔧 Configuration Options

### AstroODataConfig

```typescript
interface AstroODataConfig {
  connection: any; // Database connection
  schemas: Record<string, TableSchema>; // Table schemas
  relationships?: ForeignKeyRelationship[]; // Foreign key relationships
  searchConfig?: Array<{ // Full-text search configuration
    table: string;
    ftsTable: string;
    columns: string[];
  }>;
  baseUrl?: string; // Base URL for OData context
}
```

### TableSchema

```typescript
interface TableSchema {
  name: string;
  columns: Array<{
    name: string;
    type: 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB';
    primaryKey?: boolean;
    nullable?: boolean;
    defaultValue?: any;
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
    unique?: boolean;
  }>;
}
```

### ForeignKeyRelationship

```typescript
interface ForeignKeyRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  name: string;
}
```

## 🎉 OData v4 Query Examples

### Filtering

```typescript
// Basic filtering
GET /api/odata/Products?$filter=price gt 100

// Complex filtering
GET /api/odata/Products?$filter=price gt 100 and category_id eq 1

// String filtering
GET /api/odata/Products?$filter=name eq 'Laptop Pro'
```

### Expanding Related Data

```typescript
// Single expand
GET /api/odata/Products?$expand=category

// Multiple expands
GET /api/odata/Products?$expand=category,supplier

// Nested expands
GET /api/odata/Products?$expand=category($expand=parent)
```

### Full-Text Search

```typescript
// Simple search
GET /api/odata/Products?$search=laptop

// Search with other filters
GET /api/odata/Products?$search=laptop&$filter=price gt 500
```

### Aggregations

```typescript
// Group by with aggregates
GET /api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price))

// Multiple aggregates
GET /api/odata/Products?$apply=groupby((category_id),aggregate(price with sum as total_price,price with count as product_count))
```

### Computed Properties

```typescript
// Simple computation
GET /api/odata/Products?$compute=price * 1.1 as price_with_tax

// Complex computation
GET /api/odata/Products?$compute=price * 1.1 as price_with_tax,price * 0.1 as discount_amount

// Date computations
GET /api/odata/Orders?$compute=julianday('now') - julianday(order_date) as days_since_order
```

### Combined Queries

```typescript
// Complex query with all features
GET /api/odata/Products?$filter=price gt 100&$expand=category&$search=laptop&$compute=price * 1.1 as price_with_tax&$apply=groupby((category_id),aggregate(price with avg as avg_price))&$orderby=price desc&$top=10&$skip=20&$count=true
```

## 🛠️ Error Handling

The package provides comprehensive error handling with proper HTTP status codes:

- `400` - Bad Request (invalid query parameters)
- `404` - Not Found (resource not found)
- `405` - Method Not Allowed (unsupported HTTP method)
- `500` - Internal Server Error (database errors)

All errors are returned in OData v4 format:

```json
{
  "error": {
    "code": "400",
    "message": "Invalid filter expression: Field 'nonexistent_field' not found"
  }
}
```

## 🚀 Performance Tips

1. **Use Indexes** - Add database indexes for frequently queried fields
2. **Limit Results** - Always use `$top` for large datasets
3. **Optimize Expands** - Only expand necessary relationships
4. **Use FTS** - Enable full-text search for better search performance
5. **Connection Pooling** - Use connection pooling for production

## 📚 API Reference

### AstroODataHandler

```typescript
class AstroODataHandler {
  constructor(config: AstroODataConfig)
  
  createGetHandler(): (context: AstroAPIContext) => Promise<Response>
  createPostHandler(): (context: AstroAPIContext) => Promise<Response>
  createPutHandler(): (context: AstroAPIContext) => Promise<Response>
  createDeleteHandler(): (context: AstroAPIContext) => Promise<Response>
  createUniversalHandler(): (context: AstroAPIContext) => Promise<Response>
  
  parseODataQuery(searchParams: URLSearchParams): ParsedODataQuery
  resolveResource(context: AstroAPIContext): string
  resolveResourceWithId(context: AstroAPIContext): { resource: string; id: string }
  
  formatODataResponse(options: ODataResponseOptions): Response
  formatSingleResourceResponse(options: SingleResourceResponseOptions): Response
  formatErrorResponse(error: Error, statusCode: number): Response
}
```

### Convenience Functions

```typescript
// Create a universal handler for all HTTP methods
createUniversalODataHandler(config: AstroODataConfig): (context: AstroAPIContext) => Promise<Response>

// Create individual handlers
createODataHandlers(config: AstroODataConfig): {
  GET: (context: AstroAPIContext) => Promise<Response>
  POST: (context: AstroAPIContext) => Promise<Response>
  PUT: (context: AstroAPIContext) => Promise<Response>
  DELETE: (context: AstroAPIContext) => Promise<Response>
}
```

## 🎯 Testing

The package includes comprehensive test coverage:

```bash
npm test
npm run test:coverage
```

## 🤝 Contributing

This package is part of the larger OData v4 SQLite ecosystem. Contributions are welcome!

## 📄 License

MIT License - see LICENSE file for details.

---

**Made with ❤️ by The Happiest Software Engineer in the Universe**
