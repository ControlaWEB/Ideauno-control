import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { OperationsService } from './operations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

class CreateOperationDto {
  // S1 Origen
  @IsOptional() @IsString() tipoOperacion: string;
  @IsOptional() propiedadEnInventario: boolean;
  @IsOptional() @IsString() propertyId: string;
  @IsOptional() @IsString() tipoCierreExterno: string;
  @IsOptional() @IsString() direccionCierreExterno: string;
  @IsOptional() @IsString() tipoInmuebleExterno: string;
  @IsOptional() @IsString() docCierreTipo: string;

  // S2 Económico
  @IsOptional() precioFinalCierre: number;
  @IsOptional() @IsString() fechaCierre: string;
  @IsOptional() montoComisionGenerada: number;
  @IsOptional() contractValue: number;
  @IsOptional() @IsString() currency: string;
  @IsOptional() commissionRate: number;

  // S3 Asesores
  @IsOptional() @IsString() advisorId: string;
  @IsOptional() @IsString() closerId: string;
  @IsOptional() @IsString() clientId: string;
  @IsOptional() @IsString() repVendedorTipo: string;
  @IsOptional() @IsString() repCompradorTipo: string;
  @IsOptional() @IsString() asesorInternoVendedor: string;
  @IsOptional() @IsString() asesorInternoComprador: string;
  @IsOptional() @IsString() asesorExternoVendedor: string;
  @IsOptional() @IsString() asesorExternoComprador: string;

  // S4 PLD
  @IsOptional() @IsString() pldTipoCliente: string;
  @IsOptional() pldExpedienteCompleto: boolean;

  // S6 Pago
  @IsOptional() solicitaLiberacion: boolean;
  @IsOptional() @IsString() observaciones: string;

  // Legacy / compat
  @IsOptional() @IsString() type: string;
  @IsOptional() @IsString() status: string;
}

class UpdateStatusDto {
  @IsNotEmpty() status: string;
  @IsOptional() @IsString() adminId: string;
}

class CancelOperationDto {
  @IsNotEmpty() @IsString() motivo: string;
}

class BlockCommissionDto {
  @IsNotEmpty() @IsString() motivo: string;
}

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationsController {
  constructor(private operationsService: OperationsService) {}

  @Get()
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    const advisorId = req.user.role === 'Asesor' ? (req.user.advisorId ?? undefined) : undefined;
    return this.operationsService.findAll({
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
      status,
      type,
      advisorId,
    });
  }

  @Get('commissions')
  findCommissions(
    @Query('advisorId') advisorId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.operationsService.findAllCommissions({
      advisorId, status, type,
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.operationsService.findOne(id);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Post()
  create(@Body() body: CreateOperationDto) {
    return this.operationsService.create(body as any);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.operationsService.updateStatus(id, body.status, body.adminId);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: CancelOperationDto, @Request() req: any) {
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
  blockCommission(@Param('id') id: string, @Body() body: BlockCommissionDto, @Request() req: any) {
    return this.operationsService.blockCommission(id, req.user.id, body.motivo);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.JURIDICO)
  @Patch('commissions/:id/unblock')
  unblockCommission(@Param('id') id: string, @Request() req: any) {
    return this.operationsService.unblockCommission(id, req.user.id);
  }
}
