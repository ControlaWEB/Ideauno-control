import { Controller, Get, Post, Patch, Body, Query, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AdvisorsService } from './advisors.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

class UpdateStatusDto {
  @IsNotEmpty()
  @IsIn(['Activo', 'En mentoría', 'Inactivo', 'Baja definitiva', 'Fallecido'])
  status: string;

  @IsOptional() @IsString() motivo_baja?: string;
  @IsOptional() @IsString() fecha_baja?: string;
}

class UpdateBankDto {
  @IsNotEmpty() @IsString() clabe_interbancaria: string;
  @IsNotEmpty() @IsString() banco: string;
  @IsNotEmpty() @IsString() titular_cuenta: string;
}

class CreateAdvisorDto {
  @IsNotEmpty({ message: 'El nombre es requerido.' })
  name: string;

  @IsEmail({}, { message: 'El correo electrónico debe ser válido.' })
  @IsNotEmpty({ message: 'El correo electrónico es requerido.' })
  email: string;

  @IsOptional() @IsString() phone: string;
  @IsOptional() @IsString() rfc: string;
  @IsOptional() @IsString() curp: string;
  @IsOptional() @IsString() fechaNacimiento: string;
  @IsOptional() @IsString() fechaAltaAsesor: string;
  @IsOptional() @IsString() specialty: string;
  @IsOptional() @IsString() license: string;

  @IsNotEmpty({ message: 'El estatus es requerido.' })
  status: string;

  @IsOptional() @IsString() inviteByAdvisorId: string;
  @IsOptional() pasaPorMentoria: boolean;
  @IsOptional() @IsString() idMentor: string;
  @IsOptional() @IsString() nombreBeneficiario: string;
  @IsOptional() @IsString() telefonoBeneficiario: string;
  @IsOptional() @IsString() correoBeneficiario: string;
  @IsOptional() @IsString() observaciones: string;

  @IsOptional()
  @IsNumber()
  metaAma: number;
}

@Controller('advisors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvisorsController {
  constructor(private advisorsService: AdvisorsService) {}

  @Get()
  async findAll(@Query('status') status?: string) {
    return this.advisorsService.findAll(status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.advisorsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() body: CreateAdvisorDto) {
    return this.advisorsService.create(body);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.advisorsService.update(id, body);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.advisorsService.updateStatus(id, body);
  }

  @Patch(':id/bank')
  async updateBank(@Param('id') id: string, @Body() body: UpdateBankDto, @Request() req: any) {
    // Asesor solo puede editar sus propios datos bancarios
    if (req.user.role === UserRole.ASESOR && req.user.advisorId !== id) {
      throw new ForbiddenException('Solo puedes editar tus propios datos bancarios.');
    }
    return this.advisorsService.updateBank(id, body);
  }
}
