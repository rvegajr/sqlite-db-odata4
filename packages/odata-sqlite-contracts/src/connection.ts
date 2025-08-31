export type ConnectionType = 'local' | 'turso';

export interface SQLiteStatement {
  run(params?: any[]): Promise<{ changes: number; lastInsertRowid: number }>;
  get(params?: any[]): Promise<any>;
  all(params?: any[]): Promise<any[]>;
}

export interface ISQLiteConnection {
  prepare(sql: string): Promise<SQLiteStatement>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ITursoConnection extends ISQLiteConnection {
  sync(): Promise<void>;
}

export interface LocalSQLiteOptions {
  verbose?: boolean;
  readonly?: boolean;
  timeout?: number;
}

export interface TursoOptions {
  syncUrl?: string;
  syncInterval?: number;
}

export interface ConnectionConfig {
  type: ConnectionType;
  database?: string; // For local SQLite
  url?: string; // For Turso
  authToken?: string; // For Turso
  options?: LocalSQLiteOptions | TursoOptions;
}
