export type ChangeOperation = 'create' | 'update' | 'delete';

export interface ChangeSet {
  id?: number;
  resourceName: string;
  entityId: number;
  operation: ChangeOperation;
  timestamp: number;
  data?: any;
}

export interface DeltaLink {
  url: string;
  token: string;
  expiresAt?: number;
}

export interface DeltaToken {
  timestamp: number;
  customToken?: string;
}

export interface DeltaTokenParseResult {
  isValid: boolean;
  timestamp?: number;
  customToken?: string;
  error?: string;
}

export interface DeltaResponse {
  '@odata.context': string;
  '@odata.deltaLink'?: string;
  '@odata.nextLink'?: string;
  value: any[];
}

export interface DeltaConfig {
  maxChanges?: number;
  cleanupInterval?: number;
  tokenExpiry?: number;
  useDatabase?: boolean;
}

export interface IDeltaTracker {
  generateDeltaLink(
    baseUrl: string, 
    resourceName: string, 
    timestamp: number, 
    existingQuery?: string, 
    customToken?: string
  ): string;
  
  trackChange(
    resourceName: string, 
    entityId: number, 
    operation: ChangeOperation, 
    timestamp: number
  ): void;
  
  getChanges(resourceName: string, sinceTimestamp: number): ChangeSet[];
  
  parseDeltaToken(token: string): DeltaTokenParseResult;
  
  generateDeltaResponse(
    resourceName: string,
    baseUrl: string,
    sinceTimestamp: number,
    currentTimestamp: number
  ): DeltaResponse;
  
  createChangeTrackingTables(connection: any): void;
  
  storeChangeInDatabase(
    connection: any,
    resourceName: string,
    entityId: number,
    operation: ChangeOperation,
    timestamp: number
  ): void;
  
  getChangesFromDatabase(
    connection: any,
    resourceName: string,
    sinceTimestamp: number
  ): ChangeSet[];
  
  createChangeSet(
    resourceName: string,
    entityId: number,
    operation: ChangeOperation,
    timestamp: number
  ): ChangeSet;
  
  mergeChangeSets(changeSets: ChangeSet[]): ChangeSet[];
  
  deduplicateChangeSets(changeSets: ChangeSet[]): ChangeSet[];
  
  cleanupOldChanges(maxAge: number): void;
}
