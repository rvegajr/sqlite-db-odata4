import type { 
  ODataQuery, 
  ODataFilterExpression, 
  TableSchema, 
  SQLQuery,
  ISQLBuilder 
} from 'odata-sqlite-contracts';

export class SQLBuilder implements ISQLBuilder {
  buildSelectQuery(
    query: ODataQuery, 
    table: string, 
    schema: TableSchema,
    fieldMap?: Record<string, string>
  ): SQLQuery {
    const params: any[] = [];
    let sql = 'SELECT ';

    // Handle SELECT clause
    if (query.select && query.select.length > 0) {
      const mappedFields = query.select.map(field => {
        const dbField = fieldMap?.[field] || field;
        this.validateField(dbField, schema);
        return dbField;
      });
      sql += mappedFields.join(', ');
    } else {
      sql += '*';
    }

    sql += ` FROM ${table}`;

    // Handle WHERE clause
    if (query.filter) {
      const whereClause = this.buildWhereClause(query.filter, schema, params, fieldMap);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    // Handle ORDER BY clause
    if (query.orderBy && query.orderBy.length > 0) {
      const orderClauses = query.orderBy.map(order => {
        const dbField = fieldMap?.[order.field] || order.field;
        this.validateField(dbField, schema);
        return `${dbField} ${order.direction.toUpperCase()}`;
      });
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // Handle LIMIT and OFFSET
    if (query.top) {
      sql += ` LIMIT ${query.top}`;
    }
    if (query.skip) {
      sql += query.top ? ` OFFSET ${query.skip}` : ` LIMIT -1 OFFSET ${query.skip}`;
    }

    return { sql, params };
  }

  buildCountQuery(
    query: ODataQuery, 
    table: string, 
    schema: TableSchema,
    fieldMap?: Record<string, string>
  ): SQLQuery {
    const params: any[] = [];
    let sql = `SELECT COUNT(*) as count FROM ${table}`;

    // Handle WHERE clause
    if (query.filter) {
      const whereClause = this.buildWhereClause(query.filter, schema, params, fieldMap);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    return { sql, params };
  }

  private buildWhereClause(
    filter: ODataFilterExpression, 
    schema: TableSchema, 
    params: any[],
    fieldMap?: Record<string, string>
  ): string {
    const dbField = fieldMap?.[filter.field!] || filter.field!;
    
    if (filter.field) {
      this.validateField(dbField, schema);
    }

    switch (filter.operator) {
      case 'eq':
        params.push(filter.value);
        return `${dbField} = ?`;
      
      case 'ne':
        params.push(filter.value);
        return `${dbField} != ?`;
      
      case 'lt':
        params.push(filter.value);
        return `${dbField} < ?`;
      
      case 'le':
        params.push(filter.value);
        return `${dbField} <= ?`;
      
      case 'gt':
        params.push(filter.value);
        return `${dbField} > ?`;
      
      case 'ge':
        params.push(filter.value);
        return `${dbField} >= ?`;
      
      case 'in':
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => '?').join(', ');
          params.push(...filter.value);
          return `${dbField} IN (${placeholders})`;
        }
        throw new Error('IN operator requires array value');
      
      case 'contains':
        params.push(`%${filter.value}%`);
        return `${dbField} LIKE ?`;
      
      case 'startswith':
        params.push(`${filter.value}%`);
        return `${dbField} LIKE ?`;
      
      case 'endswith':
        params.push(`%${filter.value}`);
        return `${dbField} LIKE ?`;
      
      case 'and':
        if (!filter.left || !filter.right) {
          throw new Error('AND operator requires left and right operands');
        }
        const leftClause = this.buildWhereClause(filter.left, schema, params, fieldMap);
        const rightClause = this.buildWhereClause(filter.right, schema, params, fieldMap);
        return `(${leftClause} AND ${rightClause})`;
      
      case 'or':
        if (!filter.left || !filter.right) {
          throw new Error('OR operator requires left and right operands');
        }
        const leftOrClause = this.buildWhereClause(filter.left, schema, params, fieldMap);
        const rightOrClause = this.buildWhereClause(filter.right, schema, params, fieldMap);
        return `(${leftOrClause} OR ${rightOrClause})`;
      
      case 'not':
        if (!filter.left) {
          throw new Error('NOT operator requires left operand');
        }
        const notClause = this.buildWhereClause(filter.left, schema, params, fieldMap);
        return `NOT (${notClause})`;
      
      default:
        throw new Error(`Unsupported operator: ${filter.operator}`);
    }
  }

  private validateField(field: string, schema: TableSchema): void {
    const columnExists = schema.columns.some(col => col.name === field);
    if (!columnExists) {
      throw new Error(`Field ${field} not found in schema`);
    }
  }
}
