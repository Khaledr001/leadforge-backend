import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';

/** Express request augmented with the authenticated Supabase user. */
export interface AuthenticatedRequest extends Request {
  user?: User;
}
