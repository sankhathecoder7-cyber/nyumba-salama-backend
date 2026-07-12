import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AdminService {
  constructor(private db: DatabaseService) {}

  async getStats() {
    const [videos, properties, users] = await Promise.all([
      this.db.queryOne('SELECT COUNT(*) as count FROM videos'),
      this.db.queryOne('SELECT COUNT(*) as count FROM properties'),
      this.db.queryOne('SELECT COUNT(*) as count FROM users'),
    ]);

    return {
      totalVideos: videos?.count || 0,
      totalProperties: properties?.count || 0,
      totalUsers: users?.count || 0,
    };
  }

  async getAllVideos() {
    return this.db.query(
      `SELECT v.*, u.name as userName, u.email as userEmail
       FROM videos v
       JOIN users u ON v.userId = u.id
       ORDER BY v.createdAt DESC`,
    );
  }

  async verifyVideo(id: string) {
    const video = await this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) throw new NotFoundException('Video not found');
    await this.db.run('UPDATE videos SET status = ? WHERE id = ?', ['VERIFIED', id]);
    return this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
  }

  async deleteVideo(id: string) {
    const video = await this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) throw new NotFoundException('Video not found');

    if (video.url && video.url.startsWith('/uploads/')) {
      try {
        const { unlink } = require('fs/promises');
        const { join } = require('path');
        await unlink(join(process.cwd(), video.url));
      } catch {}
    }

    await this.db.run('DELETE FROM videos WHERE id = ?', [id]);
    return { message: 'Video deleted' };
  }

  async getAllProperties() {
    return this.db.query(
      `SELECT p.*, u.name as agentName, u.email as agentEmail
       FROM properties p
       JOIN users u ON p.agentId = u.id
       ORDER BY p.createdAt DESC`,
    );
  }

  async updatePropertyStatus(id: string, status: string) {
    const property = await this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
    if (!property) throw new NotFoundException('Property not found');
    await this.db.run(
      'UPDATE properties SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id],
    );
    return this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
  }

  async deleteProperty(id: string) {
    const property = await this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
    if (!property) throw new NotFoundException('Property not found');
    await this.db.run('DELETE FROM properties WHERE id = ?', [id]);
    return { message: 'Property deleted' };
  }

  async getAllUsers() {
    return this.db.query(
      'SELECT id, name, email, phone, role, avatar, createdAt FROM users ORDER BY createdAt DESC',
    );
  }

  async updateUserRole(id: string, role: string) {
    const user = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundException('User not found');
    await this.db.run(
      'UPDATE users SET role = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [role, id],
    );
    return this.db.queryOne(
      'SELECT id, name, email, phone, role, avatar, createdAt FROM users WHERE id = ?',
      [id],
    );
  }

  async deleteUser(id: string) {
    const user = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) throw new NotFoundException('User not found');

    const admins = await this.db.queryOne(
      'SELECT COUNT(*) as count FROM users WHERE role = ?',
      ['ADMIN'],
    );
    if (user.role === 'ADMIN' && admins?.count <= 1) {
      throw new NotFoundException('Cannot delete the last admin account');
    }

    await this.db.run('DELETE FROM users WHERE id = ?', [id]);
    return { message: 'User deleted' };
  }
}
