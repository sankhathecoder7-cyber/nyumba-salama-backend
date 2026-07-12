import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiService } from './ai.service';
import { EmbeddingService } from './embedding.service';
import { RagService } from './rag.service';
import { QdrantModule } from '../qdrant/qdrant.module';

@Module({
  imports: [HttpModule, QdrantModule],
  providers: [AiService, EmbeddingService, RagService],
  exports: [AiService, EmbeddingService, RagService],
})
export class AiModule {}
