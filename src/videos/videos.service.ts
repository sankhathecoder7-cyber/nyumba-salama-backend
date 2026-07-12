import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { unlink } from 'fs/promises';
import { join } from 'path';

@Injectable()
export class VideosService {
  constructor(private db: DatabaseService) {}

  async uploadVideo(
    userId: string,
    title: string,
    description: string | null,
    propertyId: string | null,
    filename: string,
    price?: number,
    location?: string,
    university?: string,
    phone?: string,
  ) {
    try {
      console.log('=== UPLOAD VIDEO START ===');
      console.log('userId:', userId);
      console.log('title:', title);
      console.log('filename:', filename);
      console.log('price:', price);
      console.log('location:', location);
      console.log('university:', university);
      console.log('propertyId:', propertyId);

      let finalPrice = price;
      let finalLocation = location;
      let finalUniversity = university;

      if (propertyId) {
        const property = await this.db.queryOne(
          'SELECT * FROM properties WHERE id = ?',
          [propertyId],
        );
        if (!property) throw new NotFoundException('Property not found');
        if (!finalPrice) finalPrice = property.price;
        if (!finalLocation) finalLocation = property.location;
        if (!finalUniversity) finalUniversity = property.university;
      }

      const id = this.db.generateId();
      const url = `/uploads/${filename}`;

      console.log('Generated id:', id);
      console.log('Final price:', finalPrice);
      console.log('Final location:', finalLocation);
      console.log('Final university:', finalUniversity);

      const result = await this.db.run(
        `INSERT INTO videos (id, title, description, url, status, price, location, university, phone, userId, propertyId)
         VALUES (?, ?, ?, ?, 'VERIFIED', ?, ?, ?, ?, ?, ?)`,
        [
          id,
          title,
          description || null,
          url,
          finalPrice || null,
          finalLocation || null,
          finalUniversity || 'BOTH',
          phone || null,
          userId,
          propertyId || null,
        ],
      );

      console.log('Insert result:', result);

      const video = await this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
      console.log('Video saved:', video);
      console.log('=== UPLOAD VIDEO END ===');

      return video;
    } catch (error) {
      console.error('=== UPLOAD VIDEO ERROR ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      throw error;
    }
  }

  async findAll(query: { status?: string; university?: string; page?: number; limit?: number }) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.status) { 
      conditions.push('v.status = ?'); 
      params.push(query.status); 
    }
    
    if (query.university && query.university !== 'BOTH') {
      conditions.push('(v.university = ? OR v.university = ?)');
      params.push(query.university, 'BOTH');
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    const [data, countRow] = await Promise.all([
      this.db.query(
        `SELECT v.*, u.name as userName, u.avatar as userAvatar
         FROM videos v JOIN users u ON v.userId = u.id
         ${where} ORDER BY v.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.db.queryOne(
        `SELECT COUNT(*) as total FROM videos v ${where}`,
        params,
      ),
    ]);

    return {
      data,
      meta: {
        total: countRow?.total || 0,
        page,
        limit,
        totalPages: Math.ceil((countRow?.total || 0) / limit),
      },
    };
  }

  async findByUser(userId: string) {
    return this.db.query(
      'SELECT * FROM videos WHERE userId = ? ORDER BY createdAt DESC',
      [userId],
    );
  }

  async findById(id: string) {
    const video = await this.db.queryOne(
      `SELECT v.*, u.name as userName, u.avatar as userAvatar
       FROM videos v
       JOIN users u ON v.userId = u.id
       WHERE v.id = ?`,
      [id],
    );
    if (!video) throw new NotFoundException('Video not found');
    return video;
  }

  async verifyVideo(id: string, status: string) {
    const video = await this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) throw new NotFoundException('Video not found');
    await this.db.run('UPDATE videos SET status = ? WHERE id = ?', [status, id]);
    return this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
  }

  async likeVideo(id: string) {
    const video = await this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) throw new NotFoundException('Video not found');
    await this.db.run('UPDATE videos SET likes = likes + 1 WHERE id = ?', [id]);
    return { message: 'Video liked' };
  }

  async deleteVideo(id: string, userId: string) {
    const video = await this.db.queryOne('SELECT * FROM videos WHERE id = ?', [id]);
    if (!video) throw new NotFoundException('Video not found');
    if (video.userId !== userId) throw new BadRequestException('Not authorized');

    if (video.url && video.url.startsWith('/uploads/')) {
      const filepath = join(process.cwd(), video.url);
      try { await unlink(filepath); } catch {}
    }

    await this.db.run('DELETE FROM videos WHERE id = ?', [id]);
    return { message: 'Video deleted' };
  }
}