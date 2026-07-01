import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { IsNumber, IsOptional, IsString } from 'class-validator';

class UpdateConfigDto {
  @IsNumber() valorNumerico: number;
  @IsOptional() @IsString() actualizadoPor?: string;
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
  getKpis() { return this.dashboardService.getKpis(); }

  @Get('charts')
  getCharts() { return this.dashboardService.getCharts(); }

  @Get('config')
  getConfig() { return this.dashboardService.getConfig(); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch('config/:id')
  updateConfig(@Param('id') id: string, @Body() body: UpdateConfigDto) {
    return this.dashboardService.updateConfig(id, body.valorNumerico, body.actualizadoPor);
  }
}
