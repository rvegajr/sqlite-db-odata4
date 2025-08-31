import { describe, it, expect, beforeEach } from 'vitest';
import { SearchProvider } from '../src/search-provider';
import type { TableSchema } from 'odata-sqlite-contracts';

describe('🔍 SearchProvider - Full-Text Search with FTS5', () => {
  let searchProvider: SearchProvider;
  let productsSchema: TableSchema;
  let customersSchema: TableSchema;

  beforeEach(() => {
    searchProvider = new SearchProvider();
    
    // Define test schemas
    productsSchema = {
      name: 'products',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'description', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'brand', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'category', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'tags', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'price', type: 'REAL', primaryKey: false, nullable: false }
      ]
    };

    customersSchema = {
      name: 'customers',
      columns: [
        { name: 'id', type: 'INTEGER', primaryKey: true, nullable: false },
        { name: 'first_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'last_name', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'email', type: 'TEXT', primaryKey: false, nullable: false },
        { name: 'company', type: 'TEXT', primaryKey: false, nullable: false }
      ]
    };
  });

  describe('🔍 Basic Search Functionality', () => {
    it('should create FTS5 index for searchable columns', async () => {
      const searchableColumns = ['name', 'description', 'brand'];
      const indexName = 'products_fts';
      
      const result = searchProvider.createFTSIndex(
        'products',
        indexName,
        searchableColumns
      );

      expect(result.sql).toContain('CREATE VIRTUAL TABLE products_fts USING fts5');
      expect(result.sql).toContain('name, description, brand');
      expect(result.sql).toContain("content='products'");
      expect(result.sql).toContain("content_rowid='id'");
    });

    it('should generate simple search query', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('SELECT * FROM products');
      expect(result.sql).toContain('WHERE id IN (');
      expect(result.sql).toContain('SELECT rowid FROM products_fts');
      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('phone');
    });

    it('should handle search with multiple terms', () => {
      const searchTerm = 'apple phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('apple phone');
    });

    it('should handle search with special characters', () => {
      const searchTerm = 'iPhone 14 Pro';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('iPhone 14 Pro');
    });
  });

  describe('🔍 Advanced Search Features', () => {
    it('should handle boolean search operators', () => {
      const searchTerm = 'apple OR samsung';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('apple OR samsung');
    });

    it('should handle AND search operators', () => {
      const searchTerm = 'phone AND wireless';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('phone AND wireless');
    });

    it('should handle NOT search operators', () => {
      const searchTerm = 'phone NOT android';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('phone NOT android');
    });

    it('should handle phrase search with quotes', () => {
      const searchTerm = '"wireless headphones"';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('"wireless headphones"');
    });

    it('should handle wildcard search', () => {
      const searchTerm = 'phone*';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('WHERE products_fts MATCH ?');
      expect(result.parameters).toContain('phone*');
    });
  });

  describe('🔍 Search Ranking and Relevance', () => {
    it('should generate search with ranking', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQueryWithRanking(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('SELECT products.*, rank');
      expect(result.sql).toContain('JOIN (');
      expect(result.sql).toContain('SELECT rowid, rank FROM products_fts');
      expect(result.sql).toContain('ORDER BY rank DESC');
    });

    it('should handle search with custom ranking weights', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      const weights = { name: 3, description: 2, brand: 1 };
      
      const result = searchProvider.buildSearchQueryWithCustomRanking(
        searchTerm,
        ftsTable,
        searchableColumns,
        weights
      );

      expect(result.sql).toContain('bm25(products_fts, 3, 2, 1) as rank');
      expect(result.sql).toContain('ORDER BY rank DESC');
    });

    it('should handle search with minimum relevance threshold', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      const minRelevance = 0.5;
      
      const result = searchProvider.buildSearchQueryWithThreshold(
        searchTerm,
        ftsTable,
        searchableColumns,
        minRelevance
      );

      expect(result.sql).toContain('HAVING rank >= ?');
      expect(result.parameters).toContain(0.5);
    });
  });

  describe('🔍 Search Integration with Filters', () => {
    it('should combine search with existing filters', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      const existingFilter = 'price > 100';
      
      const result = searchProvider.buildSearchWithFilter(
        searchTerm,
        ftsTable,
        searchableColumns,
        existingFilter
      );

      expect(result.sql).toContain('WHERE id IN (');
      expect(result.sql).toContain('SELECT rowid FROM products_fts');
      expect(result.sql).toContain('AND price > 100');
    });

    it('should handle search with complex filters', () => {
      const searchTerm = 'wireless';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      const existingFilter = 'category = "Electronics" AND price BETWEEN 50 AND 500';
      
      const result = searchProvider.buildSearchWithFilter(
        searchTerm,
        ftsTable,
        searchableColumns,
        existingFilter
      );

      expect(result.sql).toContain('WHERE id IN (');
      expect(result.sql).toContain('SELECT rowid FROM products_fts');
      expect(result.sql).toContain('AND category = "Electronics"');
      expect(result.sql).toContain('AND price BETWEEN 50 AND 500');
    });
  });

  describe('🔍 Multi-Table Search', () => {
    it('should search across multiple tables', () => {
      const searchTerm = 'john';
      const searchConfig = [
        { table: 'customers', ftsTable: 'customers_fts', columns: ['first_name', 'last_name', 'email'] },
        { table: 'products', ftsTable: 'products_fts', columns: ['name', 'description', 'brand'] }
      ];
      
      const result = searchProvider.buildMultiTableSearch(
        searchTerm,
        searchConfig
      );

      expect(result.queries).toHaveLength(2);
      expect(result.queries[0].sql).toContain('customers_fts');
      expect(result.queries[1].sql).toContain('products_fts');
    });

    it('should combine multi-table search results', () => {
      const searchTerm = 'apple';
      const searchConfig = [
        { table: 'customers', ftsTable: 'customers_fts', columns: ['first_name', 'last_name', 'email'] },
        { table: 'products', ftsTable: 'products_fts', columns: ['name', 'description', 'brand'] }
      ];
      
      const result = searchProvider.buildUnifiedSearch(
        searchTerm,
        searchConfig
      );

      expect(result.sql).toContain('UNION ALL');
      expect(result.sql).toContain('customers_fts');
      expect(result.sql).toContain('products_fts');
    });
  });

  describe('🔍 Search Performance and Optimization', () => {
    it('should generate efficient search queries', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const startTime = performance.now();
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.sql).toContain('products_fts');
    });

    it('should handle large search terms efficiently', () => {
      const searchTerm = 'very long search term with many words that should be processed quickly';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const startTime = performance.now();
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should complete within 10ms
      expect(result.parameters).toContain(searchTerm);
    });

    it('should optimize search with index hints', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildOptimizedSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('INDEXED BY');
      expect(result.sql).toContain('products_fts');
    });
  });

  describe('🔍 Error Handling and Validation', () => {
    it('should validate search terms', () => {
      const invalidSearchTerm = '';
      
      expect(() => {
        searchProvider.buildSearchQuery(
          invalidSearchTerm,
          'products_fts',
          ['name', 'description']
        );
      }).toThrow('Search term cannot be empty');
    });

    it('should validate FTS table names', () => {
      const searchTerm = 'phone';
      const invalidFtsTable = '';
      
      expect(() => {
        searchProvider.buildSearchQuery(
          searchTerm,
          invalidFtsTable,
          ['name', 'description']
        );
      }).toThrow('FTS table name cannot be empty');
    });

    it('should validate searchable columns', () => {
      const searchTerm = 'phone';
      const ftsTable = 'products_fts';
      const invalidColumns: string[] = [];
      
      expect(() => {
        searchProvider.buildSearchQuery(
          searchTerm,
          ftsTable,
          invalidColumns
        );
      }).toThrow('At least one searchable column must be specified');
    });

    it('should handle SQL injection attempts', () => {
      const maliciousSearchTerm = "'; DROP TABLE products; --";
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description'];
      
      const result = searchProvider.buildSearchQuery(
        maliciousSearchTerm,
        ftsTable,
        searchableColumns
      );

      // Should be properly parameterized
      expect(result.sql).toContain('?');
      expect(result.parameters).toContain(maliciousSearchTerm);
      expect(result.sql).not.toContain('DROP TABLE');
    });
  });

  describe('🔍 Real-World Search Scenarios', () => {
    it('should handle e-commerce product search', () => {
      const searchTerm = 'wireless bluetooth headphones';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand', 'tags'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('products_fts');
      expect(result.sql).toContain('products_fts');
      expect(result.parameters).toContain('wireless bluetooth headphones');
    });

    it('should handle customer search with company names', () => {
      const searchTerm = 'john smith microsoft';
      const ftsTable = 'customers_fts';
      const searchableColumns = ['first_name', 'last_name', 'email', 'company'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('customers_fts');
      expect(result.parameters).toContain('john smith microsoft');
    });

    it('should handle complex boolean search', () => {
      const searchTerm = '(apple OR samsung) AND (phone OR tablet) NOT android';
      const ftsTable = 'products_fts';
      const searchableColumns = ['name', 'description', 'brand'];
      
      const result = searchProvider.buildSearchQuery(
        searchTerm,
        ftsTable,
        searchableColumns
      );

      expect(result.sql).toContain('products_fts');
      expect(result.parameters).toContain('(apple OR samsung) AND (phone OR tablet) NOT android');
    });
  });
});
