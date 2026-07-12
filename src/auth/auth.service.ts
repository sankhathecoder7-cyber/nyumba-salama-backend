import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.db.queryOne('SELECT id FROM users WHERE email = ?', [dto.email]);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    // Validate required fields
    if (!dto.name || !dto.email || !dto.password || !dto.phone) {
      throw new BadRequestException('All fields are required');
    }

    // Generate ID and hash password
    const id = this.db.generateId();
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    
    // Set role - default to STUDENT
    let role = 'STUDENT';
    if (dto.role === 'PROPERTY_OWNER' || dto.role === 'property_owner') {
      role = 'PROPERTY_OWNER';
    }

    // Insert user
    await this.db.run(
      'INSERT INTO users (id, name, email, password, phone, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [id, dto.name, dto.email, hashedPassword, dto.phone, role],
    );

    // Get user
    const user = await this.db.queryOne(
      'SELECT id, name, email, phone, role, avatar, createdAt FROM users WHERE id = ?',
      [id],
    );

    const token = this.generateToken(user.id, user.email, user.role);
    return { user, ...token };
  }

  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.db.queryOne(
      'SELECT * FROM users WHERE email = ?',
      [dto.email],
    );
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user.id, user.email, user.role);
    const { password, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, ...token };
  }

  async validateUser(userId: string) {
    const user = await this.db.queryOne(
      'SELECT id, name, email, phone, role, avatar FROM users WHERE id = ?',
      [userId],
    );
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async forgotPassword(email: string) {
    const user = await this.db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) return { message: 'If email exists, reset link has been sent' };

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3600000).toISOString();
    const id = this.db.generateId();

    await this.db.run(
      'INSERT INTO password_resets (id, token, expiresAt, userId) VALUES (?, ?, ?, ?)',
      [id, token, expiresAt, user.id],
    );

    return { message: 'Password reset link sent to email', token };
  }

  async resetPassword(token: string, newPassword: string) {
    const reset = await this.db.queryOne(
      'SELECT * FROM password_resets WHERE token = ?',
      [token],
    );
    if (!reset || new Date(reset.expiresAt) < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, reset.userId]);
    await this.db.run('DELETE FROM password_resets WHERE id = ?', [reset.id]);

    return { message: 'Password reset successfully' };
  }

  private generateToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return {
      access_token: this.jwtService.sign(payload),
      expiresIn: '7d',
    };
  }
}