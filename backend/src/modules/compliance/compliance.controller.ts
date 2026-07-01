import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get('kpis')
  getKpis() { return this.complianceService.getKpis(); }

  @Get('cases')
  findAll(
    @Query('status') status?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.complianceService.findAll({
      status, riskLevel,
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
    });
  }

  @Get('cases/:id')
  findOne(@Param('id') id: string) { return this.complianceService.findOne(id); }

  @Patch('cases/:id')
  updateCase(@Param('id') id: string, @Body() body: any) {
    return this.complianceService.updateCase(id, body);
  }
}
