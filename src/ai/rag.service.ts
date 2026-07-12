import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';

interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  university: string;
  description: string;
  rating?: number;
  [key: string]: any;
}

// ✅ MAP YA VYUO NA MAENEO YAO KARIBU (ILIOSASISHWA KAMILI)
const UNIVERSITY_LOCATIONS: Record<string, string[]> = {
  'UDSM': [
    'Mlimani', 'Kijitonyama', 'Kinondoni', 'Mikocheni', 'Masaki', 
    'Oyster Bay', 'Ubungo', 'Mabibo', 'Changanyikeni', 'Makongo', 
    'Mpakani', 'Sinza', 'Mwenge'
  ],
  'ARU': [
    'Survey', 'Mlimani', 'Makongo', 'Changanyikeni', 'Mpakani', 
    'Mwenge', 'Goba', 'Ubungo', 'Sinza', 'Kijitonyama', 'Kinondoni', 'Mabibo'
  ],
  'MUHAS': [
    'Muhimbili', 'Kariakoo', 'Mchafukoge', 'Upanga', 'Posta', 
    'Kigamboni', 'Magomeni', 'Masaki'
  ],
  'DIT': [
    'Kijitonyama', 'Magomeni', 'Kinondoni', 'Oyster Bay', 'Masaki', 
    'Kariakoo', 'Upanga', 'Posta'
  ],
  'IFM': [
    'Posta', 'Magomeni', 'Kinondoni', 'Kigamboni', 'Mchafukoge', 
    'Kariakoo', 'Upanga', 'Masaki'
  ],
  'CBE': [
    'Temeke', 'Mbagala', 'Kariakoo', 'Mchafukoge', 'Posta', 'Upanga', 'Magomeni'
  ],
  'NIT': [
    'Mabibo', 'Ubungo', 'Kimara', 'Mikocheni', 'External', 
    'Sinza', 'Mwenge'
  ],
  'TIA': [
    'Mlimani', 'Kinondoni', 'Ubungo', 'Kimara', 'Mabibo', 'Sinza'
  ],
  'DUCE': [
    'Gongo la Mboto', 'Gongo', 'Mboto', 'Mlimani', 'Kijitonyama', 
    'Kinondoni', 'Ubungo'
  ],
};

const ALL_LOCATIONS = [
  'Kimara', 'Ubungo', 'Kinondoni', 'Mikocheni', 'Mlimani', 
  'Magomeni', 'Kijitonyama', 'Posta', 'Masaki', 'Oyster Bay', 
  'Kariakoo', 'Mchafukoge', 'Upanga', 'Muhimbili', 'Ardhi', 
  'Kigamboni', 'Mabibo', 'Changanyikeni', 'Makongo', 'Mpakani', 
  'Sinza', 'Mwenge', 'External', 'Gongo la Mboto', 'Gongo', 'Mboto',
  'Temeke', 'Mbagala', 'Survey', 'Goba'
];

// ✅ MUNICIPALITY MAP - Maeneo na Manispaa zake
const MUNICIPALITY_MAP: Record<string, string> = {
  // Kinondoni
  'Mlimani': 'Kinondoni',
  'Kijitonyama': 'Kinondoni',
  'Kinondoni': 'Kinondoni',
  'Mikocheni': 'Kinondoni',
  'Masaki': 'Kinondoni',
  'Oyster Bay': 'Kinondoni',
  'Survey': 'Kinondoni',
  // Ubungo
  'Ubungo': 'Ubungo',
  'Mabibo': 'Ubungo',
  'Changanyikeni': 'Ubungo',
  'Makongo': 'Ubungo',
  'Mpakani': 'Ubungo',
  'Sinza': 'Ubungo',
  'Mwenge': 'Ubungo',
  'Goba': 'Ubungo',
  'External': 'Ubungo',
  'Kimara': 'Ubungo',
  'Magomeni': 'Ubungo',
  // Ilala
  'Kariakoo': 'Ilala',
  'Mchafukoge': 'Ilala',
  'Upanga': 'Ilala',
  'Posta': 'Ilala',
  'Muhimbili': 'Ilala',
  // Temeke
  'Temeke': 'Temeke',
  'Mbagala': 'Temeke',
  'Gongo la Mboto': 'Temeke',
  'Gongo': 'Temeke',
  'Mboto': 'Temeke',
  // Kigamboni
  'Kigamboni': 'Kigamboni'
};

// ✅ Function ya kupata municipality
function getMunicipality(location: string): string {
  return MUNICIPALITY_MAP[location] || 'Unknown';
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly groqApiKey: string;
  private readonly groqBaseUrl: string;
  private readonly chatModel: string;
  private readonly temperature: number;
  private readonly maxTokens: number;

  constructor(
    private configService: ConfigService,
    private db: DatabaseService,
  ) {
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.groqBaseUrl = this.configService.get<string>('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1';
    this.chatModel = this.configService.get<string>('CHAT_MODEL') || 'llama-3.3-70b-versatile';
    this.temperature = parseFloat(this.configService.get<string>('TEMPERATURE') || '0.3');
    this.maxTokens = parseInt(this.configService.get<string>('MAX_TOKENS') || '1000', 10);

    console.log('===== RAG SERVICE INITIALIZED =====');
    console.log('🔑 API Key exists:', !!this.groqApiKey);
    console.log('📡 Chat Model:', this.chatModel);
    console.log('🎓 Universities mapped:', Object.keys(UNIVERSITY_LOCATIONS).length);
    console.log('📍 Total locations:', ALL_LOCATIONS.length);
    console.log('🏛️ Municipalities mapped:', Object.keys(MUNICIPALITY_MAP).length);
    console.log('===================================');
  }

  /**
   * Sort properties based on user's question
   */
  private sortProperties(properties: any[], question: string): any[] {
    const lowerQuestion = question.toLowerCase();
    let sorted = [...properties];

    if (lowerQuestion.includes('bei nafuu') || 
        lowerQuestion.includes('cheapest') ||
        lowerQuestion.includes('gharama ndogo') ||
        lowerQuestion.includes('nafuu')) {
      sorted = sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
      console.log('💰 Sorted by price: cheapest first');
    }
    else if (lowerQuestion.includes('bei kubwa') ||
             lowerQuestion.includes('gharama kubwa') ||
             lowerQuestion.includes('expensive')) {
      sorted = sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
      console.log('💰 Sorted by price: most expensive first');
    }
    else if (lowerQuestion.includes('rating') ||
             lowerQuestion.includes('ubora') ||
             lowerQuestion.includes('best') ||
             lowerQuestion.includes('bora')) {
      sorted = sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      console.log('⭐ Sorted by rating: highest first');
    }
    else if (lowerQuestion.includes('karibu') ||
             lowerQuestion.includes('near') ||
             lowerQuestion.includes('close')) {
      console.log('📍 Keeping location-based order');
    }

    return sorted;
  }

  async askQuestion(question: string, userId?: string): Promise<any> {
    console.log('===== RAG askQuestion() ENTERED =====');
    console.log('📝 Question:', question);

    const startTime = Date.now();

    try {
      // STEP 1: Identify university
      const universities = ['UDSM', 'ARU', 'MUHAS', 'DIT', 'IFM', 'CBE', 'TIA', 'DUCE', 'NIT'];
      let matchedUniversity: string | null = null;

      console.log('🔍 STEP 1: Searching for university...');
      for (const uni of universities) {
        if (question.toUpperCase().includes(uni) || question.toLowerCase().includes(uni.toLowerCase())) {
          matchedUniversity = uni;
          break;
        }
      }
      console.log('🎓 Matched university:', matchedUniversity || 'NONE');

      // STEP 2: Identify location
      let matchedLocation: string | null = null;
      console.log('🔍 STEP 2: Searching for location...');
      for (const loc of ALL_LOCATIONS) {
        if (question.toLowerCase().includes(loc.toLowerCase())) {
          matchedLocation = loc;
          break;
        }
      }
      console.log('📍 Matched location:', matchedLocation || 'NONE');

      // STEP 2.5: Get municipality if location found
      let matchedMunicipality: string | null = null;
      if (matchedLocation) {
        matchedMunicipality = getMunicipality(matchedLocation);
        console.log(`🏛️ Matched municipality: ${matchedMunicipality}`);
      }

      let properties: any[] = [];

      // STEP 3a: Search by university
      if (matchedUniversity && !matchedLocation) {
        const nearbyLocations = UNIVERSITY_LOCATIONS[matchedUniversity] || [];
        console.log(`🎓 Found university: ${matchedUniversity}, nearby: ${nearbyLocations.join(', ')}`);
        
        if (nearbyLocations.length > 0) {
          const placeholders = nearbyLocations.map(() => 'location LIKE ?').join(' OR ');
          const params = nearbyLocations.map(loc => `%${loc}%`);
          properties = await this.db.query(
            `SELECT * FROM properties WHERE (${placeholders}) LIMIT 15`,
            params
          );
          console.log(`📊 Found ${properties.length} properties near ${matchedUniversity}`);
        }
      }

      // STEP 3b: Search by location
      if (matchedLocation && properties.length === 0) {
        console.log(`📍 Searching by location: ${matchedLocation}`);
        properties = await this.db.query(
          'SELECT * FROM properties WHERE location LIKE ? LIMIT 15',
          [`%${matchedLocation}%`]
        );
        console.log(`📊 Found ${properties.length} properties in ${matchedLocation}`);
      }

      // STEP 3c: Price search
      if (properties.length === 0) {
        const priceMatch = question.match(/(\d{3,6})/);
        const targetPrice = priceMatch ? parseInt(priceMatch[1]) : null;
        if (targetPrice) {
          console.log(`💰 Searching by price: ${targetPrice}`);
          properties = await this.db.query(
            'SELECT * FROM properties WHERE price <= ? AND price >= ? LIMIT 15',
            [targetPrice * 1.5, targetPrice * 0.5]
          );
          console.log(`📊 Found ${properties.length} properties in price range`);
        }
      }

      // STEP 3d: Keyword search
      if (properties.length === 0) {
        console.log('🔍 Keyword search...');
        const searchTerms = question.split(' ').filter((word) => word.length > 2);
        if (searchTerms.length > 0) {
          const conditions: string[] = [];
          const params: any[] = [];
          searchTerms.forEach((term) => {
            conditions.push('title LIKE ?');
            params.push(`%${term}%`);
            conditions.push('description LIKE ?');
            params.push(`%${term}%`);
            conditions.push('location LIKE ?');
            params.push(`%${term}%`);
          });
          properties = await this.db.query(
            `SELECT * FROM properties WHERE ${conditions.join(' OR ')} LIMIT 15`,
            params
          );
          console.log(`📊 Found ${properties.length} properties by keywords`);
        }
      }

      // STEP 3e: Fallback
      if (properties.length === 0) {
        console.log('🔍 Loading all available...');
        properties = await this.db.query(
          "SELECT * FROM properties WHERE status = 'AVAILABLE' LIMIT 15",
          []
        );
        console.log(`📊 Found ${properties.length} total properties`);
      }

      // STEP 4: Sort properties
      properties = this.sortProperties(properties, question);
      console.log(`📊 Sorted ${properties.length} properties`);

      if (properties.length === 0) {
        console.log('⚠️ NO PROPERTIES FOUND → returning fallback');
        return this.getFallbackResponse(question);
      }

      console.log('📋 Properties found:');
      properties.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title} | TSh ${p.price} | ${p.location} | ⭐${p.rating || 'N/A'}`);
      });

      // Build context
      let context = '';
      const matchedProperties: any[] = [];
      for (const prop of properties) {
        matchedProperties.push(prop);
        const municipality = getMunicipality(prop.location);
        context += `
Property ${matchedProperties.length}:
- Title: ${prop.title || 'N/A'}
- Price: TSh ${prop.price || 'N/A'}
- Location: ${prop.location || 'N/A'} (${municipality})
- University: ${prop.university || 'N/A'}
- Rating: ⭐${prop.rating || 'N/A'}/5
- Description: ${prop.description || 'N/A'}
---`;
      }

      const systemPrompt = `
You are NyumbaSalama AI Assistant, a helpful AI for students looking for housing in Dar es Salaam.

Your role:
- Help students find suitable properties
- Provide honest information about properties
- Compare properties when asked
- Give advice on housing decisions
- Sort properties by price, rating, or location when asked
- When asked about municipality, tell the student which municipality the location is in

UNIVERSITY LOCATIONS MAP (use this to suggest areas):
- UDSM: Mlimani, Kijitonyama, Kinondoni, Mikocheni, Masaki, Oyster Bay, Ubungo, Mabibo, Changanyikeni, Makongo, Mpakani, Sinza, Mwenge
- ARU: Survey, Mlimani, Makongo, Changanyikeni, Mpakani, Mwenge, Goba, Ubungo, Sinza, Kijitonyama, Kinondoni, Mabibo
- MUHAS: Muhimbili, Kariakoo, Mchafukoge, Upanga, Posta, Kigamboni, Magomeni, Masaki
- DIT: Kijitonyama, Magomeni, Kinondoni, Oyster Bay, Masaki, Kariakoo, Upanga, Posta
- IFM: Posta, Magomeni, Kinondoni, Kigamboni, Mchafukoge, Kariakoo, Upanga, Masaki
- CBE: Temeke, Mbagala, Kariakoo, Mchafukoge, Posta, Upanga, Magomeni
- NIT: Mabibo, Ubungo, Kimara, Mikocheni, External, Sinza, Mwenge
- TIA: Mlimani, Kinondoni, Ubungo, Kimara, Mabibo, Sinza
- DUCE: Gongo la Mboto, Gongo, Mboto, Mlimani, Kijitonyama, Kinondoni, Ubungo

MUNICIPALITY MAP (use this when asked about municipality):
- Kinondoni: Mlimani, Kijitonyama, Kinondoni, Mikocheni, Masaki, Oyster Bay, Survey
- Ubungo: Ubungo, Mabibo, Changanyikeni, Makongo, Mpakani, Sinza, Mwenge, Goba, External, Kimara, Magomeni
- Ilala: Kariakoo, Mchafukoge, Upanga, Posta, Muhimbili
- Temeke: Temeke, Mbagala, Gongo la Mboto, Gongo, Mboto
- Kigamboni: Kigamboni

Guidelines:
- Use ONLY the provided property context
- If the context doesn't have enough information, say so honestly
- Be friendly and helpful
- Respond in Swahili or English based on the user's question
- Format prices with TSh prefix
- **When asked "Mabibo iko manispaa gani?" simply say "Mabibo iko Manispaa ya Ubungo"**

Context from properties:
${context}

User question: ${question}

Answer:
`;

      console.log('📤 Calling Groq API...');
      const response = await axios.post(
        `${this.groqBaseUrl}/chat/completions`,
        {
          model: this.chatModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );

      const responseTimeMs = Date.now() - startTime;
      console.log('✅ Groq API Response received in', responseTimeMs, 'ms');

      const answer = response.data?.choices?.[0]?.message?.content || 'No response from AI';

      if (userId) {
        await this.db.run(
          'INSERT INTO chat_messages (userId, role, content) VALUES (?, ?, ?)',
          [userId, 'user', question]
        );
        await this.db.run(
          'INSERT INTO chat_messages (userId, role, content) VALUES (?, ?, ?)',
          [userId, 'assistant', answer]
        );
      }

      return {
        response: answer,
        matchedProperties: matchedProperties,
        sources: matchedProperties.map((p: any) => ({ id: p.id, title: p.title, score: 1 })),
        confidence: matchedProperties.length > 0 ? 0.8 : 0,
        responseTimeMs: responseTimeMs,
        model: this.chatModel,
        aiMode: true,
      };

    } catch (error: any) {
      console.error('❌ RAG Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      return this.getFallbackResponse(question);
    }
  }

  private getFallbackResponse(question: string): any {
    return {
      response: "I'm here to help you find accommodation near universities in Dar es Salaam! Try asking about rooms near UDSM, ARU, MUHAS, DIT, or any other university. You can also ask about prices, amenities, or specific areas.",
      matchedProperties: [],
      sources: [],
      confidence: 0,
      responseTimeMs: 0,
      model: 'fallback',
      aiMode: false,
    };
  }

  async getHistory(userId: string) {
    return this.db.query(
      'SELECT * FROM chat_messages WHERE userId = ? ORDER BY createdAt DESC LIMIT 50',
      [userId],
    );
  }

  async clearHistory(userId: string) {
    await this.db.run('DELETE FROM chat_messages WHERE userId = ?', [userId]);
    return { message: 'History cleared' };
  }
}