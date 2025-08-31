# OData v4 Express Integration Example

This example demonstrates how to use the OData v4 SQLite integration with Express.js to create a fully functional REST API.

## Features

- ✅ **OData v4 Compliant**: Full support for OData v4 query options
- ✅ **$filter**: Filter data with complex expressions
- ✅ **$expand**: Join related data (navigation properties)
- ✅ **$search**: Full-text search capabilities
- ✅ **$compute**: Computed properties and calculations
- ✅ **$top & $skip**: Pagination support
- ✅ **$orderby**: Sorting capabilities
- ✅ **$count**: Count endpoints
- ✅ **$metadata**: OData metadata generation
- ✅ **CRUD Operations**: Create, Read, Update, Delete
- ✅ **Error Handling**: Proper OData v4 error responses

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Access the API**:
   - Documentation: http://localhost:3000
   - Health check: http://localhost:3000/health
   - Products API: http://localhost:3000/api/odata/Products
   - Categories API: http://localhost:3000/api/odata/Categories
   - Metadata: http://localhost:3000/api/odata/$metadata

## API Examples

### Basic Queries

```bash
# Get all products
GET /api/odata/Products

# Get products with filter
GET /api/odata/Products?$filter=price gt 1000

# Get products with expand (join categories)
GET /api/odata/Products?$expand=category

# Get products with search
GET /api/odata/Products?$search=laptop

# Get products with computed properties
GET /api/odata/Products?$compute=price * 1.1 as price_with_tax

# Get products with pagination
GET /api/odata/Products?$top=5&$skip=10

# Get products with sorting
GET /api/odata/Products?$orderby=price desc

# Get product count
GET /api/odata/Products/$count

# Get single product
GET /api/odata/Products(1)

# Get product's category
GET /api/odata/Products(1)/category
```

### Complex Queries

```bash
# Combined query with multiple options
GET /api/odata/Products?$filter=price gt 1000&$expand=category&$search=laptop&$compute=price * 1.1 as price_with_tax&$orderby=price desc&$top=10

# Aggregation with $apply
GET /api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price,price with count as total_products))
```

### CRUD Operations

```bash
# Create a new product
POST /api/odata/Products
Content-Type: application/json

{
  "name": "New Product",
  "price": 500.00,
  "category_id": 1
}

# Update a product
PUT /api/odata/Products(1)
Content-Type: application/json

{
  "name": "Updated Product",
  "price": 600.00,
  "category_id": 1
}

# Delete a product
DELETE /api/odata/Products(1)
```

## Response Format

All responses follow the OData v4 specification:

```json
{
  "@odata.context": "/api/odata/$metadata#Products",
  "value": [
    {
      "id": 1,
      "name": "Laptop Pro",
      "price": 1200.00,
      "category_id": 1,
      "category_name": "Computers"
    }
  ]
}
```

## Error Handling

Errors are returned in OData v4 format:

```json
{
  "error": {
    "code": "400",
    "message": "Invalid filter expression"
  }
}
```

## Configuration

The example uses a mock database connection for demonstration. In a real application, you would:

1. **Replace the mock connection** with a real SQLite connection
2. **Define your schemas** based on your database structure
3. **Configure relationships** between your tables
4. **Set up search configuration** for full-text search

## Next Steps

- Replace mock data with real SQLite database
- Add authentication and authorization
- Implement caching for better performance
- Add validation middleware
- Set up logging and monitoring

## Learn More

- [OData v4 Specification](https://docs.oasis-open.org/odata/odata/v4.0/os/part1-protocol/odata-v4.0-os-part1-protocol.html)
- [Express.js Documentation](https://expressjs.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
