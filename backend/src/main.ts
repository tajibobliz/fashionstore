import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // Elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true, // Devuelve error si vienen propiedades extra
      transform: true,           // Convierte tipos automáticamente (string → number, etc.)
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();