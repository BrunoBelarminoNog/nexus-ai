import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database/database.module.js';
import {
  DrizzleExecutionHistoryRepository,
  DrizzleExecutionRepository,
} from './drizzle-execution.repository.js';
import {
  ExecutionHistoryRepository,
  ExecutionRepository,
} from './execution.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: ExecutionRepository, useClass: DrizzleExecutionRepository },
    {
      provide: ExecutionHistoryRepository,
      useClass: DrizzleExecutionHistoryRepository,
    },
  ],
  exports: [ExecutionRepository, ExecutionHistoryRepository],
})
export class ExecutionsModule {}
