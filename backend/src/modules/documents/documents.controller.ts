import {
  Controller,
  Post,
  Get,
  Patch,
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
import { DocumentsService } from './documents.service';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  /**
   * POST /documents/upload
   * Body: multipart/form-data
   *   file        — archivo (PDF / JPG / PNG / WEBP, máx 20 MB)
   *   entidad     — 'asesor' | 'propiedad' | 'cierre' | etc.
   *   idEntidad   — ID del registro relacionado
   *   tipoDocumento — 'ine' | 'curp' | 'contrato' | etc.
   */
  @Post('upload')
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
    @Body('entidad') entidad: string,
    @Body('idEntidad') idEntidad: string,
    @Body('tipoDocumento') tipoDocumento: string,
    @Request() req: any,
  ) {
    return this.documentsService.upload(file, {
      entidad,
      idEntidad,
      tipoDocumento,
      subidoPor: req.user.id,
    });
  }

  /**
   * GET /documents/:id/url
   * Devuelve URL firmada con expiración de 1 hora.
   * Asesores solo pueden acceder a sus propios documentos.
   */
  @Get(':id/url')
  async getSignedUrl(@Param('id') id: string, @Request() req: any) {
    return this.documentsService.getDocumentUrl(id, req.user.id, req.user.role);
  }

  /**
   * GET /documents/entity/:entidad/:idEntidad
   * Lista todos los documentos de una entidad (sin URLs — pedir con :id/url).
   */
  @Get('entity/:entidad/:idEntidad')
  async listByEntity(
    @Param('entidad') entidad: string,
    @Param('idEntidad') idEntidad: string,
  ) {
    return this.documentsService.listByEntity(entidad, idEntidad);
  }

  /**
   * PATCH /documents/:id/status
   * Solo admins pueden validar/rechazar documentos.
   */
  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'Pendiente' | 'Validado' | 'Rechazado' | 'Sustituido',
    @Body('observaciones') observaciones: string,
    @Request() req: any,
  ) {
    return this.documentsService.updateStatus(id, status, req.user.id, observaciones);
  }

  /**
   * DELETE /documents/:id
   * Solo Super Admin y Director pueden eliminar documentos.
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async delete(@Param('id') id: string) {
    return this.documentsService.deleteDocument(id);
  }
}
