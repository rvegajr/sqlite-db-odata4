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
import { BatchBuilder } from 'odata-sqlite-batch';
import { DeltaTracker } from 'odata-sqlite-delta';

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

export class AstroODataHandler {
  private config: AstroODataConfig;
  private expandBuilder: ExpandBuilder;
  private searchProvider: SearchProvider;
  private aggregationBuilder: AggregationBuilder;
  private computeBuilder: ComputeBuilder;
  private batchBuilder: BatchBuilder;
  private deltaTracker: DeltaTracker;

  constructor(config: AstroODataConfig) {
    this.config = config;
    this.expandBuilder = new ExpandBuilder();
    this.searchProvider = new SearchProvider();
    this.aggregationBuilder = new AggregationBuilder();
    this.computeBuilder = new ComputeBuilder();
    this.batchBuilder = new BatchBuilder();
    this.deltaTracker = new DeltaTracker(config.deltaConfig);
  }

  // Create API route handlers for different HTTP methods
  createGetHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      try {
        const { request, params } = context;
        const url = new URL(request.url);
        const path = params.path || '';

        // Handle special OData endpoints
        if (path === '$metadata') {
          return this.handleMetadataRequest(url);
        }

        if (path.endsWith('/$count')) {
          return this.handleCountRequest(context);
        }

        // Handle single resource requests
        const singleResourceMatch = path.match(/^([^(]+)\(([^)]+)\)$/);
        if (singleResourceMatch) {
          const [, resource, id] = singleResourceMatch;
          return this.handleSingleResourceRequest(resource, id, context);
        }

        // Handle navigation property requests
        const navigationMatch = path.match(/^([^(]+)\(([^)]+)\)\/(.+)$/);
        if (navigationMatch) {
          const [, resource, id, navigation] = navigationMatch;
          return this.handleNavigationRequest(resource, id, navigation, context);
        }

        // Handle collection requests
        return this.handleCollectionRequest(path, context);
      } catch (error) {
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  createPostHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      try {
        const { request, params } = context;
        const resource = this.resolveResource(context);
        
        if (!this.config.schemas[resource]) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }

        const body = await request.json();
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
        this.trackChange(resource, newResource.id, 'create');
        
        const response = this.formatSingleResourceResponse({
          data: newResource,
          context: resource,
          baseUrl: this.config.baseUrl || new URL(request.url).origin
        });
        
        response.status = 201;
        return response;
      } catch (error) {
        // Check if it's a validation error or database error
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
        const { request, params } = context;
        const { resource, id } = this.resolveResourceWithId(context);
        
        if (!this.config.schemas[resource]) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }

        const body = await request.json();
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
        this.trackChange(resource, parseInt(id), 'update');
        
        return this.formatSingleResourceResponse({
          data: updatedResource,
          context: resource,
          baseUrl: this.config.baseUrl || new URL(request.url).origin
        });
      } catch (error) {
        // Check if it's a validation error or database error
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('Required field') || errorMessage.includes('missing')) {
          return this.formatErrorResponse(error as Error, 400);
        }
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

        // Delete the resource
        const sql = `DELETE FROM ${resource.toLowerCase()} WHERE id = ?`;
        const result = await this.config.connection.query(sql, [id]);
        
        if (result.changes === 0) {
          return this.formatErrorResponse(new Error('Resource not found'), 404);
        }
        
        return new Response(null, { status: 204 });
      } catch (error) {
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  createUniversalHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      const { request } = context;
      const method = request.method.toUpperCase();

      switch (method) {
        case 'GET':
          return this.createGetHandler()(context);
        case 'POST':
          return this.createPostHandler()(context);
        case 'PUT':
          return this.createPutHandler()(context);
        case 'DELETE':
          return this.createDeleteHandler()(context);
        default:
          return new Response('Method Not Allowed', { status: 405 });
      }
    };
  }

  // Query parameter parsing
  parseODataQuery(searchParams: URLSearchParams): ParsedODataQuery {
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

    // Parse $apply
    const applyParam = searchParams.get('$apply');
    if (applyParam) {
      query.apply = this.parseApplyExpression(applyParam);
    }

    // Parse $compute
    const computeParam = searchParams.get('$compute');
    if (computeParam) {
      query.compute = this.parseComputeExpression(computeParam);
    }

    // Parse $select
    const selectParam = searchParams.get('$select');
    if (selectParam) {
      query.select = selectParam.split(',');
    }

    // Parse $orderby
    const orderByParam = searchParams.get('$orderby');
    if (orderByParam) {
      query.orderBy = this.parseOrderByExpression(orderByParam);
    }

    // Parse $top
    const topParam = searchParams.get('$top');
    if (topParam) {
      query.top = parseInt(topParam, 10);
    }

    // Parse $skip
    const skipParam = searchParams.get('$skip');
    if (skipParam) {
      query.skip = parseInt(skipParam, 10);
    }

    // Parse $count
    const countParam = searchParams.get('$count');
    if (countParam === 'true') {
      query.count = true;
    }

    return query;
  }

  // Resource resolution
  resolveResource(context: AstroAPIContext): string {
    const path = context.params.path || '';
    return path.split('/')[0];
  }

  resolveResourceWithId(context: AstroAPIContext): { resource: string; id: string } {
    const path = context.params.path || '';
    const match = path.match(/^([^(]+)\(([^)]+)\)$/);
    
    if (!match) {
      throw new Error('Invalid resource ID format');
    }
    
    return {
      resource: match[1],
      id: match[2]
    };
  }

  resolveNavigationPath(context: AstroAPIContext): { resource: string; id: string; navigation: string } {
    const path = context.params.path || '';
    const match = path.match(/^([^(]+)\(([^)]+)\)\/(.+)$/);
    
    if (!match) {
      // Try alternative format without parentheses
      const altMatch = path.match(/^([^\/]+)\/([^\/]+)\/(.+)$/);
      if (!altMatch) {
        throw new Error('Invalid navigation path format');
      }
      return {
        resource: altMatch[1],
        id: altMatch[2],
        navigation: altMatch[3]
      };
    }
    
    return {
      resource: match[1],
      id: match[2],
      navigation: match[3]
    };
  }

  // Response formatting
  formatODataResponse(options: ODataResponseOptions): Response {
    const { data, count, context, baseUrl } = options;
    
    const responseData: any = {
      '@odata.context': `${baseUrl}/$metadata#${context}`,
      value: data
    };

    if (count !== undefined) {
      responseData['@odata.count'] = count;
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  formatSingleResourceResponse(options: SingleResourceResponseOptions): Response {
    const { data, context, baseUrl } = options;
    
    const responseData = {
      '@odata.context': `${baseUrl}/$metadata#${context}/$entity`,
      ...data
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  formatErrorResponse(error: Error, statusCode: number): Response {
    const responseData = {
      error: {
        code: statusCode.toString(),
        message: error.message
      }
    };

    return new Response(JSON.stringify(responseData), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Private helper methods
  private async executeODataQuery(tableName: string, schema: TableSchema, query: ODataQuery): Promise<ODataResult<any>> {
    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    // Add WHERE clause for filtering
    if (query.filter) {
      const whereClause = this.buildWhereClause(query.filter, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    // Add search
    if (query.search) {
      const searchConfig = this.config.searchConfig?.find(s => s.table === tableName);
      if (searchConfig) {
        const searchClause = this.searchProvider.buildSearchQuery(searchConfig.ftsTable, query.search);
        const searchWhere = sql.includes('WHERE') ? ' AND ' : ' WHERE ';
        sql += `${searchWhere}${searchClause}`;
      } else {
        // Fallback to simple LIKE search if no FTS config
        const searchWhere = sql.includes('WHERE') ? ' AND ' : ' WHERE ';
        sql += `${searchWhere}name LIKE ?`;
        params.push(`%${query.search}%`);
      }
    }

    // Add expand (JOIN) if requested
    if (query.expand && query.expand.length > 0) {
      const expandResult = this.expandBuilder.buildExpandClause(
        query.expand,
        tableName,
        [schema],
        this.config.relationships || []
      );
      
      // Build the expanded SQL query
      const selectFields = expandResult.selectFields.length > 0 
        ? expandResult.selectFields.join(', ') 
        : `${tableName}.*`;
      
      sql = `SELECT ${selectFields} FROM ${tableName}`;
      
      // Add JOIN clauses
      if (expandResult.joins.length > 0) {
        sql += ' ' + expandResult.joins.join(' ');
      }
      
      // Add parameters
      params.push(...expandResult.parameters);
    }

    // Add ORDER BY
    if (query.orderBy && query.orderBy.length > 0) {
      const orderByClause = query.orderBy.map(ob => `${ob.field} ${ob.direction.toUpperCase()}`).join(', ');
      sql += ` ORDER BY ${orderByClause}`;
    }

    // Add LIMIT and OFFSET
    if (query.top) {
      sql += ` LIMIT ${query.top}`;
    }
    if (query.skip) {
      sql += ` OFFSET ${query.skip}`;
    }

    // Execute query
    const data = await this.config.connection.query(sql, params);
    
    // Get count if requested
    let count: number | undefined;
    if (query.count) {
      const countSql = `SELECT COUNT(*) as count FROM ${tableName}`;
      const countResult = await this.config.connection.query(countSql);
      count = countResult[0].count;
    }

    return { data, count };
  }

  private buildWhereClause(filter: ODataFilterExpression, params: any[]): string {
    const operators = {
      eq: '=',
      ne: '!=',
      lt: '<',
      le: '<=',
      gt: '>',
      ge: '>='
    };

    const operator = operators[filter.operator];
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
    const schema = this.config.schemas[resource];

    try {
      // Execute the OData query directly
      const result = await this.executeODataQuery(resource.toLowerCase(), schema, query as ODataQuery);

      const response = this.formatODataResponse({
        data: result.data,
        count: result.count,
        context: resource,
        baseUrl: this.config.baseUrl || url.origin
      });
      
      // Add delta link if enabled
      if (this.config.enableDelta) {
        const deltaLink = this.generateDeltaLink(resource, Date.now(), url.search);
        response.headers.set('OData-DeltaLink', deltaLink);
      }
      
      return response;
    } catch (error) {
      // Check if it's a database error or query parsing error
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('Database') || errorMessage.includes('connection')) {
        return this.formatErrorResponse(error as Error, 500);
      }
      if (errorMessage.includes('Invalid filter') || errorMessage.includes('Invalid query')) {
        return this.formatErrorResponse(error as Error, 400);
      }
      return this.formatErrorResponse(error as Error, 400);
    }
  }

  private parseFilterExpression(filterString: string): ODataFilterExpression {
    // Simple filter parsing - in a real implementation, you'd want a proper parser
    const match = filterString.match(/^(\w+)\s+(eq|ne|lt|le|gt|ge)\s+(.+)$/);
    
    if (!match) {
      throw new Error(`Invalid filter expression: ${filterString}`);
    }
    
    const [, field, operator, value] = match;
    
    // Try to parse value as number if possible
    let parsedValue: any = value;
    if (!isNaN(Number(value))) {
      parsedValue = Number(value);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      parsedValue = value.slice(1, -1);
    }
    
    return {
      field,
      operator: operator as any,
      value: parsedValue
    };
  }

  private parseExpandExpression(expandString: string): ODataExpandField[] {
    return expandString.split(',').map(path => ({
      path: path.trim()
    }));
  }

  private parseApplyExpression(applyString: string): ParsedODataQuery['apply'] {
    // Simple apply parsing - in a real implementation, you'd want a proper parser
    const groupByMatch = applyString.match(/groupby\(\(([^)]+)\)/);
    const aggregateMatch = applyString.match(/aggregate\(([^)]+)\)/);
    
    if (!groupByMatch || !aggregateMatch) {
      throw new Error(`Invalid apply expression: ${applyString}`);
    }
    
    const groupBy = groupByMatch[1].split(',').map(f => f.trim());
    const aggregateString = aggregateMatch[1];
    const aggregateMatch2 = aggregateString.match(/^(\w+)\s+with\s+(\w+)\s+as\s+(\w+)$/);
    
    if (!aggregateMatch2) {
      throw new Error(`Invalid aggregate expression: ${aggregateString}`);
    }
    
    const [, source, op, as] = aggregateMatch2;
    
    return {
      groupBy,
      aggregates: [{
        source,
        op: op as any,
        as
      }]
    };
  }

  private parseComputeExpression(computeString: string): ParsedODataQuery['compute'] {
    const match = computeString.match(/^(.+)\s+as\s+(\w+)$/);
    
    if (!match) {
      throw new Error(`Invalid compute expression: ${computeString}`);
    }
    
    const [, expression, as] = match;
    
    return [{
      expression: expression.trim(),
      as: as.trim()
    }];
  }

  private parseOrderByExpression(orderByString: string): ODataOrderByField[] {
    return orderByString.split(',').map(part => {
      const trimmed = part.trim();
      const spaceIndex = trimmed.lastIndexOf(' ');
      
      if (spaceIndex === -1) {
        return { field: trimmed, direction: 'asc' };
      }
      
      const field = trimmed.substring(0, spaceIndex);
      const direction = trimmed.substring(spaceIndex + 1);
      
      return {
        field,
        direction: direction.toLowerCase() as 'asc' | 'desc'
      };
    });
  }

  private generateMetadata(): string {
    // Generate basic OData v4 metadata XML
    const entityTypes = Object.entries(this.config.schemas).map(([name, schema]) => {
      const properties = schema.columns.map(col => {
        const nullable = col.nullable ? 'Nullable="true"' : 'Nullable="false"';
        return `    <Property Name="${col.name}" Type="Edm.${this.mapSqlTypeToEdmType(col.type)}" ${nullable}/>`;
      }).join('\n');
      
      return `  <EntityType Name="${name}">
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

  private mapSqlTypeToEdmType(sqlType: string): string {
    switch (sqlType.toUpperCase()) {
      case 'INTEGER':
        return 'Int32';
      case 'REAL':
        return 'Double';
      case 'TEXT':
        return 'String';
      case 'BLOB':
        return 'Binary';
      default:
        return 'String';
    }
  }

  // 🚀 Batch Operations Support
  createBatchHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      if (!this.config.enableBatch) {
        return this.formatErrorResponse(new Error('Batch operations not enabled'), 405);
      }

      try {
        const { request } = context;
        const contentType = request.headers.get('content-type') || '';
        
        if (!contentType.includes('multipart/mixed')) {
          return this.formatErrorResponse(new Error('Invalid content type for batch request'), 400);
        }

        const body = await request.text();
        const batchRequest = this.batchBuilder.parseBatchRequest(body);
        
        const batchResponse = await this.batchBuilder.executeBatch(
          batchRequest.operations,
          this.config.connection,
          {
            schemas: this.config.schemas
          }
        );

        const responseContent = this.batchBuilder.generateBatchResponse(
          batchRequest.operations,
          batchResponse.results
        );

        return new Response(responseContent, {
          status: 200,
          headers: {
            'Content-Type': 'multipart/mixed; boundary=batch_boundary',
            'OData-Version': '4.0'
          }
        });
      } catch (error) {
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  // 🚀 Delta Links Support
  createDeltaHandler() {
    return async (context: AstroAPIContext): Promise<Response> => {
      if (!this.config.enableDelta) {
        return this.formatErrorResponse(new Error('Delta links not enabled'), 405);
      }

      try {
        const { request, params } = context;
        const url = new URL(request.url);
        const path = params.path || '';
        const deltaToken = url.searchParams.get('$deltatoken');

        if (!deltaToken) {
          return this.formatErrorResponse(new Error('Delta token required'), 400);
        }

        const parseResult = this.deltaTracker.parseDeltaToken(deltaToken);
        if (!parseResult.isValid) {
          return this.formatErrorResponse(new Error(parseResult.error || 'Invalid delta token'), 400);
        }

        const resourceName = this.resolveResource(context);
        const sinceTimestamp = parseResult.timestamp || 0;
        const currentTimestamp = Date.now();

        const response = this.deltaTracker.generateDeltaResponse(
          resourceName,
          this.config.baseUrl || new URL(request.url).origin,
          sinceTimestamp,
          currentTimestamp
        );

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'OData-Version': '4.0'
          }
        });
      } catch (error) {
        return this.formatErrorResponse(error as Error, 500);
      }
    };
  }

  // 🚀 Track changes for delta links
  trackChange(resourceName: string, entityId: number, operation: 'create' | 'update' | 'delete') {
    if (this.config.enableDelta) {
      this.deltaTracker.trackChange(resourceName, entityId, operation, Date.now());
    }
  }

  // 🚀 Generate delta link for a resource
  generateDeltaLink(resourceName: string, timestamp: number, existingQuery?: string): string {
    if (!this.config.enableDelta) {
      throw new Error('Delta links not enabled');
    }

    return this.deltaTracker.generateDeltaLink(
      this.config.baseUrl || '',
      resourceName,
      timestamp,
      existingQuery
    );
  }

  // 🚀 Get change statistics
  getChangeStats() {
    if (!this.config.enableDelta) {
      throw new Error('Delta links not enabled');
    }

    return this.deltaTracker.getChangeStats();
  }

  // 🚀 Clean up old changes
  cleanupOldChanges(maxAge: number) {
    if (this.config.enableDelta) {
      this.deltaTracker.cleanupOldChanges(maxAge);
    }
  }
}
