import { Test, TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { CatalogService } from './catalog.service';
import { BadRequestException } from '@nestjs/common';

describe('CatalogService', () => {
  let service: CatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CatalogService],
    }).useMocker(() => ({})).compile();

    service = module.get<CatalogService>(CatalogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a fourth image for a variant', async () => {
    const varianteRepo = { findOne: jest.fn().mockResolvedValue({ idVariante: 7 }) };
    const imagenRepo = { find: jest.fn().mockResolvedValue([{ orden: 1 }, { orden: 2 }, { orden: 3 }]) };
    const realService = new CatalogService(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      {} as never, varianteRepo as never, imagenRepo as never,
    );

    await expect(realService.createImagenVariante(7, { url: 'https://example.test/image.jpg' }))
      .rejects.toThrow(BadRequestException);
  });
});
