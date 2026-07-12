import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  DAR_ES_SALAAM_UNIVERSITIES,
  UNIVERSITY_LABELS,
  UNIVERSITY_KEYWORDS,
} from '../common/constants/university.constants';

interface PropertyResult {
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
  agentId: string;
  agentName: string;
  agentPhone: string;
}

@Injectable()
export class ChatbotService {
  constructor(private db: DatabaseService) {}

  async getRecommendations(query: {
    university?: string;
    minPrice?: number;
    maxPrice?: number;
    type?: string;
  }) {
    const conditions: string[] = ['status = ?'];
    const params: unknown[] = ['AVAILABLE'];

    if (query.university && query.university !== 'BOTH') {
      conditions.push('(university = ? OR university = ?)');
      params.push(query.university, 'BOTH');
    }
    if (query.minPrice) {
      conditions.push('price >= ?');
      params.push(query.minPrice);
    }
    if (query.maxPrice) {
      conditions.push('price <= ?');
      params.push(query.maxPrice);
    }
    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }

    const properties = await this.db.query<PropertyResult>(
      `SELECT p.*, u.name as agentName, u.phone as agentPhone
       FROM properties p JOIN users u ON p.agentId = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY p.rating DESC LIMIT 5`,
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
    const properties = await this.db.query<PropertyResult>(
      `SELECT p.*, u.name as agentName FROM properties p JOIN users u ON p.agentId = u.id WHERE p.id IN (${placeholders})`,
      ids,
    );

    return {
      comparison: properties.map((p) => ({
        title: p.title,
        price: p.price,
        location: p.location,
        type: p.type,
        rating: p.rating,
        amenities: p.amenities,
        agent: p.agentName,
      })),
    };
  }

  async answerQuestion(question: string) {
    const q = question.toLowerCase();
    let response = "Habari! I'm NyumbaSalama, here to help you find accommodation near universities in Dar es Salaam. You can ask me about:\n\n";
    response += "- Rooms near specific universities (UDSM, ARU, MUHAS, DIT, etc.)\n";
    response += "- Prices and budget advice\n";
    response += "- Safety and verified properties\n";
    response += "- Amenities (WiFi, private bathroom, kitchen)\n";
    response += "- Room types (Single, Shared, Studio, Apartment)\n\n";
    response += "What area or university are you interested in?";

    const detectedUni = this.detectUniversity(q);
    if (detectedUni) {
      const label = UNIVERSITY_LABELS[detectedUni] || detectedUni;
      const props = await this.db.query(
        `SELECT * FROM properties WHERE status = 'AVAILABLE' AND (university = ? OR university = 'BOTH') ORDER BY price ASC LIMIT 5`,
        [detectedUni],
      );
      if (props.length > 0) {
        response = `Found ${props.length} available properties near ${label}.\n\n`;
        props.forEach((p: PropertyResult, i: number) => {
          response += `${i + 1}. ${p.title} - TSh ${Number(p.price).toLocaleString()}/month (${p.location}, ${p.area})\n`;
        });
        response += `\nPrices range from TSh ${Number(props[0].price).toLocaleString()} to TSh ${Number(props[props.length - 1].price).toLocaleString()}. Check our homepage to see all options with the university filter.`;
      } else {
        response = `I couldn't find properties specifically for ${label} right now. Try broadening your search or checking back later. Properties marked for "All Universities" might also be suitable.`;
      }
    }

    if (q.includes('cheap') || q.includes('budget') || q.includes('bei nafuu') || q.match(/under\s*\d+/)) {
      const cheapest = await this.db.queryOne<{ price: number }>(
        "SELECT price FROM properties WHERE status = 'AVAILABLE' ORDER BY price ASC LIMIT 1",
        [],
      );
      response = `The cheapest available property is ${cheapest ? `TSh ${Number(cheapest.price).toLocaleString()}/month` : 'around TSh 50,000/month'}.\n\n`;
      response += "Budget tips for students:\n";
      response += "- Single rooms: TSh 50,000-150,000/month\n";
      response += "- Shared rooms: TSh 80,000-200,000/month\n";
      response += "- Look for areas with good Daladala connections\n";
      response += "- Use the price filter on our homepage to find what fits your budget";
    }

    if (q.includes('safe') || q.includes('verified') || q.includes('security') || q.includes('usalama')) {
      const verified = await this.db.query(
        "SELECT COUNT(*) as count FROM properties WHERE status = 'AVAILABLE' AND rating >= 4",
        [],
      );
      response = `Safety is a top priority at NyumbaSalama! We have ${verified[0]?.count || 'many'} highly-rated (4+ stars) properties available.\n\n`;
      response += "Tips for finding safe accommodation:\n";
      response += "- Look for properties with high ratings and reviews\n";
      response += "- Check if the property has security (Usalama) listed in amenities\n";
      response += "- Watch property video tours to see the actual environment\n";
      response += "- Consider popular student areas like Mlimani and Ardhi";
    }

    return { response };
  }

  async saveMessage(userId: string, content: string, role: string) {
    const id = this.db.generateId();
    await this.db.run(
      'INSERT INTO chat_messages (id, role, content, userId) VALUES (?, ?, ?, ?)',
      [id, role, content, userId],
    );
    return this.db.queryOne('SELECT * FROM chat_messages WHERE id = ?', [id]);
  }

  async getChatHistory(userId: string) {
    return this.db.query(
      'SELECT * FROM chat_messages WHERE userId = ? ORDER BY createdAt ASC LIMIT 50',
      [userId],
    );
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
