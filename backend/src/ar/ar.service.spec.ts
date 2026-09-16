import { Test, TestingModule } from '@nestjs/testing';
import { ArService } from './ar.service';

describe('ArService', () => {
  let service: ArService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArService],
    }).compile();

    service = module.get<ArService>(ArService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
