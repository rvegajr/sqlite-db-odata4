# 🚀 OData v4 Astro Integration Example

This is a complete example project demonstrating how to use the OData v4 Astro integration package. It shows both server-side rendering (SSR) and client-side integration with OData v4 queries.

## ✨ Features Demonstrated

- **OData v4 API Routes** - Complete REST API with OData v4 compliance
- **Server-Side Rendering** - Using OData queries in Astro SSR
- **Client-Side Integration** - Dynamic filtering and search
- **Advanced OData Features** - `$expand`, `$search`, `$compute`, `$filter`, `$orderby`
- **Real-time Search** - Full-text search functionality
- **Computed Properties** - Dynamic calculations (price with tax)
- **Relationship Support** - JOIN operations for related data

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:4321`

### 3. Explore the Features

- **Products Page** (`/products`) - Demonstrates SSR with OData queries
- **OData API** (`/api/odata/Products`) - RESTful OData v4 endpoints

## 📁 Project Structure

```
src/
├── pages/
│   ├── api/
│   │   └── odata/
│   │       └── [...path].ts    # OData v4 API routes
│   └── products.astro          # Example page with SSR
├── astro.config.mjs           # Astro configuration
└── package.json               # Dependencies
```

## 🎯 OData v4 API Examples

### Basic Queries

```bash
# Get all products
curl "http://localhost:4321/api/odata/Products"

# Get products with filtering
curl "http://localhost:4321/api/odata/Products?\$filter=price gt 100"

# Get products with pagination
curl "http://localhost:4321/api/odata/Products?\$top=10&\$skip=20"

# Get products with ordering
curl "http://localhost:4321/api/odata/Products?\$orderby=price desc"
```

### Advanced Features

```bash
# Expand related data (JOIN operations)
curl "http://localhost:4321/api/odata/Products?\$expand=category"

# Full-text search
curl "http://localhost:4321/api/odata/Products?\$search=laptop"

# Computed properties
curl "http://localhost:4321/api/odata/Products?\$compute=price * 1.1 as price_with_tax"

# Complex combined queries
curl "http://localhost:4321/api/odata/Products?\$filter=price gt 100&\$expand=category&\$search=laptop&\$compute=price * 1.1 as price_with_tax&\$orderby=price desc&\$top=10"
```

### CRUD Operations

```bash
# Create a new product
curl -X POST "http://localhost:4321/api/odata/Products" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Laptop", "price": 1200.00, "category_id": 1}'

# Update a product
curl -X PUT "http://localhost:4321/api/odata/Products(1)" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Laptop", "price": 1100.00, "category_id": 1}'

# Delete a product
curl -X DELETE "http://localhost:4321/api/odata/Products(1)"

# Get a single product
curl "http://localhost:4321/api/odata/Products(1)"
```

## 🎨 Frontend Features

### Server-Side Rendering (SSR)

The `/products` page demonstrates:

- **OData Queries in SSR** - Using OData queries during server-side rendering
- **Computed Properties** - Dynamic calculations (price with tax)
- **Relationship Expansion** - JOIN operations for category data
- **Filtering and Sorting** - Server-side filtering and ordering

### Client-Side Integration

The page includes interactive features:

- **Real-time Filtering** - Filter by price, category, and search terms
- **Dynamic Updates** - Update product grid without page refresh
- **Statistics** - Real-time calculation of product statistics
- **Responsive Design** - Modern, responsive UI with hover effects

## 🔧 Configuration

### Database Setup

The example uses a local SQLite database. You can modify the connection in `src/pages/api/odata/[...path].ts`:

```typescript
// For local SQLite
const connection = await ConnectionAdapter.create({
  type: 'local',
  database: './data.db'
});

// For Turso cloud database
const connection = await ConnectionAdapter.create({
  type: 'turso',
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!
});
```

### Schema Configuration

The example includes schemas for:

- **Products** - Product information with prices and categories
- **Categories** - Product categories
- **Customers** - Customer information

### Relationships

The example defines relationships between:

- **Products → Categories** - Each product belongs to a category

### Search Configuration

Full-text search is configured for:

- **Products** - Search by name and description

## 🚀 Performance Features

- **Efficient Queries** - Optimized SQL generation
- **Pagination** - Built-in support for `$top` and `$skip`
- **Caching** - Astro's built-in caching mechanisms
- **Type Safety** - Full TypeScript support

## 🎯 Learning Points

This example demonstrates:

1. **OData v4 Compliance** - Full implementation of OData v4 specification
2. **Astro Integration** - Seamless integration with Astro's SSR and API routes
3. **Type Safety** - Complete TypeScript support throughout
4. **Advanced Features** - Complex queries with multiple OData operators
5. **Real-world Usage** - Practical implementation patterns

## 🔍 Testing the API

You can test the OData v4 API using:

- **Browser** - Navigate to the API endpoints
- **curl** - Use the examples above
- **Postman** - Import the endpoints for testing
- **OData Client Libraries** - Use any OData v4 client library

## 📚 Next Steps

After exploring this example:

1. **Modify Schemas** - Add your own database schemas
2. **Add Relationships** - Define relationships between your entities
3. **Customize Queries** - Implement your own OData query patterns
4. **Add Authentication** - Implement authentication and authorization
5. **Deploy** - Deploy to your preferred hosting platform

## 🤝 Contributing

This example is part of the OData v4 SQLite ecosystem. Feel free to:

- Report issues
- Suggest improvements
- Submit pull requests
- Share your own examples

---

**Made with ❤️ by The Happiest Software Engineer in the Universe**
