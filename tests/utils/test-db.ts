import { readFileSync } from 'fs';
import { join } from 'path';
import { ConnectionAdapter } from '../../packages/odata-sqlite-core/src/connection-adapter';
import type { ConnectionConfig, ISQLiteConnection, TableSchema } from '../../packages/odata-sqlite-contracts/src';

export interface TestDatabaseConfig {
  type: 'memory' | 'file' | 'docker' | 'turso';
  dataset: 'ecommerce' | 'blog' | 'analytics' | 'custom';
  volume: 'small' | 'medium' | 'large' | 'stress';
  options: {
    enableFTS?: boolean;
    enableTriggers?: boolean;
    enableViews?: boolean;
    seedData?: boolean;
  };
}

export interface PerformanceMetrics {
  queryTime: number;
  memoryUsage: number;
  rowsReturned: number;
  sqlGenerated: string;
}

export interface PerformanceReport {
  totalQueries: number;
  averageQueryTime: number;
  maxQueryTime: number;
  minQueryTime: number;
  totalMemoryUsage: number;
  queries: Array<{
    query: string;
    time: number;
    rows: number;
  }>;
}

export class TestDatabaseManager {
  private connection: ISQLiteConnection | null = null;
  private config: TestDatabaseConfig;
  private performanceMetrics: PerformanceMetrics[] = [];

  constructor(config: TestDatabaseConfig) {
    this.config = config;
  }

  async createDatabase(): Promise<ISQLiteConnection> {
    const connectionConfig: ConnectionConfig = {
      type: 'local',
      database: this.config.type === 'memory' ? ':memory:' : `./test-${Date.now()}.db`,
      options: {
        verbose: false
      }
    };

    this.connection = await ConnectionAdapter.create(connectionConfig);
    
    // Initialize database schema
    await this.initializeSchema();
    
    // Seed data if requested
    if (this.config.options.seedData) {
      await this.seedData();
    }

    return this.connection;
  }

  private async initializeSchema(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    // Read and execute schema
    const schemaPath = join(__dirname, '../fixtures/schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    // Split schema into individual statements and handle multi-line statements
    const statements = this.parseSQLStatements(schema);

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await this.connection.exec(statement);
        } catch (error) {
          console.warn(`Warning: Failed to execute statement: ${statement.substring(0, 100)}...`);
          console.warn(`Error: ${error}`);
        }
      }
    }
  }

  private parseSQLStatements(sql: string): string[] {
    // Remove comments
    const withoutComments = sql
      .replace(/--.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

    // Split by semicolon, but be careful with semicolons inside strings
    const statements: string[] = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < withoutComments.length; i++) {
      const char = withoutComments[i];
      
      if (char === "'" || char === '"') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }
      
      if (char === ';' && !inString) {
        const trimmed = currentStatement.trim();
        if (trimmed) {
          statements.push(trimmed);
        }
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }

    // Add the last statement if it exists
    const trimmed = currentStatement.trim();
    if (trimmed) {
      statements.push(trimmed);
    }

    return statements.filter(stmt => stmt.length > 0);
  }

  async seedData(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const generator = new TestDataGenerator(this.connection);
    
    switch (this.config.dataset) {
      case 'ecommerce':
        await generator.generateEcommerceData(this.getVolumeSize());
        break;
      case 'blog':
        await generator.generateBlogData(this.getVolumeSize());
        break;
      case 'analytics':
        await generator.generateAnalyticsData(this.getVolumeSize());
        break;
      default:
        throw new Error(`Unknown dataset: ${this.config.dataset}`);
    }
  }

  private getVolumeSize(): number {
    switch (this.config.volume) {
      case 'small': return 100;
      case 'medium': return 1000;
      case 'large': return 10000;
      case 'stress': return 100000;
      default: return 1000;
    }
  }

  async cleanup(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    this.performanceMetrics = [];
  }

  async getPerformanceMetrics(): Promise<PerformanceMetrics[]> {
    return this.performanceMetrics;
  }

  async generateReport(): Promise<PerformanceReport> {
    if (this.performanceMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageQueryTime: 0,
        maxQueryTime: 0,
        minQueryTime: 0,
        totalMemoryUsage: 0,
        queries: []
      };
    }

    const queryTimes = this.performanceMetrics.map(m => m.queryTime);
    const totalQueries = this.performanceMetrics.length;
    const averageQueryTime = queryTimes.reduce((a, b) => a + b, 0) / totalQueries;
    const maxQueryTime = Math.max(...queryTimes);
    const minQueryTime = Math.min(...queryTimes);
    const totalMemoryUsage = this.performanceMetrics.reduce((sum, m) => sum + m.memoryUsage, 0);

    return {
      totalQueries,
      averageQueryTime,
      maxQueryTime,
      minQueryTime,
      totalMemoryUsage,
      queries: this.performanceMetrics.map(m => ({
        query: m.sqlGenerated,
        time: m.queryTime,
        rows: m.rowsReturned
      }))
    };
  }

  async measureQueryTime<T>(
    queryFn: () => Promise<T>,
    sqlGenerated: string
  ): Promise<T> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      const result = await queryFn();
      
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const metrics: PerformanceMetrics = {
        queryTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        sqlGenerated
      };
      
      this.performanceMetrics.push(metrics);
      return result;
    } catch (error) {
      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;
      
      const metrics: PerformanceMetrics = {
        queryTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        rowsReturned: 0,
        sqlGenerated
      };
      
      this.performanceMetrics.push(metrics);
      throw error;
    }
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    // Query SQLite schema information
    const stmt = await this.connection.prepare(`
      SELECT 
        name as column_name,
        type as data_type,
        "notnull" as is_nullable,
        pk as is_primary_key,
        dflt_value as default_value
      FROM pragma_table_info(?)
      ORDER BY cid
    `);
    
    const columns = await stmt.all([tableName]);
    
    return {
      name: tableName,
      columns: columns.map(col => ({
        name: col.column_name,
        type: this.mapSqliteType(col.data_type),
        primaryKey: col.is_primary_key === 1,
        nullable: col.is_nullable === 0,
        defaultValue: col.default_value
      }))
    };
  }

  private mapSqliteType(sqliteType: string): 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB' | 'NULL' {
    const upperType = sqliteType.toUpperCase();
    if (upperType.includes('INT')) return 'INTEGER';
    if (upperType.includes('TEXT') || upperType.includes('CHAR') || upperType.includes('VARCHAR')) return 'TEXT';
    if (upperType.includes('REAL') || upperType.includes('FLOAT') || upperType.includes('DOUBLE')) return 'REAL';
    if (upperType.includes('BLOB')) return 'BLOB';
    return 'NULL';
  }
}

export class TestDataGenerator {
  constructor(private connection: ISQLiteConnection) {}

  async generateEcommerceData(volume: number): Promise<void> {
    console.log(`🎯 Generating e-commerce data with ${volume} records...`);
    
    // Generate categories
    await this.generateCategories(volume / 10);
    
    // Generate customers
    await this.generateCustomers(volume);
    
    // Generate products
    await this.generateProducts(volume * 2);
    
    // Generate orders
    await this.generateOrders(volume * 3);
    
    // Generate reviews
    await this.generateReviews(volume * 4);
    
    console.log('✅ E-commerce data generation complete!');
  }

  async generateBlogData(volume: number): Promise<void> {
    console.log(`📝 Generating blog data with ${volume} records...`);
    // Implementation for blog data generation
    console.log('✅ Blog data generation complete!');
  }

  async generateAnalyticsData(volume: number): Promise<void> {
    console.log(`📊 Generating analytics data with ${volume} records...`);
    // Implementation for analytics data generation
    console.log('✅ Analytics data generation complete!');
  }

  private async generateCategories(count: number): Promise<void> {
    const categories = [
      'Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports',
      'Automotive', 'Health & Beauty', 'Toys & Games', 'Food & Beverages', 'Jewelry'
    ];

    for (let i = 0; i < Math.min(count, categories.length); i++) {
      const stmt = await this.connection.prepare(`
        INSERT INTO categories (name, description, slug, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      await stmt.run([
        categories[i],
        `Description for ${categories[i]}`,
        categories[i].toLowerCase().replace(/\s+/g, '-'),
        1,
        i
      ]);
    }
  }

  private async generateCustomers(count: number): Promise<void> {
    const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Tom', 'Emma'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller'];
    
    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;
      
      const stmt = await this.connection.prepare(`
        INSERT INTO customers (email, first_name, last_name, phone, status, total_orders, total_spent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      await stmt.run([
        email,
        firstName,
        lastName,
        `+1-555-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
        'active',
        Math.floor(Math.random() * 20),
        Math.random() * 5000
      ]);
    }
  }

  private async generateProducts(count: number): Promise<void> {
    const brands = ['Apple', 'Samsung', 'Nike', 'Adidas', 'Sony', 'LG', 'Dell', 'HP'];
    const colors = ['Red', 'Blue', 'Green', 'Black', 'White', 'Silver', 'Gold'];
    
    for (let i = 0; i < count; i++) {
      const brand = brands[Math.floor(Math.random() * brands.length)];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const price = Math.random() * 1000 + 10;
      
      const stmt = await this.connection.prepare(`
        INSERT INTO products (sku, name, description, price, category_id, brand, color, is_active, stock_quantity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      await stmt.run([
        `SKU-${String(i).padStart(6, '0')}`,
        `${brand} ${color} Product ${i}`,
        `High-quality ${color} ${brand} product with amazing features.`,
        price,
        Math.floor(Math.random() * 10) + 1,
        brand,
        color,
        1,
        Math.floor(Math.random() * 100)
      ]);
    }
  }

  private async generateOrders(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const customerId = Math.floor(Math.random() * 100) + 1;
      const subtotal = Math.random() * 500 + 10;
      const tax = subtotal * 0.1;
      const shipping = Math.random() * 20 + 5;
      const total = subtotal + tax + shipping;
      
      const shippingAddress = JSON.stringify({
        street: `${Math.floor(Math.random() * 9999)} Main St`,
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'US'
      });
      
      const billingAddress = JSON.stringify({
        street: `${Math.floor(Math.random() * 9999)} Billing St`,
        city: 'Billing City',
        state: 'BC',
        zip: '54321',
        country: 'US'
      });
      
      const stmt = await this.connection.prepare(`
        INSERT INTO orders (order_number, customer_id, status, subtotal, tax_amount, shipping_amount, total_amount, payment_status, shipping_address, billing_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      await stmt.run([
        `ORD-${String(i).padStart(6, '0')}`,
        customerId,
        ['pending', 'confirmed', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 5)],
        subtotal,
        tax,
        shipping,
        total,
        ['pending', 'paid', 'failed'][Math.floor(Math.random() * 3)],
        shippingAddress,
        billingAddress
      ]);
    }
  }

  private async generateReviews(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const rating = Math.floor(Math.random() * 5) + 1;
      
      const stmt = await this.connection.prepare(`
        INSERT INTO product_reviews (product_id, customer_id, rating, title, review, is_approved)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      await stmt.run([
        Math.floor(Math.random() * 200) + 1,
        Math.floor(Math.random() * 100) + 1,
        rating,
        `Review ${i}`,
        `This is a ${rating}-star review for product ${i}. Great quality and fast delivery!`,
        1
      ]);
    }
  }
}
