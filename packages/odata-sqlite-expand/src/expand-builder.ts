import type { 
  ODataExpandField, 
  TableSchema, 
  ForeignKeyRelationship,
  ODataFilterExpression 
} from 'odata-sqlite-contracts';

export interface ExpandResult {
  joins: string[];
  selectFields: string[];
  parameters: any[];
  orderBy: string[];
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface IExpandBuilder {
  buildExpandClause(
    expand: ODataExpandField[],
    baseTable: string,
    schemas: TableSchema[],
    relationships: ForeignKeyRelationship[]
  ): ExpandResult;
}

export class ExpandBuilder implements IExpandBuilder {
  buildExpandClause(
    expand: ODataExpandField[],
    baseTable: string,
    schemas: TableSchema[],
    relationships: ForeignKeyRelationship[]
  ): ExpandResult {
    const result: ExpandResult = {
      joins: [],
      selectFields: [],
      parameters: [],
      orderBy: [],
      limit: undefined,
      offset: undefined
    };

    for (const expandField of expand) {
      this.processExpandField(expandField, baseTable, schemas, relationships, result, '');
    }

    return result;
  }

  private processExpandField(
    expandField: ODataExpandField,
    currentTable: string,
    schemas: TableSchema[],
    relationships: ForeignKeyRelationship[],
    result: ExpandResult,
    prefix: string
  ): void {
    // Find the relationship
    const relationship = this.findRelationship(currentTable, expandField.path, relationships);
    if (!relationship) {
      throw new Error(`Relationship "${expandField.path}" not found for table "${currentTable}"`);
    }

    // Find the target table schema
    const targetSchema = this.findSchema(relationship.toTable, schemas);
    if (!targetSchema) {
      throw new Error(`Schema not found for table "${relationship.toTable}"`);
    }

    // Generate JOIN clause
    const joinClause = this.generateJoinClause(
      currentTable,
      relationship,
      expandField,
      result
    );
    result.joins.push(joinClause);

    // Generate SELECT fields
    this.generateSelectFields(
      relationship.toTable,
      targetSchema,
      expandField,
      result,
      prefix + (prefix ? '_' : '') + relationship.name
    );

    // Handle ordering
    if (expandField.orderBy && expandField.orderBy.length > 0) {
      for (const orderBy of expandField.orderBy) {
        const orderClause = `${relationship.toTable}.${orderBy.field} ${orderBy.direction.toUpperCase()}`;
        result.orderBy.push(orderClause);
      }
    }

    // Handle pagination
    if (expandField.top !== undefined) {
      result.limit = expandField.top;
    }
    if (expandField.skip !== undefined) {
      result.offset = expandField.skip;
    }

    // Process nested expands
    if (expandField.nested && expandField.nested.length > 0) {
      for (const nestedField of expandField.nested) {
        this.processExpandField(
          nestedField,
          relationship.toTable,
          schemas,
          relationships,
          result,
          prefix + (prefix ? '_' : '') + relationship.name
        );
      }
    }
  }

  private findRelationship(
    fromTable: string,
    relationshipName: string,
    relationships: ForeignKeyRelationship[]
  ): ForeignKeyRelationship | undefined {
    return relationships.find(r => 
      r.fromTable === fromTable && r.name === relationshipName
    );
  }

  private findSchema(tableName: string, schemas: TableSchema[]): TableSchema | undefined {
    return schemas.find(s => s.name === tableName);
  }

  private generateJoinClause(
    fromTable: string,
    relationship: ForeignKeyRelationship,
    expandField: ODataExpandField,
    result: ExpandResult
  ): string {
    let joinClause = `LEFT JOIN ${relationship.toTable} ON ${fromTable}.${relationship.fromColumn} = ${relationship.toTable}.${relationship.toColumn}`;

    // Add filtering to JOIN if specified
    if (expandField.filter) {
      const filterClause = this.buildFilterClause(expandField.filter, relationship.toTable, result);
      if (filterClause) {
        joinClause += ` AND ${filterClause}`;
      }
    }

    return joinClause;
  }

  private generateSelectFields(
    tableName: string,
    schema: TableSchema,
    expandField: ODataExpandField,
    result: ExpandResult,
    prefix: string
  ): void {
    const fieldsToSelect = expandField.select || schema.columns.map(col => col.name);

    // Validate selected fields
    for (const field of fieldsToSelect) {
      const columnExists = schema.columns.some(col => col.name === field);
      if (!columnExists) {
        throw new Error(`Field "${field}" not found in table "${tableName}"`);
      }
    }

    // Add selected fields to result
    for (const field of fieldsToSelect) {
      const alias = `${prefix}_${field}`;
      result.selectFields.push(`${tableName}.${field} as ${alias}`);
    }
  }

  private buildFilterClause(
    filter: ODataFilterExpression,
    tableName: string,
    result: ExpandResult
  ): string {
    switch (filter.operator) {
      case 'eq':
        result.parameters.push(filter.value);
        return `${tableName}.${filter.field} = ?`;
      
      case 'ne':
        result.parameters.push(filter.value);
        return `${tableName}.${filter.field} != ?`;
      
      case 'lt':
        result.parameters.push(filter.value);
        return `${tableName}.${filter.field} < ?`;
      
      case 'le':
        result.parameters.push(filter.value);
        return `${tableName}.${filter.field} <= ?`;
      
      case 'gt':
        result.parameters.push(filter.value);
        return `${tableName}.${filter.field} > ?`;
      
      case 'ge':
        result.parameters.push(filter.value);
        return `${tableName}.${filter.field} >= ?`;
      
      case 'in':
        if (Array.isArray(filter.value)) {
          const placeholders = filter.value.map(() => '?').join(', ');
          result.parameters.push(...filter.value);
          return `${tableName}.${filter.field} IN (${placeholders})`;
        }
        throw new Error('IN operator requires array value');
      
      case 'contains':
        result.parameters.push(`%${filter.value}%`);
        return `${tableName}.${filter.field} LIKE ?`;
      
      case 'startswith':
        result.parameters.push(`${filter.value}%`);
        return `${tableName}.${filter.field} LIKE ?`;
      
      case 'endswith':
        result.parameters.push(`%${filter.value}`);
        return `${tableName}.${filter.field} LIKE ?`;
      
      case 'and':
        if (!filter.left || !filter.right) {
          throw new Error('AND operator requires left and right operands');
        }
        const leftClause = this.buildFilterClause(filter.left, tableName, result);
        const rightClause = this.buildFilterClause(filter.right, tableName, result);
        return `(${leftClause} AND ${rightClause})`;
      
      case 'or':
        if (!filter.left || !filter.right) {
          throw new Error('OR operator requires left and right operands');
        }
        const leftOrClause = this.buildFilterClause(filter.left, tableName, result);
        const rightOrClause = this.buildFilterClause(filter.right, tableName, result);
        return `(${leftOrClause} OR ${rightOrClause})`;
      
      case 'not':
        if (!filter.left) {
          throw new Error('NOT operator requires left operand');
        }
        const notClause = this.buildFilterClause(filter.left, tableName, result);
        return `NOT (${notClause})`;
      
      default:
        throw new Error(`Unsupported operator: ${filter.operator}`);
    }
  }
}
