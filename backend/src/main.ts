import * as dotenv from 'dotenv';
dotenv.config({ override: true });
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
] as const;

function validateEnv(logger: Logger) {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    logger.error(
      `Faltan variables de entorno requeridas: ${missing.join(', ')}. ` +
        'Configúralas en backend/.env (local) o en el panel de Railway (producción).',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  validateEnv(logger);

  const app = await NestFactory.create(AppModule);

  // Security headers
  app.use(helmet());

  // CORS
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global error mapping (BD → 4xx, sin stack traces expuestos)
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global API prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`🚀 IDEA UNO OS Backend running on http://localhost:${port}/api`);
  logger.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
