import { registerAs } from '@nestjs/config';

/**
 * Database / Supabase config namespace: `database.*`.
 *
 * `url` (DATABASE_URL) is consumed directly by Prisma via env. The Supabase
 * values are used by the AuthGuard to validate JWTs (optional in local dev).
 */
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
}));
