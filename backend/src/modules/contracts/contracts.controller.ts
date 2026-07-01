import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

class CreateContractDto {
  @IsOptional() @IsString() tipo_solicitud?: string;
  @IsOptional() @IsString() id_propiedad?: string;
  @IsOptional() @IsString() id_asesor_solicitante?: string;
  @IsOptional() @IsNumber() precio_renta_acordada?: number;
  @IsOptional() @IsString() fecha_firma_estimada?: string;
  @IsOptional() @IsString() fecha_entrega_estimada?: string;
  @IsOptional() @IsString() condiciones_pago?: string;
  @IsOptional() @IsString() observaciones_asesor?: string;
  @IsOptional() @IsBoolean() confirmacion_asesor?: boolean;
  @IsOptional() cliente?: Record<string, any>;
}

class UpdateStatusDto {
  @IsNotEmpty() @IsString() estatus: string;
  @IsOptional() @IsString() observaciones?: string;
}

@Controller('contracts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Post()
  create(@Body() body: CreateContractDto) {
    return this.contractsService.create(body as Record<string, any>);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('advisorId') advisorId?: string,
    @Query('tipoSolicitud') tipoSolicitud?: string,
    @Query('estatus') estatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const effectiveAdvisorId =
      req.user.role === UserRole.ASESOR ? req.user.id : advisorId;
    return this.contractsService.findAll({
      advisorId: effectiveAdvisorId,
      tipoSolicitud,
      estatus,
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
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
    return this.contractsService.updateStatus(id, body.estatus, req.user.id, body.observaciones);
  }
}
