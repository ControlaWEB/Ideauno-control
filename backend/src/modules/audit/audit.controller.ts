import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { MAX_TEXTO_CORTO } from '../../common/validation/patterns';

class FindAuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) userId?: string;
  @IsOptional() @IsString() @MaxLength(MAX_TEXTO_CORTO) action?: string;
}

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  findAll(@Query() query: FindAuditQueryDto) {
    return this.auditService.findAll({
      userId: query.userId,
      action: query.action,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
