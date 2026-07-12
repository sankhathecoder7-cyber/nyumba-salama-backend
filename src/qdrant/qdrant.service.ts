import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ConfigService } from '@nestjs/config';

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchResult {
  id: string | number;
  score: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private readonly collectionName = 'properties';
  private readonly vectorSize = 1536;
  private connected = false;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333';
    const apiKey = this.configService.get<string>('QDRANT_API_KEY') || undefined;
    this.client = new QdrantClient({ url, apiKey });
    this.logger.log(`Qdrant client initialized with URL: ${url}`);
  }

  async onModuleInit() {
    await this.ensureCollection();
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async healthCheck(): Promise<{ status: string; collections: number }> {
    try {
      const collections = await this.client.getCollections();
      this.connected = true;
      return {
        status: 'healthy',
        collections: collections.collections.length,
      };
    } catch (error) {
      this.connected = false;
      this.logger.error('Qdrant health check failed', error);
      return { status: 'unhealthy', collections: 0 };
    }
  }

  async ensureCollection(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === this.collectionName,
      );

      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: 'Cosine',
          },
        });
        this.logger.log(`✅ Collection '${this.collectionName}' created`);
      } else {
        this.logger.log(`✅ Collection '${this.collectionName}' already exists`);
      }
      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      this.logger.error(
        '❌ Failed to connect to Qdrant at ' +
          (this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333'),
        error,
      );
      return false;
    }
  }

  async createCollection(name?: string): Promise<void> {
    const collectionName = name || this.collectionName;
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (c) => c.name === collectionName,
      );
      if (exists) {
        this.logger.log(`Collection '${collectionName}' already exists`);
        return;
      }
      await this.client.createCollection(collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: 'Cosine',
        },
      });
      this.logger.log(`✅ Collection '${collectionName}' created`);
    } catch (error) {
      this.logger.error(`❌ Failed to create collection '${collectionName}'`, error);
      throw error;
    }
  }

  async deleteCollection(name?: string): Promise<void> {
    const collectionName = name || this.collectionName;
    try {
      await this.client.deleteCollection(collectionName);
      this.logger.log(`✅ Collection '${collectionName}' deleted`);
    } catch (error) {
      this.logger.error(`❌ Failed to delete collection '${collectionName}'`, error);
      throw error;
    }
  }

  async upsertVectors(points: QdrantPoint[]): Promise<void> {
    try {
      if (!points || points.length === 0) {
        this.logger.warn('No points to upsert');
        return;
      }

      // ✅ Ensure each point has required fields
      const validPoints = points.filter(p => p.id && p.vector && p.vector.length > 0);
      
      if (validPoints.length === 0) {
        this.logger.warn('No valid points to upsert');
        return;
      }

      await this.client.upsert(this.collectionName, {
        wait: true,
        points: validPoints.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload || {},
        })),
      });
      this.logger.log(`✅ Upserted ${validPoints.length} vectors`);
    } catch (error) {
      this.logger.error('❌ Failed to upsert vectors', error);
      throw error;
    }
  }

  async upsertBatch(points: QdrantPoint[], batchSize: number = 100): Promise<{ total: number; batches: number; failed: number }> {
    let total = 0;
    let batches = 0;
    let failed = 0;

    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      try {
        await this.upsertVectors(batch);
        total += batch.length;
        batches++;
        this.logger.log(`Batch ${batches} uploaded: ${batch.length} points (${total}/${points.length})`);
      } catch (error) {
        failed += batch.length;
        this.logger.error(`Batch ${batches + 1} failed: ${batch.length} points`, error);
        batches++;
      }
    }

    return { total, batches, failed };
  }

  async deleteVectors(ids: string[]): Promise<void> {
    try {
      await this.client.delete(this.collectionName, {
        wait: true,
        points: ids,
      });
      this.logger.log(`✅ Deleted ${ids.length} vectors`);
    } catch (error) {
      this.logger.error('❌ Failed to delete vectors', error);
      throw error;
    }
  }

  async updateVector(point: QdrantPoint): Promise<void> {
    await this.upsertVectors([point]);
  }

  async searchVectors(
    vector: number[],
    limit: number = 5,
    filter?: Record<string, unknown>,
  ): Promise<SearchResult[]> {
    try {
      if (!vector || vector.length === 0) {
        this.logger.warn('Empty vector provided for search');
        return [];
      }

      const result = await this.client.search(this.collectionName, {
        vector,
        limit,
        with_payload: true,
        score_threshold: 0.5,
        filter: filter
          ? {
              must: Object.entries(filter).map(([key, value]) => ({
                key,
                match: { value },
              })),
            }
          : undefined,
      });

      this.logger.log(`✅ Search returned ${result.length} results`);
      return result.map((r) => ({
        id: r.id,
        score: r.score,
        payload: (r.payload as Record<string, unknown>) || {},
      }));
    } catch (error) {
      this.logger.error('❌ Failed to search vectors', error);
      throw error;
    }
  }

  async getCollectionInfo(): Promise<{ pointsCount: number; vectorSize: number } | null> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      const config = info.config?.params?.vectors as Record<string, unknown> | undefined;
      return {
        pointsCount: info.points_count || 0,
        vectorSize: (config && typeof config.size === 'number') ? config.size : this.vectorSize,
      };
    } catch {
      return null;
    }
  }
}