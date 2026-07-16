import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { SocialPlatform } from '@prisma/client';

export class GenerateSocialDto {
  @IsUUID()
  clientId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  count!: number;

  @IsEnum(SocialPlatform)
  platform!: SocialPlatform;
}
