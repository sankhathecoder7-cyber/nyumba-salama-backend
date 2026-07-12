import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  get githubModelsToken(): string {
    return process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY || '';
  }

  get chatModel(): string {
    return process.env.CHAT_MODEL || 'openai/gpt-4o';
  }

  get embeddingModel(): string {
    return process.env.EMBEDDING_MODEL || 'openai/text-embedding-3-small';
  }

  get githubModelsUrl(): string {
    return process.env.GITHUB_MODELS_URL || 'https://models.github.ai/inference';
  }

  get qdrantUrl(): string {
    return process.env.QDRANT_URL || 'http://localhost:6333';
  }

  get qdrantApiKey(): string {
    return process.env.QDRANT_API_KEY || '';
  }

  get topK(): number {
    const val = process.env.TOP_K;
    return val ? parseInt(val, 10) : 5;
  }

  get temperature(): number {
    const val = process.env.TEMPERATURE;
    return val ? parseFloat(val) : 0.3;
  }

  get maxTokens(): number {
    const val = process.env.MAX_TOKENS;
    return val ? parseInt(val, 10) : 1000;
  }

  get databaseUrl(): string {
    return process.env.DATABASE_URL || 'file:./dev.db';
  }

  get jwtSecret(): string {
    return process.env.JWT_SECRET || 'nyumbasalama-secret-key';
  }

  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '7d';
  }

  get port(): number {
    const val = process.env.PORT;
    return val ? parseInt(val, 10) : 8000;
  }

  get isAiEnabled(): boolean {
    const token = this.githubModelsToken;
    return !!token && token.length > 10;
  }
}
