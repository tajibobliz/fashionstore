import { Test, TestingModule } from '@nestjs/testing';
import { ArController } from './ar.controller';
import { ArService } from './ar.service';

describe('ArController', () => {
  let controller: ArController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArController],
      providers: [ArService],
    }).compile();

    controller = module.get<ArController>(ArController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
