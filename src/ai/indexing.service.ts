import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { EmbeddingService } from './embedding.service';

@Injectable()
export class IndexingService {
  private readonly logger = new Logger(IndexingService.name);

  constructor(
    private db: DatabaseService,
    private qdrant: QdrantService,
    private embedding: EmbeddingService,
  ) {}

  async indexAllProperties() {
    try {
      this.logger.log('🚀 Starting property indexing...');

      // 1. Get all properties
      const properties = await this.db.query('SELECT * FROM properties');
      this.logger.log(`📊 Found ${properties.length} properties in database`);

      if (properties.length === 0) {
        this.logger.warn('⚠️ No properties found');
        return { indexed: 0, message: 'No properties found' };
      }

      // 2. Generate embeddings one by one
      const points: any[] = [];
      let successCount = 0;
      
      for (let i = 0; i < properties.length; i++) {
        const prop = properties[i];
        this.logger.log(`🔄 Processing ${i + 1}/${properties.length}: ${prop.title}`);
        
        // Create text for embedding
        const text = `${prop.title} ${prop.type} ${prop.price} ${prop.location} ${prop.university} ${prop.description || ''}`;

        try {
          this.logger.log(`📤 Generating embedding...`);
          const vector = await this.embedding.embedQuery(text);
          this.logger.log(`📥 Received embedding length: ${vector.length}`);
          
          points.push({
            id: prop.id,
            vector: vector,
            payload: {
              id: prop.id,
              title: prop.title,
              price: prop.price,
              location: prop.location,
              university: prop.university,
              description: prop.description || '',
              type: prop.type || '',
            },
          });
          successCount++;
          this.logger.log(`✅ Embedded ${i + 1}/${properties.length}: ${prop.title}`);
        } catch (err: any) {
          this.logger.error(`❌ Failed on ${prop.id}: ${err.message}`);
        }
      }

      this.logger.log(`📊 Successfully embedded ${successCount}/${properties.length} properties`);

      // 3. Upsert to Qdrant
      if (points.length > 0) {
        this.logger.log(`📤 Upserting ${points.length} points to Qdrant...`);
        await this.qdrant.upsertVectors(points);
        this.logger.log(`✅ Successfully indexed ${points.length} properties`);
        return { 
          indexed: points.length, 
          total: properties.length,
          message: `Successfully indexed ${points.length} properties` 
        };
      }

      return { 
        indexed: 0, 
        total: properties.length,
        message: 'No properties were indexed' 
      };
    } catch (error: any) {
      this.logger.error(`❌ Indexing failed: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  async clearIndex() {
    try {
      this.logger.log('🗑️ Clearing index...');
      await this.qdrant.deleteCollection('properties');
      await this.qdrant.ensureCollection();
      this.logger.log('✅ Index cleared successfully');
      return { message: 'Index cleared successfully' };
    } catch (error: any) {
      this.logger.error(`❌ Failed to clear index: ${error.message}`);
      throw error;
    }
  }
}