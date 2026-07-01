import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { AdvisorsModule } from './modules/advisors/advisors.module';
import { ClientsModule } from './modules/clients/clients.module';
import { OperationsModule } from './modules/operations/operations.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { AuditModule } from './modules/audit/audit.module';
import { TemplatesModule } from './modules/templates/templates.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 100 },
    ]),
    DatabaseModule,
    AuthModule,
    DashboardModule,
    PropertiesModule,
    AdvisorsModule,
    ClientsModule,
    OperationsModule,
    ComplianceModule,
    DocumentsModule,
    PaymentsModule,
    ContractsModule,
    AuditModule,
    TemplatesModule,
  ],
})
export class AppModule {}
