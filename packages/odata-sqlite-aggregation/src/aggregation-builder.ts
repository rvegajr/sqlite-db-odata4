import type { SQLQuery, TableSchema } from 'odata-sqlite-contracts';

export interface AggregationResult {
  sql: string;
  parameters: any[];
}

export interface AggregateFunction {
  source: string;
  op: 'sum' | 'avg' | 'min' | 'max' | 'count';
  as: string;
}

export interface IAggregationBuilder {
  buildAggregationQuery(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[]
  ): AggregationResult;
  
  buildAggregationWithFilter(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    filter: string
  ): AggregationResult;
  
  buildAggregationWithHaving(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    having: string
  ): AggregationResult;
  
  buildAggregationWithOrdering(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    orderBy: string
  ): AggregationResult;
  
  buildComplexAggregation(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    filter?: string,
    having?: string,
    orderBy?: string
  ): AggregationResult;
}

export class AggregationBuilder implements IAggregationBuilder {
  buildAggregationQuery(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[]
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause}`;

    return { sql, parameters: [] };
  }

  buildAggregationWithFilter(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    filter: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} WHERE ${filter} ${groupByClause}`;

    return { sql, parameters: [] };
  }

  buildAggregationWithHaving(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    having: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause} HAVING ${having}`;

    return { sql, parameters: [] };
  }

  buildAggregationWithOrdering(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    orderBy: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause} ORDER BY ${orderBy}`;

    return { sql, parameters: [] };
  }

  buildComplexAggregation(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    filter?: string,
    having?: string,
    orderBy?: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    let sql = `SELECT ${selectClause} FROM ${table}`;
    
    if (filter) {
      sql += ` WHERE ${filter}`;
    }
    
    sql += ` ${groupByClause}`;
    
    if (having) {
      sql += ` HAVING ${having}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    return { sql, parameters: [] };
  }

  private buildSelectClause(groupByFields: string[], aggregates: AggregateFunction[]): string {
    const selectParts: string[] = [];
    
    // Add group by fields
    selectParts.push(...groupByFields);
    
    // Add aggregate functions
    for (const aggregate of aggregates) {
      const aggregateClause = this.buildAggregateClause(aggregate);
      selectParts.push(aggregateClause);
    }
    
    return selectParts.join(', ');
  }

  private buildAggregateClause(aggregate: AggregateFunction): string {
    const { source, op, as } = aggregate;
    
    switch (op) {
      case 'sum':
        return `SUM(${source}) as ${as}`;
      case 'avg':
        return `AVG(${source}) as ${as}`;
      case 'min':
        return `MIN(${source}) as ${as}`;
      case 'max':
        return `MAX(${source}) as ${as}`;
      case 'count':
        return `COUNT(${source}) as ${as}`;
      default:
        throw new Error(`Unsupported aggregation operator: ${op}`);
    }
  }

  private buildGroupByClause(groupByFields: string[]): string {
    return `GROUP BY ${groupByFields.join(', ')}`;
  }

  private validateAggregationInputs(
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[]
  ): void {
    if (!groupByFields || groupByFields.length === 0) {
      throw new Error('At least one group by field must be specified');
    }

    if (!aggregates || aggregates.length === 0) {
      throw new Error('At least one aggregation must be specified');
    }

    // Validate group by fields exist in schema
    for (const field of groupByFields) {
      const fieldExists = schema.columns.some(col => col.name === field);
      if (!fieldExists) {
        throw new Error(`Field "${field}" not found in table "${schema.name}"`);
      }
    }

    // Validate aggregate source fields exist in schema
    for (const aggregate of aggregates) {
      const fieldExists = schema.columns.some(col => col.name === aggregate.source);
      if (!fieldExists) {
        throw new Error(`Field "${aggregate.source}" not found in table "${schema.name}"`);
      }
    }
  }

  // Helper methods for advanced aggregation features
  buildCountDistinctAggregation(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    distinctField: string,
    alias: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, []);
    
    const selectClause = `${groupByFields.join(', ')}, COUNT(DISTINCT ${distinctField}) as ${alias}`;
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause}`;
    
    return { sql, parameters: [] };
  }

  buildConditionalAggregation(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    condition: string,
    aggregate: AggregateFunction
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, [aggregate]);
    
    const selectClause = `${groupByFields.join(', ')}, ${this.buildConditionalAggregateClause(condition, aggregate)}`;
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause}`;
    
    return { sql, parameters: [] };
  }

  private buildConditionalAggregateClause(condition: string, aggregate: AggregateFunction): string {
    const { source, op, as } = aggregate;
    
    switch (op) {
      case 'sum':
        return `SUM(CASE WHEN ${condition} THEN ${source} ELSE 0 END) as ${as}`;
      case 'avg':
        return `AVG(CASE WHEN ${condition} THEN ${source} END) as ${as}`;
      case 'min':
        return `MIN(CASE WHEN ${condition} THEN ${source} END) as ${as}`;
      case 'max':
        return `MAX(CASE WHEN ${condition} THEN ${source} END) as ${as}`;
      case 'count':
        return `COUNT(CASE WHEN ${condition} THEN ${source} END) as ${as}`;
      default:
        throw new Error(`Unsupported aggregation operator: ${op}`);
    }
  }

  buildWindowFunctionAggregation(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    windowField: string,
    windowFunction: 'row_number' | 'rank' | 'dense_rank',
    partitionBy?: string[],
    orderBy?: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, []);
    
    const selectParts = [...groupByFields];
    
    let windowClause = `${windowFunction.toUpperCase()}() OVER (`;
    if (partitionBy && partitionBy.length > 0) {
      windowClause += `PARTITION BY ${partitionBy.join(', ')}`;
    }
    if (orderBy) {
      if (partitionBy && partitionBy.length > 0) {
        windowClause += ' ';
      }
      windowClause += `ORDER BY ${orderBy}`;
    }
    windowClause += ')';
    
    selectParts.push(`${windowClause} as ${windowField}`);
    
    const selectClause = selectParts.join(', ');
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause}`;
    
    return { sql, parameters: [] };
  }

  // Performance optimization methods
  buildOptimizedAggregation(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    indexHint?: string
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    let sql = `SELECT ${selectClause} FROM ${table}`;
    
    if (indexHint) {
      sql += ` INDEXED BY ${indexHint}`;
    }
    
    sql += ` ${groupByClause}`;

    return { sql, parameters: [] };
  }

  buildAggregationWithLimit(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    limit: number
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause} LIMIT ?`;

    return { sql, parameters: [limit] };
  }

  buildAggregationWithOffset(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    offset: number
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause} OFFSET ?`;

    return { sql, parameters: [offset] };
  }

  buildAggregationWithPagination(
    table: string,
    schema: TableSchema,
    groupByFields: string[],
    aggregates: AggregateFunction[],
    limit: number,
    offset: number
  ): AggregationResult {
    this.validateAggregationInputs(schema, groupByFields, aggregates);

    const selectClause = this.buildSelectClause(groupByFields, aggregates);
    const groupByClause = this.buildGroupByClause(groupByFields);
    
    const sql = `SELECT ${selectClause} FROM ${table} ${groupByClause} LIMIT ? OFFSET ?`;

    return { sql, parameters: [limit, offset] };
  }
}
