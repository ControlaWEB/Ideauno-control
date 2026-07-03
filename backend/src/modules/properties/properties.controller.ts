import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  CURP,
  EmptyToUndefined,
  FECHA_ISO,
  MAX_EMAIL,
  MAX_MONTO,
  MAX_NOMBRE,
  MAX_SUPERFICIE,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
  MSG,
  RFC,
  SOLO_LETRAS,
  TELEFONO_MX,
} from '../../common/validation/patterns';
import { IsEmail } from 'class-validator';

// Unión de estatus usados por la UI (properties/[id], rentals/[id]) y el backend
const PROPERTY_STATUSES = [
  'Incompleta',
  'En revisión',
  'Activa',
  'Publicable',
  'Compartible',
  'Compartida',
  'Disponible',
  'Apartada',
  'Vendida',
  'vendida',
  'Rentada',
  'rentada',
  'Inactiva',
  'Suspendida',
];
const TIPOS_OPERACION = ['Venta', 'Renta'];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

class CreatePropertyDto {
  // Identificación
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) code?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) folio?: string;

  // Tipo/estatus
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(TIPOS_OPERACION, {
    message: `Tipo de operación debe ser: ${TIPOS_OPERACION.join(' o ')}.`,
  })
  tipoOperacion?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tipoInmueble?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) type?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) status?: string;

  // Propietario
  @Transform(trim)
  @IsNotEmpty({ message: 'El nombre del propietario es requerido.' })
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  ownerName: string;

  @IsNotEmpty({ message: 'El teléfono del propietario es requerido.' })
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  ownerPhone: string;

  @IsOptional()
  @EmptyToUndefined()
  @Transform(trimLower)
  @IsEmail({}, { message: MSG.email })
  @MaxLength(MAX_EMAIL)
  ownerEmail?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(RFC, { message: MSG.rfc })
  ownerRfc?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(CURP, { message: MSG.curp })
  ownerCurp?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  ownerEstadoCivil?: string;

  // Condiciones legales
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  adquiridaMatrimonio?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  regimenMatrimonial?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Transform(trim)
  @MaxLength(MAX_NOMBRE)
  nombreConyuge?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  conyugeDeAcuerdo?: string;
  @IsOptional() @IsBoolean() tieneCopropietarios?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) copropietarios?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  quienRealizaVenta?: string;

  // Documentos propiedad
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tienePredial?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tieneAgua?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tieneLuz?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tieneAvaluo?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) tieneHipoteca?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_NOMBRE)
  institucionAcreedora?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  saldoHipoteca?: number;
  @IsOptional() @IsBoolean() provieneHerencia?: boolean;
  @IsOptional() @IsBoolean() adjudicacionConcluida?: boolean;

  // Inmueble
  @Transform(trim)
  @IsNotEmpty({ message: 'La dirección es requerida.' })
  @MaxLength(MAX_TEXTO_CORTO)
  address: string;

  @Transform(trim)
  @IsNotEmpty({ message: 'La ciudad es requerida.' })
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  city: string;

  @Transform(trim)
  @IsNotEmpty({ message: 'El estado es requerido.' })
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  state: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) zona?: string;
  @IsOptional() @IsString() @MaxLength(500) mapsUrl?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_SUPERFICIE)
  superficieTerreno?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_SUPERFICIE)
  superficieConstruccion?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(10000)
  frenteM?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(10000)
  fondoM?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  recamaras?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  banosCompletos?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  mediosBanos?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  estacionamientos?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(200) niveles?: number;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) antiguedad?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  estadoConservacion?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  situacionActual?: string;

  // Comercial
  @IsNotEmpty({ message: 'El precio es requerido.' })
  @Type(() => Number)
  @IsNumber(NUM_OPTS, { message: 'El precio debe ser un número válido.' })
  @Min(1, { message: 'El precio debe ser mayor a cero.' })
  @Max(MAX_MONTO, { message: 'El precio excede el máximo permitido.' })
  price: number;

  @IsOptional() @EmptyToUndefined() @IsIn(['MXN', 'USD']) currency?: string;
  @IsOptional() @IsBoolean() esNegociable?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) formasPago?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  cuotaMantenimiento?: number;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) amenidades?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) description?: string;

  // Captación
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) advisorId?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fechaCaptacion?: string;
  @IsOptional() @IsBoolean() autorizacionPromocion?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  tipoAutorizacion?: string;
  @IsOptional() @IsBoolean() contratoComisionFirmado?: boolean;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fechaFirmaContrato?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  vigenciaContrato?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS, {
    message: 'El porcentaje de comisión debe ser un número.',
  })
  @Min(0, { message: 'El porcentaje de comisión no puede ser negativo.' })
  @Max(100, { message: 'El porcentaje de comisión no puede ser mayor a 100.' })
  porcentajeComisionPactado?: number;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;

  // ── Campos de renta (formulario /rentals/new, columnas snake_case en BD) ──
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(TIPOS_OPERACION)
  tipo_operacion_principal?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  quien_realiza_contrato?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  doc_acredita_propiedad?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber(NUM_OPTS, {
    message: 'La renta mensual debe ser un número válido.',
  })
  @Min(0)
  @Max(MAX_MONTO)
  renta_mensual_solicitada?: number;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  deposito_requerido?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  plazo_minimo_contrato?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  acepta_mascotas?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  acepta_estudiantes?: string;
  @IsOptional() @IsBoolean() acepta_empresas?: boolean;
  @IsOptional() @IsBoolean() requiere_aval?: boolean;
  @IsOptional() @IsBoolean() acepta_obligado_solidario?: boolean;
  @IsOptional() @IsBoolean() requiere_poliza_juridica?: boolean;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  servicios_incluidos?: string;
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  equipamiento_incluido?: string;
  @IsOptional() @IsBoolean() disponible_mostrarse?: boolean;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_disponibilidad?: string;
}

// PATCH /properties/:id — mismos campos que create pero todos opcionales
class UpdatePropertyDto extends CreatePropertyDto {
  @IsOptional() declare ownerName: string;
  @IsOptional() declare ownerPhone: string;
  @IsOptional() declare address: string;
  @IsOptional() declare city: string;
  @IsOptional() declare state: string;
  @IsOptional() declare price: number;
}

class UpdatePropertyStatusDto {
  @IsNotEmpty({ message: 'El estatus es requerido.' })
  @IsIn(PROPERTY_STATUSES, {
    message: `El estatus debe ser uno de: ${PROPERTY_STATUSES.join(', ')}.`,
  })
  status: string;
}

class FindPropertiesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) location?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) type?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) status?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  priceMin?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber(NUM_OPTS)
  @Min(0)
  @Max(MAX_MONTO)
  priceMax?: number;
  @IsOptional()
  @EmptyToUndefined()
  @IsIn(TIPOS_OPERACION)
  tipoOperacion?: string;
}

@Controller('properties')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get()
  async findAll(@Query() query: FindPropertiesQueryDto) {
    return this.propertiesService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 12,
      location: query.location,
      type: query.type,
      status: query.status,
      priceMin: query.priceMin,
      priceMax: query.priceMax,
      tipoOperacion: query.tipoOperacion,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Post()
  async create(@Body() body: CreatePropertyDto) {
    return this.propertiesService.create(body as Record<string, any>);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdatePropertyStatusDto,
  ) {
    return this.propertiesService.updateStatus(id, body.status);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdatePropertyDto) {
    return this.propertiesService.update(id, body);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.propertiesService.remove(id);
  }
}
