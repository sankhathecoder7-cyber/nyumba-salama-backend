import { Injectable, OnModuleInit } from '@nestjs/common';
import * as sqlite3 from 'sqlite3';
import * as crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sqlite3Module = require('sqlite3');

@Injectable()
export class DatabaseService implements OnModuleInit {
  private db: sqlite3.Database;

  constructor() {
    this.db = new sqlite3Module.Database('./dev.db');
    this.db.run('PRAGMA journal_mode=WAL');
    this.db.run('PRAGMA foreign_keys=ON');
  }

  async onModuleInit() {
    await this.createTables();
    await this.runMigrations();
    await this.seedAdmin();
  }

  private async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone TEXT NOT NULL,
        role TEXT DEFAULT 'STUDENT',
        avatar TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        price REAL NOT NULL,
        location TEXT NOT NULL,
        area TEXT,
        university TEXT DEFAULT 'BOTH',
        description TEXT,
        status TEXT DEFAULT 'AVAILABLE',
        amenities TEXT,
        rating REAL DEFAULT 0,
        reviewCount INTEGER DEFAULT 0,
        latitude REAL,
        longitude REAL,
        images TEXT,
        videoUrl TEXT,
        agentId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agentId) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        url TEXT NOT NULL,
        thumbnail TEXT,
        cloudinaryPublicId TEXT,
        status TEXT DEFAULT 'PENDING',
        price REAL,
        location TEXT,
        university TEXT,
        phone TEXT,
        userId TEXT NOT NULL,
        propertyId TEXT,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        rating REAL NOT NULL,
        comment TEXT,
        userId TEXT NOT NULL,
        propertyId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE,
        UNIQUE(userId, propertyId)
      )`,
      `CREATE TABLE IF NOT EXISTS favorites (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        propertyId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE,
        UNIQUE(userId, propertyId)
      )`,
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        userId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        isRead INTEGER DEFAULT 0,
        userId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        expiresAt DATETIME NOT NULL,
        userId TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )`,
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
  }

  private async runMigrations() {
    try {
      await this.run('ALTER TABLE videos ADD COLUMN phone TEXT');
    } catch {
      // Column already exists or SQLite doesn't support this ALTER
    }
  }

  private async seedAdmin() {
    const bcrypt = require('bcryptjs');
    const existing = await this.queryOne(
      'SELECT id FROM users WHERE email = ?',
      ['admin@nyumbasalama.com'],
    );
    if (!existing) {
      const id = this.generateId();
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await this.run(
        'INSERT INTO users (id, name, email, password, phone, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        [id, 'Admin', 'admin@nyumbasalama.com', hashedPassword, '255000000000', 'ADMIN'],
      );
      console.log('Default admin user seeded: admin@nyumbasalama.com / admin123');
    }
  }

  generateId(): string {
    return crypto.randomUUID();
  }

  query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as T[]);
      });
    });
  }

  queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve((row as T) || null);
      });
    });
  }

  run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }
}
