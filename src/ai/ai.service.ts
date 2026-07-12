import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { DatabaseService } from '../database/database.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { EmbeddingService } from './embedding.service';
import {
  DAR_ES_SALAAM_UNIVERSITIES,
  UNIVERSITY_KEYWORDS,
  UNIVERSITY_LABELS,
} from '../common/constants/university.constants';

interface ChatMemoryEntry {
  userId: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  propertyIds: string[];
}

interface PropertyDocument {
  id: string;
  title: string;
  type: string;
  price: number;
  location: string;
  area: string;
  university: string;
  description: string;
  amenities: string;
  rating: number;
  reviewCount: number;
  status: string;
  latitude: number;
  longitude: number;
  district?: string;
  ward?: string;
}

const AI_SYSTEM_PROMPT = `You are NyumbaSalama AI, an intelligent housing assistant specifically designed to help university students find safe and affordable accommodation in Dar es Salaam, Tanzania.

IDENTITY:
- Name: NyumbaSalama AI
- Purpose: Help students find verified housing near their university
- Personality: Friendly, helpful, professional, and understanding like a trusted Tanzanian elder sibling

CORE RULES:
1. NEVER hallucinate or invent information about properties, prices, or landlords
2. ONLY answer using information retrieved from the property database provided in the context
3. If no properties match the query, honestly say so and suggest broadening the search
4. NEVER invent prices - only mention prices from retrieved documents
5. NEVER invent landlord names or contact information
6. ALWAYS recommend verified listings when available
7. If you don't know something, say "Nafuta, sielewi vizuri. Unaweza kutafuta tena?" (or similar in the user's language)

RESPONSE FORMAT:
When recommending properties, ALWAYS include:
- Property title
- Rent (in TSh/month)
- Location (area and university proximity)
- Key amenities
- When available, mention if verified

LANGUAGES:
- Support Swahili (Tanzanian Swahili)
- Support English
- Support mixed Swahili-English (common in Dar es Salaam)
- Respond in the same language the student uses

UNIVERSITIES IN DAR ES SALAAM:
- UDSM: University of Dar es Salaam (Mlimani area)
- ARU: Ardhi University (Ardhi/Observatory area)
- MUHAS: Muhimbili University of Health and Allied Sciences (Upanga/Ilala area)
- DIT: Dar es Salaam Institute of Technology (city center)
- CBE: College of Business Education (Mchikichini/Ilala area)
- IFM: Institute of Finance Management (Shaaban Robert Street, city center)
- DUCE: Dar es Salaam University College of Education (Chang'ombe area)
- TIA: Tanzania Institute of Accountancy (city center)
- NIT: National Institute of Transport (Mabibo area)
- OUT: Open University of Tanzania (Kawawa Road)
- SJUIT: St Joseph University Tanzania (Mbezi area)
- KIU: Kampala International University Dar Campus (Gongo la Mboto area)
- MNMA: Mwalimu Nyerere Memorial Academy (Kivukoni area)
- UoB: University of Bagamoyo Dar Campus (city center)

IMPORTANT GUIDELINES:
- Prices in TSh (Tanzanian Shillings)
- Typical student budget: TSh 50,000 - TSh 300,000/month
- Single rooms: ~TSh 50,000 - 150,000
- Shared rooms: ~TSh 80,000 - 200,000
- Studios/Apartments: ~TSh 200,000 - 450,000+
- Always mention if transport (Daladala, Bajaji) is available nearby
- Consider safety and security when recommending
- If asked about specific amenities (WiFi, private bathroom, kitchen), highlight properties that have them
- Be concise - 2-4 sentences for simple answers, longer for detailed listings
- Show enthusiasm when finding good matches`;

const FALLBACK_RESPONSES: Record<string, string> = {
  general: "I'm here to help you find accommodation near universities in Dar es Salaam! Try asking about rooms near UDSM, ARU, MUHAS, DIT, or any other university. You can also ask about prices, amenities, or specific areas.",
  budget: "Student budgets typically range from TSh 50,000 to TSh 300,000 per month. Single rooms start around TSh 50,000, shared rooms around TSh 80,000, and studios from TSh 200,000. For the most affordable options, try areas with good Daladala connections to your university.",
  safety: "Safety is our priority at NyumbaSalama! Look for properties marked as 'verified' on our platform. We recommend areas like Mlimani, Ardhi, and Kijitonyama which are popular student areas with good security.",
  features: "When looking for student housing, consider: location (walking distance or good transport), amenities (Umeme, Maji, WiFi), room type (Single/Shared), and budget. You can filter by all these on our homepage!",
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly token: string;
  private readonly conversationStore = new Map<string, ChatMemoryEntry>();
  private readonly MAX_MEMORY_MESSAGES = 10;
  private aiAvailable = true;

  constructor(
    private db: DatabaseService,
    private qdrant: QdrantService,
    private embeddings: EmbeddingService,
  ) {
    this.token = process.env.GITHUB_TOKEN || process.env.OPENAI_API_KEY || '';
    if (!this.token) {
      this.logger.warn('No GITHUB_TOKEN or OPENAI_API_KEY set. AI features disabled.');
      this.aiAvailable = false;
    }
  }

  async indexProperties(): Promise<{ indexed: number; message: string }> {
    this.logger.log('Starting property indexing...');
    const properties: PropertyDocument[] = await this.db.query(
      "SELECT * FROM properties WHERE status = 'AVAILABLE'",
      [],
    );

    if (properties.length === 0) {
      return { indexed: 0, message: 'No available properties to index' };
    }

    if (!this.embeddings.isAvailable) {
      this.logger.error('Embedding service not available - no API token configured');
      return { indexed: 0, message: 'Embedding service unavailable - no API token' };
    }

    const qdrantHealthy = await this.qdrant.healthCheck();
    if (qdrantHealthy.status !== 'healthy') {
      return { indexed: 0, message: 'Qdrant is not healthy. Please ensure Qdrant is running.' };
    }

    await this.qdrant.ensureCollection();

    const texts = properties.map((p) => this.buildPropertyText(p));
    const vectors = await this.embeddings.embedBatch(texts);

    const points = properties.map((p, i) => ({
      id: p.id,
      vector: vectors[i],
      payload: {
        propertyId: p.id,
        title: p.title,
        type: p.type,
        price: p.price,
        location: p.location,
        area: p.area,
        university: p.university,
        universityLabel: UNIVERSITY_LABELS[p.university] || p.university,
        description: p.description,
        amenities: p.amenities,
        rating: p.rating,
        reviewCount: p.reviewCount,
        status: p.status,
        latitude: p.latitude,
        longitude: p.longitude,
      },
    }));

    try {
      await this.qdrant.upsertBatch(points);
      this.logger.log(`Indexed ${points.length} properties successfully`);
      return {
        indexed: points.length,
        message: `Successfully indexed ${points.length} properties`,
      };
    } catch (error) {
      this.logger.error('Failed to upload vectors to Qdrant', error);
      return { indexed: 0, message: 'Failed to upload vectors to Qdrant' };
    }
  }

  async askQuestion(
    question: string,
    userId: string,
  ): Promise<{
    response: string;
    matchedProperties: Array<Record<string, unknown>>;
    sources: Array<Record<string, unknown>>;
    confidence: number;
    responseTimeMs: number;
    model: string;
    aiMode: boolean;
  }> {
    const startTime = Date.now();
    this.logger.log(`Question from ${userId}: "${question.substring(0, 100)}"`);

    await this.saveMessage(userId, question, 'user');
    const memory = this.getOrCreateMemory(userId);
    memory.messages.push({ role: 'user', content: question });

    try {
      const qdrantHealthy = (await this.qdrant.healthCheck()).status === 'healthy';
      const aiEnabled = this.aiAvailable && this.embeddings.isAvailable && qdrantHealthy;

      if (!aiEnabled) {
        const fallback = this.getFallbackResponse(question, memory);
        await this.saveMessage(userId, fallback, 'assistant');
        memory.messages.push({ role: 'assistant', content: fallback });
        return {
          response: fallback,
          matchedProperties: [],
          sources: [],
          confidence: 0,
          responseTimeMs: Date.now() - startTime,
          model: 'fallback',
          aiMode: false,
        };
      }

      const questionEmbedding = await this.embeddings.embedQuery(question);

      let searchResults: Array<{ id: string | number; score: number; payload: Record<string, unknown> }> = [];
      try {
        const topK = parseInt(process.env.TOP_K || '5', 10);
        searchResults = await this.qdrant.searchVectors(questionEmbedding, topK);
      } catch (error) {
        this.logger.warn('Qdrant search failed, proceeding without context', error);
      }

      const matchedProperties = searchResults.map((r) => ({
        ...r.payload,
        score: r.score,
      }));

      const highestScore = searchResults.length > 0 ? searchResults[0].score : 0;
      const confidence = Math.min(1, highestScore);

      const context = this.buildRagContext(searchResults);

      const recentHistory = memory.messages.slice(-6);
      const historyText = recentHistory
        .map((m) => `${m.role === 'user' ? 'Student' : 'NyumbaSalama AI'}: ${m.content}`)
        .join('\n');

      const systemPrompt = `${AI_SYSTEM_PROMPT}

${context}

RECENT CONVERSATION:
${historyText || '(No previous messages)'}

IMPORTANT: You must ONLY use the property information provided above. If the student asks about something not in the context, admit you don't have that information and suggest they browse the website or try a different search query. Always be concise and helpful.`;

      const temperature = parseFloat(process.env.TEMPERATURE || '0.3');
      const maxTokens = parseInt(process.env.MAX_TOKENS || '1000', 10);
      const chatModel = process.env.CHAT_MODEL || 'openai/gpt-4o';

      const response = await axios.post(
        'https://models.github.ai/inference',
        {
          model: chatModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          temperature,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const answer =
        response.data?.choices?.[0]?.message?.content ||
        this.getFallbackResponse(question, memory);

      await this.saveMessage(userId, answer, 'assistant');
      memory.messages.push({ role: 'assistant', content: answer });

      const sources = searchResults.map((r) => ({
        id: r.payload.propertyId,
        title: r.payload.title,
        score: r.score,
      }));

      return {
        response: answer,
        matchedProperties,
        sources,
        confidence,
        responseTimeMs: Date.now() - startTime,
        model: chatModel,
        aiMode: true,
      };
    } catch (error) {
      this.logger.error('AI query failed', error);
      this.aiAvailable = false;

      const fallback = this.getFallbackResponse(question, memory);
      await this.saveMessage(userId, fallback, 'assistant');
      memory.messages.push({ role: 'assistant', content: fallback });

      return {
        response: fallback,
        matchedProperties: [],
        sources: [],
        confidence: 0,
        responseTimeMs: Date.now() - startTime,
        model: 'fallback',
        aiMode: false,
      };
    }
  }

  async getRecommendations(query: {
    university?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: string;
  }) {
    const conditions: string[] = ["status = 'AVAILABLE'"];
    const params: unknown[] = [];

    if (query.university && query.university !== 'BOTH') {
      conditions.push('(university = ? OR university = ?)');
      params.push(query.university, 'BOTH');
    }
    if (query.minPrice) {
      conditions.push('price >= ?');
      params.push(Number(query.minPrice));
    }
    if (query.maxPrice) {
      conditions.push('price <= ?');
      params.push(Number(query.maxPrice));
    }
    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }

    const properties = await this.db.query(
      `SELECT * FROM properties WHERE ${conditions.join(' AND ')} ORDER BY rating DESC LIMIT 5`,
      params,
    );

    return {
      recommendations: properties,
      message: `Found ${properties.length} properties matching your criteria`,
    };
  }

  async compareProperties(ids: string[]) {
    if (!ids || ids.length < 2) {
      return { message: 'Please provide at least 2 property IDs to compare' };
    }

    const placeholders = ids.map(() => '?').join(',');
    const properties = await this.db.query(
      `SELECT * FROM properties WHERE id IN (${placeholders})`,
      ids,
    );

    return {
      comparison: properties.map((p: PropertyDocument) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        location: p.location,
        type: p.type,
        rating: p.rating,
        amenities: p.amenities,
        description: p.description,
        university: p.university,
      })),
    };
  }

  async getHistory(userId: string) {
    return this.db.query(
      'SELECT * FROM chat_messages WHERE userId = ? ORDER BY createdAt ASC LIMIT 50',
      [userId],
    );
  }

  async clearHistory(userId: string) {
    await this.db.run('DELETE FROM chat_messages WHERE userId = ?', [userId]);
    this.conversationStore.delete(userId);
    return { message: 'Chat history cleared' };
  }

  private async saveMessage(userId: string, content: string, role: string) {
    const id = this.db.generateId();
    await this.db.run(
      'INSERT INTO chat_messages (id, role, content, userId) VALUES (?, ?, ?, ?)',
      [id, role, content, userId],
    );
  }

  private getOrCreateMemory(userId: string): ChatMemoryEntry {
    if (!this.conversationStore.has(userId)) {
      this.conversationStore.set(userId, {
        userId,
        messages: [],
        propertyIds: [],
      });
    }
    return this.conversationStore.get(userId)!;
  }

  private buildPropertyText(property: PropertyDocument): string {
    const parts = [
      `Property: ${property.title}`,
      `Type: ${property.type}`,
      `Rent: TSh ${Number(property.price).toLocaleString()} per month`,
      `Location: ${property.location}, ${property.area}`,
      `University: ${UNIVERSITY_LABELS[property.university] || property.university}`,
      `Description: ${property.description}`,
      `Amenities: ${property.amenities || 'Not specified'}`,
      `Rating: ${property.rating}/5 from ${property.reviewCount} reviews`,
    ];

    if (property.latitude && property.longitude) {
      parts.push(`Coordinates: ${property.latitude}, ${property.longitude}`);
    }

    return parts.join('. ');
  }

  private buildRagContext(
    searchResults: Array<{ id: string | number; score: number; payload: Record<string, unknown> }>,
  ): string {
    if (searchResults.length === 0) {
      return 'NO MATCHING PROPERTIES FOUND IN DATABASE.\nYou can still help by suggesting the student refine their search criteria or browse the website. Never invent properties or prices.';
    }

    let context = 'RETRIEVED PROPERTIES FROM DATABASE (use ONLY these):\n\n';

    searchResults.forEach((r, i) => {
      const p = r.payload;
      context += `--- Property ${i + 1} (Relevance: ${(r.score * 100).toFixed(0)}%) ---\n`;
      context += `ID: ${p.propertyId}\n`;
      context += `Title: ${p.title}\n`;
      context += `Type: ${p.type}\n`;
      context += `Price: TSh ${Number(p.price).toLocaleString()}/month\n`;
      context += `Location: ${p.location}, ${p.area}\n`;
      context += `University: ${UNIVERSITY_LABELS[p.university as string] || p.university}\n`;
      context += `Description: ${p.description}\n`;
      context += `Amenities: ${p.amenities}\n`;
      context += `Rating: ${p.rating}/5 (${p.reviewCount} reviews)\n`;
      if (p.latitude && p.longitude) {
        context += `Coordinates: ${p.latitude}, ${p.longitude}\n`;
      }
      context += '\n';
    });

    context += '--- END OF PROPERTY DATA ---\n';
    context += 'You must ONLY use the above property data to answer. Do not fabricate any property information.\n';

    return context;
  }

  private getFallbackResponse(question: string, memory: ChatMemoryEntry): string {
    const q = question.toLowerCase().trim();

    if (q.length < 3) {
      return FALLBACK_RESPONSES.general;
    }

    const detectedUniversity = this.detectUniversity(q);
    if (detectedUniversity) {
      const label = UNIVERSITY_LABELS[detectedUniversity] || detectedUniversity;
      return `You're asking about accommodation near ${label}. ${
        this.aiAvailable
          ? 'AI is temporarily unavailable. Please try browsing properties on the homepage with the university filter, or try asking again shortly.'
          : 'Please use the search filters on our homepage to find properties near ' + label + '. You can filter by university, price range, and room type.'
      }`;
    }

    if (
      q.includes('cheap') ||
      q.includes('budget') ||
      q.match(/under\s*\d+/) ||
      q.includes('affordable') ||
      q.includes('bei nafuu') ||
      q.match(/\d{4,6}/)
    ) {
      return FALLBACK_RESPONSES.budget;
    }

    if (
      q.includes('safe') ||
      q.includes('security') ||
      q.includes('verified') ||
      q.includes('usalama') ||
      q.includes('salama') ||
      q.includes('trust')
    ) {
      return FALLBACK_RESPONSES.safety;
    }

    if (
      q.includes('wifi') ||
      q.includes('bathroom') ||
      q.includes('amenities') ||
      q.includes('features') ||
      q.includes('bafu') ||
      q.includes('single') ||
      q.includes('shared') ||
      q.includes('studio')
    ) {
      return FALLBACK_RESPONSES.features;
    }

    return FALLBACK_RESPONSES.general;
  }

  private detectUniversity(text: string): string | null {
    const lower = text.toLowerCase();
    for (const uniCode of DAR_ES_SALAAM_UNIVERSITIES) {
      if (uniCode === 'BOTH') continue;
      const keywords = UNIVERSITY_KEYWORDS[uniCode] || [];
      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          return uniCode;
        }
      }
    }
    return null;
  }
}
