import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly groqApiKey: string;
  private readonly groqBaseUrl: string;
  private readonly model: string;
  private readonly useMockEmbeddings: boolean;

  constructor(private configService: ConfigService) {
    // ✅ Soma Groq API key
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.groqBaseUrl = this.configService.get<string>('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1';
    this.model = this.configService.get<string>('EMBEDDING_MODEL') || 'text-embedding-3-small';
    
    // ✅ Kwa kuwa Groq haisupport embeddings, tutatumia mock
    this.useMockEmbeddings = true;
    
    console.log('🔍 EmbeddingService initialized');
    console.log('📝 Groq API Key exists:', !!this.groqApiKey);
    console.log('📝 Using mock embeddings:', this.useMockEmbeddings);
    console.log('📝 Model:', this.model);
    console.log('📝 Base URL:', this.groqBaseUrl);
    
    if (!this.groqApiKey) {
      this.logger.warn('❌ No GROQ_API_KEY set. Embeddings will use mock data.');
    } else {
      this.logger.log('✅ GROQ_API_KEY loaded successfully');
    }
  }

  get isAvailable(): boolean {
    return !!this.groqApiKey;
  }

  /**
   * Generate embedding for a single text
   * Kwa kuwa Groq haisupport embeddings, tunatumia mock data
   */
  async embedQuery(text: string): Promise<number[]> {
    this.logger.log(`📤 Embedding query: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // ✅ Mock embedding - vector ya 1536 dimensions
    // Hii inafanya kazi kwa majaribio na RAG system
    const mockEmbedding = new Array(1536).fill(0.1);
    
    // Ongeza random small variation ili embeddings ziwe tofauti kidogo
    for (let i = 0; i < mockEmbedding.length; i++) {
      mockEmbedding[i] = 0.1 + (Math.random() * 0.01);
    }
    
    this.logger.log(`📥 Mock embedding generated: ${mockEmbedding.length} dimensions`);
    return mockEmbedding;
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    this.logger.log(`📤 Embedding ${texts.length} documents (using mock)`);
    
    const results: number[][] = [];
    for (const text of texts) {
      const embedding = await this.embedQuery(text);
      results.push(embedding);
    }
    
    this.logger.log(`✅ Generated ${results.length} mock embeddings`);
    return results;
  }

  /**
   * Generate embeddings in batches
   */
  async embedBatch(texts: string[], batchSize: number = 100): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      this.logger.log(`📤 Processing batch ${Math.floor(i / batchSize) + 1}: ${batch.length} texts`);
      const batchResults = await this.embedDocuments(batch);
      results.push(...batchResults);
    }
    this.logger.log(`✅ Completed ${results.length} embeddings`);
    return results;
  }

  /**
   * Try to use Groq for embeddings (if they ever support it)
   */
  private async callGroqEmbeddingApi(input: string | string[]): Promise<number[][]> {
    if (!this.groqApiKey) {
      throw new Error('No Groq API key available');
    }

    try {
      const response = await axios.post(
        `${this.groqBaseUrl}/embeddings`,
        { 
          model: this.model, 
          input: input 
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const data = response.data?.data;
      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((item: { embedding?: number[] }) => item.embedding || []);
    } catch (error: any) {
      this.logger.error(`Groq embedding API error: ${error.message}`);
      throw error;
    }
  }
}