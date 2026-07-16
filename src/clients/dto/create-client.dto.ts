import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ClientPlan } from '@prisma/client';

export class CreateClientDto {
  @IsUUID()
  leadId!: string;

  @IsEnum(ClientPlan)
  plan!: ClientPlan;

  @IsOptional()
  @IsInt()
  @Min(0)
  mrr?: number;
}
