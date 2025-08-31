# 🚀 Complete OData v4 Implementation for SQLite

A comprehensive, production-ready OData v4 implementation for SQLite with advanced features including batch operations, delta links, full-text search, aggregations, and framework integrations.

## ✨ Features

- **🔧 Core OData v4 Support** - Complete query builder and executor
- **🔗 $expand Operations** - JOIN operations with relationship support
- **🔍 Full-Text Search** - SQLite FTS5 integration with $search
- **📊 Aggregations** - $apply with GROUP BY and aggregate functions
- **🧮 Computed Properties** - $compute with dynamic calculations
- **📦 Batch Operations** - OData v4 batch request/response handling
- **📈 Delta Links** - Change tracking with delta tokens
- **🌐 Framework Integrations** - Express.js and Astro support
- **✅ TDD & ISP** - Test-driven development with interface segregation
- **🔒 Type Safety** - Full TypeScript support with strict mode

## 📦 Published Packages

### Core Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`odata-sqlite-contracts`](https://www.npmjs.com/package/odata-sqlite-contracts) | ![npm](https://img.shields.io/npm/v/odata-sqlite-contracts) | Core interfaces and contracts |
| [`odata-sqlite-core`](https://www.npmjs.com/package/odata-sqlite-core) | ![npm](https://img.shields.io/npm/v/odata-sqlite-core) | SQL builder and query executor |
| [`odata-sqlite-expand`](https://www.npmjs.com/package/odata-sqlite-expand) | ![npm](https://img.shields.io/npm/v/odata-sqlite-expand) | $expand (JOIN) operations |
| [`odata-sqlite-search`](https://www.npmjs.com/package/odata-sqlite-search) | ![npm](https://img.shields.io/npm/v/odata-sqlite-search) | Full-text search with FTS5 |
| [`odata-sqlite-aggregation`](https://www.npmjs.com/package/odata-sqlite-aggregation) | ![npm](https://img.shields.io/npm/v/odata-sqlite-aggregation) | $apply aggregations |
| [`odata-sqlite-compute`](https://www.npmjs.com/package/odata-sqlite-compute) | ![npm](https://img.shields.io/npm/v/odata-sqlite-compute) | $compute computed properties |
| [`odata-sqlite-batch`](https://www.npmjs.com/package/odata-sqlite-batch) | ![npm](https://img.shields.io/npm/v/odata-sqlite-batch) | Batch operations |
| [`odata-sqlite-delta`](https://www.npmjs.com/package/odata-sqlite-delta) | ![npm](https://img.shields.io/npm/v/odata-sqlite-delta) | Delta links and change tracking |

### Framework Integrations

| Package | Version | Description |
|---------|---------|-------------|
| [`odata-sqlite-express`](https://www.npmjs.com/package/odata-sqlite-express) | ![npm](https://img.shields.io/npm/v/odata-sqlite-express) | Express.js integration |
| [`odata-sqlite-astro`](https://www.npmjs.com/package/odata-sqlite-astro) | ![npm](https://img.shields.io/npm/v/odata-sqlite-astro) | Astro integration |

## 🚀 Quick Start

### Installation

```bash
# Core functionality
npm install odata-sqlite-core odata-sqlite-contracts

# Advanced features
npm install odata-sqlite-expand odata-sqlite-search odata-sqlite-aggregation odata-sqlite-compute

# Batch operations and delta links
npm install odata-sqlite-batch odata-sqlite-delta

# Framework integration
npm install odata-sqlite-express  # For Express.js
npm install odata-sqlite-astro    # For Astro
```

### Basic Usage

```typescript
import { SQLBuilder, ConnectionAdapter } from 'odata-sqlite-core';
import { LocalSQLiteAdapter } from 'odata-sqlite-core';

// Setup database connection
const adapter = new LocalSQLiteAdapter('database.db');
const builder = new SQLBuilder();

// Build OData query
const query = builder.buildSelectQuery('Products', {
  filter: 'price gt 100',
  top: 10,
  orderBy: 'price desc',
  select: 'id,name,price'
});

// Execute query
const result = await adapter.query(query.sql, query.params);
```

### Express.js Integration

```typescript
import express from 'express';
import { ExpressODataHandler } from 'odata-sqlite-express';

const app = express();
const handler = new ExpressODataHandler({
  connection: adapter,
  schemas: { Products, Categories }
});

// Register OData routes
app.use('/api/odata', handler.createRouter());
```

### Advanced Features

#### Batch Operations

```typescript
import { BatchBuilder } from 'odata-sqlite-batch';

const batchBuilder = new BatchBuilder();
const batchRequest = `
--batch_boundary
Content-Type: multipart/mixed; boundary=batch_boundary

--batch_boundary
Content-Type: application/http

GET /api/odata/Products HTTP/1.1

--batch_boundary
Content-Type: application/http

POST /api/odata/Products HTTP/1.1
Content-Type: application/json

{"name": "New Product", "price": 99.99}
--batch_boundary--
`;

const result = await batchBuilder.executeBatch(batchRequest, adapter);
```

#### Delta Links

```typescript
import { DeltaTracker } from 'odata-sqlite-delta';

const deltaTracker = new DeltaTracker();

// Track changes
deltaTracker.trackChange('Products', 1, 'create');
deltaTracker.trackChange('Products', 1, 'update');

// Generate delta link
const deltaLink = deltaTracker.generateDeltaLink(
  'http://localhost:3000/api/odata/Products',
  'Products',
  Date.now()
);
```

#### Full-Text Search

```typescript
import { SearchProvider } from 'odata-sqlite-search';

const searchProvider = new SearchProvider();
const searchResult = searchProvider.buildSearchQuery(
  'laptop computer',
  'products_fts',
  ['name', 'description']
);
```

## 🧪 Testing

All packages include comprehensive test suites:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

## 📚 Documentation

### Core Concepts

- **OData v4 Compliance** - Full implementation of OData v4 specification
- **SQLite Integration** - Works with both local SQLite and Turso cloud
- **Type Safety** - Complete TypeScript support with strict mode
- **Performance** - Optimized query building and execution

### Query Options Supported

- `$filter` - Complex filtering with operators
- `$select` - Field selection
- `$orderby` - Sorting with multiple fields
- `$top` / `$skip` - Pagination
- `$expand` - Relationship expansion
- `$search` - Full-text search
- `$apply` - Aggregations and grouping
- `$compute` - Computed properties
- `$count` - Result counting
- `$batch` - Batch operations
- `$deltatoken` - Change tracking

### Database Support

- **Local SQLite** - Using `better-sqlite3`
- **Turso Cloud** - Using `@libsql/client`
- **Custom Adapters** - Extensible connection system

## 🏗️ Architecture

The library follows clean architecture principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Framework Integrations                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Express.js    │  │     Astro       │  │   Custom    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Advanced Features                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Batch    │  │    Delta    │  │    Aggregations     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Core Features                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Expand   │  │   Search    │  │      Compute        │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                        Core Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   SQL Builder   │  │   Connection    │  │  Contracts  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Local SQLite  │  │   Turso Cloud   │  │   Custom    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Use Cases

### E-commerce Applications
- Product catalog with filtering and search
- Order management with relationships
- Customer analytics with aggregations

### Content Management Systems
- Article search and categorization
- Media library management
- User activity tracking

### Business Intelligence
- Data analytics and reporting
- Real-time dashboards
- Change tracking and auditing

## 🔧 Development

### Prerequisites

- Node.js 18+
- TypeScript 5+
- SQLite 3.x

### Setup

```bash
git clone https://github.com/your-username/sqlite-db-odata4.git
cd sqlite-db-odata4
npm install
npm run build
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests first (TDD)
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Support

- 📖 [Documentation](https://github.com/your-username/sqlite-db-odata4/wiki)
- 🐛 [Issue Tracker](https://github.com/your-username/sqlite-db-odata4/issues)
- 💬 [Discussions](https://github.com/your-username/sqlite-db-odata4/discussions)

## 🙏 Acknowledgments

- OData v4 specification contributors
- SQLite development team
- Turso/libSQL team
- Express.js and Astro communities

---

**Built with ❤️ by The Happiest Software Engineer in the Universe**
