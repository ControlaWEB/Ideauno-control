import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AdvisorsService } from './advisors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  IsBoolean,
  IsEmail,
  IsIn,
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
import {
  CLABE,
  CURP,
  EmptyToUndefined,
  FECHA_ISO,
  MAX_EMAIL,
  MAX_MONTO,
  MAX_NOMBRE,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
  MSG,
  RFC,
  SOLO_LETRAS,
  TELEFONO_MX,
} from '../../common/validation/patterns';

const ADVISOR_STATUSES = [
  'Activo',
  'En mentoría',
  'Inactivo',
  'Baja definitiva',
  'Fallecido',
];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

class UpdateStatusDto {
  @IsNotEmpty({ message: 'El estatus es requerido.' })
  @IsIn(ADVISOR_STATUSES, {
    message: `El estatus debe ser uno de: ${ADVISOR_STATUSES.join(', ')}.`,
  })
  status: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) motivo_baja?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fecha_baja?: string;
}

class UpdateBankDto {
  @IsNotEmpty({ message: 'La CLABE es requerida.' })
  @Matches(CLABE, { message: MSG.clabe })
  clabe_interbancaria: string;

  @Transform(trim)
  @IsNotEmpty({ message: 'El banco es requerido.' })
  @IsString()
  @MaxLength(MAX_NOMBRE)
  banco: string;

  @Transform(trim)
  @IsNotEmpty({ message: 'El titular de la cuenta es requerido.' })
  @IsString()
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  titular_cuenta: string;
}

class CreateAdvisorDto {
  @Transform(trim)
  @IsNotEmpty({ message: 'El nombre es requerido.' })
  @MaxLength(MAX_NOMBRE, {
    message: `El nombre no puede exceder ${MAX_NOMBRE} caracteres.`,
  })
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  name: string;

  @Transform(trimLower)
  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  @MaxLength(MAX_EMAIL)
  email: string;

  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  phone?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(RFC, { message: MSG.rfc })
  rfc?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(CURP, { message: MSG.curp })
  curp?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fechaNacimiento?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(FECHA_ISO, { message: MSG.fecha })
  fechaAltaAsesor?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) specialty?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) license?: string;

  @IsNotEmpty({ message: 'El estatus es requerido.' })
  @IsIn(ADVISOR_STATUSES, {
    message: `El estatus debe ser uno de: ${ADVISOR_STATUSES.join(', ')}.`,
  })
  status: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  inviteByAdvisorId?: string;
  @IsOptional() @IsBoolean() pasaPorMentoria?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) idMentor?: string;

  // Si viene, el perfil de asesor se liga a un usuario existente (un admin que
  // también vende) en vez de crear un login nuevo.
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) linkUserId?: string;

  @IsOptional()
  @EmptyToUndefined()
  @Transform(trim)
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  nombreBeneficiario?: string;

  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  telefonoBeneficiario?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Transform(trimLower)
  @IsEmail({}, { message: MSG.email })
  @MaxLength(MAX_EMAIL)
  correoBeneficiario?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La meta AMA debe ser un número.' },
  )
  @Min(0, { message: 'La meta AMA no puede ser negativa.' })
  @Max(MAX_MONTO, { message: 'La meta AMA excede el máximo permitido.' })
  metaAma?: number;
}

// PATCH /advisors/:id — solo campos editables, ya no acepta `any`
class UpdateAdvisorDto {
  @IsOptional()
  @EmptyToUndefined()
  @Transform(trim)
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  name?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Transform(trimLower)
  @IsEmail({}, { message: MSG.email })
  @MaxLength(MAX_EMAIL)
  email?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  phone?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(RFC, { message: MSG.rfc })
  rfc?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(CURP, { message: MSG.curp })
  curp?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) specialty?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) license?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) idMentor?: string;
  @IsOptional() @IsBoolean() pasaPorMentoria?: boolean;
  @IsOptional()
  @EmptyToUndefined()
  @Transform(trim)
  @MaxLength(MAX_NOMBRE)
  @Matches(SOLO_LETRAS, { message: MSG.soloLetras })
  nombreBeneficiario?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Matches(TELEFONO_MX, { message: MSG.telefono })
  telefonoBeneficiario?: string;
  @IsOptional()
  @EmptyToUndefined()
  @Transform(trimLower)
  @IsEmail({}, { message: MSG.email })
  @MaxLength(MAX_EMAIL)
  correoBeneficiario?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'La meta AMA debe ser un número.' },
  )
  @Min(0)
  @Max(MAX_MONTO)
  metaAma?: number;
}

@Controller('advisors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvisorsController {
  constructor(private advisorsService: AdvisorsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.advisorsService.findAll(status);
  }

  // Debe ir ANTES de @Get(':id') o Nest lo tomaría como un id.
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('linkable-users')
  async linkableUsers() {
    return this.advisorsService.listLinkableUsers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.advisorsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() body: CreateAdvisorDto) {
    const { linkUserId, ...dto } = body;
    return this.advisorsService.create(dto, { linkUserId });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateAdvisorDto) {
    return this.advisorsService.update(id, body);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.advisorsService.updateStatus(id, body);
  }

  @Patch(':id/bank')
  async updateBank(
    @Param('id') id: string,
    @Body() body: UpdateBankDto,
    @Request() req: any,
  ) {
    // Asesor solo puede editar sus propios datos bancarios
    if (req.user.role === UserRole.ASESOR && req.user.advisorId !== id) {
      throw new ForbiddenException(
        'Solo puedes editar tus propios datos bancarios.',
      );
    }
    return this.advisorsService.updateBank(id, body);
  }
}
