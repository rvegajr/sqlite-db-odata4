// Connection adapters
export { ConnectionAdapter, LocalSQLiteAdapter, TursoAdapter } from './connection-adapter';

// SQL Builder
export { SQLBuilder } from './sql-builder';

// Re-export types from contracts for convenience
export type {
  ConnectionConfig,
  ISQLiteConnection,
  ITursoConnection,
  ODataQuery,
  ODataResult,
  IODataParser,
  IODataExecutor,
  ISQLBuilder,
  SQLQuery,
  TableSchema
} from 'odata-sqlite-contracts';
