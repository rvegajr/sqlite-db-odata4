import type { 
  IDeltaTracker, 
  ChangeSet, 
  ChangeOperation, 
  DeltaTokenParseResult, 
  DeltaResponse, 
  DeltaConfig 
} from './delta-types';

export class DeltaTracker implements IDeltaTracker {
  private changes: Map<string, ChangeSet[]> = new Map();
  private config: DeltaConfig;

  constructor(config: DeltaConfig = {}) {
    this.config = {
      maxChanges: 1000,
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      tokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
      useDatabase: false,
      ...config
    };
  }

  generateDeltaLink(
    baseUrl: string, 
    resourceName: string, 
    timestamp: number, 
    existingQuery: string = '', 
    customToken?: string
  ): string {
    const token = customToken || this.formatTimestamp(timestamp);
    const separator = existingQuery.includes('?') ? '&' : '?';
    return `${baseUrl}/${resourceName}${existingQuery}${separator}$deltatoken=${token}`;
  }

  trackChange(
    resourceName: string, 
    entityId: number, 
    operation: ChangeOperation, 
    timestamp: number
  ): void {
    // Validation
    if (!resourceName) {
      throw new Error('Resource name cannot be empty');
    }
    if (entityId <= 0) {
      throw new Error('Entity ID must be positive');
    }
    if (!['create', 'update', 'delete'].includes(operation)) {
      throw new Error(`Invalid operation: ${operation}`);
    }
    if (timestamp <= 0) {
      throw new Error('Timestamp must be positive');
    }

    const changeSet: ChangeSet = {
      resourceName,
      entityId,
      operation,
      timestamp
    };

    if (!this.changes.has(resourceName)) {
      this.changes.set(resourceName, []);
    }

    const resourceChanges = this.changes.get(resourceName)!;
    resourceChanges.push(changeSet);

    // Limit the number of changes per resource
    if (resourceChanges.length > (this.config.maxChanges || 1000)) {
      resourceChanges.splice(0, resourceChanges.length - (this.config.maxChanges || 1000));
    }
  }

  getChanges(resourceName: string, sinceTimestamp: number): ChangeSet[] {
    const resourceChanges = this.changes.get(resourceName) || [];
    return resourceChanges.filter(change => change.timestamp > sinceTimestamp);
  }

  parseDeltaToken(token: string): DeltaTokenParseResult {
    if (!token) {
      return {
        isValid: false,
        error: 'Delta token cannot be empty'
      };
    }

    // Check if it's a custom token
    if (token.includes('-') || token.includes('_')) {
      return {
        isValid: true,
        customToken: token
      };
    }

    // Try to parse as timestamp
    const timestamp = parseInt(token, 10);
    if (isNaN(timestamp) || timestamp <= 0) {
      return {
        isValid: false,
        error: 'Invalid delta token format'
      };
    }

    return {
      isValid: true,
      timestamp
    };
  }

  generateDeltaResponse(
    resourceName: string,
    baseUrl: string,
    sinceTimestamp: number,
    currentTimestamp: number
  ): DeltaResponse {
    const changes = this.getChanges(resourceName, sinceTimestamp);
    
    const response: DeltaResponse = {
      '@odata.context': `${baseUrl}/$metadata#${resourceName}`,
      value: changes.map(change => ({
        '@odata.id': `${baseUrl}/${resourceName}(${change.entityId})`,
        '@odata.etag': `"${change.timestamp}"`,
        '@odata.operation': change.operation,
        ...change.data
      }))
    };

    // Add delta link for next request
    const nextDeltaLink = this.generateDeltaLink(baseUrl, resourceName, currentTimestamp);
    response['@odata.deltaLink'] = nextDeltaLink;

    return response;
  }

  createChangeTrackingTables(connection: any): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS delta_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        resource_name TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        operation TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_delta_changes_resource_timestamp 
      ON delta_changes(resource_name, timestamp);
      
      CREATE INDEX IF NOT EXISTS idx_delta_changes_entity 
      ON delta_changes(entity_id);
    `;

    connection.exec(sql);
  }

  storeChangeInDatabase(
    connection: any,
    resourceName: string,
    entityId: number,
    operation: ChangeOperation,
    timestamp: number
  ): void {
    const sql = `
      INSERT INTO delta_changes (resource_name, entity_id, operation, timestamp, data)
      VALUES (?, ?, ?, ?, ?)
    `;

    const data = JSON.stringify({ resourceName, entityId, operation, timestamp });
    connection.prepare(sql).run(resourceName, entityId, operation, timestamp, data);
  }

  getChangesFromDatabase(
    connection: any,
    resourceName: string,
    sinceTimestamp: number
  ): ChangeSet[] {
    const sql = `
      SELECT * FROM delta_changes 
      WHERE resource_name = ? AND timestamp > ?
      ORDER BY timestamp ASC
    `;

    const rows = connection.prepare(sql).all(resourceName, sinceTimestamp);
    
    return rows.map((row: any) => ({
      id: row.id,
      resourceName: row.resource_name,
      entityId: row.entity_id,
      operation: row.operation as ChangeOperation,
      timestamp: row.timestamp,
      data: row.data ? JSON.parse(row.data) : undefined
    }));
  }

  createChangeSet(
    resourceName: string,
    entityId: number,
    operation: ChangeOperation,
    timestamp: number
  ): ChangeSet {
    return {
      resourceName,
      entityId,
      operation,
      timestamp
    };
  }

  mergeChangeSets(changeSets: ChangeSet[]): ChangeSet[] {
    // Sort by timestamp
    return changeSets.sort((a, b) => a.timestamp - b.timestamp);
  }

  deduplicateChangeSets(changeSets: ChangeSet[]): ChangeSet[] {
    const seen = new Set<string>();
    return changeSets.filter(change => {
      const key = `${change.resourceName}-${change.entityId}-${change.operation}-${change.timestamp}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  cleanupOldChanges(maxAge: number): void {
    const cutoffTime = Date.now() - maxAge;

    for (const [resourceName, changes] of this.changes.entries()) {
      const filteredChanges = changes.filter(change => change.timestamp > cutoffTime);
      this.changes.set(resourceName, filteredChanges);
    }
  }

  // Helper methods
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
  }

  // Additional utility methods
  getChangeHistory(resourceName: string): ChangeSet[] {
    return this.changes.get(resourceName) || [];
  }

  clearChanges(resourceName?: string): void {
    if (resourceName) {
      this.changes.delete(resourceName);
    } else {
      this.changes.clear();
    }
  }

  getChangeStats(): { [resourceName: string]: number } {
    const stats: { [resourceName: string]: number } = {};
    for (const [resourceName, changes] of this.changes.entries()) {
      stats[resourceName] = changes.length;
    }
    return stats;
  }

  exportChanges(resourceName: string, format: 'json' | 'csv' = 'json'): string {
    const changes = this.getChangeHistory(resourceName);
    
    if (format === 'csv') {
      const headers = ['Resource', 'Entity ID', 'Operation', 'Timestamp', 'Data'];
      const rows = changes.map(change => [
        change.resourceName,
        change.entityId,
        change.operation,
        change.timestamp,
        JSON.stringify(change.data || {})
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');
    }
    
    return JSON.stringify(changes, null, 2);
  }
}
