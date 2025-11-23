// server/db.js
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./db.sqlite', (err) => {
  if (err) console.error('DB connection error:', err.message);
  else console.log('✅ Connected to SQLite database.');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create users table
db.run(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    uid TEXT,
    phone TEXT UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create enquiries table with foreign key reference to users
db.run(`
  CREATE TABLE IF NOT EXISTS home_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    city TEXT,
    type TEXT,
    bathroom_number TEXT,
    kitchen_type TEXT,
    material TEXT,
    area TEXT,
    theme TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS custom_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    type TEXT,
    city TEXT,
    area TEXT,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS kb_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    email TEXT,
    city TEXT,
    area TEXT,
    bathroom_type TEXT,
    kitchen_type TEXT,
    kitchen_theme TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS wardrobe_enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    email TEXT,
    city TEXT,
    length TEXT,
    wardrobe_type TEXT,
    material TEXT,
    finish TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  )
`);
// Create projects table
db.run(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT,
    location_area TEXT,
    city TEXT,
    address TEXT,
    rera TEXT,
    status TEXT,
    property_type TEXT,
    configurations TEXT, /* JSON array: [{type: "3 BHK", size_min:1600, size_max:2000, price_min:..., price_max:...}, ...] */
    blocks TEXT,
    units TEXT,
    floors TEXT,
    land_area TEXT,
    description TEXT,
    videos TEXT, /* JSON array of video URLs */
    developer_name TEXT,
    developer_logo TEXT,
    developer_description TEXT,
    highlights TEXT, /* JSON array of strings */
    amenities TEXT,  /* JSON array of strings */
    gallery TEXT,    /* JSON array of image URLs */
    thumbnail TEXT,  /* single URL chosen as thumbnail from gallery */
    brochure_url TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    price_info TEXT, /* optional JSON for price ranges */
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    customer_phone TEXT,
    review TEXT NOT NULL,
    service_type TEXT,
    isHome BOOLEAN DEFAULT 0,
    page TEXT,
    customer_type TEXT,
    rating type INTEGER,
    customer_image TEXT,   /* URL or filename */
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
