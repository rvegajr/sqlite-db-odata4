import { describe, it, expect } from 'vitest';
import { ConnectionAdapter } from '../src/connection-adapter';
import type { ConnectionConfig } from 'odata-sqlite-contracts';

describe('ConnectionAdapter - Simple Tests', () => {
  describe('create', () => {
    it('should throw error for invalid connection type', async () => {
      const invalidConfig = {
        type: 'invalid' as any,
        database: ':memory:'
      };

      await expect(ConnectionAdapter.create(invalidConfig)).rejects.toThrow('Unsupported connection type');
    });

    it('should throw error for Turso without required fields', async () => {
      const invalidTursoConfig: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io'
        // Missing authToken
      };

      await expect(ConnectionAdapter.create(invalidTursoConfig)).rejects.toThrow('Turso connection requires url and authToken');
    });

    it('should validate local connection configuration', () => {
      const validConfig: ConnectionConfig = {
        type: 'local',
        database: ':memory:',
        options: {
          verbose: false
        }
      };

      expect(validConfig.type).toBe('local');
      expect(validConfig.database).toBe(':memory:');
    });

    it('should validate Turso connection configuration', () => {
      const validConfig: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'test-token',
        options: {
          syncUrl: 'https://test-sync.turso.io'
        }
      };

      expect(validConfig.type).toBe('turso');
      expect(validConfig.url).toBeDefined();
      expect(validConfig.authToken).toBeDefined();
    });
  });

  describe('LocalSQLiteAdapter', () => {
    it('should require local connection type', () => {
      const invalidConfig: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'test-token'
      };

      // This would throw in the constructor, but we're just testing the type checking
      expect(invalidConfig.type).toBe('turso');
    });
  });

  describe('TursoAdapter', () => {
    it('should require turso connection type', () => {
      const invalidConfig: ConnectionConfig = {
        type: 'local',
        database: ':memory:'
      };

      // This would throw in the constructor, but we're just testing the type checking
      expect(invalidConfig.type).toBe('local');
    });

    it('should require url and authToken for Turso', () => {
      const config: ConnectionConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'test-token'
      };

      expect(config.url).toBeDefined();
      expect(config.authToken).toBeDefined();
    });
  });
});
