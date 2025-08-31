import type { APIRoute } from 'astro';
import { createUniversalODataHandler } from 'odata-sqlite-astro';
import { ConnectionAdapter } from 'odata-sqlite-core';

// Define database schemas
const productsSchema = {
  name: 'products',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'price', type: 'REAL', primaryKey: false, nullable: false },
    { name: 'category_id', type: 'INTEGER', primaryKey: false, nullable: false },
    { name: 'description', type: 'TEXT', primaryKey: false, nullable: true }
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

const customersSchema = {
  name: 'customers',
  columns: [
    { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
    { name: 'first_name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'last_name', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'email', type: 'TEXT', primaryKey: false, nullable: false },
    { name: 'registration_date', type: 'TEXT', primaryKey: false, nullable: false }
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

// Create the OData handler
const handler = createUniversalODataHandler({
  connection: await ConnectionAdapter.create({
    type: 'local',
    database: './data.db'
  }),
  schemas: {
    'Products': productsSchema,
    'Categories': categoriesSchema,
    'Customers': customersSchema
  },
  relationships,
  searchConfig: [
    {
      table: 'products',
      ftsTable: 'products_fts',
      columns: ['name', 'description']
    }
  ]
});

// Export all HTTP methods
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
