import { describe, it, expect } from 'vitest';
import type { 
  ISQLiteConnection, 
  ITursoConnection, 
  ConnectionConfig,
  ConnectionType 
} from '../src/connection';

describe('Connection Interfaces', () => {
  describe('ISQLiteConnection', () => {
    it('should define the basic SQLite connection interface', () => {
      // This test ensures our interface is properly defined
      const mockConnection: ISQLiteConnection = {
        prepare: async (sql: string) => ({
          run: async (params: any[]) => ({ changes: 0, lastInsertRowid: 0 }),
          get: async (params: any[]) => ({}),
          all: async (params: any[]) => ([])
        }),
        exec: async (sql: string) => {},
        transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
          return await fn();
        },
        close: async () => {}
      };

      expect(mockConnection).toBeDefined();
      expect(typeof mockConnection.prepare).toBe('function');
      expect(typeof mockConnection.exec).toBe('function');
      expect(typeof mockConnection.transaction).toBe('function');
      expect(typeof mockConnection.close).toBe('function');
    });
  });

  describe('ITursoConnection', () => {
    it('should extend ISQLiteConnection with Turso-specific methods', () => {
      const mockTursoConnection: ITursoConnection = {
        prepare: async (sql: string) => ({
          run: async (params: any[]) => ({ changes: 0, lastInsertRowid: 0 }),
          get: async (params: any[]) => ({}),
          all: async (params: any[]) => ([])
        }),
        exec: async (sql: string) => {},
        transaction: async <T>(fn: () => Promise<T>): Promise<T> => {
          return await fn();
        },
        close: async () => {},
        sync: async () => {}
      };

      expect(mockTursoConnection).toBeDefined();
      expect(typeof mockTursoConnection.sync).toBe('function');
    });
  });

  describe('ConnectionConfig', () => {
    it('should support local SQLite configuration', () => {
      const localConfig: ConnectionConfig = {
        type: 'local',
        database: ':memory:',
        options: {
          verbose: false
        }
      };

      expect(localConfig.type).toBe('local');
      expect(localConfig.database).toBe(':memory:');
    });

    it('should support Turso configuration', () => {
      const tursoConfig: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://your-database.turso.io',
        authToken: 'your-auth-token',
        options: {
          syncUrl: 'https://your-database-sync.turso.io'
        }
      };

      expect(tursoConfig.type).toBe('turso');
      expect(tursoConfig.url).toBeDefined();
      expect(tursoConfig.authToken).toBeDefined();
    });
  });

  describe('ConnectionType', () => {
    it('should define valid connection types', () => {
      const validTypes: ConnectionType[] = ['local', 'turso'];
      
      expect(validTypes).toContain('local');
      expect(validTypes).toContain('turso');
    });
  });
});
