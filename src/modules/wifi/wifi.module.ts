import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WifiNetwork } from '../../database/entities/wifi-network.entity.js';
import { WifiController } from './wifi.controller.js';
import { WifiService } from './wifi.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WifiNetwork])],
  controllers: [WifiController],
  providers: [WifiService],
  exports: [WifiService],
})
export class WifiModule {}
