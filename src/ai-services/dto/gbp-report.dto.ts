import { IsUUID } from 'class-validator';

export class GbpReportDto {
  @IsUUID()
  clientId!: string;
}
