import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { TemplatesService } from './templates.service';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  /**
   * GET /templates
   * Cualquier usuario autenticado puede ver el listado.
   */
  @Get()
  async findAll() {
    return this.templatesService.findAll();
  }

  /**
   * GET /templates/:id/url
   * Cualquier usuario autenticado puede descargar.
   */
  @Get(':id/url')
  async getDownloadUrl(@Param('id') id: string) {
    return this.templatesService.getDownloadUrl(id);
  }

  /**
   * POST /templates
   * Solo Super Admin y Admin pueden subir plantillas.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({
            fileType: /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body('nombre') nombre: string,
    @Body('categoria') categoria: string,
    @Body('descripcion') descripcion: string,
    @Request() req: any,
  ) {
    return this.templatesService.upload(file, {
      nombre,
      categoria,
      descripcion,
      subidoPor: req.user.id,
    });
  }

  /**
   * DELETE /templates/:id
   * Solo Super Admin y Admin pueden eliminar.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    return this.templatesService.delete(id);
  }
}
