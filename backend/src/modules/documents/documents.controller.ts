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
  PayloadTooLargeException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { DocumentsService } from './documents.service';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MAX_TEXTO_CORTO,
  MAX_TEXTO_LARGO,
} from '../../common/validation/patterns';

// Escrituras hasta 30 MB; cualquier otro documento máximo 2 MB.
const MAX_ESCRITURA_SIZE = 30 * 1024 * 1024; // 30 MB
const MAX_DEFAULT_SIZE = 2 * 1024 * 1024; //  2 MB
const limitFor = (tipoDocumento: string) =>
  tipoDocumento === 'escritura' ? MAX_ESCRITURA_SIZE : MAX_DEFAULT_SIZE;

const ENTIDADES = ['asesor', 'propiedad', 'cierre', 'cliente', 'operacion'];
const DOC_STATUSES = ['Pendiente', 'Validado', 'Rechazado', 'Sustituido'];

class UploadDocumentDto {
  @IsNotEmpty({ message: 'La entidad es requerida.' })
  @IsIn(ENTIDADES, {
    message: `La entidad debe ser una de: ${ENTIDADES.join(', ')}.`,
  })
  entidad: string;

  @IsNotEmpty({ message: 'El ID de la entidad es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  idEntidad: string;

  @IsNotEmpty({ message: 'El tipo de documento es requerido.' })
  @IsString()
  @MaxLength(MAX_TEXTO_CORTO)
  tipoDocumento: string;
}

class UpdateDocumentStatusDto {
  @IsNotEmpty({ message: 'El estatus es requerido.' })
  @IsIn(DOC_STATUSES, {
    message: `El estatus debe ser uno de: ${DOC_STATUSES.join(', ')}.`,
  })
  status: 'Pendiente' | 'Validado' | 'Rechazado' | 'Sustituido';

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXTO_LARGO)
  observaciones?: string;
}

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
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Cap absoluto de memoria = el mayor límite permitido (escritura, 50 MB).
      limits: { fileSize: MAX_ESCRITURA_SIZE },
    }),
  )
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_ESCRITURA_SIZE }),
          new FileTypeValidator({
            fileType: /^(image\/(jpeg|jpg|png|webp)|application\/pdf)$/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() body: UploadDocumentDto,
    @Request() req: any,
  ) {
    // Límite por tipo: escritura 50 MB, el resto 2 MB.
    const limit = limitFor(body.tipoDocumento);
    if (file.size > limit) {
      const mb = limit === MAX_ESCRITURA_SIZE ? '30' : '2';
      throw new PayloadTooLargeException(
        `El archivo excede el máximo permitido de ${mb} MB para este tipo de documento.`,
      );
    }
    return this.documentsService.upload(file, {
      entidad: body.entidad,
      idEntidad: body.idEntidad,
      tipoDocumento: body.tipoDocumento,
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
    @Body() body: UpdateDocumentStatusDto,
    @Request() req: any,
  ) {
    return this.documentsService.updateStatus(
      id,
      body.status,
      req.user.id,
      body.observaciones ?? '',
    );
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
