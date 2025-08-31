import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import { ConnectionAdapter } from 'odata-sqlite-core';
import type { TableSchema } from 'odata-sqlite-contracts';

// Database setup
const db = new Database(':memory:');
const connection = new ConnectionAdapter(db);

// Sample schema
const schemas: Record<string, TableSchema> = {
  Products: {
    columns: [
      { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'price', type: 'REAL', nullable: false },
      { name: 'categoryId', type: 'INTEGER', nullable: true }
    ]
  },
  Categories: {
    columns: [
      { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
      { name: 'name', type: 'TEXT', nullable: false },
      { name: 'description', type: 'TEXT', nullable: true }
    ]
  }
};

// Initialize database with sample data
function initializeDatabase() {
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );
    
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      categoryId INTEGER,
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );
  `);

  // Insert sample data
  const insertCategory = db.prepare('INSERT INTO categories (id, name, description) VALUES (?, ?, ?)');
  const insertProduct = db.prepare('INSERT INTO products (id, name, price, categoryId) VALUES (?, ?, ?, ?)');

  insertCategory.run(1, 'Electronics', 'Electronic devices and gadgets');
  insertCategory.run(2, 'Books', 'Books and literature');
  insertCategory.run(3, 'Clothing', 'Apparel and accessories');

  insertProduct.run(1, 'Laptop', 999.99, 1);
  insertProduct.run(2, 'Smartphone', 599.99, 1);
  insertProduct.run(3, 'Programming Book', 49.99, 2);
  insertProduct.run(4, 'T-Shirt', 19.99, 3);
  insertProduct.run(5, 'Headphones', 89.99, 1);
}

// Initialize on first request
let initialized = false;

// OData query parser
function parseODataQuery(searchParams: URLSearchParams) {
  const query: any = {};

  // Parse $filter
  const filter = searchParams.get('$filter');
  if (filter) {
    query.filter = parseFilter(filter);
  }

  // Parse $top
  const top = searchParams.get('$top');
  if (top) {
    query.top = parseInt(top);
  }

  // Parse $skip
  const skip = searchParams.get('$skip');
  if (skip) {
    query.skip = parseInt(skip);
  }

  // Parse $orderby
  const orderby = searchParams.get('$orderby');
  if (orderby) {
    query.orderBy = parseOrderBy(orderby);
  }

  // Parse $select
  const select = searchParams.get('$select');
  if (select) {
    query.select = select.split(',').map(s => s.trim());
  }

  return query;
}

function parseFilter(filterString: string) {
  // Simple filter parser - supports basic comparisons
  const match = filterString.match(/^(\w+)\s+(eq|ne|lt|le|gt|ge)\s+(.+)$/);
  if (!match) {
    throw new Error(`Invalid filter: ${filterString}`);
  }

  const [, field, operator, value] = match;
  let parsedValue: any = value;

  // Parse value
  if (value === 'null') {
    parsedValue = null;
  } else if (value === 'true' || value === 'false') {
    parsedValue = value === 'true';
  } else if (value.startsWith("'") && value.endsWith("'")) {
    parsedValue = value.slice(1, -1);
  } else if (!isNaN(Number(value))) {
    parsedValue = Number(value);
  }

  return { field, operator, value: parsedValue };
}

function parseOrderBy(orderByString: string) {
  return orderByString.split(',').map(field => {
    const parts = field.trim().split(' ');
    return {
      field: parts[0],
      direction: parts[1] === 'desc' ? 'desc' : 'asc'
    };
  });
}

// Build SQL query
function buildSQLQuery(tableName: string, query: any) {
  let sql = `SELECT * FROM ${tableName.toLowerCase()}`;
  const params: any[] = [];

  // Add WHERE clause
  if (query.filter) {
    const operators: Record<string, string> = {
      eq: '=',
      ne: '!=',
      lt: '<',
      le: '<=',
      gt: '>',
      ge: '>='
    };

    const operator = operators[query.filter.operator] || '=';
    params.push(query.filter.value);
    sql += ` WHERE ${query.filter.field} ${operator} ?`;
  }

  // Add ORDER BY
  if (query.orderBy && query.orderBy.length > 0) {
    const orderByClause = query.orderBy.map((ob: any) => 
      `${ob.field} ${ob.direction}`
    ).join(', ');
    sql += ` ORDER BY ${orderByClause}`;
  }

  // Add LIMIT and OFFSET
  if (query.skip) {
    sql += ` OFFSET ${query.skip}`;
  }
  if (query.top) {
    sql += ` LIMIT ${query.top}`;
  }

  return { sql, params };
}

// Format OData response
function formatODataResponse(data: any[], context: string, baseUrl: string, count?: number) {
  const response: any = {
    '@odata.context': `${baseUrl}/api/odata/$metadata#${context}`,
    value: data
  };

  if (count !== undefined) {
    response['@odata.count'] = count;
  }

  return response;
}

// Generate metadata
function generateMetadata() {
  return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Default" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Product">
        <Property Name="id" Type="Edm.Int32" Nullable="false"/>
        <Property Name="name" Type="Edm.String" Nullable="false"/>
        <Property Name="price" Type="Edm.Double" Nullable="false"/>
        <Property Name="categoryId" Type="Edm.Int32" Nullable="true"/>
      </EntityType>
      <EntityType Name="Category">
        <Property Name="id" Type="Edm.Int32" Nullable="false"/>
        <Property Name="name" Type="Edm.String" Nullable="false"/>
        <Property Name="description" Type="Edm.String" Nullable="true"/>
      </EntityType>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
}

// Main API route handler
export const GET: APIRoute = async ({ request, params }) => {
  try {
    // Initialize database on first request
    if (!initialized) {
      initializeDatabase();
      initialized = true;
    }

    const url = new URL(request.url);
    const path = params.path || '';
    const baseUrl = url.origin;

    // Handle metadata request
    if (path === '$metadata') {
      return new Response(generateMetadata(), {
        status: 200,
        headers: {
          'Content-Type': 'application/xml'
        }
      });
    }

    // Handle count request
    if (path.endsWith('/$count')) {
      const resource = path.replace('/$count', '');
      if (!schemas[resource]) {
        return new Response(JSON.stringify({ error: 'Resource not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = db.prepare(`SELECT COUNT(*) as count FROM ${resource.toLowerCase()}`).get();
      return new Response(result.count.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Handle single resource request
    const singleResourceMatch = path.match(/^([^\/]+)\(([^\/]+)\)$/);
    if (singleResourceMatch) {
      const [, resource, id] = singleResourceMatch;
      if (!schemas[resource]) {
        return new Response(JSON.stringify({ error: 'Resource not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = db.prepare(`SELECT * FROM ${resource.toLowerCase()} WHERE id = ?`).get(id);
      if (!result) {
        return new Response(JSON.stringify({ error: 'Resource not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const response = {
        '@odata.context': `${baseUrl}/api/odata/$metadata#${resource}/$entity`,
        ...result
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Handle collection request
    const resource = path.split('/')[0];
    if (!schemas[resource]) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const query = parseODataQuery(url.searchParams);
    const { sql, params: queryParams } = buildSQLQuery(resource, query);
    
    const stmt = db.prepare(sql);
    const data = stmt.all(queryParams);

    const response = formatODataResponse(data, resource, baseUrl, query.count ? data.length : undefined);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OData API Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, params }) => {
  try {
    if (!initialized) {
      initializeDatabase();
      initialized = true;
    }

    const path = params.path || '';
    const resource = path.split('/')[0];

    if (!schemas[resource]) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json() as Record<string, any>;
    const schema = schemas[resource];

    // Validate required fields
    const requiredFields = schema.columns
      .filter(col => !col.nullable && !col.primaryKey)
      .map(col => col.name);

    for (const field of requiredFields) {
      if (!(field in body)) {
        return new Response(JSON.stringify({ 
          error: `Required field '${field}' is missing` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Insert the new resource
    const columns = Object.keys(body);
    const values = Object.values(body);
    const placeholders = values.map(() => '?').join(', ');

    const sql = `INSERT INTO ${resource.toLowerCase()} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const stmt = db.prepare(sql);
    const result = stmt.get(values);

    const url = new URL(request.url);
    const response = {
      '@odata.context': `${url.origin}/api/odata/$metadata#${resource}/$entity`,
      ...result
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OData POST Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    if (!initialized) {
      initializeDatabase();
      initialized = true;
    }

    const path = params.path || '';
    const singleResourceMatch = path.match(/^([^\/]+)\(([^\/]+)\)$/);
    
    if (!singleResourceMatch) {
      return new Response(JSON.stringify({ error: 'Invalid resource path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [, resource, id] = singleResourceMatch;

    if (!schemas[resource]) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json() as Record<string, any>;
    const schema = schemas[resource];

    // Validate required fields
    const requiredFields = schema.columns
      .filter(col => !col.nullable && !col.primaryKey)
      .map(col => col.name);

    for (const field of requiredFields) {
      if (!(field in body)) {
        return new Response(JSON.stringify({ 
          error: `Required field '${field}' is missing` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Update the resource
    const columns = Object.keys(body);
    const values = Object.values(body);
    const setClause = columns.map(col => `${col} = ?`).join(', ');

    const sql = `UPDATE ${resource.toLowerCase()} SET ${setClause} WHERE id = ? RETURNING *`;
    const stmt = db.prepare(sql);
    const result = stmt.get([...values, id]);

    if (!result) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const response = {
      '@odata.context': `${url.origin}/api/odata/$metadata#${resource}/$entity`,
      ...result
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('OData PUT Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    if (!initialized) {
      initializeDatabase();
      initialized = true;
    }

    const path = params.path || '';
    const singleResourceMatch = path.match(/^([^\/]+)\(([^\/]+)\)$/);
    
    if (!singleResourceMatch) {
      return new Response(JSON.stringify({ error: 'Invalid resource path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [, resource, id] = singleResourceMatch;

    if (!schemas[resource]) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sql = `DELETE FROM ${resource.toLowerCase()} WHERE id = ?`;
    const stmt = db.prepare(sql);
    const result = stmt.run(id);

    if (result.changes === 0) {
      return new Response(JSON.stringify({ error: 'Resource not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(null, { status: 204 });

  } catch (error) {
    console.error('OData DELETE Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: (error as Error).message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
