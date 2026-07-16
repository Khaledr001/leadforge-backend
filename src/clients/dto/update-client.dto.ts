import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ClientPlan } from '@prisma/client';

export class UpdateClientDto {
  @IsOptional()
  @IsEnum(ClientPlan)
  plan?: ClientPlan;

  @IsOptional()
  @IsInt()
  @Min(0)
  mrr?: number;
}
