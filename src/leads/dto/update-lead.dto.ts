import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { LeadStatus } from '@prisma/client';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;
}
