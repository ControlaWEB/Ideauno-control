import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsInt, Min, Max, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MAX_TEXTO_CORTO } from '../../common/validation/patterns';

class FindNotificationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

class NotificationIdParam {
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  id: string;
}

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  private advisorIdOf(req: any): string {
    return req.user?.advisorId ?? req.user?.id ?? '';
  }

  @Get()
  find(@Request() req: any, @Query() query: FindNotificationsQueryDto) {
    return this.notificationsService.findForAdvisor(
      this.advisorIdOf(req),
      query.limit ?? 20,
    );
  }

  @Patch('read-all')
  markAll(@Request() req: any) {
    return this.notificationsService.markAllRead(this.advisorIdOf(req));
  }

  @Patch(':id/read')
  markRead(@Param() params: NotificationIdParam, @Request() req: any) {
    return this.notificationsService.markRead(params.id, this.advisorIdOf(req));
  }
}
