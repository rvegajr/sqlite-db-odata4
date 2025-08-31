# 🚀 OData v4 Astro Integration - Working Example

This is a complete, working example of OData v4 integration with Astro that demonstrates first-class integration capabilities.

## ✨ Features

- **🔧 Full CRUD Operations** - Create, Read, Update, Delete with proper HTTP status codes
- **🔍 OData v4 Query Support** - $filter, $orderby, $top, $skip, $select, $count
- **📊 OData v4 Compliance** - Metadata generation, proper response formatting
- **🛡️ Type Safety** - Built with TypeScript for complete type safety
- **⚡ Performance** - Optimized SQL queries with parameterized queries
- **🎨 Astro Native** - Built specifically for Astro's API routes and SSR

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:4321` to see the demo.

## 🔗 API Endpoints

### Core OData Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/odata/$metadata` | OData v4 metadata document |
| GET | `/api/odata/Products` | Get all products |
| GET | `/api/odata/Products(1)` | Get specific product |
| GET | `/api/odata/Categories` | Get all categories |
| POST | `/api/odata/Products` | Create new product |
| PUT | `/api/odata/Products(1)` | Update product |
| DELETE | `/api/odata/Products(1)` | Delete product |

### Query Examples

```bash
# Filtering
GET /api/odata/Products?$filter=price gt 100

# Sorting
GET /api/odata/Products?$orderby=price desc

# Pagination
GET /api/odata/Products?$top=5&$skip=10

# Field Selection
GET /api/odata/Products?$select=name,price

# Count
GET /api/odata/Products?$count=true
```

## 🏗️ Architecture

### File Structure

```
src/
├── pages/
│   ├── api/
│   │   └── odata/
│   │       └── [...path].ts    # Main OData API route
│   └── index.astro             # Demo frontend
├── astro.config.mjs            # Astro configuration
└── package.json                # Dependencies
```

### Key Components

1. **API Route Handler** (`[...path].ts`)
   - Handles all OData requests
   - Parses OData query parameters
   - Generates SQL queries
   - Formats OData v4 responses
   - Provides metadata generation

2. **Database Integration**
   - Uses `better-sqlite3` for SQLite database
   - In-memory database with sample data
   - Proper schema definition
   - Foreign key relationships

3. **Query Processing**
   - OData query parameter parsing
   - SQL generation with parameter binding
   - Filter, sort, pagination support
   - Error handling and validation

## 🧪 Testing the API

### Using the Demo Page

1. Open `http://localhost:4321`
2. Click the test buttons to try different endpoints
3. Check the browser console for API responses

### Using curl

```bash
# Get all products
curl http://localhost:4321/api/odata/Products

# Get expensive products
curl "http://localhost:4321/api/odata/Products?\$filter=price gt 500"

# Get metadata
curl http://localhost:4321/api/odata/\$metadata

# Create a new product
curl -X POST http://localhost:4321/api/odata/Products \
  -H "Content-Type: application/json" \
  -d '{"name":"New Product","price":99.99,"categoryId":1}'
```

### Using JavaScript

```javascript
// Get products with filtering
const response = await fetch('/api/odata/Products?$filter=price gt 100&$orderby=price desc');
const data = await response.json();
console.log(data);

// Create a new product
const newProduct = await fetch('/api/odata/Products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'New Product',
    price: 99.99,
    categoryId: 1
  })
});
```

## 📊 Sample Data

The example includes sample data for testing:

### Categories
- Electronics (ID: 1)
- Books (ID: 2)  
- Clothing (ID: 3)

### Products
- Laptop ($999.99, Electronics)
- Smartphone ($599.99, Electronics)
- Programming Book ($49.99, Books)
- T-Shirt ($19.99, Clothing)
- Headphones ($89.99, Electronics)

## 🔧 Customization

### Adding New Resources

1. **Define the schema:**
   ```typescript
   const schemas: Record<string, TableSchema> = {
     YourResource: {
       columns: [
         { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
         { name: 'name', type: 'TEXT', nullable: false },
         // ... more columns
       ]
     }
   };
   ```

2. **Create the table:**
   ```sql
   CREATE TABLE your_resource (
     id INTEGER PRIMARY KEY,
     name TEXT NOT NULL,
     -- ... more columns
   );
   ```

3. **Add sample data:**
   ```typescript
   const insertStmt = db.prepare('INSERT INTO your_resource (id, name) VALUES (?, ?)');
   insertStmt.run(1, 'Sample Item');
   ```

### Extending Query Support

The query parser can be extended to support additional OData features:

- **$expand** - For navigation properties
- **$search** - For full-text search
- **$apply** - For aggregations
- **$compute** - For computed properties

## 🛡️ Security Considerations

- **SQL Injection Protection** - All queries use parameterized statements
- **Input Validation** - Query parameters are validated before processing
- **Error Handling** - Proper error responses without information leakage
- **Type Safety** - TypeScript ensures type safety throughout

## 🚀 Production Deployment

For production use:

1. **Database Configuration**
   - Use persistent SQLite file instead of in-memory
   - Configure proper database path
   - Set up database migrations

2. **Security**
   - Add authentication and authorization
   - Implement rate limiting
   - Add CORS configuration

3. **Performance**
   - Add database indexes
   - Implement caching
   - Add query optimization

4. **Monitoring**
   - Add logging
   - Implement metrics
   - Set up error tracking

## 📚 Learn More

- [OData v4 Specification](https://docs.oasis-open.org/odata/odata/v4.0/os/part1-protocol/odata-v4.0-os-part1-protocol.html)
- [Astro Documentation](https://docs.astro.build/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

## 🤝 Contributing

This example demonstrates the core concepts of OData v4 integration with Astro. You can extend it with:

- Additional OData features
- More complex query support
- Database migrations
- Authentication integration
- Performance optimizations

## 📄 License

This example is part of the OData v4 SQLite implementation and is licensed under MIT.
