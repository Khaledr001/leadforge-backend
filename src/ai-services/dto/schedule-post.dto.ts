import { IsDateString, IsUUID } from 'class-validator';

export class SchedulePostDto {
  @IsUUID()
  postId!: string;

  @IsDateString()
  scheduledFor!: string;
}
