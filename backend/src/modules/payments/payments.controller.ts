import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

class RequestPaymentDto {
  @IsNotEmpty() @IsString() commissionId: string;
  @IsNotEmpty() @IsString() advisorId: string;
}

class MarkPaidDto {
  @IsNotEmpty() @IsString() formaPago: string;
  @IsNotEmpty() @IsNumber() montoPagado: number;
  @IsOptional() requiereCfdi?: boolean;
  @IsOptional() @IsString() uuidCfdi?: string;
  @IsOptional() @IsString() referenciaTransferencia?: string;
}

class RejectDto {
  @IsOptional() @IsString() observaciones?: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('request')
  requestPayment(@Body() body: RequestPaymentDto) {
    return this.paymentsService.requestPayment(body.commissionId, body.advisorId);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('advisorId') advisorId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveAdvisorId =
      req.user.role === UserRole.ASESOR ? (req.user.advisorId ?? req.user.id) : advisorId;
    return this.paymentsService.findAll({
      advisorId: effectiveAdvisorId,
      status,
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/authorize')
  authorize(@Param('id') id: string, @Request() req: any) {
    return this.paymentsService.authorize(id, req.user.id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/paid')
  markPaid(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: MarkPaidDto,
  ) {
    return this.paymentsService.markPaid(id, req.user.id, body.formaPago, body.montoPagado, {
      requiereCfdi: body.requiereCfdi,
      uuidCfdi: body.uuidCfdi,
      referenciaTransferencia: body.referenciaTransferencia,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: RejectDto,
  ) {
    return this.paymentsService.reject(id, req.user.id, body.observaciones);
  }
}
