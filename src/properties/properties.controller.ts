import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { SearchPropertyDto } from './dto/search-property.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get()
  findAll(@Query() query: SearchPropertyDto) {
    return this.propertiesService.findAll(query);
  }

  @Get('university/:university')
  findByUniversity(@Param('university') university: string) {
    return this.propertiesService.findByUniversity(university);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.propertiesService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@GetUser('id') userId: string, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.create(userId, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @GetUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePropertyDto>,
  ) {
    return this.propertiesService.update(id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@GetUser('id') userId: string, @Param('id') id: string) {
    return this.propertiesService.remove(id, userId);
  }
}
