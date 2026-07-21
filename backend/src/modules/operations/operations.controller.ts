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
import { OperationsService } from './operations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmptyToUndefined,
  FECHA_ISO,
  MAX_EMAIL,
  MAX_MONTO,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
  MSG,
} from '../../common/validation/patterns';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const OPERATION_STATUSES = [
  'Solicitado',
  'En revisión',
  'Validado por administración',
  'Liberado para pago',
  'Liberada',
  'Pagado',
  'Cancelado',
];

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

// Datos del colocador externo (agente/inmobiliaria que captó la propiedad).
// Solo aplica en cierres externos (propiedadEnInventario === false).
class ColocadorDto {
  @IsNotEmpty({ message: 'La inmobiliaria/agente externo es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  inmobiliaria: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) nombre?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) telefono?: string;
  @IsOptional() @IsString() @MaxLength(MAX_EMAIL) correo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS, { message: 'El % pactado debe ser un número.' })
  @Min(0, { message: 'El % pactado no puede ser negativo.' })
  @Max(100, { message: 'El % pactado no puede ser mayor a 100.' })
  pctPactado?: number;
}

class CreateOperationDto {
  // S1 Origen
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['Venta', 'Renta'], {
    message: 'Tipo de operación debe ser Venta o Renta.',
  })
  tipoOperacion?: string;
  @IsOptional() @IsBoolean() propiedadEnInventario?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) propertyId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  tipoCierreExterno?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  direccionCierreExterno?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  tipoInmuebleExterno?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) docCierreTipo?: string;

  // S2 Económico
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS, { message: 'El precio final debe ser un número válido.' })
  @Min(0, { message: 'El precio final no puede ser negativo.' })
  @Max(MAX_MONTO)
  precioFinalCierre?: number;

  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fechaCierre?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS, {
    message: 'El monto de comisión debe ser un número válido.',
  })
  @Min(0, { message: 'El monto de comisión no puede ser negativo.' })
  @Max(MAX_MONTO)
  montoComisionGenerada?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  contractValue?: number;

  @IsOptional() @EmptyToUndefined() @IsIn(['MXN', 'USD']) currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS, { message: 'La tasa de comisión debe ser un número.' })
  @Min(0, { message: 'La tasa de comisión no puede ser negativa.' })
  @Max(100, { message: 'La tasa de comisión no puede ser mayor a 100.' })
  commissionRate?: number;

  // S3 Asesores
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) advisorId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) closerId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) clientId?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  repVendedorTipo?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  repCompradorTipo?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  asesorInternoVendedor?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  asesorInternoComprador?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  asesorExternoVendedor?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  asesorExternoComprador?: string;

  // S4 PLD
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) pldTipoCliente?: string;
  @IsOptional() @IsBoolean() pldExpedienteCompleto?: boolean;

  // Colocador externo (solo cierres externos)
  @IsOptional()
  @ValidateNested()
  @Type(() => ColocadorDto)
  colocador?: ColocadorDto;

  // S6 Pago
  @IsOptional() @IsBoolean() solicitaLiberacion?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;

  // Legacy / compat
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) type?: string;
  @IsOptional() @EmptyToUndefined() @IsIn(OPERATION_STATUSES) status?: string;
}

class UpdateStatusDto {
  @IsNotEmpty({ message: 'El estatus es requerido.' })
  @IsIn(OPERATION_STATUSES, {
    message: `El estatus debe ser uno de: ${OPERATION_STATUSES.join(', ')}.`,
  })
  status: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) adminId?: string;
}

class FindOperationsQueryDto extends PaginationQueryDto {
  @IsOptional() @EmptyToUndefined() @IsIn(OPERATION_STATUSES) status?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) type?: string;
}

class FindCommissionsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) advisorId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) status?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) operationId?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['cierre', 'invitacion', 'mentoria'])
  type?: string;
  // 'true' = solo comisiones sin una solicitud de pago activa/completada aún
  // (para la vista de Admin: "liberadas pendientes de solicitud").
  @IsOptional() @IsIn(['true', 'false']) sinSolicitud?: string;
}

class CancelOperationDto {
  @IsNotEmpty({ message: 'El motivo de cancelación es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  motivo: string;
}

class BlockCommissionDto {
  @IsNotEmpty({ message: 'El motivo de bloqueo es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  motivo: string;
}

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @Get()
  findAll(@Request() req: any, @Query() query: FindOperationsQueryDto) {
    const isAsesor = req.user.role === 'Asesor';
    // Integrante de team ve las operaciones de todo el equipo; asesor solo, las suyas.
    const teamId = isAsesor ? (req.user.teamId ?? undefined) : undefined;
    const advisorId = isAsesor && !teamId ? (req.user.advisorId ?? undefined) : undefined;
    return this.operationsService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      status: query.status,
      type: query.type,
      advisorId,
      teamId,
    });
  }

  @Get('commissions')
  findCommissions(
    @Request() req: any,
    @Query() query: FindCommissionsQueryDto,
  ) {
    const isAsesor = req.user.role === 'Asesor';
    // Team: ve las comisiones de todo el equipo. Asesor solo: solo las suyas (ignora query).
    const teamId = isAsesor ? (req.user.teamId ?? undefined) : undefined;
    const advisorId = isAsesor
      ? (teamId ? undefined : (req.user.advisorId ?? '-'))
      : query.advisorId;
    return this.operationsService.findAllCommissions({
      advisorId,
      teamId,
      status: query.status,
      type: query.type,
      operationId: query.operationId,
      sinSolicitud: query.sinSolicitud === 'true',
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.operationsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Post()
  create(@Body() body: CreateOperationDto, @Request() req: any) {
    // Un Asesor solo puede registrar operaciones a su propio nombre
    if (req.user.role === UserRole.ASESOR) {
      body.advisorId = req.user.advisorId ?? body.advisorId;
      body.closerId = req.user.advisorId ?? body.closerId;
    }
    return this.operationsService.create(body as any);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.operationsService.updateStatus(id, body.status, body.adminId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() body: CancelOperationDto,
    @Request() req: any,
  ) {
    return this.operationsService.cancel(id, req.user.id, body.motivo);
  }

  // Commission release/block — accesible a Jurídico además de Admin
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.JURIDICO)
  @Patch('commissions/:id/release')
  releaseCommission(@Param('id') id: string, @Request() req: any) {
    return this.operationsService.releaseCommission(id, req.user.id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.JURIDICO)
  @Patch('commissions/:id/block')
  blockCommission(
    @Param('id') id: string,
    @Body() body: BlockCommissionDto,
    @Request() req: any,
  ) {
    return this.operationsService.blockCommission(id, req.user.id, body.motivo);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.JURIDICO)
  @Patch('commissions/:id/unblock')
  unblockCommission(@Param('id') id: string, @Request() req: any) {
    return this.operationsService.unblockCommission(id, req.user.id);
  }
}
