import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { QdrantModule } from './qdrant/qdrant.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { VideosModule } from './videos/videos.module';
import { ReviewsModule } from './reviews/reviews.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    QdrantModule,
    AiModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    VideosModule,
    ReviewsModule,
    FavoritesModule,
    ChatbotModule,
    AdminModule,
  ],
})
export class AppModule {}