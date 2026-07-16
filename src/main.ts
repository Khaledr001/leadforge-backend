import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // No enableImplicitConversion: it coerces booleans from query strings
      // incorrectly ("false" -> true). Numeric fields use explicit @Type().
    }),
  );

  const dashboardUrl =
    config.get<string>('app.dashboardUrl') ?? 'http://localhost:3000';
  app.enableCors({ origin: dashboardUrl, credentials: true });
  app.enableShutdownHooks();

  const port = config.get<number>('app.port') ?? 3001;
  await app.listen(port);

  app.get(Logger).log(`LeadForge API listening on http://localhost:${port}`);
}

void bootstrap();
