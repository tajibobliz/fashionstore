import { Module } from '@nestjs/common';
import { MlClient } from './ml.client';
import { MlController } from './ml.controller';
import { MlService } from './ml.service';
import { MlScheduler } from './ml.scheduler';

@Module({
  controllers: [MlController],
  providers: [MlService, MlClient, MlScheduler],
})
export class MlModule {}
