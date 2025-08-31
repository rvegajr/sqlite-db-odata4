import type { SQLQuery } from 'odata-sqlite-contracts';

export interface SearchResult {
  sql: string;
  parameters: any[];
}

export interface FTSIndexResult {
  sql: string;
  parameters: any[];
}

export interface SearchConfig {
  table: string;
  ftsTable: string;
  columns: string[];
}

export interface MultiTableSearchResult {
  queries: SearchResult[];
}

export interface RankingWeights {
  [column: string]: number;
}

export interface ISearchProvider {
  createFTSIndex(table: string, indexName: string, columns: string[]): FTSIndexResult;
  buildSearchQuery(searchTerm: string, ftsTable: string, searchableColumns: string[]): SearchResult;
  buildSearchQueryWithRanking(searchTerm: string, ftsTable: string, searchableColumns: string[]): SearchResult;
  buildSearchQueryWithCustomRanking(
    searchTerm: string, 
    ftsTable: string, 
    searchableColumns: string[], 
    weights: RankingWeights
  ): SearchResult;
  buildSearchQueryWithThreshold(
    searchTerm: string, 
    ftsTable: string, 
    searchableColumns: string[], 
    minRelevance: number
  ): SearchResult;
  buildSearchWithFilter(
    searchTerm: string, 
    ftsTable: string, 
    searchableColumns: string[], 
    existingFilter: string
  ): SearchResult;
  buildMultiTableSearch(searchTerm: string, searchConfig: SearchConfig[]): MultiTableSearchResult;
  buildUnifiedSearch(searchTerm: string, searchConfig: SearchConfig[]): SearchResult;
  buildOptimizedSearchQuery(searchTerm: string, ftsTable: string, searchableColumns: string[]): SearchResult;
}

export class SearchProvider implements ISearchProvider {
  createFTSIndex(table: string, indexName: string, columns: string[]): FTSIndexResult {
    if (!table || !indexName || !columns.length) {
      throw new Error('Table name, index name, and columns are required');
    }

    const columnsList = columns.join(', ');
    const sql = `CREATE VIRTUAL TABLE ${indexName} USING fts5(
      ${columnsList},
      content='${table}',
      content_rowid='id'
    )`;

    return { sql, parameters: [] };
  }

  buildSearchQuery(searchTerm: string, ftsTable: string, searchableColumns: string[]): SearchResult {
    this.validateSearchInputs(searchTerm, ftsTable, searchableColumns);

    const baseTable = ftsTable.replace('_fts', '');
    const sql = `SELECT * FROM ${baseTable} 
                 WHERE id IN (
                   SELECT rowid FROM ${ftsTable} 
                   WHERE ${ftsTable} MATCH ?
                 )`;

    return { sql, parameters: [searchTerm] };
  }

  buildSearchQueryWithRanking(searchTerm: string, ftsTable: string, searchableColumns: string[]): SearchResult {
    this.validateSearchInputs(searchTerm, ftsTable, searchableColumns);

    const baseTable = ftsTable.replace('_fts', '');
    const sql = `SELECT ${baseTable}.*, rank 
                 FROM ${baseTable} 
                 JOIN (
                   SELECT rowid, rank FROM ${ftsTable} 
                   WHERE ${ftsTable} MATCH ?
                 ) AS search_results ON ${baseTable}.id = search_results.rowid
                 ORDER BY rank DESC`;

    return { sql, parameters: [searchTerm] };
  }

  buildSearchQueryWithCustomRanking(
    searchTerm: string, 
    ftsTable: string, 
    searchableColumns: string[], 
    weights: RankingWeights
  ): SearchResult {
    this.validateSearchInputs(searchTerm, ftsTable, searchableColumns);

    const baseTable = ftsTable.replace('_fts', '');
    const weightValues = searchableColumns.map(col => weights[col] || 1.0);
    const weightString = weightValues.join(', ');

    const sql = `SELECT ${baseTable}.*, bm25(${ftsTable}, ${weightString}) as rank 
                 FROM ${baseTable} 
                 JOIN ${ftsTable} ON ${baseTable}.id = ${ftsTable}.rowid
                 WHERE ${ftsTable} MATCH ?
                 ORDER BY rank DESC`;

    return { sql, parameters: [searchTerm] };
  }

  buildSearchQueryWithThreshold(
    searchTerm: string, 
    ftsTable: string, 
    searchableColumns: string[], 
    minRelevance: number
  ): SearchResult {
    this.validateSearchInputs(searchTerm, ftsTable, searchableColumns);

    const baseTable = ftsTable.replace('_fts', '');
    const sql = `SELECT ${baseTable}.*, rank 
                 FROM ${baseTable} 
                 JOIN (
                   SELECT rowid, rank FROM ${ftsTable} 
                   WHERE ${ftsTable} MATCH ?
                 ) AS search_results ON ${baseTable}.id = search_results.rowid
                 HAVING rank >= ?
                 ORDER BY rank DESC`;

    return { sql, parameters: [searchTerm, minRelevance] };
  }

  buildSearchWithFilter(
    searchTerm: string, 
    ftsTable: string, 
    searchableColumns: string[], 
    existingFilter: string
  ): SearchResult {
    this.validateSearchInputs(searchTerm, ftsTable, searchableColumns);

    const baseTable = ftsTable.replace('_fts', '');
    const sql = `SELECT * FROM ${baseTable} 
                 WHERE id IN (
                   SELECT rowid FROM ${ftsTable} 
                   WHERE ${ftsTable} MATCH ?
                 )
                 AND ${existingFilter}`;

    return { sql, parameters: [searchTerm] };
  }

  buildMultiTableSearch(searchTerm: string, searchConfig: SearchConfig[]): MultiTableSearchResult {
    if (!searchTerm || !searchConfig.length) {
      throw new Error('Search term and search configuration are required');
    }

    const queries: SearchResult[] = [];

    for (const config of searchConfig) {
      const query = this.buildSearchQuery(searchTerm, config.ftsTable, config.columns);
      queries.push(query);
    }

    return { queries };
  }

  buildUnifiedSearch(searchTerm: string, searchConfig: SearchConfig[]): SearchResult {
    if (!searchTerm || !searchConfig.length) {
      throw new Error('Search term and search configuration are required');
    }

    const unionQueries: string[] = [];
    const parameters: any[] = [];

    for (const config of searchConfig) {
      const baseTable = config.ftsTable.replace('_fts', '');
      const query = `SELECT '${baseTable}' as source_table, * FROM ${baseTable} 
                     WHERE id IN (
                       SELECT rowid FROM ${config.ftsTable} 
                       WHERE ${config.ftsTable} MATCH ?
                     )`;
      
      unionQueries.push(query);
      parameters.push(searchTerm);
    }

    const sql = unionQueries.join(' UNION ALL ');

    return { sql, parameters };
  }

  buildOptimizedSearchQuery(searchTerm: string, ftsTable: string, searchableColumns: string[]): SearchResult {
    this.validateSearchInputs(searchTerm, ftsTable, searchableColumns);

    const baseTable = ftsTable.replace('_fts', '');
    const sql = `SELECT * FROM ${baseTable} INDEXED BY ${ftsTable}
                 WHERE id IN (
                   SELECT rowid FROM ${ftsTable} 
                   WHERE ${ftsTable} MATCH ?
                 )`;

    return { sql, parameters: [searchTerm] };
  }

  private validateSearchInputs(searchTerm: string, ftsTable: string, searchableColumns: string[]): void {
    if (!searchTerm || searchTerm.trim() === '') {
      throw new Error('Search term cannot be empty');
    }

    if (!ftsTable || ftsTable.trim() === '') {
      throw new Error('FTS table name cannot be empty');
    }

    if (!searchableColumns || searchableColumns.length === 0) {
      throw new Error('At least one searchable column must be specified');
    }
  }

  // Helper methods for advanced search features
  buildPhraseSearch(phrase: string, ftsTable: string, searchableColumns: string[]): SearchResult {
    const quotedPhrase = `"${phrase}"`;
    return this.buildSearchQuery(quotedPhrase, ftsTable, searchableColumns);
  }

  buildWildcardSearch(term: string, ftsTable: string, searchableColumns: string[]): SearchResult {
    const wildcardTerm = `${term}*`;
    return this.buildSearchQuery(wildcardTerm, ftsTable, searchableColumns);
  }

  buildBooleanSearch(expression: string, ftsTable: string, searchableColumns: string[]): SearchResult {
    return this.buildSearchQuery(expression, ftsTable, searchableColumns);
  }

  buildProximitySearch(term1: string, term2: string, distance: number, ftsTable: string, searchableColumns: string[]): SearchResult {
    const proximityExpression = `"${term1} ${term2}"~${distance}`;
    return this.buildSearchQuery(proximityExpression, ftsTable, searchableColumns);
  }

  // Performance optimization methods
  buildSearchWithLimit(searchTerm: string, ftsTable: string, searchableColumns: string[], limit: number): SearchResult {
    const baseResult = this.buildSearchQuery(searchTerm, ftsTable, searchableColumns);
    const sql = `${baseResult.sql} LIMIT ?`;
    return { sql, parameters: [...baseResult.parameters, limit] };
  }

  buildSearchWithOffset(searchTerm: string, ftsTable: string, searchableColumns: string[], offset: number): SearchResult {
    const baseResult = this.buildSearchQuery(searchTerm, ftsTable, searchableColumns);
    const sql = `${baseResult.sql} OFFSET ?`;
    return { sql, parameters: [...baseResult.parameters, offset] };
  }

  buildSearchWithPagination(searchTerm: string, ftsTable: string, searchableColumns: string[], limit: number, offset: number): SearchResult {
    const baseResult = this.buildSearchQuery(searchTerm, ftsTable, searchableColumns);
    const sql = `${baseResult.sql} LIMIT ? OFFSET ?`;
    return { sql, parameters: [...baseResult.parameters, limit, offset] };
  }
}
