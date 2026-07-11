import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  EmptyToUndefined,
  MAX_EMAIL,
  MAX_MONTO,
  MAX_NOMBRE,
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
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

// Integrante de un team = mismo shape que el alta de asesor individual.
class TeamMemberDto {
  @Transform(trim) @IsNotEmpty() @IsString() @MaxLength(MAX_NOMBRE) name: string;
  @Transform(trimLower) @IsEmail() @IsNotEmpty() @MaxLength(MAX_EMAIL) email: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) phone?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) rfc?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) curp?: string;
  @IsOptional() @IsString() @MaxLength(20) fechaNacimiento?: string;
  @IsOptional() @IsString() @MaxLength(20) fechaAltaAsesor?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) specialty?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) license?: string;

  @IsNotEmpty()
  @IsIn(ADVISOR_STATUSES, {
    message: `El estatus debe ser uno de: ${ADVISOR_STATUSES.join(', ')}.`,
  })
  status: string;

  @IsOptional() @IsBoolean() pasaPorMentoria?: boolean;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) inviteByAdvisorId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) idMentor?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) nombreBeneficiario?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) telefonoBeneficiario?: string;
  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  @MaxLength(MAX_EMAIL)
  correoBeneficiario?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observaciones?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_MONTO)
  metaAma?: number;
}

class CreateTeamDto {
  @Transform(trim) @IsNotEmpty() @IsString() @MaxLength(MAX_NOMBRE) nombre: string;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) clabeInterbancaria?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) banco?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) titularCuenta?: string;
  @IsOptional() @IsString() @MaxLength(20) fechaAltaTeam?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_MONTO)
  metaAma?: number;

  @ValidateNested()
  @Type(() => TeamMemberDto)
  primerIntegrante: TeamMemberDto;
}

// Crear un team a partir de asesores que YA existen (no crea logins).
class CreateTeamFromExistingDto {
  @Transform(trim) @IsNotEmpty() @IsString() @MaxLength(MAX_NOMBRE) nombre: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) clabeInterbancaria?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) banco?: string;
  @IsOptional() @IsString() @MaxLength(MAX_NOMBRE) titularCuenta?: string;
  @IsOptional() @IsString() @MaxLength(20) fechaAltaTeam?: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'Selecciona al menos un asesor.' })
  @IsString({ each: true })
  @MaxLength(MAX_TEXTO_CORTO, { each: true })
  advisorIds: string[];
}

class AddExistingMemberDto {
  @IsNotEmpty() @IsString() @MaxLength(MAX_TEXTO_CORTO) advisorId: string;
}

@Controller('teams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  create(@Body() body: CreateTeamDto) {
    return this.teamsService.createTeam(body);
  }

  // Crear team con asesores existentes (no crea logins nuevos).
  @Post('from-existing')
  createFromExisting(@Body() body: CreateTeamFromExistingDto) {
    return this.teamsService.createTeamFromExisting(body);
  }

  // Asesores que pueden formar/unirse a un team (sin team aún).
  // Debe ir ANTES de @Get(':id').
  @Get('unteamed-advisors')
  unteamedAdvisors() {
    return this.teamsService.listUnteamedAdvisors();
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: TeamMemberDto) {
    return this.teamsService.addMember(id, body);
  }

  // Agregar un asesor existente (sin team) a un team ya creado.
  @Post(':id/existing-members')
  addExistingMember(
    @Param('id') id: string,
    @Body() body: AddExistingMemberDto,
  ) {
    return this.teamsService.addExistingMember(id, body.advisorId);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.teamsService.getOne(id);
  }

  @Get(':id/documentos-pendientes')
  getDocumentosPendientes(@Param('id') id: string) {
    return this.teamsService.getDocumentosPendientes(id);
  }
}
