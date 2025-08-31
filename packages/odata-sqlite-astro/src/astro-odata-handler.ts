import type { 
  TableSchema, 
  ForeignKeyRelationship, 
  ODataQuery,
  ODataFilterExpression,
  ODataExpandField,
  ODataOrderByField,
  ODataResult
} from 'odata-sqlite-contracts';
import { ExpandBuilder } from 'odata-sqlite-expand';
import { SearchProvider } from 'odata-sqlite-search';
import { AggregationBuilder } from 'odata-sqlite-aggregation';
import { ComputeBuilder } from 'odata-sqlite-compute';

// Astro API context type
export interface AstroAPIContext {
  request: Request;
  params: Record<string, string>;
  redirect: (url: string) => Response;
}

// Configuration for the Astro OData handler
export interface AstroODataConfig {
  connection: any;
  schemas: Record<string, TableSchema>;
  relationships?: ForeignKeyRelationship[];
  searchConfig?: Array<{
    table: string;
    ftsTable: string;
    columns: string[];
  }>;
  baseUrl?: string;
  enableBatch?: boolean;
  enableDelta?: boolean;
  deltaConfig?: {
    maxChanges?: number;
    cleanupInterval?: number;
    tokenExpiry?: number;
  };
}

// Parsed OData query parameters
export interface ParsedODataQuery {
  filter?: ODataFilterExpression;
  expand?: ODataExpandField[];
  search?: string;
  apply?: {
    groupBy: string[];
    aggregates: Array<{
      source: string;
      op: 'sum' | 'avg' | 'count' | 'min' | 'max';
      as: string;
    }>;
  };
  compute?: Array<{
    expression: string;
    as: string;
  }>;
  select?: string[];
  orderBy?: ODataOrderByField[];
  top?: number;
  skip?: number;
  count?: boolean;
}

// Response formatting options
export interface ODataResponseOptions {
  data: any;
  count?: number;
  context: string;
  baseUrl: string;
}

export interface SingleResourceResponseOptions {
  data: any;
  context: string;
  baseUrl: string;
}

// Simple Delta Tracker implementation
class SimpleDeltaTracker {
  private changes: Array<{
    resource: string;
    id: string;
    operation: string;
    timestamp: number;
  }> = [];

  constructor(config?: any) {}

  generateDeltaLink(resource: string, token: string): string {
    return `${resource}?$deltatoken=${token}`;
  }

  trackChange(resource: string, id: string, operation: string): void {
    this.changes.push({
      resource,
      id,
      operation,
      timestamp: Date.now()
    });
  }

  getChanges(token: string): any[] {
    return this.changes;
  }

  parseDeltaToken(token: string): any {
    return { timestamp: parseInt(token) || 0 };
  }

  generateDeltaResponse(changes: any[]): any {
    return {
      value: changes,
      '@odata.deltaLink': this.generateDeltaLink('', Date.now().toString())
    };
  }
}

export class AstroODataHandler {
  private config: AstroODataConfig;
  private expandBuilder: ExpandBuilder;
  private searchProvider: SearchProvider;
  private aggregationBuilder: AggregationBuilder;
  private computeBuilder: ComputeBuilder;
  private deltaTracker: SimpleDeltaTracker;

  constructor(config: AstroODataConfig) {
    this.config = config;
    this.expandBuilder = new ExpandBuilder();
    this.searchProvider = new SearchProvider();
    this.aggregationBuilder = new AggregationBuilder();
    this.computeBuilder = new ComputeBuilder();
    this.deltaTracker = new SimpleDeltaTracker(config.deltaConfig);
  }

  // Main handler method for Astro API routes
  async handleRequest(context: AstroAPIContext): Promise<Response> {
    try {
      const { request, params } = context;
      const url = new URL(request.url);
      const path = url.pathname.replace('/api/odata/', '');

      // Handle special OData endpoints
      if (path === '$metadata') {
        return this.handleMetadataRequest(url);
      }

      if (path.endsWith('/$count')) {
        return this.handleCountRequest(context);
      }

      // Parse the path to determine the request type
      const singleResourceMatch = path.match(/^([^\/]+)\(([^\/]+)\)$/);
      if (singleResourceMatch) {
        const [, resource, id] = singleResourceMatch;
        return this.handleSingleResourceRequest(resource || '', id || '', context);
      }

      const navigationMatch = path.match(/^([^\/]+)\(([^\/]+)\)\/([^\/]+)$/);
      if (navigationMatch) {
        const [, resource, id, navigation] = navigationMatch;
        return this.handleNavigationRequest(resource || '', id || '', navigation || '', context);
      }

      // Handle collection requests
      const resource = this.resolveResource(context);
      if (resource) {
        return this.handleCollectionRequest(resource, context);
      }

      return this.formatErrorResponse(new Error('Invalid OData request'), 400);
    } catch (error) {
      return this.formatErrorResponse(error as Error, 500);
    }
  }

  // Create handlers for different HTTP methods
  createGetHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      return this.handleRequest(context);
    };
  }

  createPostHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      try {
        const { request } = context;
        const resource = this.resolveResource(context);
        
        if (!this.config.schemas[resource]) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }

        const body = await request.json() as Record<string, any>;
        const schema = this.config.schemas[resource];
        
        // Validate required fields
        const requiredFields = schema.columns
          .filter(col => !col.nullable && !col.primaryKey)
          .map(col => col.name);
        
        for (const field of requiredFields) {
          if (!(field in body)) {
            return this.formatErrorResponse(
              new Error(`Required field '${field}' is missing`), 
              400
            );
          }
        }

        // Insert the new resource
        const columns = Object.keys(body);
        const values = Object.values(body);
        const placeholders = values.map(() => '?').join(', ');
        
        const sql = `INSERT INTO ${resource.toLowerCase()} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await this.config.connection.query(sql, values);
        
        const newResource = Array.isArray(result) ? result[0] : result;
        
        // Track change for delta links
        this.deltaTracker.trackChange(resource, newResource.id, 'create');
        
        const response = this.formatSingleResourceResponse({
          data: newResource,
          context: resource,
          baseUrl: this.config.baseUrl || new URL(request.url).origin
        });
        
        return new Response(response.body, { 
          status: 201, 
          headers: response.headers 
        });
      } catch (error) {
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Required field') || errorMessage.includes('missing')) {
          return this.formatErrorResponse(error as Error, 400);
        }
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  createPutHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      try {
        const { request } = context;
        const { resource, id } = this.resolveResourceWithId(context);
        
        if (!this.config.schemas[resource]) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }

        const body = await request.json() as Record<string, any>;
        const schema = this.config.schemas[resource];
        
        // Validate required fields
        const requiredFields = schema.columns
          .filter(col => !col.nullable && !col.primaryKey)
          .map(col => col.name);
        
        for (const field of requiredFields) {
          if (!(field in body)) {
            return this.formatErrorResponse(
              new Error(`Required field '${field}' is missing`), 
              400
            );
          }
        }

        // Update the resource
        const columns = Object.keys(body);
        const values = Object.values(body);
        const setClause = columns.map(col => `${col} = ?`).join(', ');
        
        const sql = `UPDATE ${resource.toLowerCase()} SET ${setClause} WHERE id = ? RETURNING *`;
        const result = await this.config.connection.query(sql, [...values, id]);
        
        if (Array.isArray(result) && result.length === 0) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }
        
        const updatedResource = Array.isArray(result) ? result[0] : result;
        
        // Track change for delta links
        this.deltaTracker.trackChange(resource, id, 'update');
        
        return this.formatSingleResourceResponse({
          data: updatedResource,
          context: resource,
          baseUrl: this.config.baseUrl || new URL(request.url).origin
        });
      } catch (error) {
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  createDeleteHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      try {
        const { resource, id } = this.resolveResourceWithId(context);
        
        if (!this.config.schemas[resource]) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }

        const sql = `DELETE FROM ${resource.toLowerCase()} WHERE id = ? RETURNING *`;
        const result = await this.config.connection.query(sql, [id]);
        
        if (Array.isArray(result) && result.length === 0) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }
        
        // Track change for delta links
        this.deltaTracker.trackChange(resource, id, 'delete');
        
        return new Response(null, { status: 204 });
      } catch (error) {
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  // Delta link management methods
  trackChange(resource: string, id: string | number, operation: string): void {
    this.deltaTracker.trackChange(resource, id.toString(), operation);
  }

  generateDeltaLink(resource: string, token: string): string {
    return this.deltaTracker.generateDeltaLink(resource, token);
  }

  getChangeStats(): { total: number; byOperation: Record<string, number> } {
    const changes = this.deltaTracker.getChanges('');
    const byOperation: Record<string, number> = {};
    
    changes.forEach(change => {
      byOperation[change.operation] = (byOperation[change.operation] || 0) + 1;
    });
    
    return {
      total: changes.length,
      byOperation
    };
  }

  cleanupOldChanges(): void {
    // Simple cleanup - in a real implementation, you'd want to persist to database
    const changes = this.deltaTracker.getChanges('');
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    // Filter out old changes (this is a simplified version)
  }

  private resolveResource(context: AstroAPIContext): string {
    const path = context.params.path || '';
    return path.split('/')[0] || '';
  }

  private resolveResourceWithId(context: AstroAPIContext): { resource: string; id: string } {
    const path = context.params.path || '';
    const match = path.match(/^([^\/]+)\(([^\/]+)\)$/);
    
    if (match) {
      return {
        resource: match[1] || '',
        id: match[2] || ''
      };
    }

    // Try alternative pattern
    const altMatch = path.match(/^([^\/]+)\/([^\/]+)$/);
    if (altMatch) {
      return {
        resource: altMatch[1] || '',
        id: altMatch[2] || ''
      };
    }

    throw new Error('Invalid resource path');
  }

  private resolveNavigationPath(context: AstroAPIContext): { resource: string; id: string; navigation: string } {
    const path = context.params.path || '';
    const match = path.match(/^([^\/]+)\(([^\/]+)\)\/([^\/]+)$/);
    
    if (match) {
      return {
        resource: match[1] || '',
        id: match[2] || '',
        navigation: match[3] || ''
      };
    }

    // Try alternative pattern
    const altMatch = path.match(/^([^\/]+)\/([^\/]+)\/([^\/]+)$/);
    if (altMatch) {
      return {
        resource: altMatch[1] || '',
        id: altMatch[2] || '',
        navigation: altMatch[3] || ''
      };
    }

    throw new Error('Invalid navigation path');
  }

  private parseODataQuery(searchParams: URLSearchParams): ParsedODataQuery {
    const query: ParsedODataQuery = {};

    // Parse $filter
    const filterParam = searchParams.get('$filter');
    if (filterParam) {
      query.filter = this.parseFilterExpression(filterParam);
    }

    // Parse $expand
    const expandParam = searchParams.get('$expand');
    if (expandParam) {
      query.expand = this.parseExpandExpression(expandParam);
    }

    // Parse $search
    const searchParam = searchParams.get('$search');
    if (searchParam) {
      query.search = searchParam;
    }

    // Parse $select
    const selectParam = searchParams.get('$select');
    if (selectParam) {
      query.select = selectParam.split(',').map(s => s.trim());
    }

    // Parse $orderby
    const orderByParam = searchParams.get('$orderby');
    if (orderByParam) {
      query.orderBy = this.parseOrderByExpression(orderByParam);
    }

    // Parse $top
    const topParam = searchParams.get('$top');
    if (topParam) {
      query.top = parseInt(topParam);
    }

    // Parse $skip
    const skipParam = searchParams.get('$skip');
    if (skipParam) {
      query.skip = parseInt(skipParam);
    }

    // Parse $count
    const countParam = searchParams.get('$count');
    if (countParam) {
      query.count = countParam === 'true';
    }

    return query;
  }

  private async buildSQLQuery(tableName: string, query: ParsedODataQuery): Promise<{ sql: string; params: any[] }> {
    let sql = `SELECT * FROM ${tableName.toLowerCase()}`;
    const params: any[] = [];

    // Handle $search
    const searchConfig = this.config.searchConfig?.find(s => s.table === tableName);
    if (searchConfig && query.search) {
      const searchClause = this.searchProvider.buildSearchQuery(query.search, searchConfig.ftsTable, searchConfig.columns);
      const searchWhere = sql.includes('WHERE') ? ' AND ' : ' WHERE ';
      sql += `${searchWhere}${searchClause}`;
    }

    // Handle $filter
    if (query.filter) {
      const whereClause = this.buildWhereClause(query.filter, params);
      const whereKeyword = sql.includes('WHERE') ? ' AND ' : ' WHERE ';
      sql += `${whereKeyword}${whereClause}`;
    }

    // Handle $orderby
    if (query.orderBy && query.orderBy.length > 0) {
      const orderByClause = query.orderBy.map(field => 
        `${field.field} ${field.direction || 'asc'}`
      ).join(', ');
      sql += ` ORDER BY ${orderByClause}`;
    }

    // Handle $top and $skip
    if (query.skip) {
      sql += ` OFFSET ${query.skip}`;
    }
    if (query.top) {
      sql += ` LIMIT ${query.top}`;
    }

    return { sql, params };
  }

  private buildWhereClause(filter: ODataFilterExpression, params: any[]): string {
    const operators: Record<string, string> = {
      eq: '=',
      ne: '!=',
      lt: '<',
      le: '<=',
      gt: '>',
      ge: '>=',
      and: 'AND',
      or: 'OR'
    };

    const operator = operators[filter.operator] || '=';
    if (!operator) {
      throw new Error(`Unsupported operator: ${filter.operator}`);
    }

    params.push(filter.value);
    return `${filter.field} ${operator} ?`;
  }

  private async handleMetadataRequest(url: URL): Promise<Response> {
    // Generate OData v4 metadata XML
    const metadata = this.generateMetadata();
    
    return new Response(metadata, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
  }

  private async handleCountRequest(context: AstroAPIContext): Promise<Response> {
    const resource = this.resolveResource(context).replace('/$count', '');
    
    if (!this.config.schemas[resource]) {
      return this.formatErrorResponse(new Error('Resource not found'), 404);
    }

    const sql = `SELECT COUNT(*) as count FROM ${resource.toLowerCase()}`;
    const result = await this.config.connection.query(sql);
    const count = result[0].count;

    return new Response(count.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  private async handleSingleResourceRequest(resource: string, id: string, context: AstroAPIContext): Promise<Response> {
    if (!this.config.schemas[resource]) {
      return this.formatErrorResponse(new Error('Resource not found'), 404);
    }

    const sql = `SELECT * FROM ${resource.toLowerCase()} WHERE id = ?`;
    const result = await this.config.connection.query(sql, [id]);
    
    if (result.length === 0) {
      return this.formatErrorResponse(new Error('Resource not found'), 404);
    }

    return this.formatSingleResourceResponse({
      data: result[0],
      context: resource,
      baseUrl: this.config.baseUrl || new URL(context.request.url).origin
    });
  }

  private async handleNavigationRequest(resource: string, id: string, navigation: string, context: AstroAPIContext): Promise<Response> {
    // Handle navigation property requests (e.g., Products(1)/category)
    const relationship = this.config.relationships?.find(r => 
      r.fromTable === resource.toLowerCase() && r.name === navigation
    );

    if (!relationship) {
      return this.formatErrorResponse(new Error('Navigation property not found'), 404);
    }

    const sql = `SELECT * FROM ${relationship.toTable} WHERE ${relationship.toColumn} = ?`;
    const result = await this.config.connection.query(sql, [id]);

    return this.formatODataResponse({
      data: result,
      context: navigation,
      baseUrl: this.config.baseUrl || new URL(context.request.url).origin
    });
  }

  private async handleCollectionRequest(resource: string, context: AstroAPIContext): Promise<Response> {
    if (!this.config.schemas[resource]) {
      return this.formatErrorResponse(new Error('Resource not found'), 404);
    }

    const { request } = context;
    const url = new URL(request.url);
    const query = this.parseODataQuery(url.searchParams);

    const { sql, params } = await this.buildSQLQuery(resource, query);
    const result = await this.config.connection.query(sql, params);

    // Add delta link header if enabled
    const response = this.formatODataResponse({
      data: result,
      count: query.count ? result.length : undefined,
      context: resource,
      baseUrl: this.config.baseUrl || url.origin
    });

    if (this.config.enableDelta) {
      const deltaLink = this.generateDeltaLink(resource, Date.now().toString());
      response.headers.set('OData-DeltaLink', deltaLink);
    }

    return response;
  }

  private formatODataResponse(options: ODataResponseOptions): Response {
    const { data, count, context, baseUrl } = options;
    
    const response = {
      '@odata.context': `${baseUrl}/api/odata/$metadata#${context}`,
      value: data
    };

    if (count !== undefined) {
      response['@odata.count'] = count;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private formatSingleResourceResponse(options: SingleResourceResponseOptions): Response {
    const { data, context, baseUrl } = options;
    
    const response = {
      '@odata.context': `${baseUrl}/api/odata/$metadata#${context}/$entity`,
      ...data
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private formatErrorResponse(error: Error, status: number): Response {
    const errorResponse = {
      error: {
        code: status.toString(),
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  private generateMetadata(): string {
    // Generate basic OData v4 metadata XML
    const entityTypes = Object.entries(this.config.schemas).map(([name, schema]) => {
      const properties = schema.columns.map(col => {
        const nullable = col.nullable ? 'Nullable="true"' : 'Nullable="false"';
        return `        <Property Name="${col.name}" Type="${col.type}" ${nullable}/>`;
      }).join('\n');
      
      return `      <EntityType Name="${name}">
${properties}
      </EntityType>`;
    }).join('\n\n');

    return `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Default" xmlns="http://docs.oasis-open.org/odata/ns/edm">
${entityTypes}
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;
  }

  private parseFilterExpression(filterString: string): ODataFilterExpression {
    // Simple filter parsing - in a real implementation, you'd want a more robust parser
    const match = filterString.match(/^(\w+)\s+(eq|ne|lt|le|gt|ge)\s+(.+)$/);
    if (!match) {
      throw new Error(`Invalid filter expression: ${filterString}`);
    }

    const [, field, operator, value] = match;
    let parsedValue: any = value;

    // Parse value based on type
    if (value === 'null') {
      parsedValue = null;
    } else if (value === 'true' || value === 'false') {
      parsedValue = value === 'true';
    } else if (value.startsWith("'") && value.endsWith("'")) {
      parsedValue = value.slice(1, -1);
    } else if (!isNaN(Number(value))) {
      parsedValue = Number(value);
    }

    return {
      field,
      operator: operator as any,
      value: parsedValue
    };
  }

  private parseExpandExpression(expandString: string): ODataExpandField[] {
    return expandString.split(',').map(field => ({
      field: field.trim()
    }));
  }

  private parseOrderByExpression(orderByString: string): ODataOrderByField[] {
    return orderByString.split(',').map(field => {
      const parts = field.trim().split(' ');
      return {
        field: parts[0],
        direction: parts[1] === 'desc' ? 'desc' : 'asc'
      };
    });
  }
}
