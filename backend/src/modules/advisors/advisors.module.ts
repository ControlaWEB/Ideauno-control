import { Module } from '@nestjs/common';
import { AdvisorsService } from './advisors.service';
import { AdvisorsController } from './advisors.controller';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, AuditModule, NotificationsModule],
  controllers: [AdvisorsController],
  providers: [AdvisorsService],
  exports: [AdvisorsService],
})
export class AdvisorsModule {}
