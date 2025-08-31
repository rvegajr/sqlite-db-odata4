import type { SQLQuery, TableSchema } from 'odata-sqlite-contracts';

export interface ComputeResult {
  sql: string;
  parameters: any[];
}

export interface ComputeExpression {
  expression: string;
  as: string;
}

export interface IComputeBuilder {
  buildComputeQuery(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[]
  ): ComputeResult;
  
  buildComputeWithFilter(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    filter: string
  ): ComputeResult;
  
  buildComputeWithOrdering(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    orderBy: string
  ): ComputeResult;
  
  buildComplexCompute(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    filter?: string,
    orderBy?: string
  ): ComputeResult;
}

export class ComputeBuilder implements IComputeBuilder {
  buildComputeQuery(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[]
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    const sql = `SELECT *, ${selectClause} FROM ${table}`;

    return { sql, parameters: [] };
  }

  buildComputeWithFilter(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    filter: string
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    const sql = `SELECT *, ${selectClause} FROM ${table} WHERE ${filter}`;

    return { sql, parameters: [] };
  }

  buildComputeWithOrdering(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    orderBy: string
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    const sql = `SELECT *, ${selectClause} FROM ${table} ORDER BY ${orderBy}`;

    return { sql, parameters: [] };
  }

  buildComplexCompute(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    filter?: string,
    orderBy?: string
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    let sql = `SELECT *, ${selectClause} FROM ${table}`;
    
    if (filter) {
      sql += ` WHERE ${filter}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    return { sql, parameters: [] };
  }

  private buildSelectClause(computeExpressions: ComputeExpression[]): string {
    const selectParts: string[] = [];
    
    for (const compute of computeExpressions) {
      const computeClause = `(${compute.expression}) as ${compute.as}`;
      selectParts.push(computeClause);
    }
    
    return selectParts.join(', ');
  }

  private validateComputeInputs(
    schema: TableSchema,
    computeExpressions: ComputeExpression[]
  ): void {
    if (!computeExpressions || computeExpressions.length === 0) {
      throw new Error('At least one compute expression must be specified');
    }

    for (const compute of computeExpressions) {
      if (!compute.expression || compute.expression.trim() === '') {
        throw new Error('Compute expression cannot be empty');
      }

      if (!compute.as || compute.as.trim() === '') {
        throw new Error('Compute alias cannot be empty');
      }

      // Basic syntax validation
      if (!this.isValidExpressionSyntax(compute.expression)) {
        throw new Error('Invalid compute expression syntax');
      }

      // Validate field references exist in schema
      this.validateFieldReferences(compute.expression, schema);
    }
  }

  private isValidExpressionSyntax(expression: string): boolean {
    // Basic syntax validation - check for balanced parentheses
    const parentheses = expression.match(/[()]/g);
    if (parentheses) {
      const openCount = parentheses.filter(p => p === '(').length;
      const closeCount = parentheses.filter(p => p === ')').length;
      if (openCount !== closeCount) {
        return false;
      }
    }

    // Check for balanced quotes
    const singleQuotes = expression.match(/'/g);
    const doubleQuotes = expression.match(/"/g);
    if (singleQuotes && singleQuotes.length % 2 !== 0) {
      return false;
    }
    if (doubleQuotes && doubleQuotes.length % 2 !== 0) {
      return false;
    }

    // Check for invalid operator sequences (e.g., ++, --, **, //)
    // Note: || is valid for string concatenation in SQLite
    const invalidSequences = [/\+\+/, /--/, /\*\*/, /\/\//];
    for (const sequence of invalidSequences) {
      if (sequence.test(expression)) {
        return false;
      }
    }

    // Check for consecutive operators (e.g., + +, - -, etc.)
    const consecutiveOperators = /\s*[+\-*/]\s*[+\-*/]\s*/;
    if (consecutiveOperators.test(expression)) {
      return false;
    }

    // Check for basic SQL structure - should contain at least one valid operator or function
    const validOperators = ['+', '-', '*', '/', '%', '||', 'AND', 'OR', 'NOT', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS'];
    const validFunctions = ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'UPPER', 'LOWER', 'SUBSTR', 'INSTR', 'CAST', 'JULIANDAY', 'NOW', 'ABS', 'ROUND', 'CEIL', 'FLOOR'];
    
    // Check if expression contains at least one valid operator or function
    const hasValidOperator = validOperators.some(op => expression.toUpperCase().includes(op));
    const hasValidFunction = validFunctions.some(func => expression.toUpperCase().includes(func));
    
    // If it's a simple field reference, that's also valid
    const isSimpleField = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expression.trim());
    
    return hasValidOperator || hasValidFunction || isSimpleField;
  }

  private validateFieldReferences(expression: string, schema: TableSchema): void {
    // SQL keywords and functions that should not be validated as fields
    const sqlKeywords = new Set([
      'SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'AND', 'OR', 'NOT', 
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 
      'UPPER', 'LOWER', 'SUBSTR', 'INSTR', 'CAST', 'JULIANDAY', 'NOW', 'INTEGER', 'REAL', 'TEXT',
      'DIV', 'MOD', 'ABS', 'ROUND', 'CEIL', 'FLOOR', 'RANDOM', 'LENGTH', 'REPLACE', 'TRIM',
      'LTRIM', 'RTRIM', 'COALESCE', 'NULLIF', 'IIF', 'ZEROBLOB', 'QUOTE', 'HEX', 'UNHEX',
      'TYPEOF', 'LAST_INSERT_ROWID', 'CHANGES', 'TOTAL_CHANGES', 'SQLITE_VERSION'
    ]);

    // Extract potential field names from the expression
    // This regex looks for identifiers that are not quoted strings or numbers
    const fieldRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    
    let match;
    while ((match = fieldRegex.exec(expression)) !== null) {
      const potentialField = match[1];
      
      if (!potentialField) {
        continue;
      }
      
      // Skip SQL keywords and functions (case-insensitive)
      if (sqlKeywords.has(potentialField.toUpperCase())) {
        continue;
      }

      // Skip numbers
      if (/^\d+(\.\d+)?$/.test(potentialField)) {
        continue;
      }

      // Skip if it's part of a quoted string
      const beforeMatch = expression.substring(0, match.index);
      const singleQuotesBefore = (beforeMatch.match(/'/g) || []).length;
      const doubleQuotesBefore = (beforeMatch.match(/"/g) || []).length;
      
      if (singleQuotesBefore % 2 === 1 || doubleQuotesBefore % 2 === 1) {
        continue; // Inside a quoted string
      }

      // Check if the field exists in the schema
      const fieldExists = schema.columns.some(col => col.name === potentialField);
      if (!fieldExists) {
        throw new Error(`Field "${potentialField}" not found in table "${schema.name}"`);
      }
    }
  }

  // Helper methods for advanced compute features
  buildArithmeticCompute(
    table: string,
    schema: TableSchema,
    field1: string,
    operator: '+' | '-' | '*' | '/',
    field2: string,
    alias: string
  ): ComputeResult {
    const expression = `${field1} ${operator} ${field2}`;
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  buildStringConcatenationCompute(
    table: string,
    schema: TableSchema,
    fields: string[],
    separator: string,
    alias: string
  ): ComputeResult {
    const expression = fields.join(` || '${separator}' || `);
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  buildConditionalCompute(
    table: string,
    schema: TableSchema,
    condition: string,
    trueValue: string,
    falseValue: string,
    alias: string
  ): ComputeResult {
    const expression = `CASE WHEN ${condition} THEN ${trueValue} ELSE ${falseValue} END`;
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  buildDateCompute(
    table: string,
    schema: TableSchema,
    dateField: string,
    operation: 'age' | 'days_since' | 'days_until',
    alias: string
  ): ComputeResult {
    let expression: string;
    
    switch (operation) {
      case 'age':
        expression = `CAST((julianday('now') - julianday(${dateField})) / 365.25 AS INTEGER)`;
        break;
      case 'days_since':
        expression = `CAST(julianday('now') - julianday(${dateField}) AS INTEGER)`;
        break;
      case 'days_until':
        expression = `CAST(julianday(${dateField}) - julianday('now') AS INTEGER)`;
        break;
      default:
        throw new Error(`Unsupported date operation: ${operation}`);
    }
    
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  buildMathematicalCompute(
    table: string,
    schema: TableSchema,
    expression: string,
    alias: string
  ): ComputeResult {
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  // Performance optimization methods
  buildOptimizedCompute(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    indexHint?: string
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    let sql = `SELECT *, ${selectClause} FROM ${table}`;
    
    if (indexHint) {
      sql += ` INDEXED BY ${indexHint}`;
    }

    return { sql, parameters: [] };
  }

  buildComputeWithLimit(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    limit: number
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    const sql = `SELECT *, ${selectClause} FROM ${table} LIMIT ?`;

    return { sql, parameters: [limit] };
  }

  buildComputeWithOffset(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    offset: number
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    const sql = `SELECT *, ${selectClause} FROM ${table} OFFSET ?`;

    return { sql, parameters: [offset] };
  }

  buildComputeWithPagination(
    table: string,
    schema: TableSchema,
    computeExpressions: ComputeExpression[],
    limit: number,
    offset: number
  ): ComputeResult {
    this.validateComputeInputs(schema, computeExpressions);

    const selectClause = this.buildSelectClause(computeExpressions);
    const sql = `SELECT *, ${selectClause} FROM ${table} LIMIT ? OFFSET ?`;

    return { sql, parameters: [limit, offset] };
  }

  // Advanced compute features
  buildWindowFunctionCompute(
    table: string,
    schema: TableSchema,
    windowFunction: 'row_number' | 'rank' | 'dense_rank' | 'lead' | 'lag',
    alias: string,
    partitionBy?: string[],
    orderBy?: string
  ): ComputeResult {
    let expression = `${windowFunction.toUpperCase()}() OVER (`;
    
    if (partitionBy && partitionBy.length > 0) {
      expression += `PARTITION BY ${partitionBy.join(', ')}`;
    }
    
    if (orderBy) {
      if (partitionBy && partitionBy.length > 0) {
        expression += ' ';
      }
      expression += `ORDER BY ${orderBy}`;
    }
    
    expression += ')';
    
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  buildAggregateCompute(
    table: string,
    schema: TableSchema,
    aggregateFunction: 'sum' | 'avg' | 'count' | 'min' | 'max',
    field: string,
    alias: string
  ): ComputeResult {
    const expression = `${aggregateFunction.toUpperCase()}(${field})`;
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }

  buildStringFunctionCompute(
    table: string,
    schema: TableSchema,
    functionName: 'upper' | 'lower' | 'substr' | 'length' | 'trim',
    field: string,
    alias: string = '',
    args: string[] = []
  ): ComputeResult {
    let expression: string;
    
    switch (functionName) {
      case 'upper':
        expression = `UPPER(${field})`;
        break;
      case 'lower':
        expression = `LOWER(${field})`;
        break;
      case 'substr':
        if (args.length >= 2) {
          expression = `SUBSTR(${field}, ${args[0]}, ${args[1]})`;
        } else {
          throw new Error('SUBSTR requires start and length parameters');
        }
        break;
      case 'length':
        expression = `LENGTH(${field})`;
        break;
      case 'trim':
        expression = `TRIM(${field})`;
        break;
      default:
        throw new Error(`Unsupported string function: ${functionName}`);
    }
    
    return this.buildComputeQuery(table, schema, [{ expression, as: alias }]);
  }
}
