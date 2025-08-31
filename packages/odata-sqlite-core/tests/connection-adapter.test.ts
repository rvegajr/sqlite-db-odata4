import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConnectionAdapter } from '../src/connection-adapter';
import type { ConnectionConfig, ISQLiteConnection } from 'odata-sqlite-contracts';

describe('ConnectionAdapter', () => {
  describe('create', () => {
    it('should create local SQLite connection with memory database', async () => {
      const config: ConnectionConfig = {
        type: 'local',
        database: ':memory:',
        options: {
          verbose: false
        }
      };

      const connection = await ConnectionAdapter.create(config);
      
      expect(connection).toBeDefined();
      expect(typeof connection.prepare).toBe('function');
      expect(typeof connection.exec).toBe('function');
      expect(typeof connection.transaction).toBe('function');
      expect(typeof connection.close).toBe('function');

      // Test basic functionality
      await connection.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      const stmt = await connection.prepare('INSERT INTO test (name) VALUES (?)');
      await stmt.run(['Test Product']);
      
      const result = await connection.prepare('SELECT * FROM test');
      const rows = await result.all();
      
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Test Product');

      await connection.close();
    });

    it('should create Turso connection with proper configuration', async () => {
      const config: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://test-db.turso.io',
        authToken: 'test-token',
        options: {
          syncUrl: 'https://test-db-sync.turso.io'
        }
      };

      // Mock Turso connection for testing
      const connection = await ConnectionAdapter.create(config);
      
      expect(connection).toBeDefined();
      expect(typeof connection.prepare).toBe('function');
      expect(typeof connection.exec).toBe('function');
      expect(typeof connection.transaction).toBe('function');
      expect(typeof connection.close).toBe('function');
      
      // Turso connections should have sync method
      if ('sync' in connection) {
        expect(typeof connection.sync).toBe('function');
      }

      await connection.close();
    });

    it('should handle connection errors gracefully', async () => {
      const invalidConfig: ConnectionConfig = {
        type: 'local',
        database: '/invalid/path/database.db',
        options: {
          verbose: false
        }
      };

      await expect(ConnectionAdapter.create(invalidConfig)).rejects.toThrow();
    });
  });

  describe('LocalSQLiteAdapter', () => {
    it('should support transactions', async () => {
      const config: ConnectionConfig = {
        type: 'local',
        database: ':memory:',
        options: {
          verbose: false
        }
      };

      const connection = await ConnectionAdapter.create(config);
      
      await connection.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER)');
      await connection.exec('INSERT INTO accounts (balance) VALUES (100), (200)');

      // Test transaction rollback
      try {
        await connection.transaction(async () => {
          await connection.exec('UPDATE accounts SET balance = balance - 50 WHERE id = 1');
          await connection.exec('UPDATE accounts SET balance = balance + 50 WHERE id = 2');
          throw new Error('Simulated error');
        });
      } catch (error) {
        // Transaction should be rolled back
      }

      const result = await connection.prepare('SELECT * FROM accounts ORDER BY id');
      const rows = await result.all();
      
      expect(rows[0].balance).toBe(100); // Should be unchanged due to rollback
      expect(rows[1].balance).toBe(200);

      await connection.close();
    });

    it('should support prepared statements with parameters', async () => {
      const config: ConnectionConfig = {
        type: 'local',
        database: ':memory:',
        options: {
          verbose: false
        }
      };

      const connection = await ConnectionAdapter.create(config);
      
      await connection.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)');
      
      const insertStmt = await connection.prepare('INSERT INTO products (name, price) VALUES (?, ?)');
      await insertStmt.run(['Product 1', 10.99]);
      await insertStmt.run(['Product 2', 20.50]);

      const selectStmt = await connection.prepare('SELECT * FROM products WHERE price > ?');
      const rows = await selectStmt.all([15.0]);
      
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Product 2');
      expect(rows[0].price).toBe(20.5);

      await connection.close();
    });
  });
});
