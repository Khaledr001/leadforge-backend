import { IsUUID } from 'class-validator';

export class CancelSubscriptionDto {
  @IsUUID()
  clientId!: string;
}
