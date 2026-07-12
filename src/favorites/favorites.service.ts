import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class FavoritesService {
  constructor(private db: DatabaseService) {}

  async addFavorite(userId: string, propertyId: string) {
    const prop = await this.db.queryOne('SELECT id FROM properties WHERE id = ?', [propertyId]);
    if (!prop) throw new NotFoundException('Property not found');

    const existing = await this.db.queryOne(
      'SELECT id FROM favorites WHERE userId = ? AND propertyId = ?',
      [userId, propertyId],
    );
    if (existing) throw new BadRequestException('Already in favorites');

    const id = this.db.generateId();
    await this.db.run(
      'INSERT INTO favorites (id, userId, propertyId) VALUES (?, ?, ?)',
      [id, userId, propertyId],
    );

    return { message: 'Added to favorites' };
  }

  async removeFavorite(userId: string, propertyId: string) {
    const fav = await this.db.queryOne(
      'SELECT id FROM favorites WHERE userId = ? AND propertyId = ?',
      [userId, propertyId],
    );
    if (!fav) throw new NotFoundException('Favorite not found');

    await this.db.run('DELETE FROM favorites WHERE userId = ? AND propertyId = ?', [userId, propertyId]);
    return { message: 'Removed from favorites' };
  }

  async getUserFavorites(userId: string) {
    return this.db.query(
      `SELECT f.*, p.title, p.price, p.location, p.type, p.rating, p.images, p.status
       FROM favorites f JOIN properties p ON f.propertyId = p.id
       WHERE f.userId = ? ORDER BY f.createdAt DESC`,
      [userId],
    );
  }

  async isFavorite(userId: string, propertyId: string) {
    const fav = await this.db.queryOne(
      'SELECT id FROM favorites WHERE userId = ? AND propertyId = ?',
      [userId, propertyId],
    );
    return { isFavorite: !!fav };
  }
}
