import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ComplianceService } from './compliance.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
} from '../../common/validation/patterns';

class UpdateCaseDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) status?: string;
  @IsOptional() @IsBoolean() rfcValid?: boolean;
  @IsOptional() @IsBoolean() identificationValid?: boolean;
  @IsOptional() @IsIn(['negativo', 'positivo', 'pendiente']) pepCheck?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_LARGO) observations?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) alertTrigger?: string;
}

class FindCasesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) status?: string;
  @IsOptional() @IsIn(['Bajo', 'Medio', 'Alto']) riskLevel?: string;
}

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get('kpis')
  getKpis() {
    return this.complianceService.getKpis();
  }

  @Get('cases')
  findAll(@Query() query: FindCasesQueryDto) {
    return this.complianceService.findAll({
      status: query.status,
      riskLevel: query.riskLevel,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });
  }

  @Get('cases/:id')
  findOne(@Param('id') id: string) {
    return this.complianceService.findOne(id);
  }

  @Patch('cases/:id')
  updateCase(@Param('id') id: string, @Body() body: UpdateCaseDto) {
    return this.complianceService.updateCase(id, body);
  }
}
