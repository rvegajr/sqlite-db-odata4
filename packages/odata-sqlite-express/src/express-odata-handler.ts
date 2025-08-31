import { Request, Response, Router } from 'express';
import { TableSchema } from 'odata-sqlite-core';
import { ForeignKeyRelationship, ODataExpandField } from 'odata-sqlite-contracts';
import { ExpandBuilder } from 'odata-sqlite-expand';
import { SearchProvider } from 'odata-sqlite-search';
import { AggregationBuilder } from 'odata-sqlite-aggregation';
import { ComputeBuilder } from 'odata-sqlite-compute';

// Type definitions
export interface ExpressODataConfig {
  connection: any;
  schemas: { [resourceName: string]: TableSchema };
  relationships?: ForeignKeyRelationship[];
  searchConfig?: { table: string; ftsTable: string; columns: string[]; }[];
  baseUrl?: string;
}

export interface ODataQuery {
  $top?: number;
  $skip?: number;
  $filter?: string;
  $orderby?: string;
  $select?: string;
  $count?: boolean;
  $expand?: string;
  $search?: string;
  $apply?: string;
  $compute?: string;
}

export interface ParsedODataQuery {
  top?: number;
  skip?: number;
  filter?: ODataFilterExpression;
  orderby?: string[];
  select?: string[];
  count?: boolean;
  expand?: string[];
  search?: string;
  apply?: {
    groupBy: string[];
    aggregates: { source: string; op: "sum" | "avg" | "count" | "min" | "max"; as: string; }[];
  };
  compute?: { expression: string; as: string; }[];
}

export interface ODataFilterExpression {
  field: string;
  operator: string;
  value: any;
}

export interface ODataResponseOptions {
  data: any;
  count?: number;
  context: string;
  baseUrl: string;
}

export interface ODataResult<T> {
  data: T[];
  count?: number;
}

export class ExpressODataHandler {
  private config: ExpressODataConfig;
  private expandBuilder: ExpandBuilder;
  private searchProvider: SearchProvider;
  private aggregationBuilder: AggregationBuilder;
  private computeBuilder: ComputeBuilder;

  constructor(config: ExpressODataConfig) {
    this.config = config;
    this.expandBuilder = new ExpandBuilder();
    this.searchProvider = new SearchProvider();
    this.aggregationBuilder = new AggregationBuilder();
    this.computeBuilder = new ComputeBuilder();
  }

  static registerOData(
    app: any,
    basePath: string,
    resourceName: string,
    connection: any,
    schema: TableSchema,
    options?: {
      relationships?: ForeignKeyRelationship[];
      searchConfig?: { table: string; ftsTable: string; columns: string[]; }[];
    }
  ) {
    const handler = new ExpressODataHandler({
      connection,
      schemas: { [resourceName]: schema },
      relationships: options?.relationships || [],
      searchConfig: options?.searchConfig || []
    });

    const router = handler.createODataRouter(resourceName, basePath);
    app.use(basePath, router);
  }

  createODataRouter(resourceName: string, basePath: string): Router {
    const router = Router();
    const schema = this.config.schemas[resourceName];

    if (!schema) {
      throw new Error(`Schema not found for resource: ${resourceName}`);
    }

    // GET /resource
    router.get(`/${resourceName}`, async (req: Request, res: Response) => {
      try {
        const query = req.query as any;
        const result = await this.executeODataQuery(resourceName, schema, query);
        const response = this.formatODataResponse({
          data: result.data,
          count: result.count || 0,
          context: `$${resourceName}`,
          baseUrl: this.config.baseUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}`
        });
        return res.json(response);
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // GET /resource/$count
    router.get(`/${resourceName}/\\$count`, async (req: Request, res: Response) => {
      try {
        const query = this.parseQuery(req.query as any);
        const result = await this.executeODataQuery(resourceName, schema, { ...query, $count: true });
        return res.json({ value: result.count || 0 });
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // GET /resource/$metadata
    router.get(`/${resourceName}/\\$metadata`, async (req: Request, res: Response) => {
      try {
        const metadata = this.generateMetadata(resourceName, schema);
        res.set('Content-Type', 'application/xml');
        return res.send(metadata);
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // GET /resource/:id
    router.get(`/${resourceName}/:id`, async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const query = this.parseQuery(req.query as any);
        const result = await this.executeODataQuery(resourceName, schema, { ...query, $filter: `id eq ${id}` });
        
        if (!result.data || result.data.length === 0) {
          return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
        }

        const response = this.formatSingleResourceResponse({
          data: result.data[0],
          context: `$${resourceName}`,
          baseUrl: this.config.baseUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}`
        });
        return res.json(response);
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // POST /resource
    router.post(`/${resourceName}`, async (req: Request, res: Response) => {
      try {
        const schema = this.config.schemas[resourceName];
        if (!schema) {
          return res.status(404).json({ error: { code: 'NotFound', message: 'Schema not found' } });
        }

        const columns = Object.keys(req.body).filter(key => schema.columns.some((col: any) => col.name === key));
        const values = columns.map(col => req.body[col]);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ${resourceName} (${columns.join(', ')}) VALUES (${placeholders})`;
        const result = this.config.connection.prepare(sql).run(...values);
        
        const insertedRecord = this.config.connection.prepare(`SELECT * FROM ${resourceName} WHERE id = ?`).get(result.lastInsertRowid);
        
        const response = this.formatSingleResourceResponse({
          data: insertedRecord,
          context: `$${resourceName}`,
          baseUrl: this.config.baseUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}`
        });
        return res.status(201).json(response);
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // PUT /resource/:id
    router.put(`/${resourceName}/:id`, async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const schema = this.config.schemas[resourceName];
        if (!schema) {
          return res.status(404).json({ error: { code: 'NotFound', message: 'Schema not found' } });
        }

        const columns = Object.keys(req.body).filter(key => schema.columns.some((col: any) => col.name === key));
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        const values = [...columns.map(col => req.body[col]), id];

        const sql = `UPDATE ${resourceName} SET ${setClause} WHERE id = ?`;
        const result = this.config.connection.prepare(sql).run(...values);
        
        if (result.changes === 0) {
          return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
        }

        const updatedRecord = this.config.connection.prepare(`SELECT * FROM ${resourceName} WHERE id = ?`).get(id);
        
        const response = this.formatSingleResourceResponse({
          data: updatedRecord,
          context: `$${resourceName}`,
          baseUrl: this.config.baseUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}`
        });
        return res.json(response);
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // DELETE /resource/:id
    router.delete(`/${resourceName}/:id`, async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const sql = `DELETE FROM ${resourceName} WHERE id = ?`;
        const result = this.config.connection.prepare(sql).run(id);
        
        if (result.changes === 0) {
          return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
        }

        return res.status(204).send();
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // Navigation properties
    router.get(`/${resourceName}/:id/:navigation`, async (req: Request, res: Response) => {
      try {
        const id = req.params.id;
        const navigation = req.params.navigation;
        const query = this.parseQuery(req.query as any);
        
        // Find the relationship
        const relationship = this.config.relationships?.find(r => 
          r.fromTable === resourceName && r.fromColumn === 'id' && r.toTable === navigation
        );

        if (!relationship) {
          return res.status(404).json({ error: { code: 'NotFound', message: 'Navigation property not found' } });
        }

        const sql = `SELECT * FROM ${navigation} WHERE ${relationship.toColumn} = ?`;
        const data = this.config.connection.prepare(sql).all(id);
        
        const response = this.formatODataResponse({
          data,
          context: navigation || '',
          baseUrl: this.config.baseUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}`
        });
        return res.json(response);
      } catch (error) {
        return res.status(500).json({ error: { code: 'InternalError', message: error instanceof Error ? error.message : 'Unknown error' } });
      }
    });

    // Error handling middleware
    router.use((error: any, req: Request, res: Response, next: any) => {
      if (error.message?.includes('Invalid')) {
        return res.status(400).json({ error: { code: 'BadRequest', message: error.message } });
      }
      if (error.message?.includes('Schema not found')) {
        return res.status(404).json({ error: { code: 'NotFound', message: error.message } });
      }
      return res.status(500).json({ error: { code: 'InternalError', message: 'Internal server error' } });
    });

    // Catch-all for unmatched routes
    router.all('*', (req: Request, res: Response) => {
      return res.status(404).json({ error: { code: 'NotFound', message: 'Resource not found' } });
    });

    return router;
  }

  private async executeODataQuery(tableName: string, schema: TableSchema, query: ODataQuery): Promise<{ data: any; count?: number }> {
    let sql = `SELECT * FROM ${tableName}`;
    const parameters: any[] = [];
    let hasWhere = false;

    // Apply $expand (JOINs) first
    if (query.$expand) {
      const expandFields = this.parseExpandString(query.$expand);
      const expandResult = this.expandBuilder.buildExpandClause(
        expandFields,
        tableName,
        Object.values(this.config.schemas),
        this.config.relationships || []
      );
      if (expandResult.joins.length > 0) {
        sql = `SELECT ${tableName}.*, ${expandResult.selectFields.join(', ')} FROM ${tableName}`;
        sql += expandResult.joins.map(join => ` ${join}`).join('');
        parameters.push(...expandResult.parameters);
      }
    }

    // Apply $filter (WHERE)
    if (query.$filter) {
      const parsedQuery = this.parseQuery(query);
      if (parsedQuery.filter) {
        const filterSql = this.buildFilterClause(parsedQuery.filter);
        sql += ` WHERE ${filterSql.sql}`;
        parameters.push(...filterSql.parameters);
        hasWhere = true;
      }
    }

    // Apply $search
    if (query.$search) {
      const searchConfig = this.config.searchConfig?.find(s => s.table === tableName);
      if (searchConfig) {
        const searchResult = this.searchProvider.buildSearchQuery(
          query.$search,
          searchConfig.ftsTable,
          searchConfig.columns
        );
        const searchSql = hasWhere ? ` AND ${searchResult.sql}` : ` WHERE ${searchResult.sql}`;
        sql += searchSql;
        parameters.push(...searchResult.parameters);
      }
    }

    // Apply $apply (aggregations)
    if (query.$apply) {
      const parsedQuery = this.parseQuery(query);
      if (parsedQuery.apply) {
        const applyResult = this.aggregationBuilder.buildAggregationQuery(
          tableName,
          schema,
          parsedQuery.apply.groupBy,
          parsedQuery.apply.aggregates
        );
        sql = applyResult.sql;
        parameters.push(...applyResult.parameters);
      }
    }

    // Apply $compute (computed properties)
    if (query.$compute) {
      const parsedQuery = this.parseQuery(query);
      if (parsedQuery.compute && parsedQuery.compute.length > 0) {
        const computeResult = this.computeBuilder.buildComputeQuery(
          tableName,
          schema,
          parsedQuery.compute
        );
        if (computeResult.sql) {
          sql = computeResult.sql;
          parameters.push(...computeResult.parameters);
        }
      }
    }

    // Apply $orderby
    if (query.$orderby) {
      const orderByClause = this.buildOrderByClause(query.$orderby);
      sql += ` ORDER BY ${orderByClause}`;
    }

    // Apply $top and $skip
    if (query.$skip) {
      sql += ` LIMIT -1 OFFSET ${query.$skip}`;
    }
    if (query.$top) {
      const limit = query.$top;
      const offset = query.$skip || 0;
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    // Execute query
    const data = this.config.connection.prepare(sql).all(...parameters);
    
    // Get count if requested
    let count: number | undefined;
    if (query.$count) {
      const countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const countResult = this.config.connection.prepare(countSql).get();
      count = countResult.count;
    }

    return { data, ...(count !== undefined && { count }) };
  }

  private parseExpandString(expandString: string): ODataExpandField[] {
    return expandString.split(',').map(part => {
      const trimmed = part.trim();
      return {
        path: trimmed,
        orderBy: []
      };
    });
  }

  private parseQuery(query: ODataQuery): ParsedODataQuery {
    const parsedQuery: ParsedODataQuery = {};

    if (query.$top) parsedQuery.top = query.$top;
    if (query.$skip) parsedQuery.skip = query.$skip;
    if (query.$orderby) parsedQuery.orderby = query.$orderby.split(',').map(s => s.trim());
    if (query.$select) parsedQuery.select = query.$select.split(',').map(s => s.trim());
    if (query.$count) parsedQuery.count = query.$count;
    if (query.$expand) parsedQuery.expand = query.$expand.split(',').map(s => s.trim());
    if (query.$search) parsedQuery.search = query.$search;

    if (query.$filter) {
      parsedQuery.filter = this.parseFilterExpression(query.$filter);
    }

    if (query.$apply) {
      parsedQuery.apply = this.parseApplyExpression(query.$apply);
    }

    if (query.$compute) {
      parsedQuery.compute = this.parseComputeExpression(query.$compute);
    }

    return parsedQuery;
  }

  private parseFilterExpression(filterString: string): ODataFilterExpression {
    // Simple filter parsing - can be enhanced for complex expressions
    const operators: { [key: string]: string } = {
      eq: '=',
      ne: '!=',
      lt: '<',
      le: '<=',
      gt: '>',
      ge: '>='
    };

    const parts = filterString.split(' ');
    const field = parts[0] || '';
    const operator = operators[parts[1] as keyof typeof operators] || parts[1] || '';
    const value = parts.slice(2).join(' ');

    let parsedValue: any = value;
    if (value === 'true') {
      parsedValue = true;
    } else if (value === 'false') {
      parsedValue = false;
    } else if (!isNaN(Number(value))) {
      parsedValue = Number(value);
    } else if (value && value.startsWith("'") && value.endsWith("'")) {
      parsedValue = value.slice(1, -1);
    }

    return {
      field,
      operator,
      value: parsedValue
    };
  }

  private parseApplyExpression(applyString: string): { groupBy: string[]; aggregates: { source: string; op: "sum" | "avg" | "count" | "min" | "max"; as: string; }[] } {
    const groupByMatch = applyString.match(/groupby\(([^)]+)\)/);
    const aggregateMatch = applyString.match(/aggregate\(([^)]+)\)/);

    if (!groupByMatch || !aggregateMatch) {
      throw new Error('Invalid $apply expression');
    }

    const groupBy = groupByMatch[1]?.split(',').map(f => f.trim()) || [];
    const aggregateString = aggregateMatch[1];
    const aggregateParts = aggregateString?.split(',').map(part => part.trim()) || [];

    const aggregates = aggregateParts.map(part => {
      const match = part.match(/(\w+) with (\w+) as (\w+)/);
      if (!match) {
        throw new Error(`Invalid aggregate expression: ${part}`);
      }
      return {
        source: match[1] || '',
        op: (match[2] || '') as "sum" | "avg" | "count" | "min" | "max",
        as: match[3] || ''
      };
    });

    return {
      groupBy,
      aggregates
    };
  }

  private parseComputeExpression(computeString: string): { expression: string; as: string; }[] {
    return computeString.split(',').map(part => {
      const match = part.trim().match(/(.+) as (\w+)/);
      if (!match) {
        throw new Error(`Invalid compute expression: ${part}`);
      }
      return {
        expression: (match[1] || '').trim(),
        as: (match[2] || '').trim()
      };
    });
  }

  private buildFilterClause(filter: ODataFilterExpression): { sql: string; parameters: any[] } {
    const sql = `${filter.field} ${filter.operator} ?`;
    return { sql, parameters: [filter.value] };
  }

  private buildOrderByClause(orderBy: string): string {
    return orderBy.split(',').map(part => {
      const trimmed = part.trim();
      if (trimmed.endsWith(' desc')) {
        return `${trimmed.slice(0, -5)} DESC`;
      }
      return trimmed;
    }).join(', ');
  }

  private formatODataResponse(options: ODataResponseOptions) {
    const response: any = {
      '@odata.context': `${options.baseUrl}/$metadata#${options.context}`,
      value: options.data
    };

    if (options.count !== undefined) {
      response['@odata.count'] = options.count;
    }

    return response;
  }

  private formatSingleResourceResponse(options: { data: any; context: string; baseUrl: string }) {
    return {
      '@odata.context': `${options.baseUrl}/$metadata#${options.context}`,
      ...options.data
    };
  }

  private generateMetadata(resourceName: string, schema: TableSchema): string {
    const properties = schema.columns.map((col: any) => 
      `    <Property Name="${col.name}" Type="${this.getODataType(col.type)}" Nullable="${col.nullable !== false}" />`
    ).join('\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Default" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="${resourceName}">
${properties}
      </EntityType>
      <EntityContainer Name="Container">
        <EntitySet Name="${resourceName}" EntityType="${resourceName}" />
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
  }

  private getODataType(sqliteType: string): string {
    const typeMap: { [key: string]: string } = {
      'INTEGER': 'Edm.Int32',
      'REAL': 'Edm.Double',
      'TEXT': 'Edm.String',
      'BLOB': 'Edm.Binary',
      'BOOLEAN': 'Edm.Boolean',
      'DATETIME': 'Edm.DateTimeOffset'
    };
    return typeMap[sqliteType.toUpperCase()] || 'Edm.String';
  }
}
