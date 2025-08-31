const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text({ type: 'multipart/mixed' }));

// Initialize SQLite database
const db = new Database(':memory:');

// 🚀 Database Schema Setup
function setupDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS Products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS OrderItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES Orders(id),
      FOREIGN KEY (product_id) REFERENCES Products(id)
    );

    -- Full-Text Search table for Products
    CREATE VIRTUAL TABLE IF NOT EXISTS Products_fts USING fts5(
      name, description, content='Products', content_rowid='id'
    );

    -- Change tracking table for Delta Links
    CREATE TABLE IF NOT EXISTS delta_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_name TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      operation TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_delta_changes_resource_timestamp 
    ON delta_changes(resource_name, timestamp);
  `);

  // Insert sample data
  const categories = [
    { name: 'Electronics', description: 'Electronic devices and gadgets' },
    { name: 'Books', description: 'Books and publications' },
    { name: 'Clothing', description: 'Apparel and accessories' }
  ];

  const products = [
    { name: 'Laptop', price: 999.99, category_id: 1 },
    { name: 'Smartphone', price: 599.99, category_id: 1 },
    { name: 'Programming Book', price: 49.99, category_id: 2 },
    { name: 'T-Shirt', price: 19.99, category_id: 3 },
    { name: 'Headphones', price: 89.99, category_id: 1 }
  ];

  const orders = [
    { customer_name: 'John Doe', total_amount: 1049.98, status: 'completed' },
    { customer_name: 'Jane Smith', total_amount: 69.98, status: 'pending' }
  ];

  // Insert data
  const insertCategory = db.prepare('INSERT INTO Categories (name, description) VALUES (?, ?)');
  const insertProduct = db.prepare('INSERT INTO Products (name, price, category_id) VALUES (?, ?, ?)');
  const insertOrder = db.prepare('INSERT INTO Orders (customer_name, total_amount, status) VALUES (?, ?, ?)');

  categories.forEach(cat => insertCategory.run(cat.name, cat.description));
  products.forEach(prod => insertProduct.run(prod.name, prod.price, prod.category_id));
  orders.forEach(order => insertOrder.run(order.customer_name, order.total_amount, order.status));

  console.log('✅ Database initialized with sample data');
}

// 🚀 OData Query Parser
function parseODataQuery(url) {
  const params = new URLSearchParams(url.search);
  const query = {};

  if (params.get('$filter')) query.filter = params.get('$filter');
  if (params.get('$select')) query.select = params.get('$select').split(',');
  if (params.get('$orderby')) query.orderBy = params.get('$orderby');
  if (params.get('$top')) query.top = parseInt(params.get('$top'));
  if (params.get('$skip')) query.skip = parseInt(params.get('$skip'));
  if (params.get('$expand')) query.expand = params.get('$expand').split(',');
  if (params.get('$search')) query.search = params.get('$search');
  if (params.get('$apply')) query.apply = params.get('$apply');
  if (params.get('$compute')) query.compute = params.get('$compute');
  if (params.get('$count') === 'true') query.count = true;
  if (params.get('$deltatoken')) query.deltaToken = params.get('$deltatoken');

  return query;
}

// 🚀 SQL Query Builder
function buildSQLQuery(table, query) {
  let sql = `SELECT * FROM ${table}`;
  const params = [];
  let hasWhere = false;

  // Handle $filter
  if (query.filter) {
    const filterClause = parseFilter(query.filter);
    sql += ` WHERE ${filterClause.sql}`;
    params.push(...filterClause.params);
    hasWhere = true;
  }

  // Handle $search (Full-Text Search)
  if (query.search && table === 'Products') {
    const searchClause = hasWhere ? ' AND ' : ' WHERE ';
    sql += `${searchClause}id IN (SELECT rowid FROM Products_fts WHERE Products_fts MATCH ?)`;
    params.push(query.search);
    hasWhere = true;
  }

  // Handle $orderby
  if (query.orderBy) {
    sql += ` ORDER BY ${query.orderBy}`;
  }

  // Handle $top and $skip
  if (query.top || query.skip) {
    sql += ' LIMIT ?';
    params.push(query.top || 1000);
    if (query.skip) {
      sql += ' OFFSET ?';
      params.push(query.skip);
    }
  }

  return { sql, params };
}

// 🚀 Filter Parser
function parseFilter(filterString) {
  // Simple filter parser - supports basic operators
  const operators = {
    eq: '=',
    ne: '!=',
    lt: '<',
    le: '<=',
    gt: '>',
    ge: '>='
  };

  const match = filterString.match(/^(\w+)\s+(eq|ne|lt|le|gt|ge)\s+(.+)$/);
  if (!match) {
    throw new Error(`Invalid filter: ${filterString}`);
  }

  const [, field, operator, value] = match;
  const sqlOperator = operators[operator];
  
  // Handle string values
  let param = value;
  if (value.startsWith("'") && value.endsWith("'")) {
    param = value.slice(1, -1);
  } else if (!isNaN(value)) {
    param = parseFloat(value);
  }

  return {
    sql: `${field} ${sqlOperator} ?`,
    params: [param]
  };
}

// 🚀 Delta Links Implementation
class DeltaTracker {
  constructor(db) {
    this.db = db;
  }

  trackChange(resourceName, entityId, operation, timestamp = Date.now()) {
    const sql = `
      INSERT INTO delta_changes (resource_name, entity_id, operation, timestamp, data)
      VALUES (?, ?, ?, ?, ?)
    `;
    const data = JSON.stringify({ resourceName, entityId, operation, timestamp });
    this.db.prepare(sql).run(resourceName, entityId, operation, timestamp, data);
  }

  getChanges(resourceName, sinceTimestamp) {
    const sql = `
      SELECT * FROM delta_changes 
      WHERE resource_name = ? AND timestamp > ?
      ORDER BY timestamp ASC
    `;
    return this.db.prepare(sql).all(resourceName, sinceTimestamp);
  }

  generateDeltaLink(baseUrl, resourceName, timestamp) {
    return `${baseUrl}/api/odata/${resourceName}?$deltatoken=${timestamp}`;
  }

  parseDeltaToken(token) {
    const timestamp = parseInt(token, 10);
    return isNaN(timestamp) ? null : timestamp;
  }
}

// 🚀 Batch Operations Implementation
class BatchProcessor {
  constructor(db) {
    this.db = db;
  }

  parseBatchRequest(content) {
    const operations = [];
    const lines = content.split('\n');
    let currentOperation = null;
    let inHttpSection = false;
    let bodyLines = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('--changeset_boundary') && !trimmed.endsWith('--')) {
        currentOperation = { headers: [] };
        inHttpSection = false;
        bodyLines = [];
        continue;
      }

      if (currentOperation && !inHttpSection && this.isHttpMethodLine(trimmed)) {
        const [method, url] = this.parseHttpMethodLine(trimmed);
        currentOperation.method = method;
        currentOperation.url = url;
        inHttpSection = true;
        continue;
      }

      if (currentOperation && inHttpSection && trimmed.includes(':')) {
        if (trimmed.toLowerCase().startsWith('content-type:')) {
          currentOperation.headers.push(trimmed);
        }
        continue;
      }

      if (currentOperation && inHttpSection && trimmed && !trimmed.includes(':')) {
        bodyLines.push(trimmed);
        continue;
      }

      if (trimmed === '--changeset_boundary--' && currentOperation) {
        if (bodyLines.length > 0) {
          try {
            currentOperation.body = JSON.parse(bodyLines.join('\n'));
          } catch (error) {
            currentOperation.body = bodyLines.join('\n');
          }
        }
        operations.push(currentOperation);
        currentOperation = null;
        inHttpSection = false;
        bodyLines = [];
      }
    }

    return operations;
  }

  isHttpMethodLine(line) {
    return /^(GET|POST|PUT|DELETE)\s+\//.test(line);
  }

  parseHttpMethodLine(line) {
    const parts = line.split(' ');
    return [parts[0], parts[1]];
  }

  async executeBatch(operations) {
    const results = [];

    // Execute in transaction
    const transaction = this.db.transaction(() => {
      for (const operation of operations) {
        try {
          const result = this.executeSingleOperation(operation);
          results.push(result);
        } catch (error) {
          results.push({
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: { code: 'InternalError', message: error.message } }
          });
        }
      }
    });

    transaction();
    return results;
  }

  executeSingleOperation(operation) {
    const { method, url, body } = operation;
    const urlParts = url.split('/');
    const resource = urlParts[urlParts.length - 1];

    switch (method) {
      case 'GET':
        return this.handleGet(resource, url);
      case 'POST':
        return this.handlePost(resource, body);
      case 'PUT':
        return this.handlePut(resource, url, body);
      case 'DELETE':
        return this.handleDelete(resource, url);
      default:
        return {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
          body: { error: { code: 'MethodNotAllowed', message: `Method ${method} not supported` } }
        };
    }
  }

  handleGet(resource, url) {
    const query = parseODataQuery(new URL(url, 'http://localhost'));
    const { sql, params } = buildSQLQuery(resource, query);
    const result = this.db.prepare(sql).all(...params);

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: { value: result }
    };
  }

  handlePost(resource, body) {
    const columns = Object.keys(body);
    const values = Object.values(body);
    const placeholders = values.map(() => '?').join(', ');

    const sql = `INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = this.db.prepare(sql).get(...values);

    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      body: result
    };
  }

  handlePut(resource, url, body) {
    const urlParts = url.split('/');
    const id = urlParts[urlParts.length - 1].replace(/[()]/g, '');
    
    const columns = Object.keys(body);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(body), id];

    const sql = `UPDATE ${resource} SET ${setClause} WHERE id = ? RETURNING *`;
    const result = this.db.prepare(sql).get(...values);

    if (!result) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'NotFound', message: 'Resource not found' } }
      };
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result
    };
  }

  handleDelete(resource, url) {
    const urlParts = url.split('/');
    const id = urlParts[urlParts.length - 1].replace(/[()]/g, '');

    const sql = `DELETE FROM ${resource} WHERE id = ?`;
    const result = this.db.prepare(sql).run(id);

    if (result.changes === 0) {
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        body: { error: { code: 'NotFound', message: 'Resource not found' } }
      };
    }

    return {
      status: 204,
      headers: {}
    };
  }

  generateBatchResponse(operations, results) {
    let response = '--batch_boundary\r\n';
    response += 'Content-Type: multipart/mixed; boundary=changeset_boundary\r\n\r\n';

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const result = results[i];

      response += '--changeset_boundary\r\n';
      response += 'Content-Type: application/http\r\n';
      response += 'Content-Transfer-Encoding: binary\r\n\r\n';

      response += `HTTP/1.1 ${result.status} ${this.getStatusText(result.status)}\r\n`;

      for (const [key, value] of Object.entries(result.headers || {})) {
        response += `${key}: ${value}\r\n`;
      }

      response += '\r\n';

      if (result.body !== undefined) {
        if (typeof result.body === 'string') {
          response += result.body;
        } else {
          response += JSON.stringify(result.body);
        }
      }

      response += '\r\n';
    }

    response += '--changeset_boundary--\r\n';
    response += '--batch_boundary--\r\n';

    return response;
  }

  getStatusText(status) {
    const statusTexts = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      404: 'Not Found',
      405: 'Method Not Allowed',
      500: 'Internal Server Error'
    };
    return statusTexts[status] || 'Unknown';
  }
}

// Initialize services
const deltaTracker = new DeltaTracker(db);
const batchProcessor = new BatchProcessor(db);

// 🚀 OData API Routes
app.get('/api/odata/:resource(*)', async (req, res) => {
  try {
    const { resource } = req.params;
    const query = parseODataQuery(req.url);

    // Handle delta token requests
    if (query.deltaToken) {
      const sinceTimestamp = deltaTracker.parseDeltaToken(query.deltaToken);
      if (!sinceTimestamp) {
        return res.status(400).json({ error: { code: 'BadRequest', message: 'Invalid delta token' } });
      }

      const changes = deltaTracker.getChanges(resource, sinceTimestamp);
      const currentTimestamp = Date.now();

      const response = {
        '@odata.context': `${req.protocol}://${req.get('host')}/api/odata/$metadata#${resource}`,
        '@odata.deltaLink': deltaTracker.generateDeltaLink(`${req.protocol}://${req.get('host')}`, resource, currentTimestamp),
        value: changes.map(change => ({
          '@odata.id': `${req.protocol}://${req.get('host')}/api/odata/${resource}(${change.entity_id})`,
          '@odata.etag': `"${change.timestamp}"`,
          '@odata.operation': change.operation,
          ...JSON.parse(change.data || '{}')
        }))
      };

      return res.json(response);
    }

    // Handle regular queries
    const { sql, params } = buildSQLQuery(resource, query);
    const result = db.prepare(sql).all(...params);

    const response = {
      '@odata.context': `${req.protocol}://${req.get('host')}/api/odata/$metadata#${resource}`,
      value: result
    };

    // Add delta link for next request
    if (!query.deltaToken) {
      response['@odata.deltaLink'] = deltaTracker.generateDeltaLink(
        `${req.protocol}://${req.get('host')}`, 
        resource, 
        Date.now()
      );
    }

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: { code: 'InternalError', message: error.message } });
  }
});

// 🚀 Single Resource Endpoint
app.get('/api/odata/:resource(*)/:id', async (req, res) => {
  try {
    const { resource, id } = req.params;
    const sql = `SELECT * FROM ${resource} WHERE id = ?`;
    const result = db.prepare(sql).get(id);

    if (!result) {
      return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: { code: 'InternalError', message: error.message } });
  }
});

// 🚀 POST - Create Resource
app.post('/api/odata/:resource(*)', async (req, res) => {
  try {
    const { resource } = req.params;
    const body = req.body;

    const columns = Object.keys(body);
    const values = Object.values(body);
    const placeholders = values.map(() => '?').join(', ');

    const sql = `INSERT INTO ${resource} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = db.prepare(sql).get(...values);

    // Track change for delta links
    deltaTracker.trackChange(resource, result.id, 'create');

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: { code: 'InternalError', message: error.message } });
  }
});

// 🚀 PUT - Update Resource
app.put('/api/odata/:resource(*)/:id', async (req, res) => {
  try {
    const { resource, id } = req.params;
    const body = req.body;

    const columns = Object.keys(body);
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(body), id];

    const sql = `UPDATE ${resource} SET ${setClause} WHERE id = ? RETURNING *`;
    const result = db.prepare(sql).get(...values);

    if (!result) {
      return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
    }

    // Track change for delta links
    deltaTracker.trackChange(resource, parseInt(id), 'update');

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: { code: 'InternalError', message: error.message } });
  }
});

// 🚀 DELETE - Delete Resource
app.delete('/api/odata/:resource(*)/:id', async (req, res) => {
  try {
    const { resource, id } = req.params;

    const sql = `DELETE FROM ${resource} WHERE id = ?`;
    const result = db.prepare(sql).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
    }

    // Track change for delta links
    deltaTracker.trackChange(resource, parseInt(id), 'delete');

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: { code: 'InternalError', message: error.message } });
  }
});

// 🚀 Batch Operations Endpoint
app.post('/api/odata/$batch', async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/mixed')) {
      return res.status(400).json({ error: { code: 'BadRequest', message: 'Invalid content type for batch request' } });
    }

    const body = req.body;
    const operations = batchProcessor.parseBatchRequest(body);
    const results = await batchProcessor.executeBatch(operations);
    const responseContent = batchProcessor.generateBatchResponse(operations, results);

    res.set({
      'Content-Type': 'multipart/mixed; boundary=batch_boundary',
      'OData-Version': '4.0'
    });
    res.send(responseContent);
  } catch (error) {
    res.status(500).json({ error: { code: 'InternalError', message: error.message } });
  }
});

// 🚀 Metadata Endpoint
app.get('/api/odata/$metadata', (req, res) => {
  const metadata = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Default" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Products">
        <Property Name="id" Type="Edm.Int32" Nullable="false"/>
        <Property Name="name" Type="Edm.String" Nullable="false"/>
        <Property Name="price" Type="Edm.Double" Nullable="false"/>
        <Property Name="category_id" Type="Edm.Int32" Nullable="true"/>
        <Property Name="created_at" Type="Edm.DateTimeOffset" Nullable="false"/>
        <Property Name="updated_at" Type="Edm.DateTimeOffset" Nullable="false"/>
      </EntityType>
      <EntityType Name="Categories">
        <Property Name="id" Type="Edm.Int32" Nullable="false"/>
        <Property Name="name" Type="Edm.String" Nullable="false"/>
        <Property Name="description" Type="Edm.String" Nullable="true"/>
        <Property Name="created_at" Type="Edm.DateTimeOffset" Nullable="false"/>
      </EntityType>
      <EntityType Name="Orders">
        <Property Name="id" Type="Edm.Int32" Nullable="false"/>
        <Property Name="customer_name" Type="Edm.String" Nullable="false"/>
        <Property Name="total_amount" Type="Edm.Double" Nullable="false"/>
        <Property Name="status" Type="Edm.String" Nullable="false"/>
        <Property Name="created_at" Type="Edm.DateTimeOffset" Nullable="false"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

  res.set('Content-Type', 'application/xml');
  res.send(metadata);
});

// 🚀 Demo Endpoints
app.get('/api/demo/change-stats', (req, res) => {
  const sql = `
    SELECT resource_name, operation, COUNT(*) as count 
    FROM delta_changes 
    GROUP BY resource_name, operation
  `;
  const stats = db.prepare(sql).all();
  res.json(stats);
});

app.get('/api/demo/clear-changes', (req, res) => {
  db.prepare('DELETE FROM delta_changes').run();
  res.json({ message: 'All changes cleared' });
});

// Start server
setupDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Advanced OData v4 Demo Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('📚 Available Features:');
  console.log('  ✅ Basic CRUD Operations');
  console.log('  ✅ OData Query Options ($filter, $select, $orderby, $top, $skip)');
  console.log('  ✅ Full-Text Search ($search)');
  console.log('  ✅ Batch Operations ($batch)');
  console.log('  ✅ Delta Links (Change Tracking)');
  console.log('  ✅ Metadata Generation');
  console.log('');
  console.log('🔗 Example Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/odata/Products`);
  console.log(`  GET  http://localhost:${PORT}/api/odata/Products?$filter=price gt 100`);
  console.log(`  GET  http://localhost:${PORT}/api/odata/Products?$search=laptop`);
  console.log(`  GET  http://localhost:${PORT}/api/odata/Products?$top=2&$skip=1`);
  console.log(`  POST http://localhost:${PORT}/api/odata/$batch`);
  console.log(`  GET  http://localhost:${PORT}/api/odata/Products?$deltatoken=1234567890`);
  console.log(`  GET  http://localhost:${PORT}/api/odata/$metadata`);
  console.log('');
  console.log('🎯 Run "npm test" to see all features in action!');
});
