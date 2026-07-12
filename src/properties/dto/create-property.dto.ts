import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsEnum,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { DAR_ES_SALAAM_UNIVERSITIES } from '../../common/constants/university.constants';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(['SINGLE_ROOM', 'SHARED_ROOM', 'STUDIO', 'APARTMENT', 'FULL_HOUSE'])
  type: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  area: string;

  @IsEnum(DAR_ES_SALAAM_UNIVERSITIES)
  university: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  amenities: string[];

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
