import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

class CreateClientDto {
  @IsNotEmpty({ message: 'El nombre del cliente es requerido.' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @IsOptional()
  phone: string;

  @IsOptional()
  rfc: string;

  @IsNotEmpty({ message: 'El tipo de cliente es requerido (Individual / Corporate).' })
  type: string;
}

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private clientsService: ClientsService) {}

  @Get()
  async findAll(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.clientsService.findAll({
      search,
      type,
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
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
  async update(@Param('id') id: string, @Body() body: any) {
    return this.clientsService.update(id, body);
  }
}
