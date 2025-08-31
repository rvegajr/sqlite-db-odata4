import type { ODataQuery, ODataResult } from './odata';
import type { ISQLiteConnection } from './connection';

export interface IODataParser {
  parse(url: string): ODataQuery;
}

export interface IODataExecutor<T> {
  execute(
    query: ODataQuery,
    connection: ISQLiteConnection,
    options: ExecuteOptions
  ): Promise<ODataResult<T>>;
}

export interface ISQLBuilder {
  buildSelectQuery(
    query: ODataQuery,
    table: string,
    schema: TableSchema
  ): SQLQuery;
  
  buildCountQuery(
    query: ODataQuery,
    table: string,
    schema: TableSchema
  ): SQLQuery;
}

export interface SQLQuery {
  sql: string;
  params: any[];
}

export interface TableColumn {
  name: string;
  type: 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'NULL';
  primaryKey?: boolean;
  nullable?: boolean;
  defaultValue?: any;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

export interface TableSchema {
  name: string;
  columns: TableColumn[];
  indexes?: TableIndex[];
}

export interface QueryLimits {
  maxTop?: number;
  defaultPageSize?: number;
  maxSkip?: number;
}

export interface ForeignKeyRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  name: string;
}

export interface ExpandMapEntry {
  from: string;
  localField: string;
  foreignField: string;
  as?: string;
  single?: boolean;
}

export interface ExecuteOptions {
  tableName: string;
  schema?: TableSchema;
  limits?: QueryLimits;
  fieldMap?: Record<string, string>; // apiName -> dbName
  expandMap?: Record<string, ExpandMapEntry>;
  relationships?: ForeignKeyRelationship[];
  baseUrl?: string;
  security?: {
    allowedOperators?: string[];
    maxRegexLength?: number;
    allowedFields?: string[];
  };
  hooks?: {
    onParsed?: (query: ODataQuery) => void;
    onExecuted?: (info: { 
      query: ODataQuery; 
      durationMs: number; 
      resultCount: number;
      sql: string;
    }) => void;
    onError?: (err: unknown) => void;
  };
  filterTransform?: (sqlFilter: string) => string;
  search?: {
    fields: string[];
    ftsTable?: string;
  };
}
