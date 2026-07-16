import { IsUUID } from 'class-validator';

export class GenerateSiteDto {
  @IsUUID()
  leadId!: string;
}
