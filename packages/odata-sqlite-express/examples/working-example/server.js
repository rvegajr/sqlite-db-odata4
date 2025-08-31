const express = require('express');
const Database = require('better-sqlite3');
const { ExpressODataHandler } = require('../../dist/index.js');

const app = express();
app.use(express.json());

// Create in-memory database for demo
const db = new Database(':memory:');

// Create tables and insert sample data
db.exec(`
  CREATE TABLE Products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category_id INTEGER NOT NULL,
    description TEXT
  );

  CREATE TABLE Categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
  );

  CREATE VIRTUAL TABLE products_fts USING fts5(
    name, description,
    content='Products',
    content_rowid='id'
  );

  INSERT INTO Categories (id, name, description) VALUES
    (1, 'Electronics', 'Electronic devices and gadgets'),
    (2, 'Accessories', 'Computer accessories and peripherals'),
    (3, 'Audio', 'Audio equipment and headphones');

  INSERT INTO Products (id, name, price, category_id, description) VALUES
    (1, 'Laptop Pro', 1200.00, 1, 'High-performance laptop for professionals'),
    (2, 'Gaming Mouse', 75.00, 2, 'Precision gaming mouse with RGB'),
    (3, 'Wireless Keyboard', 120.00, 2, 'Ergonomic wireless keyboard'),
    (4, '4K Monitor', 450.00, 1, 'Ultra-wide 4K monitor'),
    (5, 'Noise Cancelling Headphones', 200.00, 3, 'Premium noise cancelling headphones'),
    (6, 'USB-C Hub', 35.00, 2, 'Multi-port USB-C hub'),
    (7, 'Tablet Pro', 800.00, 1, 'Professional tablet for creative work'),
    (8, 'Bluetooth Speaker', 150.00, 3, 'Portable bluetooth speaker');

  INSERT INTO products_fts (rowid, name, description) 
  SELECT id, name, description FROM Products;
`);

// Define schemas
const productsSchema = {
  name: 'Products',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
    { name: 'category_id', type: 'INTEGER', primaryKey: false, nullable: false },
    { name: 'description', type: 'TEXT', primaryKey: false, nullable: true }
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
const productsRouter = handler.createODataRouter('Products', '/api/odata');
const categoriesRouter = handler.createODataRouter('Categories', '/api/odata');

app.use('/api/odata', productsRouter);
app.use('/api/odata', categoriesRouter);

// Add some demo endpoints
app.get('/', (req, res) => {
  res.json({
    message: 'OData SQLite Express Demo',
    endpoints: {
      products: 'http://localhost:3000/api/odata/Products',
      categories: 'http://localhost:3000/api/odata/Categories',
      metadata: 'http://localhost:3000/api/odata/Products/$metadata',
      examples: {
        'All products': 'GET /api/odata/Products',
        'Filter by price': 'GET /api/odata/Products?$filter=price gt 100',
        'Sort by price': 'GET /api/odata/Products?$orderby=price desc',
        'Pagination': 'GET /api/odata/Products?$top=3&$skip=2',
        'Expand category': 'GET /api/odata/Products?$expand=category',
        'Search': 'GET /api/odata/Products?$search=laptop',
        'Aggregation': 'GET /api/odata/Products?$apply=groupby((category_id),aggregate(price with avg as avg_price))',
        'Computed field': 'GET /api/odata/Products?$compute=price * 1.1 as price_with_tax',
        'Single product': 'GET /api/odata/Products(1)',
        'Product category': 'GET /api/odata/Products(1)/category'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OData SQLite Express Demo running on http://localhost:${PORT}`);
  console.log(`📊 Products API: http://localhost:${PORT}/api/odata/Products`);
  console.log(`📊 Categories API: http://localhost:${PORT}/api/odata/Categories`);
  console.log(`📋 Metadata: http://localhost:${PORT}/api/odata/Products/$metadata`);
  console.log(`\n🎯 Try these examples:`);
  console.log(`   GET http://localhost:${PORT}/api/odata/Products`);
  console.log(`   GET http://localhost:${PORT}/api/odata/Products?$filter=price gt 100`);
  console.log(`   GET http://localhost:${PORT}/api/odata/Products?$expand=category`);
  console.log(`   GET http://localhost:${PORT}/api/odata/Products?$search=laptop`);
  console.log(`   GET http://localhost:${PORT}/api/odata/Products?$compute=price * 1.1 as price_with_tax`);
});
