import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ForbiddenException } from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  MAX_MONTO,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
} from '../../common/validation/patterns';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

class RequestPaymentDto {
  @IsNotEmpty({ message: 'El ID de la comisión es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  commissionId: string;

  @IsNotEmpty({ message: 'El ID del asesor es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  advisorId: string;
}

class MarkPaidDto {
  @IsNotEmpty({ message: 'La forma de pago es requerida.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  formaPago: string;

  @IsNotEmpty({ message: 'El monto pagado es requerido.' })
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'El monto pagado debe ser un número válido.' },
  )
  @Min(0.01, { message: 'El monto pagado debe ser mayor a cero.' })
  @Max(MAX_MONTO, { message: 'El monto pagado excede el máximo permitido.' })
  montoPagado: number;

  @IsOptional() @IsBoolean() requiereCfdi?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) uuidCfdi?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  referenciaTransferencia?: string;
}

class RejectDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;
}

class FindPaymentsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) advisorId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) status?: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('request')
  requestPayment(@Body() body: RequestPaymentDto, @Request() req: any) {
    // Un Asesor solo puede solicitar el pago de sus propias comisiones
    if (
      req.user.role === UserRole.ASESOR &&
      req.user.advisorId !== body.advisorId
    ) {
      throw new ForbiddenException(
        'Solo puedes solicitar el pago de tus propias comisiones.',
      );
    }
    return this.paymentsService.requestPayment(
      body.commissionId,
      body.advisorId,
    );
  }

  @Get()
  findAll(@Request() req: any, @Query() query: FindPaymentsQueryDto) {
    const isAsesor = req.user.role === UserRole.ASESOR;
    // Integrante de team ve los pagos de todo el equipo; asesor solo, los suyos.
    const teamId = isAsesor ? (req.user.teamId ?? undefined) : undefined;
    const effectiveAdvisorId = isAsesor
      ? (teamId ? undefined : (req.user.advisorId ?? req.user.id))
      : query.advisorId;
    return this.paymentsService.findAll({
      advisorId: effectiveAdvisorId,
      teamId,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
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
    return this.paymentsService.markPaid(
      id,
      req.user.id,
      body.formaPago,
      body.montoPagado,
      {
        requiereCfdi: body.requiereCfdi,
        uuidCfdi: body.uuidCfdi,
        referenciaTransferencia: body.referenciaTransferencia,
      },
    );
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
