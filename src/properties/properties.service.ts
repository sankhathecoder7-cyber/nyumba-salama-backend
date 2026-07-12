import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private db: DatabaseService) {}

  async create(userId: string, dto: CreatePropertyDto) {
    const id = this.db.generateId();
    const images = dto.images ? JSON.stringify(dto.images) : '[]';
    const amenities = dto.amenities ? JSON.stringify(dto.amenities) : '[]';

    await this.db.run(
      `INSERT INTO properties (id, title, type, price, location, area, university, description, status, amenities, latitude, longitude, images, videoUrl, agentId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, ?, ?, ?, ?)`,
      [id, dto.title, dto.type, dto.price, dto.location, dto.area, dto.university, dto.description, amenities, dto.latitude, dto.longitude, images, dto.videoUrl || null, userId],
    );

    return this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
  }

  async findAll(query: SearchPropertyDto) {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.query) {
      conditions.push('(title LIKE ? OR location LIKE ? OR area LIKE ? OR description LIKE ?)');
      const q = `%${query.query}%`;
      params.push(q, q, q, q);
    }
    if (query.type) { conditions.push('type = ?'); params.push(query.type); }
    if (query.university && query.university !== 'BOTH') {
      conditions.push('(university = ? OR university = ?)');
      params.push(query.university, 'BOTH');
    } else if (query.university === 'BOTH') {
      conditions.push('university = ?');
      params.push('BOTH');
    }
    if (query.minPrice) { conditions.push('price >= ?'); params.push(Number(query.minPrice)); }
    if (query.maxPrice) { conditions.push('price <= ?'); params.push(Number(query.maxPrice)); }
    if (query.status) { conditions.push('status = ?'); params.push(query.status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = query.page || 1;
    const limit = query.limit || 12;
    const offset = (page - 1) * limit;

    const [data, countRow] = await Promise.all([
      this.db.query(
        `SELECT p.*, u.name as agentName, u.phone as agentPhone, u.avatar as agentAvatar
         FROM properties p JOIN users u ON p.agentId = u.id
         ${where} ORDER BY p.createdAt DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      this.db.queryOne(`SELECT COUNT(*) as total FROM properties ${where}`, params),
    ]);

    const total = countRow?.total || 0;
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const property = await this.db.queryOne(
      `SELECT p.*, u.name as agentName, u.phone as agentPhone, u.avatar as agentAvatar
       FROM properties p JOIN users u ON p.agentId = u.id WHERE p.id = ?`,
      [id],
    );
    if (!property) throw new NotFoundException('Property not found');

    const reviews = await this.db.query(
      `SELECT r.*, u.name as userName, u.avatar as userAvatar
       FROM reviews r JOIN users u ON r.userId = u.id
       WHERE r.propertyId = ? ORDER BY r.createdAt DESC LIMIT 10`,
      [id],
    );

    const videos = await this.db.query(
      'SELECT * FROM videos WHERE propertyId = ? AND status = ? ORDER BY createdAt DESC LIMIT 5',
      [id, 'APPROVED'],
    );

    return { ...property, reviews, videos };
  }

  async update(id: string, userId: string, dto: Partial<CreatePropertyDto>) {
    const prop = await this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
    if (!prop) throw new NotFoundException('Property not found');
    if (prop.agentId !== userId) throw new ForbiddenException('Not authorized');

    const sets: string[] = [];
    const params: any[] = [];
    if (dto.title) { sets.push('title = ?'); params.push(dto.title); }
    if (dto.type) { sets.push('type = ?'); params.push(dto.type); }
    if (dto.price !== undefined) { sets.push('price = ?'); params.push(dto.price); }
    if (dto.location) { sets.push('location = ?'); params.push(dto.location); }
    if (dto.description) { sets.push('description = ?'); params.push(dto.description); }
    if (dto.status) { sets.push('status = ?'); params.push(dto.status); }
    if (dto.amenities) { sets.push('amenities = ?'); params.push(JSON.stringify(dto.amenities)); }

    if (sets.length > 0) {
      sets.push('updatedAt = CURRENT_TIMESTAMP');
      params.push(id);
      await this.db.run(`UPDATE properties SET ${sets.join(', ')} WHERE id = ?`, params);
    }

    return this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
  }

  async remove(id: string, userId: string) {
    const prop = await this.db.queryOne('SELECT * FROM properties WHERE id = ?', [id]);
    if (!prop) throw new NotFoundException('Property not found');
    if (prop.agentId !== userId) throw new ForbiddenException('Not authorized');
    await this.db.run('DELETE FROM properties WHERE id = ?', [id]);
    return { message: 'Property deleted' };
  }

  async findByUniversity(university: string) {
    return this.db.query(
      `SELECT p.*, u.name as agentName, u.phone as agentPhone, u.avatar as agentAvatar
       FROM properties p JOIN users u ON p.agentId = u.id
       WHERE (p.university = ? OR p.university = 'BOTH') AND p.status = 'AVAILABLE'
       ORDER BY p.createdAt DESC LIMIT 20`,
      [university],
    );
  }
}
