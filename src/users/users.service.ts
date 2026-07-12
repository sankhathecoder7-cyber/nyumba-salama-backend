import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private db: DatabaseService) {}

  async getProfile(userId: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, phone, role, avatar, createdAt FROM users WHERE id = ?',
      [userId],
    );
    if (!user) throw new NotFoundException('User not found');

    const [properties, favorites, videos] = await Promise.all([
      this.db.query('SELECT * FROM properties WHERE agentId = ? ORDER BY createdAt DESC LIMIT 5', [userId]),
      this.db.query('SELECT f.*, p.title, p.price, p.location, p.images, p.rating FROM favorites f JOIN properties p ON f.propertyId = p.id WHERE f.userId = ? ORDER BY f.createdAt DESC LIMIT 5', [userId]),
      this.db.query('SELECT * FROM videos WHERE userId = ? ORDER BY createdAt DESC LIMIT 5', [userId]),
    ]);

    return { ...user, properties, favorites, videos };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const sets: string[] = [];
    const params: any[] = [];

    if (dto.name) { sets.push('name = ?'); params.push(dto.name); }
    if (dto.phone) { sets.push('phone = ?'); params.push(dto.phone); }
    if (dto.avatar) { sets.push('avatar = ?'); params.push(dto.avatar); }

    if (sets.length > 0) {
      sets.push('updatedAt = CURRENT_TIMESTAMP');
      params.push(userId);
      await this.db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.db.queryOne('SELECT id, name, email, phone, role, avatar, createdAt FROM users WHERE id = ?', [userId]);
  }

  async getDashboard(userId: string) {
    const user = await this.db.queryOne('SELECT id, name, email, phone, role, avatar, createdAt FROM users WHERE id = ?', [userId]);
    if (!user) throw new NotFoundException('User not found');

    const [favCount, propCount, vidCount, revCount] = await Promise.all([
      this.db.queryOne('SELECT COUNT(*) as count FROM favorites WHERE userId = ?', [userId]),
      this.db.queryOne('SELECT COUNT(*) as count FROM properties WHERE agentId = ?', [userId]),
      this.db.queryOne('SELECT COUNT(*) as count FROM videos WHERE userId = ?', [userId]),
      this.db.queryOne('SELECT COUNT(*) as count FROM reviews WHERE userId = ?', [userId]),
    ]);

    return {
      user,
      stats: {
        favorites: favCount?.count || 0,
        properties: propCount?.count || 0,
        videos: vidCount?.count || 0,
        reviews: revCount?.count || 0,
      },
    };
  }

  async getUserProperties(userId: string) {
    return this.db.query('SELECT * FROM properties WHERE agentId = ? ORDER BY createdAt DESC', [userId]);
  }
}
