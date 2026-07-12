import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { RagService } from '../ai/rag.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('chatbot')  // ✅ Badilisha kutoka 'api/chatbot' kwenda 'chatbot'
export class ChatbotController {
  constructor(
    private aiService: AiService,
    private ragService: RagService,
  ) {}

  @Post('index')
  async indexProperties() {
    return this.aiService.indexProperties();
  }

  @Post('ask')
  @UseGuards(JwtAuthGuard)
  async askQuestion(
    @GetUser('id') userId: string,
    @Body('question') question: string,
  ) {
    console.log('📝 ChatbotController - askQuestion called');
    console.log('📝 Question:', question);
    console.log('📝 UserId:', userId);
    
    return this.ragService.askQuestion(question, userId);
  }

  @Post('recommend')
  @UseGuards(JwtAuthGuard)
  async getRecommendations(
    @Body() query: { university?: string; minPrice?: number; maxPrice?: number; type?: string },
  ) {
    return this.aiService.getRecommendations(query);
  }

  @Post('compare')
  @UseGuards(JwtAuthGuard)
  async compareProperties(@Body('ids') ids: string[]) {
    return this.aiService.compareProperties(ids);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getChatHistory(@GetUser('id') userId: string) {
    return this.ragService.getHistory(userId);
  }

  @Delete('history')
  @UseGuards(JwtAuthGuard)
  async clearChatHistory(@GetUser('id') userId: string) {
    return this.ragService.clearHistory(userId);
  }
}