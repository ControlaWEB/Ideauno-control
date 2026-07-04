import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_MONTO, MAX_TEXTO_CORTO } from '../../common/validation/patterns';

class UpdateConfigDto {
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'El valor debe ser un número válido.' },
  )
  @Min(0, { message: 'El valor no puede ser negativo.' })
  @Max(MAX_MONTO, { message: 'El valor excede el máximo permitido.' })
  valorNumerico: number;

  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) actualizadoPor?: string;
}

class DashboardFiltersQuery {
  @IsOptional() @IsString() @MaxLength(20) fechaInicio?: string;
  @IsOptional() @IsString() @MaxLength(20) fechaFin?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) idAsesor?: string;
  @IsOptional() @IsString() @MaxLength(30) tipoOperacion?: string;
  @IsOptional() @IsString() @MaxLength(60) estatusCierre?: string;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('advisor')
  getAdvisorStats(@Request() req: any, @Query('advisorId') advisorId?: string) {
    const canViewOthers =
      req.user.role === UserRole.ADMIN ||
      req.user.role === UserRole.SUPER_ADMIN;
    if (advisorId && canViewOthers) {
      return this.dashboardService.getAdvisorStatsByAdvisorId(advisorId);
    }
    return this.dashboardService.getAdvisorStats(req.user.id);
  }

  @Get('kpis')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getKpis(@Query() filters: DashboardFiltersQuery) {
    return this.dashboardService.getKpis(filters);
  }

  @Get('charts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getCharts(@Query() filters: DashboardFiltersQuery) {
    return this.dashboardService.getCharts(filters);
  }

  @Get('comision-por-mes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getComisionPorMes(@Query() filters: DashboardFiltersQuery) {
    return this.dashboardService.getComisionPorMes(filters);
  }

  @Get('config')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getConfig() {
    return this.dashboardService.getConfig();
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch('config/:id')
  updateConfig(@Param('id') id: string, @Body() body: UpdateConfigDto) {
    return this.dashboardService.updateConfig(
      id,
      body.valorNumerico,
      body.actualizadoPor,
    );
  }
}
