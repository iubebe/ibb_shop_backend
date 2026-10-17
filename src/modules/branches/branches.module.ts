import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Branch } from '../../database/entities/branch.entity.js';
import { GuestModule } from '../guest/guest.module.js';
import { BranchesController } from './branches.controller.js';
import { BranchesService } from './branches.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Branch]), GuestModule],
  controllers: [BranchesController],
  providers: [BranchesService],
})
export class BranchesModule {}
