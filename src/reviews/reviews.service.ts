import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ReviewsService {
  constructor(private db: DatabaseService) {}

  async addReview(userId: string, propertyId: string, rating: number, comment: string) {
    const prop = await this.db.queryOne('SELECT id FROM properties WHERE id = ?', [propertyId]);
    if (!prop) throw new NotFoundException('Property not found');

    const existing = await this.db.queryOne(
      'SELECT id FROM reviews WHERE userId = ? AND propertyId = ?',
      [userId, propertyId],
    );
    if (existing) throw new BadRequestException('You have already reviewed this property');

    const id = this.db.generateId();
    await this.db.run(
      'INSERT INTO reviews (id, rating, comment, userId, propertyId) VALUES (?, ?, ?, ?, ?)',
      [id, rating, comment, userId, propertyId],
    );

    const avg = await this.db.queryOne(
      'SELECT AVG(rating) as avgRating, COUNT(*) as count FROM reviews WHERE propertyId = ?',
      [propertyId],
    );

    await this.db.run(
      'UPDATE properties SET rating = ?, reviewCount = ? WHERE id = ?',
      [avg?.avgRating || 0, avg?.count || 0, propertyId],
    );

    return this.db.queryOne(
      `SELECT r.*, u.name as userName, u.avatar as userAvatar
       FROM reviews r JOIN users u ON r.userId = u.id WHERE r.id = ?`,
      [id],
    );
  }

  async getPropertyReviews(propertyId: string) {
    return this.db.query(
      `SELECT r.*, u.name as userName, u.avatar as userAvatar
       FROM reviews r JOIN users u ON r.userId = u.id
       WHERE r.propertyId = ? ORDER BY r.createdAt DESC`,
      [propertyId],
    );
  }

  async updateReview(reviewId: string, userId: string, rating: number, comment: string) {
    const review = await this.db.queryOne('SELECT * FROM reviews WHERE id = ?', [reviewId]);
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new BadRequestException('Not authorized');

    await this.db.run(
      'UPDATE reviews SET rating = ?, comment = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [rating, comment, reviewId],
    );

    return this.db.queryOne('SELECT * FROM reviews WHERE id = ?', [reviewId]);
  }

  async deleteReview(reviewId: string, userId: string) {
    const review = await this.db.queryOne('SELECT * FROM reviews WHERE id = ?', [reviewId]);
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new BadRequestException('Not authorized');

    await this.db.run('DELETE FROM reviews WHERE id = ?', [reviewId]);
    return { message: 'Review deleted' };
  }
}
