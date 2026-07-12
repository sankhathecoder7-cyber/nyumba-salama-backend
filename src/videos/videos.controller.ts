import {
  Controller, Get, Post, Delete, Param, Query, UseGuards,
  UseInterceptors, UploadedFile, Req, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Request } from 'express';
import { VideosService } from './videos.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('videos')
export class VideosController {
  constructor(private videosService: VideosService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.videosService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyVideos(@GetUser('id') userId: string) {
    return this.videosService.findByUser(userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.videosService.findById(id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadDir = join(process.cwd(), 'uploads');
          if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
      // ✅ Sasa inakubali aina zote za video
      fileFilter: (_req, file, cb) => {
        // Kubali faili zote za video
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          // Au kubali kwa extension
          const allowedExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv'];
          const ext = extname(file.originalname).toLowerCase();
          if (allowedExtensions.includes(ext)) {
            cb(null, true);
          } else {
            cb(new BadRequestException('Only video files are allowed (MP4, MOV, AVI, WebM, MKV, FLV, WMV)'), false);
          }
        }
      },
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async uploadVideo(
    @GetUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const { title, description, propertyId, price, location, university, phone } = req.body || {};

    if (!file) throw new BadRequestException('Video file is required');
    
    // ✅ propertyId sio lazima - inaweza kuwa null
    // if (!propertyId) throw new BadRequestException('Property ID is required');

    return this.videosService.uploadVideo(
      userId,
      title || file.originalname,
      description || null,
      propertyId || null,
      file.filename,
      price ? parseFloat(price) : undefined,
      location || undefined,
      university || undefined,
      phone || undefined,
    );
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard)
  verifyVideo(@Param('id') id: string, @Req() req: Request) {
    return this.videosService.verifyVideo(id, req.body.status);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  likeVideo(@Param('id') id: string) {
    return this.videosService.likeVideo(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteVideo(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.videosService.deleteVideo(id, userId);
  }
}