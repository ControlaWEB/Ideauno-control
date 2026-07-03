import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
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

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('advisor')
  getAdvisorStats(@Request() req: any) {
    return this.dashboardService.getAdvisorStats(req.user.id);
  }

  @Get('kpis')
  getKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('charts')
  getCharts() {
    return this.dashboardService.getCharts();
  }

  @Get('config')
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
