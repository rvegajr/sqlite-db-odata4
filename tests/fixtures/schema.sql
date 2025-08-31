-- 🛍️ Perfect E-commerce Database Schema
-- This schema tests ALL OData v4 features with real-world complexity

-- Enable foreign keys and full-text search
PRAGMA foreign_keys = ON;

-- 🌟 CORE ENTITIES

-- Customers with rich profile data
CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    date_of_birth TEXT, -- ISO date format
    registration_date TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    total_orders INTEGER DEFAULT 0,
    total_spent REAL DEFAULT 0.0,
    loyalty_points INTEGER DEFAULT 0,
    preferred_shipping_address TEXT,
    marketing_consent BOOLEAN DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories with hierarchical structure
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    parent_id INTEGER,
    slug TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Products with rich metadata
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    price REAL NOT NULL CHECK (price >= 0),
    compare_price REAL CHECK (compare_price >= 0),
    cost_price REAL CHECK (cost_price >= 0),
    weight REAL DEFAULT 0,
    dimensions TEXT, -- JSON: {"length": 10, "width": 5, "height": 2}
    category_id INTEGER NOT NULL,
    brand TEXT,
    model TEXT,
    color TEXT,
    size TEXT,
    material TEXT,
    tags TEXT, -- Comma-separated tags
    is_active BOOLEAN DEFAULT 1,
    is_featured BOOLEAN DEFAULT 0,
    is_on_sale BOOLEAN DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 5,
    rating_average REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Product variants for complex products
CREATE TABLE product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    stock_quantity INTEGER DEFAULT 0,
    attributes TEXT, -- JSON: {"color": "red", "size": "L"}
    is_active BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Orders with complex status tracking
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    shipping_amount REAL NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
    discount_amount REAL NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount REAL NOT NULL CHECK (total_amount >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    shipping_address TEXT NOT NULL, -- JSON format
    billing_address TEXT NOT NULL, -- JSON format
    notes TEXT,
    tracking_number TEXT,
    estimated_delivery TEXT,
    actual_delivery TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Order items with detailed information
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_variant_id INTEGER,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    total_price REAL NOT NULL CHECK (total_price >= 0),
    tax_amount REAL NOT NULL DEFAULT 0,
    discount_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (product_variant_id) REFERENCES product_variants(id)
);

-- 🌟 RELATIONSHIP TABLES

-- Product reviews and ratings
CREATE TABLE product_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    order_id INTEGER,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    review TEXT,
    is_verified_purchase BOOLEAN DEFAULT 0,
    is_approved BOOLEAN DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Customer wishlists
CREATE TABLE wishlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE(customer_id, product_id)
);

-- 🌟 ANALYTICS TABLES

-- Page views and user behavior
CREATE TABLE page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    customer_id INTEGER,
    page_type TEXT NOT NULL, -- 'product', 'category', 'search', 'checkout'
    page_id INTEGER, -- product_id, category_id, etc.
    url TEXT NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Search queries for analytics
CREATE TABLE search_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    customer_id INTEGER,
    query TEXT NOT NULL,
    results_count INTEGER,
    clicked_product_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (clicked_product_id) REFERENCES products(id)
);

-- 🌟 FULL-TEXT SEARCH INDEXES

-- Enable FTS5 for products
CREATE VIRTUAL TABLE products_fts USING fts5(
    name, description, tags, brand, model,
    content='products',
    content_rowid='id'
);

-- Enable FTS5 for categories
CREATE VIRTUAL TABLE categories_fts USING fts5(
    name, description,
    content='categories',
    content_rowid='id'
);

-- 🌟 INDEXES FOR PERFORMANCE

-- Customer indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_registration_date ON customers(registration_date);
CREATE INDEX idx_customers_total_spent ON customers(total_spent);

-- Product indexes
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_is_featured ON products(is_featured);
CREATE INDEX idx_products_rating_average ON products(rating_average);
CREATE INDEX idx_products_created_at ON products(created_at);

-- Order indexes
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_total_amount ON orders(total_amount);

-- Order item indexes
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Review indexes
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at);

-- Analytics indexes
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_customer_id ON page_views(customer_id);
CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at);

-- 🌟 TRIGGERS FOR DATA INTEGRITY

-- Update product rating when reviews change
CREATE TRIGGER update_product_rating
AFTER INSERT ON product_reviews
BEGIN
    UPDATE products 
    SET rating_average = (
        SELECT AVG(rating) 
        FROM product_reviews 
        WHERE product_id = NEW.product_id AND is_approved = 1
    ),
    rating_count = (
        SELECT COUNT(*) 
        FROM product_reviews 
        WHERE product_id = NEW.product_id AND is_approved = 1
    )
    WHERE id = NEW.product_id;
END;

-- Update customer stats when orders change
CREATE TRIGGER update_customer_stats
AFTER INSERT ON orders
BEGIN
    UPDATE customers 
    SET total_orders = (
        SELECT COUNT(*) 
        FROM orders 
        WHERE customer_id = NEW.customer_id AND status != 'cancelled'
    ),
    total_spent = (
        SELECT COALESCE(SUM(total_amount), 0) 
        FROM orders 
        WHERE customer_id = NEW.customer_id AND status != 'cancelled'
    )
    WHERE id = NEW.customer_id;
END;

-- Update FTS when products change
CREATE TRIGGER products_fts_insert
AFTER INSERT ON products
BEGIN
    INSERT INTO products_fts(rowid, name, description, tags, brand, model)
    VALUES (NEW.id, NEW.name, NEW.description, NEW.tags, NEW.brand, NEW.model);
END;

CREATE TRIGGER products_fts_update
AFTER UPDATE ON products
BEGIN
    INSERT INTO products_fts(rowid, name, description, tags, brand, model)
    VALUES (NEW.id, NEW.name, NEW.description, NEW.tags, NEW.brand, NEW.model);
END;

CREATE TRIGGER products_fts_delete
AFTER DELETE ON products
BEGIN
    INSERT INTO products_fts(products_fts, rowid, name, description, tags, brand, model)
    VALUES('delete', OLD.id, OLD.name, OLD.description, OLD.tags, OLD.brand, OLD.model);
END;
