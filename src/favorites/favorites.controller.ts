import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  getUserFavorites(@GetUser('id') userId: string) {
    return this.favoritesService.getUserFavorites(userId);
  }

  @Get('check/:propertyId')
  isFavorite(@GetUser('id') userId: string, @Param('propertyId') propertyId: string) {
    return this.favoritesService.isFavorite(userId, propertyId);
  }

  @Post(':propertyId')
  addFavorite(@GetUser('id') userId: string, @Param('propertyId') propertyId: string) {
    return this.favoritesService.addFavorite(userId, propertyId);
  }

  @Delete(':propertyId')
  removeFavorite(@GetUser('id') userId: string, @Param('propertyId') propertyId: string) {
    return this.favoritesService.removeFavorite(userId, propertyId);
  }
}
