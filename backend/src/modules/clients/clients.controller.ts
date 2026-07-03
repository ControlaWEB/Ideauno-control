import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  EmptyToUndefined,
  MAX_EMAIL,
  MAX_NOMBRE,
  MAX_TEXTO_CORTO,
  MSG,
  RFC,
  SOLO_LETRAS,
  TELEFONO_MX,
} from '../../common/validation/patterns';

const CLIENT_TYPES = ['Individual', 'Corporate'];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

class CreateClientDto {
  @Transform(trim)
  @IsNotEmpty({ message: 'El nombre del cliente es requerido.' })
  @MaxLength(MAX_NOMBRE, {
    message: `El nombre no puede exceder ${MAX_NOMBRE} caracteres.`,
  })
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

  @IsNotEmpty({ message: 'El tipo de cliente es requerido.' })
  @IsIn(CLIENT_TYPES, {
    message: `El tipo debe ser uno de: ${CLIENT_TYPES.join(', ')}.`,
  })
  type: string;
}

class UpdateClientDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(MAX_NOMBRE)
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
  @IsIn(CLIENT_TYPES, {
    message: `El tipo debe ser uno de: ${CLIENT_TYPES.join(', ')}.`,
  })
  type?: string;
}

class FindClientsQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) search?: string;
  @IsOptional() @IsIn(CLIENT_TYPES) type?: string;
}

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  async findAll(@Query() query: FindClientsQueryDto) {
    return this.clientsService.findAll({
      search: query.search,
      type: query.type,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Post()
  async create(@Body() body: CreateClientDto) {
    return this.clientsService.create(body);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateClientDto) {
    return this.clientsService.update(id, body);
  }
}
