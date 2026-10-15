import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const PORT = 4000;

// Every micro-frontend calls the API from its own dev origin. Cookies are not port-scoped, so
// credentials are allowed now for the auth cookie in iteration 08.
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: DEV_ORIGINS, credentials: true });
  await app.listen(PORT);
}

void bootstrap();
