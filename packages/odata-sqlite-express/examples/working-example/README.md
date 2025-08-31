# OData SQLite Express - Working Example

This is a complete working example demonstrating the OData SQLite Express integration with a real SQLite database.

## Features Demonstrated

- ✅ Full OData v4 query support
- ✅ Database schema definition
- ✅ Relationship mapping
- ✅ Full-text search with FTS5
- ✅ All OData query options ($filter, $expand, $search, $apply, $compute, etc.)
- ✅ RESTful CRUD operations
- ✅ OData metadata generation

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Run the Example

```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Try the API

Visit `http://localhost:3000` to see all available endpoints and examples.

## API Examples

### Basic Queries

```bash
# Get all products
curl http://localhost:3000/api/odata/Products

# Get products with price > 100
curl "http://localhost:3000/api/odata/Products?\$filter=price gt 100"

# Sort by price descending
curl "http://localhost:3000/api/odata/Products?\$orderby=price desc"

# Pagination
curl "http://localhost:3000/api/odata/Products?\$top=3&\$skip=2"
```

### Advanced Features

```bash
# Expand category information (joins)
curl "http://localhost:3000/api/odata/Products?\$expand=category"

# Full-text search
curl "http://localhost:3000/api/odata/Products?\$search=laptop"

# Aggregations
curl "http://localhost:3000/api/odata/Products?\$apply=groupby((category_id),aggregate(price with avg as avg_price))"

# Computed properties
curl "http://localhost:3000/api/odata/Products?\$compute=price * 1.1 as price_with_tax"
```

### CRUD Operations

```bash
# Get single product
curl http://localhost:3000/api/odata/Products(1)

# Create new product
curl -X POST http://localhost:3000/api/odata/Products \
  -H "Content-Type: application/json" \
  -d '{"name":"New Product","price":99.99,"category_id":1}'

# Update product
curl -X PUT http://localhost:3000/api/odata/Products(1) \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Product","price":199.99,"category_id":1}'

# Delete product
curl -X DELETE http://localhost:3000/api/odata/Products(1)
```

### Navigation Properties

```bash
# Get category for product 1
curl http://localhost:3000/api/odata/Products(1)/category
```

## Database Schema

The example uses an in-memory SQLite database with the following schema:

### Products Table
- `id` (INTEGER, PRIMARY KEY)
- `name` (TEXT, NOT NULL)
- `price` (REAL, NOT NULL)
- `category_id` (INTEGER, NOT NULL)
- `description` (TEXT)

### Categories Table
- `id` (INTEGER, PRIMARY KEY)
- `name` (TEXT, NOT NULL)
- `description` (TEXT)

### Full-Text Search
- `products_fts` (FTS5 virtual table for search)

## Sample Data

The example includes 8 products across 3 categories:

**Electronics (Category 1)**
- Laptop Pro ($1200.00)
- 4K Monitor ($450.00)
- Tablet Pro ($800.00)

**Accessories (Category 2)**
- Gaming Mouse ($75.00)
- Wireless Keyboard ($120.00)
- USB-C Hub ($35.00)

**Audio (Category 3)**
- Noise Cancelling Headphones ($200.00)
- Bluetooth Speaker ($150.00)

## Response Examples

### Collection Response
```json
{
  "@odata.context": "http://localhost:3000/api/odata/$metadata#Products",
  "@odata.count": 8,
  "value": [
    {
      "id": 1,
      "name": "Laptop Pro",
      "price": 1200.00,
      "category_id": 1,
      "description": "High-performance laptop for professionals"
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
  "category_id": 1,
  "description": "High-performance laptop for professionals"
}
```

### Expanded Response
```json
{
  "@odata.context": "http://localhost:3000/api/odata/$metadata#Products",
  "value": [
    {
      "id": 1,
      "name": "Laptop Pro",
      "price": 1200.00,
      "category_id": 1,
      "description": "High-performance laptop for professionals",
      "category_name": "Electronics",
      "category_description": "Electronic devices and gadgets"
    }
  ]
}
```

## Development

### Run with Auto-restart
```bash
npm run dev
```

### Test Different Queries

You can test various OData queries by visiting the URLs in your browser or using curl:

1. **Basic filtering**: `http://localhost:3000/api/odata/Products?$filter=price gt 500`
2. **Sorting**: `http://localhost:3000/api/odata/Products?$orderby=name asc`
3. **Pagination**: `http://localhost:3000/api/odata/Products?$top=3&$skip=2`
4. **Search**: `http://localhost:3000/api/odata/Products?$search=wireless`
5. **Expand**: `http://localhost:3000/api/odata/Products?$expand=category`
6. **Aggregation**: `http://localhost:3000/api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price))`
7. **Computed**: `http://localhost:3000/api/odata/Products?$compute=price * 1.1 as price_with_tax`

## Next Steps

This example demonstrates the core functionality. You can extend it by:

1. **Adding more tables and relationships**
2. **Implementing authentication and authorization**
3. **Adding custom business logic**
4. **Integrating with a real database file**
5. **Adding validation and error handling**
6. **Implementing caching strategies**

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT environment variable
   ```bash
   PORT=3001 npm start
   ```

2. **Database errors**: The example uses an in-memory database, so data is lost on restart

3. **Query syntax errors**: Check the OData v4 specification for correct query syntax

### Debug Mode

To see detailed SQL queries, you can modify the server.js to add logging:

```javascript
// Add this after creating the database
db.on('trace', (sql) => {
  console.log('SQL:', sql);
});
```

## Learn More

- [OData v4 Specification](https://docs.oasis-open.org/odata/odata/v4.0/os/part1-protocol/odata-v4.0-os-part1-protocol.html)
- [Express.js Documentation](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Better SQLite3 Documentation](https://github.com/WiseLibs/better-sqlite3)
