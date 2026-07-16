import { IsUUID } from 'class-validator';

export class EnrichLeadDto {
  @IsUUID()
  leadId!: string;
}
