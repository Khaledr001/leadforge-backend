import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ScraperMode } from '../interfaces/scraper-provider.interface';

export class ScrapeRequestDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  maxResults: number = 20;

  @IsOptional()
  @IsIn(['api', 'outscraper'])
  mode: ScraperMode = 'api';
}
