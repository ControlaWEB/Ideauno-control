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
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MAX_NOMBRE, MAX_TEXTO_LARGO } from '../../common/validation/patterns';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const CATEGORIAS = ['KYC', 'PLD', 'Contrato', 'Otro'];

class UploadTemplateDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'El nombre de la plantilla es requerido.' })
  @IsString()
  @MaxLength(MAX_NOMBRE)
  nombre: string;

  @IsNotEmpty({ message: 'La categoría es requerida.' })
  @IsIn(CATEGORIAS, {
    message: `La categoría debe ser una de: ${CATEGORIAS.join(', ')}.`,
  })
  categoria: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  descripcion?: string;
}

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
    @Body() body: UploadTemplateDto,
    @Request() req: any,
  ) {
    return this.templatesService.upload(file, {
      nombre: body.nombre,
      categoria: body.categoria,
      descripcion: body.descripcion ?? '',
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
