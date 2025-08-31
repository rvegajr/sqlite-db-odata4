// Connection interfaces
export type { 
  ConnectionType,
  ISQLiteConnection,
  ITursoConnection,
  SQLiteStatement,
  LocalSQLiteOptions,
  TursoOptions,
  ConnectionConfig
} from './connection';

// OData interfaces
export type {
  ODataQuery,
  ODataResult,
  ODataOrderByField,
  ODataSortDirection,
  ODataFilterOperator,
  ODataFilterExpression,
  ODataExpandField,
  ODataError,
  ODataResponse
} from './odata';

// Parser and Executor interfaces
export type {
  IODataParser,
  IODataExecutor,
  ISQLBuilder,
  SQLQuery,
  TableSchema,
  TableColumn,
  TableIndex,
  QueryLimits,
  ExpandMapEntry,
  ForeignKeyRelationship,
  ExecuteOptions
} from './parser-executor';

// Re-export commonly used types for convenience
export type { ODataFilterExpression as FilterExpression } from './odata';
export type { SQLQuery as Query } from './parser-executor';
