# 🚀 Advanced OData v4 Demo with SQLite

A comprehensive demonstration of advanced OData v4 features implemented with SQLite, including **Batch Operations** and **Delta Links** for change tracking.

## 🎯 Features Demonstrated

### ✅ Core OData v4 Features
- **Basic CRUD Operations** (Create, Read, Update, Delete)
- **Query Options** (`$filter`, `$select`, `$orderby`, `$top`, `$skip`)
- **Full-Text Search** (`$search`) using SQLite FTS5
- **Metadata Generation** (`$metadata`)

### 🚀 Advanced Features
- **Batch Operations** (`$batch`) - Execute multiple operations in a single request
- **Delta Links** (`$deltatoken`) - Track and retrieve changes since last request
- **Change Tracking** - Automatic tracking of all CRUD operations
- **Transaction Support** - Batch operations execute in database transactions

## 🛠️ Installation & Setup

```bash
# Install dependencies
npm install

# Start the demo server
npm start

# Or run in development mode with auto-restart
npm run dev
```

The server will start on `http://localhost:3000` with a pre-populated SQLite database.

## 📚 API Endpoints

### 🔗 Basic OData Endpoints

```http
# Get all products
GET /api/odata/Products

# Get single product
GET /api/odata/Products/1

# Create new product
POST /api/odata/Products
Content-Type: application/json

{
  "name": "New Product",
  "price": 99.99,
  "category_id": 1
}

# Update product
PUT /api/odata/Products/1
Content-Type: application/json

{
  "price": 149.99
}

# Delete product
DELETE /api/odata/Products/1
```

### 🔍 Query Options

```http
# Filter products
GET /api/odata/Products?$filter=price gt 100

# Select specific fields
GET /api/odata/Products?$select=name,price

# Order by field
GET /api/odata/Products?$orderby=price desc

# Pagination
GET /api/odata/Products?$top=5&$skip=10

# Full-text search
GET /api/odata/Products?$search=laptop

# Complex query
GET /api/odata/Products?$filter=price gt 50&$orderby=name asc&$top=3
```

### 🚀 Batch Operations

```http
POST /api/odata/$batch
Content-Type: multipart/mixed; boundary=batch_boundary

--batch_boundary
Content-Type: multipart/mixed; boundary=changeset_boundary

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"Batch Product 1","price":199.99,"category_id":1}

--changeset_boundary
Content-Type: application/http
Content-Transfer-Encoding: binary

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name":"Batch Product 2","price":299.99,"category_id":2}

--changeset_boundary--
--batch_boundary--
```

### 📊 Delta Links (Change Tracking)

```http
# Get initial delta link
GET /api/odata/Products

# Response includes @odata.deltaLink
{
  "@odata.context": "http://localhost:3000/api/odata/$metadata#Products",
  "@odata.deltaLink": "http://localhost:3000/api/odata/Products?$deltatoken=1704110400000",
  "value": [...]
}

# Use delta link to get changes
GET /api/odata/Products?$deltatoken=1704110400000

# Response shows only changes since last request
{
  "@odata.context": "http://localhost:3000/api/odata/$metadata#Products",
  "@odata.deltaLink": "http://localhost:3000/api/odata/Products?$deltatoken=1704110500000",
  "value": [
    {
      "@odata.id": "http://localhost:3000/api/odata/Products(6)",
      "@odata.etag": "\"1704110450000\"",
      "@odata.operation": "create",
      "name": "New Product",
      "price": 99.99
    }
  ]
}
```

### 📋 Metadata

```http
GET /api/odata/$metadata
```

Returns OData v4 metadata in XML format describing the data model.

### 📈 Demo Endpoints

```http
# Get change statistics
GET /api/demo/change-stats

# Clear all tracked changes
GET /api/demo/clear-changes
```

## 🧪 Testing

Run the comprehensive test suite to see all features in action:

```bash
npm test
```

This will test:
- ✅ Basic CRUD operations
- ✅ OData query options
- ✅ Full-text search
- ✅ Batch operations
- ✅ Delta links and change tracking
- ✅ Metadata generation
- ✅ Error handling
- ✅ Complex queries

## 🏗️ Architecture

### Database Schema

```sql
-- Products table
CREATE TABLE Products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  category_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE Categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE Orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search table
CREATE VIRTUAL TABLE Products_fts USING fts5(
  name, description, content='Products', content_rowid='id'
);

-- Change tracking table for Delta Links
CREATE TABLE delta_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_name TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  operation TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Key Components

1. **DeltaTracker** - Manages change tracking and delta link generation
2. **BatchProcessor** - Handles batch operation parsing and execution
3. **Query Parser** - Parses OData query options into SQL
4. **Filter Parser** - Converts OData filters to SQL WHERE clauses

## 🎯 Use Cases

### Batch Operations
- **Bulk Data Import** - Import multiple records in a single request
- **Transaction Safety** - All operations succeed or fail together
- **Performance** - Reduce network overhead for multiple operations

### Delta Links
- **Real-time Sync** - Get only changed data since last request
- **Mobile Apps** - Efficient data synchronization
- **Audit Trails** - Track all changes to resources
- **Incremental Updates** - Reduce bandwidth and processing time

## 🔧 Configuration

The demo server includes several configuration options:

```javascript
// Database configuration
const db = new Database(':memory:'); // In-memory SQLite database

// Delta tracking configuration
const deltaConfig = {
  maxChanges: 1000,        // Maximum changes to track per resource
  cleanupInterval: 86400000, // Cleanup old changes (24 hours)
  tokenExpiry: 604800000    // Delta token expiry (7 days)
};
```

## 🚀 Integration with Astro

This demo can be easily integrated with Astro applications:

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  server: {
    port: 3000
  }
});

// src/pages/api/odata/[...path].js
export async function GET({ request, params }) {
  // Use the OData handler from the demo
  const handler = createODataHandler({
    connection: db,
    schemas: { Products, Categories, Orders },
    enableBatch: true,
    enableDelta: true,
    deltaConfig: { maxChanges: 1000 }
  });
  
  return handler.createGetHandler()({ request, params });
}
```

## 📊 Performance Considerations

### Batch Operations
- **Transaction Safety** - All operations in a batch execute in a single transaction
- **Error Handling** - Individual operation failures don't affect others
- **Response Format** - Multipart/mixed response with individual operation results

### Delta Links
- **Efficient Queries** - Indexed timestamp queries for fast change retrieval
- **Automatic Cleanup** - Old changes are automatically cleaned up
- **Token Management** - Delta tokens include timestamps for precise change tracking

## 🔒 Security Features

- **Input Validation** - All OData query parameters are validated
- **SQL Injection Protection** - Parameterized queries prevent SQL injection
- **Error Handling** - Graceful error responses with appropriate HTTP status codes
- **Content Type Validation** - Strict validation of request content types

## 🎉 Conclusion

This demo showcases a complete implementation of advanced OData v4 features with SQLite, providing:

- **Full OData v4 Compliance** - All major query options supported
- **Advanced Features** - Batch operations and delta links
- **Production Ready** - Error handling, validation, and performance optimizations
- **Easy Integration** - Can be integrated with any Node.js framework

The implementation follows OData v4 specification standards and provides a solid foundation for building robust, scalable APIs with change tracking and batch processing capabilities.

## 📚 Additional Resources

- [OData v4 Specification](https://docs.oasis-open.org/odata/odata/v4.0/os/part1-protocol/odata-v4.0-os-part1-protocol.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Better SQLite3](https://github.com/WiseLibs/better-sqlite3)
- [Express.js](https://expressjs.com/)
