import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Get('property/:propertyId')
  getPropertyReviews(@Param('propertyId') propertyId: string) {
    return this.reviewsService.getPropertyReviews(propertyId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  addReview(
    @GetUser('id') userId: string,
    @Body('propertyId') propertyId: string,
    @Body('rating') rating: number,
    @Body('comment') comment: string,
  ) {
    return this.reviewsService.addReview(userId, propertyId, rating, comment);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  updateReview(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body('rating') rating: number,
    @Body('comment') comment: string,
  ) {
    return this.reviewsService.updateReview(id, userId, rating, comment);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  deleteReview(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.reviewsService.deleteReview(id, userId);
  }
}
