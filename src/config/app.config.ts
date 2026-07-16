import { registerAs } from '@nestjs/config';
import { join } from 'node:path';

/** Core application config namespace: `app.*`. */
export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT ?? '3001', 10),
  apiUrl: process.env.API_BASE_URL ?? 'http://localhost:3001',
  dashboardUrl: process.env.DASHBOARD_URL ?? 'http://localhost:3000',
  templatesDir: process.env.TEMPLATES_DIR ?? join(process.cwd(), 'templates'),
}));
