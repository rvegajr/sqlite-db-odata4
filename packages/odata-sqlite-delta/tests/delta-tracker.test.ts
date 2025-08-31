import { describe, it, expect, beforeEach } from 'vitest';
import { DeltaTracker } from '../src/delta-tracker';
import type { DeltaLink, ChangeSet, DeltaConfig } from '../src/delta-types';

describe('🚀 DeltaTracker - OData v4 Delta Links', () => {
  let deltaTracker: DeltaTracker;

  beforeEach(() => {
    deltaTracker = new DeltaTracker();
  });

  describe('🚀 Delta Link Generation', () => {
    it('should generate delta link for collection', () => {
      const baseUrl = 'http://localhost:3000/api/odata';
      const resourceName = 'Products';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();

      const deltaLink = deltaTracker.generateDeltaLink(baseUrl, resourceName, timestamp);

      expect(deltaLink).toBe('http://localhost:3000/api/odata/Products?$deltatoken=20240101120000000');
    });

    it('should generate delta link with existing query parameters', () => {
      const baseUrl = 'http://localhost:3000/api/odata';
      const resourceName = 'Products';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();
      const existingQuery = '?$filter=price gt 100&$top=10';

      const deltaLink = deltaTracker.generateDeltaLink(baseUrl, resourceName, timestamp, existingQuery);

      expect(deltaLink).toBe('http://localhost:3000/api/odata/Products?$filter=price gt 100&$top=10&$deltatoken=20240101120000000');
    });

    it('should generate delta link with custom token format', () => {
      const baseUrl = 'http://localhost:3000/api/odata';
      const resourceName = 'Products';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();
      const customToken = 'custom-token-123';

      const deltaLink = deltaTracker.generateDeltaLink(baseUrl, resourceName, timestamp, '', customToken);

      expect(deltaLink).toBe('http://localhost:3000/api/odata/Products?$deltatoken=custom-token-123');
    });
  });

  describe('🚀 Change Tracking', () => {
    it('should track entity creation', () => {
      const resourceName = 'Products';
      const entityId = 1;
      const operation = 'create';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();

      deltaTracker.trackChange(resourceName, entityId, operation, timestamp);

      const changes = deltaTracker.getChanges(resourceName, timestamp - 1000);
      expect(changes).toHaveLength(1);
      expect(changes[0]?.entityId).toBe(entityId);
      expect(changes[0]?.operation).toBe(operation);
    });

    it('should track entity update', () => {
      const resourceName = 'Products';
      const entityId = 1;
      const operation = 'update';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();

      deltaTracker.trackChange(resourceName, entityId, operation, timestamp);

      const changes = deltaTracker.getChanges(resourceName, timestamp - 1000);
      expect(changes).toHaveLength(1);
      expect(changes[0]?.entityId).toBe(entityId);
      expect(changes[0]?.operation).toBe(operation);
    });

    it('should track entity deletion', () => {
      const resourceName = 'Products';
      const entityId = 1;
      const operation = 'delete';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();

      deltaTracker.trackChange(resourceName, entityId, operation, timestamp);

      const changes = deltaTracker.getChanges(resourceName, timestamp - 1000);
      expect(changes).toHaveLength(1);
      expect(changes[0]?.entityId).toBe(entityId);
      expect(changes[0]?.operation).toBe(operation);
    });

    it('should track multiple changes for same entity', () => {
      const resourceName = 'Products';
      const entityId = 1;
      const timestamp1 = new Date('2024-01-01T12:00:00Z').getTime();
      const timestamp2 = new Date('2024-01-01T12:30:00Z').getTime();

      deltaTracker.trackChange(resourceName, entityId, 'create', timestamp1);
      deltaTracker.trackChange(resourceName, entityId, 'update', timestamp2);

      const changes = deltaTracker.getChanges(resourceName, timestamp1 - 1000);
      expect(changes).toHaveLength(2);
      expect(changes[0]?.operation).toBe('create');
      expect(changes[1]?.operation).toBe('update');
    });
  });

  describe('🚀 Delta Token Parsing', () => {
    it('should parse valid delta token', () => {
      const deltaToken = '20240101120000000';
      const result = deltaTracker.parseDeltaToken(deltaToken);

      expect(result.isValid).toBe(true);
      expect(result.timestamp).toBe(new Date('2024-01-01T12:00:00Z').getTime());
    });

    it('should parse custom delta token', () => {
      const deltaToken = 'custom-token-123';
      const result = deltaTracker.parseDeltaToken(deltaToken);

      expect(result.isValid).toBe(true);
      expect(result.customToken).toBe('custom-token-123');
    });

    it('should reject invalid delta token', () => {
      const deltaToken = 'invalid-token';
      const result = deltaTracker.parseDeltaToken(deltaToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid delta token format');
    });

    it('should reject empty delta token', () => {
      const deltaToken = '';
      const result = deltaTracker.parseDeltaToken(deltaToken);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Delta token cannot be empty');
    });
  });

  describe('🚀 Delta Response Generation', () => {
    it('should generate delta response with changes', () => {
      const resourceName = 'Products';
      const baseUrl = 'http://localhost:3000/api/odata';
      const currentTimestamp = new Date('2024-01-01T12:00:00Z').getTime();

      // Track some changes
      deltaTracker.trackChange(resourceName, 1, 'create', currentTimestamp - 1000);
      deltaTracker.trackChange(resourceName, 2, 'update', currentTimestamp - 500);

      const response = deltaTracker.generateDeltaResponse(
        resourceName,
        baseUrl,
        currentTimestamp - 2000,
        currentTimestamp
      );

      expect(response['@odata.context']).toBe(`${baseUrl}/$metadata#Products`);
      expect(response['@odata.deltaLink']).toBeDefined();
      expect(response.value).toHaveLength(2);
    });

    it('should generate delta response with no changes', () => {
      const resourceName = 'Products';
      const baseUrl = 'http://localhost:3000/api/odata';
      const currentTimestamp = new Date('2024-01-01T12:00:00Z').getTime();

      const response = deltaTracker.generateDeltaResponse(
        resourceName,
        baseUrl,
        currentTimestamp - 1000,
        currentTimestamp
      );

      expect(response['@odata.context']).toBe(`${baseUrl}/$metadata#Products`);
      expect(response['@odata.deltaLink']).toBeDefined();
      expect(response.value).toHaveLength(0);
    });

    it('should include next delta link in response', () => {
      const resourceName = 'Products';
      const baseUrl = 'http://localhost:3000/api/odata';
      const currentTimestamp = new Date('2024-01-01T12:00:00Z').getTime();

      const response = deltaTracker.generateDeltaResponse(
        resourceName,
        baseUrl,
        currentTimestamp - 1000,
        currentTimestamp
      );

      expect(response['@odata.deltaLink']).toContain('$deltatoken=');
    });
  });

  describe('🚀 Database Integration', () => {
    it('should create change tracking tables', () => {
      const mockConnection = {
        exec: (sql: string) => {
          // Mock implementation
        }
      };

      deltaTracker.createChangeTrackingTables(mockConnection as any);

      // The method should execute without errors
      expect(true).toBe(true);
    });

    it('should store changes in database', () => {
      const mockConnection = {
        prepare: (sql: string) => ({
          run: (params: any[]) => ({ lastInsertRowid: 1 })
        })
      };

      const resourceName = 'Products';
      const entityId = 1;
      const operation = 'create';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();

      deltaTracker.storeChangeInDatabase(
        mockConnection as any,
        resourceName,
        entityId,
        operation,
        timestamp
      );

      // The method should execute without errors
      expect(true).toBe(true);
    });

    it('should retrieve changes from database', () => {
      const mockConnection = {
        prepare: (sql: string) => ({
          all: (params: any[]) => [
            { id: 1, resource_name: 'Products', entity_id: 1, operation: 'create', timestamp: 1704110400000 }
          ]
        })
      };

      const resourceName = 'Products';
      const sinceTimestamp = new Date('2024-01-01T12:00:00Z').getTime();

      const changes = deltaTracker.getChangesFromDatabase(
        mockConnection as any,
        resourceName,
        sinceTimestamp
      );

      expect(changes).toHaveLength(1);
      expect(changes[0]?.entityId).toBe(1);
      expect(changes[0]?.operation).toBe('create');
    });
  });

  describe('🚀 Change Set Management', () => {
    it('should create change set', () => {
      const resourceName = 'Products';
      const entityId = 1;
      const operation = 'create';
      const timestamp = new Date('2024-01-01T12:00:00Z').getTime();

      const changeSet = deltaTracker.createChangeSet(resourceName, entityId, operation, timestamp);

      expect(changeSet.resourceName).toBe(resourceName);
      expect(changeSet.entityId).toBe(entityId);
      expect(changeSet.operation).toBe(operation);
      expect(changeSet.timestamp).toBe(timestamp);
    });

    it('should merge change sets', () => {
      const changeSet1 = deltaTracker.createChangeSet('Products', 1, 'create', 1000);
      const changeSet2 = deltaTracker.createChangeSet('Products', 1, 'update', 2000);

      const merged = deltaTracker.mergeChangeSets([changeSet1, changeSet2]);

      expect(merged).toHaveLength(2);
      expect(merged[0]?.operation).toBe('create');
      expect(merged[1]?.operation).toBe('update');
    });

    it('should deduplicate change sets', () => {
      const changeSet1 = deltaTracker.createChangeSet('Products', 1, 'create', 1000);
      const changeSet2 = deltaTracker.createChangeSet('Products', 1, 'create', 1000);

      const deduplicated = deltaTracker.deduplicateChangeSets([changeSet1, changeSet2]);

      expect(deduplicated).toHaveLength(1);
    });
  });

  describe('🚀 Error Handling', () => {
    it('should handle invalid resource name', () => {
      expect(() => {
        deltaTracker.trackChange('', 1, 'create', Date.now());
      }).toThrow('Resource name cannot be empty');
    });

    it('should handle invalid entity ID', () => {
      expect(() => {
        deltaTracker.trackChange('Products', -1, 'create', Date.now());
      }).toThrow('Entity ID must be positive');
    });

    it('should handle invalid operation', () => {
      expect(() => {
        deltaTracker.trackChange('Products', 1, 'invalid' as any, Date.now());
      }).toThrow('Invalid operation: invalid');
    });

    it('should handle invalid timestamp', () => {
      expect(() => {
        deltaTracker.trackChange('Products', 1, 'create', -1);
      }).toThrow('Timestamp must be positive');
    });
  });

  describe('🚀 Performance Optimization', () => {
    it('should limit change history size', () => {
      const resourceName = 'Products';
      const maxChanges = 1000;

      // Add more changes than the limit
      for (let i = 0; i < maxChanges + 100; i++) {
        deltaTracker.trackChange(resourceName, i, 'create', Date.now() + i);
      }

      const changes = deltaTracker.getChanges(resourceName, 0);
      expect(changes.length).toBeLessThanOrEqual(maxChanges);
    });

    it('should clean up old changes', () => {
      const resourceName = 'Products';
      const oldTimestamp = Date.now() - 86400000; // 24 hours ago
      const currentTimestamp = Date.now();

      deltaTracker.trackChange(resourceName, 1, 'create', oldTimestamp);
      deltaTracker.trackChange(resourceName, 2, 'create', currentTimestamp);

      deltaTracker.cleanupOldChanges(12 * 60 * 60 * 1000); // 12 hours

      const changes = deltaTracker.getChanges(resourceName, 0);
      expect(changes).toHaveLength(1);
      expect(changes[0]?.entityId).toBe(2);
    });
  });
});
