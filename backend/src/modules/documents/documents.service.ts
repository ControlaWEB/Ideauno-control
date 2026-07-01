import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import sharp from 'sharp';
import { DatabaseService } from '../../database/database.service';
import { UserRole } from '../../common/enums/role.enum';
import { EmailService } from '../notifications/email.service';

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_WIDTH = 2000;
const JPEG_QUALITY = 82;
const BUCKET = process.env.STORAGE_BUCKET ?? 'inmobiliaria-docs';
const SIGNED_URL_TTL = 3600;

const ADMIN_ROLES: string[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];

@Injectable()
export class DocumentsService {
  constructor(private db: DatabaseService, private emailService: EmailService) {}

  async upload(
    file: Express.Multer.File,
    meta: {
      entidad: string;
      idEntidad: string;
      tipoDocumento: string;
      subidoPor: string;
    },
  ) {
    let buffer = file.buffer;
    let mimeType = file.mimetype;

    if (IMAGE_TYPES.includes(file.mimetype)) {
      buffer = await sharp(file.buffer)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
      mimeType = 'image/jpeg';
    }

    const ext =
      mimeType === 'image/jpeg' ? 'jpg' : (file.originalname.split('.').pop() ?? 'bin');

    const storagePath = `${meta.entidad}/${meta.idEntidad}/${meta.tipoDocumento}/${Date.now()}.${ext}`;

    const { data, error } = await this.db.storageClient
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const id = 'doc-' + Math.random().toString(36).substring(2, 10);

    await this.db.query(
      `INSERT INTO public.dim_documentos
        (id, entidad_relacionada, id_entidad, tipo_documento, nombre_archivo,
         extension, mime_type, storage_path, subido_por, estatus_documento, fecha_carga)
       VALUES
        (@id, @entidad, @idEnt, @tipo, @nombre, @ext, @mime, @path, @subidoPor, 'Pendiente', NOW())`,
      {
        id,
        entidad: meta.entidad,
        idEnt: meta.idEntidad,
        tipo: meta.tipoDocumento,
        nombre: file.originalname,
        ext,
        mime: mimeType,
        path: data.path,
        subidoPor: meta.subidoPor,
      },
    );

    const signedUrl = await this.buildSignedUrl(data.path);
    return { id, storagePath: data.path, signedUrl };
  }

  async getDocumentUrl(docId: string, requestingUserId: string, requestingRole: string) {
    const [doc] = await this.db.query<any>(
      `SELECT * FROM public.dim_documentos WHERE id = @id LIMIT 1`,
      { id: docId },
    );
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado.`);

    if (!ADMIN_ROLES.includes(requestingRole) && doc.subido_por !== requestingUserId) {
      throw new ForbiddenException('Sin permiso para acceder a este documento.');
    }

    const signedUrl = await this.buildSignedUrl(doc.storage_path);
    return { id: docId, signedUrl, expiresInSeconds: SIGNED_URL_TTL };
  }

  async listByEntity(entidad: string, idEntidad: string) {
    return this.db.query<any>(
      `SELECT id, tipo_documento, nombre_archivo, extension, mime_type,
              estatus_documento, fecha_carga, subido_por, validado_por, observaciones
       FROM public.dim_documentos
       WHERE entidad_relacionada = @entidad AND id_entidad = @idEnt
       ORDER BY fecha_carga DESC`,
      { entidad, idEnt: idEntidad },
    );
  }

  async updateStatus(
    docId: string,
    status: 'Pendiente' | 'Validado' | 'Rechazado' | 'Sustituido',
    validadoPor: string,
    observaciones?: string,
  ) {
    const [doc] = await this.db.query<any>(
      `SELECT id, tipo_documento, subido_por FROM public.dim_documentos WHERE id = @id LIMIT 1`,
      { id: docId },
    );
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado.`);

    await this.db.query(
      `UPDATE public.dim_documentos
       SET estatus_documento = @status, validado_por = @validadoPor,
           fecha_validacion = NOW(), observaciones = @obs
       WHERE id = @id`,
      { id: docId, status, validadoPor, obs: observaciones ?? null },
    );

    if (status === 'Rechazado' && doc.subido_por) {
      const [uploader] = await this.db.query<any>(
        `SELECT email FROM public.usuarios WHERE id = @id LIMIT 1`,
        { id: doc.subido_por },
      );
      if (uploader?.email) {
        await this.emailService.send(
          [uploader.email],
          `Documento rechazado: ${doc.tipo_documento}`,
          `<p>Tu documento <strong>${doc.tipo_documento}</strong> fue rechazado.</p>${observaciones ? `<p><strong>Motivo:</strong> ${observaciones}</p>` : ''}`,
        );
      }
    }

    return { id: docId, status };
  }

  async deleteDocument(docId: string) {
    const [doc] = await this.db.query<any>(
      `SELECT storage_path FROM public.dim_documentos WHERE id = @id LIMIT 1`,
      { id: docId },
    );
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado.`);

    await this.db.storageClient.from(BUCKET).remove([doc.storage_path]);
    await this.db.query(`DELETE FROM public.dim_documentos WHERE id = @id`, { id: docId });
    return { deleted: true };
  }

  private async buildSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.db.storageClient
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL);
    if (error) throw new Error(`Signed URL error: ${error.message}`);
    return data.signedUrl;
  }
}
