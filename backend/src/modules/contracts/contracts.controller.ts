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
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  EmptyToUndefined,
  FECHA_ISO,
  MAX_EMAIL,
  MAX_MONTO,
  MAX_NOMBRE,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
  MSG,
  TELEFONO_MX,
} from '../../common/validation/patterns';

const CONTRACT_STATUSES = [
  'Pendiente',
  'En elaboración',
  'Requiere información',
  'Entregado',
  'Cancelado',
];

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

// El formulario /contracts/new envía snake_case; este DTO refleja ese contrato.
class CreateContractDto {
  @IsNotEmpty({ message: 'El tipo de solicitud es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  tipo_solicitud: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  id_propiedad?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  id_asesor_solicitante?: string;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  precio_renta_acordada?: number;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_estimada_firma?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_firma_estimada?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_entrega_estimada?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  condiciones_pago?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  condiciones_especiales?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  observaciones_asesor?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  observaciones_juridico?: string;
  @IsOptional() @IsBoolean() confirmacion_asesor?: boolean;

  // Cliente (comprador / arrendatario)
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['Persona física', 'Persona moral'])
  cliente_tipo?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) cliente_nombre?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  cliente_telefono?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_EMAIL)
  cliente_correo?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  cliente_estado_civil?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  cliente_regimen_patrimonial?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOMBRE)
  cliente_nombre_conyuge?: string;

  // Compraventa
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) formas_pago?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  monto_apartado?: number;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_estimada_escritura?: string;

  // Arrendamiento
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_inicio_contrato?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_entrega_inmueble?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) vigencia?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  deposito_garantia?: number;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  primer_pago_renta?: number;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  forma_pago_renta?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'El día de pago debe estar entre 1 y 31.' })
  @Max(31, { message: 'El día de pago debe estar entre 1 y 31.' })
  dia_pago_mensual?: number;
  @IsOptional() @IsBoolean() incluye_mantenimiento?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  servicios_incluidos?: string;
  @IsOptional() @IsBoolean() permite_mascotas?: boolean;
  @IsOptional() @IsBoolean() entrega_amueblado?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  observaciones_acuerdos?: string;

  // Documentación
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['si', 'no', 'sí'])
  docs_vendedor_completos?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  docs_vendedor_faltantes?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['si', 'no', 'sí'])
  docs_comprador_completos?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  docs_comprador_faltantes?: string;

  // Aval
  @IsOptional() @IsBoolean() requiere_aval?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tipo_aval?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) nombre_aval?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  telefono_aval?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_EMAIL)
  correo_aval?: string;

  // Representación vendedor/comprador
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  rep_vendedor_tipo?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  asesor_interno_vendedor?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOMBRE)
  nombre_externo_vendedor?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  telefono_externo_vendedor?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_EMAIL)
  correo_externo_vendedor?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOMBRE)
  inmobiliaria_externa_vendedor?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  rep_comprador_tipo?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  asesor_interno_comprador?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOMBRE)
  nombre_externo_comprador?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  telefono_externo_comprador?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_EMAIL)
  correo_externo_comprador?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOMBRE)
  inmobiliaria_externa_comprador?: string;

  // Comisiones
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(100, { message: 'El porcentaje de comisión no puede ser mayor a 100.' })
  comision_pactada_pct?: number;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  comision_pactada_monto?: number;
  @IsOptional() @IsBoolean() existe_comision_compartida?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  detalle_comision_compartida?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  precio_final_acordado?: number;

  // Objeto cliente anidado (compat)
  @IsOptional() @IsObject() cliente?: Record<string, any>;
}

class UpdateStatusDto {
  @IsNotEmpty({ message: 'El estatus es requerido.' })
  @IsIn(CONTRACT_STATUSES, {
    message: `El estatus debe ser uno de: ${CONTRACT_STATUSES.join(', ')}.`,
  })
  estatus: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;
}

class FindContractsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) advisorId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tipoSolicitud?: string;
  @IsOptional() @IsIn(CONTRACT_STATUSES) estatus?: string;
}

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Post()
  create(@Body() body: CreateContractDto, @Request() req: any) {
    // Registrar quién solicita: sin esto el Asesor nunca ve sus propias solicitudes
    const solicitante = req.user.advisorId ?? req.user.id;
    if (req.user.role === UserRole.ASESOR || !body.id_asesor_solicitante) {
      body.id_asesor_solicitante = solicitante;
    }
    return this.contractsService.create(body as Record<string, any>);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: FindContractsQueryDto) {
    const effectiveAdvisorId =
      req.user.role === UserRole.ASESOR
        ? (req.user.advisorId ?? req.user.id)
        : query.advisorId;
    return this.contractsService.findAll({
      advisorId: effectiveAdvisorId,
      tipoSolicitud: query.tipoSolicitud,
      estatus: query.estatus,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.JURIDICO)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: UpdateStatusDto,
  ) {
    return this.contractsService.updateStatus(
      id,
      body.estatus,
      req.user.id,
      body.observaciones,
    );
  }
}
