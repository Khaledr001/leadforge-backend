import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/** Extracts the authenticated Supabase user attached by the AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
