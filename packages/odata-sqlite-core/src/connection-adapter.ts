import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import type { 
  ConnectionConfig, 
  ISQLiteConnection, 
  ITursoConnection,
  SQLiteStatement,
  LocalSQLiteOptions,
  TursoOptions
} from 'odata-sqlite-contracts';

export class LocalSQLiteAdapter implements ISQLiteConnection {
  private db: Database.Database;

  constructor(config: ConnectionConfig) {
    if (config.type !== 'local') {
      throw new Error('LocalSQLiteAdapter requires local connection type');
    }

    const options = config.options as LocalSQLiteOptions;
    this.db = new Database(config.database || ':memory:', {
      verbose: options?.verbose ? console.log : undefined,
      readonly: options?.readonly || false
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  async prepare(sql: string): Promise<SQLiteStatement> {
    const stmt = this.db.prepare(sql);
    
    return {
      run: async (params: any[] = []) => {
        const result = stmt.run(...params);
        return {
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid)
        };
      },
      get: async (params: any[] = []) => {
        return stmt.get(...params);
      },
      all: async (params: any[] = []) => {
        return stmt.all(...params);
      }
    };
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.transaction(() => {
        try {
          const result = fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export class TursoAdapter implements ITursoConnection {
  private client: ReturnType<typeof createClient>;

  constructor(config: ConnectionConfig) {
    if (config.type !== 'turso') {
      throw new Error('TursoAdapter requires turso connection type');
    }

    if (!config.url || !config.authToken) {
      throw new Error('Turso connection requires url and authToken');
    }

    const options = config.options as TursoOptions;
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
      ...(options?.syncUrl && { syncUrl: options.syncUrl })
    });
  }

  async prepare(sql: string): Promise<SQLiteStatement> {
    // For Turso, we'll execute the statement directly since it doesn't have prepared statements
    // like better-sqlite3. We'll simulate the interface.
    return {
      run: async (params: any[] = []) => {
        const result = await this.client.execute({ sql, args: params });
        return {
          changes: result.rowsAffected,
          lastInsertRowid: Number(result.lastInsertRowid || 0)
        };
      },
      get: async (params: any[] = []) => {
        const result = await this.client.execute({ sql, args: params });
        return result.rows[0];
      },
      all: async (params: any[] = []) => {
        const result = await this.client.execute({ sql, args: params });
        return result.rows;
      }
    };
  }

  async exec(sql: string): Promise<void> {
    await this.client.execute({ sql, args: [] });
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    // Turso doesn't support transactions in the same way, so we'll execute sequentially
    // In a real implementation, you might want to use Turso's batch operations
    return await fn();
  }

  async sync(): Promise<void> {
    await this.client.sync();
  }

  async close(): Promise<void> {
    // Turso client doesn't need explicit closing
  }
}

export class ConnectionAdapter {
  static async create(config: ConnectionConfig): Promise<ISQLiteConnection | ITursoConnection> {
    switch (config.type) {
      case 'local':
        return new LocalSQLiteAdapter(config);
      case 'turso':
        return new TursoAdapter(config);
      default:
        throw new Error(`Unsupported connection type: ${config.type}`);
    }
  }
}
