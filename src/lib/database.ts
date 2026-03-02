import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.REACT_APP_NEON_DATABASE_URL || '', {
  disableWarningInBrowsers: true
});

export { sql };

// Database schema queries
export const createTables = async () => {
  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create expenses table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create revenues table
    await sql`
      CREATE TABLE IF NOT EXISTS revenues (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        customer_name VARCHAR(100),
        description TEXT,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create products table
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock_quantity INTEGER DEFAULT 0,
        description TEXT,
        image_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create customers table
    await sql`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create orders table
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_address TEXT NOT NULL,
        delivery_date DATE NOT NULL,
        delivery_time TIME NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create order_items table
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id UUID,
        product_name VARCHAR(100) NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL
      )
    `;

    // Migrate existing order_items table (older versions may not have product_id)
    await sql`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS product_id UUID
    `;

    // Insert default admin user if not exists
    await sql`
      INSERT INTO users (username, password_hash, name, role)
      VALUES ('admin', 'admin123', 'Administrator', 'admin')
      ON CONFLICT (username) DO NOTHING
    `;

    // Insert sample products if not exists
    await sql`
      INSERT INTO products (name, category, price, stock_quantity, description) VALUES
        ('Hoa hồng đỏ', 'Hoa tươi', 150000, 50, 'Bó hoa hồng đỏ tươi đẹp'),
        ('Hoa tulip', 'Hoa tươi', 200000, 30, 'Hoa tulip Hà Lan'),
        ('Bó hoa baby', 'Bó hoa', 120000, 40, 'Bó hoa baby trắng tinh khôi'),
        ('Giỏ hoa mixed', 'Giỏ hoa', 350000, 15, 'Giỏ hoa các loại'),
        ('Chậu sen đá', 'Chậu cây', 80000, 25, 'Chậu sen đá dễ chăm sóc')
      ON CONFLICT DO NOTHING
    `;

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
};

// Basic input validation
export const validateInput = (input: string, maxLength: number = 255): string => {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength);
};

export const validateNumber = (input: string): number => {
  const num = parseFloat(input);
  return isNaN(num) ? 0 : Math.max(0, num);
};
