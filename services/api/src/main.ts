import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

const PORT = 4000;

// Every micro-frontend calls the API from its own dev origin. The auth cookies are not port-scoped, and
// cross-origin requests carry them only with `credentials: 'include'` + Access-Control-Allow-Credentials.
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: DEV_ORIGINS, credentials: true });
  await app.listen(PORT);
}

void bootstrap();
