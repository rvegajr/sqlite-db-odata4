# OData SQLite Express Integration

A complete OData v4 compliant Express.js integration for SQLite databases, supporting both local SQLite and cloud-based Turso databases.

## Features

✅ **Full OData v4 Compliance**
- `$filter` - Complex filtering with operators (eq, ne, lt, le, gt, ge, and, or, not, contains, startswith, endswith)
- `$select` - Field selection
- `$orderby` - Sorting with multiple fields and directions
- `$top` and `$skip` - Pagination
- `$count` - Result counting
- `$expand` - Navigation properties and joins
- `$search` - Full-text search using SQLite FTS5
- `$apply` - Aggregations (groupby, aggregate functions)
- `$compute` - Computed properties and expressions
- `$metadata` - OData service metadata
- Navigation properties support

✅ **Database Support**
- Local SQLite databases
- Cloud-based Turso databases
- Automatic connection management

✅ **Express.js Integration**
- Drop-in Express middleware
- RESTful API endpoints
- Automatic route generation
- Error handling and validation
- Middleware compatibility

✅ **TypeScript Support**
- Full TypeScript definitions
- Type-safe query building
- IntelliSense support

## Installation

```bash
npm install odata-sqlite-express
```

## Quick Start

### 1. Basic Setup

```typescript
import express from 'express';
import { ExpressODataHandler } from 'odata-sqlite-express';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json());

// Create database connection
const db = new Database('example.db');

// Define your schema
const productsSchema = {
  name: 'Products',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
    { name: 'category_id', type: 'INTEGER', primaryKey: false, nullable: false }
  ]
};

// Create OData handler
const handler = new ExpressODataHandler({
  connection: db,
  schemas: { 'Products': productsSchema },
  baseUrl: 'http://localhost:3000/api/odata'
});

// Register routes
const router = handler.createODataRouter('Products', '/api/odata');
app.use('/api/odata', router);

app.listen(3000, () => {
  console.log('OData API running on http://localhost:3000/api/odata');
});
```

### 2. With Relationships and Search

```typescript
import express from 'express';
import { ExpressODataHandler } from 'odata-sqlite-express';
import Database from 'better-sqlite3';

const app = express();
app.use(express.json());

const db = new Database('example.db');

// Define schemas
const productsSchema = {
  name: 'Products',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
    { name: 'category_id', type: 'INTEGER', primaryKey: false, nullable: false }
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

// Define relationships
const relationships = [
  {
    fromTable: 'Products',
    fromColumn: 'category_id',
    toTable: 'Categories',
    toColumn: 'id',
    name: 'category'
  }
];

// Define search configuration
const searchConfig = [
  {
    table: 'Products',
    ftsTable: 'products_fts',
    columns: ['name', 'description']
  }
];

// Create OData handler
const handler = new ExpressODataHandler({
  connection: db,
  schemas: { 
    'Products': productsSchema,
    'Categories': categoriesSchema
  },
  relationships,
  searchConfig,
  baseUrl: 'http://localhost:3000/api/odata'
});

// Register routes
const router = handler.createODataRouter('Products', '/api/odata');
app.use('/api/odata', router);

app.listen(3000, () => {
  console.log('OData API running on http://localhost:3000/api/odata');
});
```

## API Endpoints

### Collection Endpoints

- `GET /api/odata/Products` - Get all products
- `POST /api/odata/Products` - Create a new product
- `GET /api/odata/Products/$count` - Get count of products
- `GET /api/odata/Products/$metadata` - Get metadata

### Single Resource Endpoints

- `GET /api/odata/Products(1)` - Get product with ID 1
- `PUT /api/odata/Products(1)` - Update product with ID 1
- `DELETE /api/odata/Products(1)` - Delete product with ID 1

### Navigation Properties

- `GET /api/odata/Products(1)/category` - Get category for product 1

## Query Examples

### Basic Filtering
```bash
# Get products with price > 100
GET /api/odata/Products?$filter=price gt 100

# Get products with name containing 'laptop'
GET /api/odata/Products?$filter=contains(name, 'laptop')

# Complex filter
GET /api/odata/Products?$filter=price gt 100 and price lt 1000
```

### Sorting and Pagination
```bash
# Sort by price descending
GET /api/odata/Products?$orderby=price desc

# Pagination
GET /api/odata/Products?$top=10&$skip=20

# Get count
GET /api/odata/Products?$count=true
```

### Field Selection
```bash
# Select specific fields
GET /api/odata/Products?$select=id,name,price
```

### Navigation Properties (Joins)
```bash
# Expand category information
GET /api/odata/Products?$expand=category

# Get category details for a specific product
GET /api/odata/Products(1)/category
```

### Full-Text Search
```bash
# Search for products
GET /api/odata/Products?$search=laptop gaming
```

### Aggregations
```bash
# Group by category and calculate average price
GET /api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price))
```

### Computed Properties
```bash
# Add computed field
GET /api/odata/Products?$compute=price * 1.1 as price_with_tax
```

## Response Format

### Collection Response
```json
{
  "@odata.context": "http://localhost:3000/api/odata/$metadata#Products",
  "@odata.count": 5,
  "value": [
    {
      "id": 1,
      "name": "Laptop Pro",
      "price": 1200.00,
      "category_id": 1
    }
  ]
}
```

### Single Resource Response
```json
{
  "@odata.context": "http://localhost:3000/api/odata/$metadata#Products/$entity",
  "id": 1,
  "name": "Laptop Pro",
  "price": 1200.00,
  "category_id": 1
}
```

### Error Response
```json
{
  "error": {
    "code": "BadRequest",
    "message": "Invalid filter expression"
  }
}
```

## Configuration Options

### ExpressODataConfig

```typescript
interface ExpressODataConfig {
  connection: any; // SQLite connection (better-sqlite3 or @libsql/client)
  schemas: { [resourceName: string]: TableSchema };
  relationships?: ForeignKeyRelationship[];
  searchConfig?: SearchConfig[];
  baseUrl?: string;
}
```

### TableSchema

```typescript
interface TableSchema {
  name: string;
  columns: TableColumn[];
}

interface TableColumn {
  name: string;
  type: 'INTEGER' | 'REAL' | 'TEXT' | 'BLOB' | 'BOOLEAN' | 'DATETIME';
  primaryKey?: boolean;
  nullable?: boolean;
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

### SearchConfig

```typescript
interface SearchConfig {
  table: string;
  ftsTable: string;
  columns: string[];
}
```

## Advanced Usage

### Custom Middleware Integration

```typescript
// Add authentication middleware
app.use('/api/odata', authenticateUser);

// Add logging middleware
app.use('/api/odata', (req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Register OData routes
app.use('/api/odata', router);
```

### Multiple Resources

```typescript
// Register multiple resources
const productsRouter = handler.createODataRouter('Products', '/api/odata');
const categoriesRouter = handler.createODataRouter('Categories', '/api/odata');

app.use('/api/odata', productsRouter);
app.use('/api/odata', categoriesRouter);
```

### Turso Database Integration

```typescript
import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://your-database.turso.io',
  authToken: 'your-auth-token'
});

const handler = new ExpressODataHandler({
  connection: client,
  schemas: { 'Products': productsSchema },
  baseUrl: 'http://localhost:3000/api/odata'
});
```

## Error Handling

The package provides comprehensive error handling:

- **400 Bad Request** - Invalid query parameters
- **404 Not Found** - Resource not found
- **405 Method Not Allowed** - Unsupported HTTP methods
- **500 Internal Server Error** - Database or processing errors

All errors follow OData v4 error format:

```json
{
  "error": {
    "code": "ErrorCode",
    "message": "Human readable error message"
  }
}
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Documentation: [Full documentation](https://your-docs-url.com)

## Roadmap

- [ ] Batch operations support
- [ ] Delta links for change tracking
- [ ] Action and function support
- [ ] Enhanced metadata generation
- [ ] Performance optimizations
- [ ] Additional database adapters
