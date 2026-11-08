import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  process.env.TZ = process.env.APP_TIMEZONE || 'UTC';
  // rawBody: el webhook de Stripe verifica su firma sobre el cuerpo tal como llegó.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Comprobantes de pago y QR viajan en base64 dentro del JSON (máx. 3 MB de archivo).
  app.useBodyParser('json', { limit: '6mb' });
  app.use(helmet());

  const configuredOrigins = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: configuredOrigins?.length ? configuredOrigins : ['http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FashionStore API')
    .setDescription('API de ecommerce y punto de venta FashionStore')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
