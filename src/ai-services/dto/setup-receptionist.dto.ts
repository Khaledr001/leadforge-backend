import { IsUUID } from 'class-validator';

export class SetupReceptionistDto {
  @IsUUID()
  clientId!: string;
}
