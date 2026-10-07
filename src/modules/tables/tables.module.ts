import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiningTable } from '../../database/entities/dining-table.entity.js';
import { TablesController } from './tables.controller.js';
import { TablesService } from './tables.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([DiningTable])],
  controllers: [TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
