import { IsEnum, IsUUID } from 'class-validator';
import { ClientPlan } from '@prisma/client';

export class CreateCheckoutDto {
  @IsUUID()
  leadId!: string;

  @IsEnum(ClientPlan)
  plan!: ClientPlan;
}
