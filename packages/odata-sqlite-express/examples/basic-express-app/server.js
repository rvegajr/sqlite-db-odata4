const express = require('express');
const { ExpressODataHandler } = require('../../dist/express-odata-handler');

const app = express();
app.use(express.json());

// Mock database connection
const mockConnection = {
  query: (sql, params = []) => {
    console.log('SQL:', sql);
    console.log('Params:', params);
    
    // Mock data for demonstration
    if (sql.includes('SELECT * FROM products')) {
      return Promise.resolve([
        { id: 1, name: 'Laptop Pro', price: 1200.00, category_id: 1 },
        { id: 2, name: 'Smartphone X', price: 800.00, category_id: 2 }
      ]);
    }
    
    if (sql.includes('SELECT * FROM categories')) {
      return Promise.resolve([
        { id: 1, name: 'Computers', description: 'Computer products' },
        { id: 2, name: 'Mobile', description: 'Mobile devices' }
      ]);
    }
    
    return Promise.resolve([]);
  }
};

// Define schemas
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

// Create OData handler
const handler = new ExpressODataHandler({
  connection: mockConnection,
  schemas: {
    'Products': productsSchema,
    'Categories': categoriesSchema
  },
  relationships,
  searchConfig: [
    {
      table: 'products',
      ftsTable: 'products_fts',
      columns: ['name']
    }
  ]
});

// Create and mount OData routers
const productsRouter = handler.createODataRouter('Products', '/api/odata');
const categoriesRouter = handler.createODataRouter('Categories', '/api/odata');

app.use('/api/odata', productsRouter);
app.use('/api/odata', categoriesRouter);

// Add a simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'OData Express Server is running' });
});

// Add documentation endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'OData v4 Express Integration Example',
    endpoints: {
      health: '/health',
      products: '/api/odata/Products',
      categories: '/api/odata/Categories',
      metadata: '/api/odata/$metadata',
      examples: {
        'Get all products': '/api/odata/Products',
        'Get products with filter': '/api/odata/Products?$filter=price gt 1000',
        'Get products with expand': '/api/odata/Products?$expand=category',
        'Get products with search': '/api/odata/Products?$search=laptop',
        'Get products with compute': '/api/odata/Products?$compute=price * 1.1 as price_with_tax',
        'Get products with top and skip': '/api/odata/Products?$top=1&$skip=1',
        'Get products with orderby': '/api/odata/Products?$orderby=price desc',
        'Get product count': '/api/odata/Products/$count',
        'Get single product': '/api/odata/Products(1)',
        'Get product category': '/api/odata/Products(1)/category'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 OData Express Server running on http://localhost:${PORT}`);
  console.log(`📖 Documentation: http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Products API: http://localhost:${PORT}/api/odata/Products`);
  console.log(`📋 Categories API: http://localhost:${PORT}/api/odata/Categories`);
  console.log(`📄 Metadata: http://localhost:${PORT}/api/odata/$metadata`);
});
