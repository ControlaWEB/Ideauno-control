import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsBoolean } from 'class-validator';

class CreatePropertyDto {
  // Identificación
  @IsOptional() @IsString() code: string;
  @IsOptional() @IsString() folio: string;

  // Tipo/estatus
  @IsOptional() @IsString() tipoOperacion: string;
  @IsOptional() @IsString() tipoInmueble: string;
  @IsOptional() @IsString() type: string;
  @IsOptional() @IsString() status: string;

  // Propietario
  @IsNotEmpty({ message: 'El nombre del propietario es requerido.' })
  ownerName: string;

  @IsNotEmpty({ message: 'El teléfono del propietario es requerido.' })
  ownerPhone: string;

  @IsOptional() @IsString() ownerEmail: string;
  @IsOptional() @IsString() ownerRfc: string;
  @IsOptional() @IsString() ownerCurp: string;
  @IsOptional() @IsString() ownerEstadoCivil: string;

  // Condiciones legales
  @IsOptional() @IsString() adquiridaMatrimonio: string;
  @IsOptional() @IsString() regimenMatrimonial: string;
  @IsOptional() @IsString() nombreConyuge: string;
  @IsOptional() @IsString() conyugeDeAcuerdo: string;
  @IsOptional() tieneCopropietarios: boolean;
  @IsOptional() @IsString() copropietarios: string;
  @IsOptional() @IsString() quienRealizaVenta: string;

  // Documentos propiedad
  @IsOptional() @IsString() tienePredial: string;
  @IsOptional() @IsString() tieneAgua: string;
  @IsOptional() @IsString() tieneLuz: string;
  @IsOptional() @IsString() tieneAvaluo: string;
  @IsOptional() @IsString() tieneHipoteca: string;
  @IsOptional() @IsString() institucionAcreedora: string;
  @IsOptional() saldoHipoteca: number;
  @IsOptional() provieneHerencia: boolean;
  @IsOptional() adjudicacionConcluida: boolean;

  // Inmueble
  @IsNotEmpty({ message: 'La dirección es requerida.' })
  address: string;

  @IsNotEmpty({ message: 'La ciudad es requerida.' })
  city: string;

  @IsNotEmpty({ message: 'El estado es requerido.' })
  state: string;

  @IsOptional() @IsString() zona: string;
  @IsOptional() @IsString() mapsUrl: string;
  @IsOptional() superficieTerreno: number;
  @IsOptional() superficieConstruccion: number;
  @IsOptional() frenteM: number;
  @IsOptional() fondoM: number;
  @IsOptional() recamaras: number;
  @IsOptional() banosCompletos: number;
  @IsOptional() mediosBanos: number;
  @IsOptional() estacionamientos: number;
  @IsOptional() niveles: number;
  @IsOptional() @IsString() antiguedad: string;
  @IsOptional() @IsString() estadoConservacion: string;
  @IsOptional() @IsString() situacionActual: string;

  // Comercial
  @IsNotEmpty({ message: 'El precio es requerido.' })
  price: number;

  @IsOptional() @IsString() currency: string;
  @IsOptional() esNegociable: boolean;
  @IsOptional() @IsString() formasPago: string;
  @IsOptional() cuotaMantenimiento: number;
  @IsOptional() @IsString() amenidades: string;
  @IsOptional() @IsString() description: string;

  // Captación
  @IsOptional() @IsString() advisorId: string;
  @IsOptional() @IsString() fechaCaptacion: string;
  @IsOptional() autorizacionPromocion: boolean;
  @IsOptional() @IsString() tipoAutorizacion: string;
  @IsOptional() contratoComisionFirmado: boolean;
  @IsOptional() @IsString() fechaFirmaContrato: string;
  @IsOptional() @IsString() vigenciaContrato: string;
  @IsOptional() porcentajeComisionPactado: number;
  @IsOptional() @IsString() observaciones: string;
}

@Controller('properties')
export class PropertiesController {
  constructor(private propertiesService: PropertiesService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('location') location?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('tipoOperacion') tipoOperacion?: string,
  ) {
    return this.propertiesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 12,
      location, type, status,
      priceMin: priceMin ? parseFloat(priceMin) : undefined,
      priceMax: priceMax ? parseFloat(priceMax) : undefined,
      tipoOperacion,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Post()
  async create(@Body() body: CreatePropertyDto) {
    return this.propertiesService.create(body as any);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.propertiesService.updateStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ASESOR)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.propertiesService.update(id, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.propertiesService.remove(id);
  }
}
