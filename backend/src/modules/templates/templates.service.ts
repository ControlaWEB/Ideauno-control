import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

const BUCKET = process.env.STORAGE_BUCKET ?? 'inmobiliaria-docs';
const SIGNED_URL_TTL = 3600;

@Injectable()
export class TemplatesService {
  constructor(private db: DatabaseService) {}

  async findAll() {
    return this.db.query<any>(
      `SELECT id, nombre, categoria, descripcion, nombre_archivo, mime_type, subido_por, created_at
       FROM public.dim_plantillas ORDER BY categoria ASC, nombre ASC`,
      {},
    );
  }

  async upload(
    file: Express.Multer.File,
    meta: { nombre: string; categoria: string; descripcion?: string; subidoPor: string },
  ) {
    const id = 'plt-' + Math.random().toString(36).substring(2, 10);
    const ext = file.originalname.split('.').pop() ?? 'pdf';
    const storagePath = `plantillas/${id}.${ext}`;

    const { data, error } = await this.db.storageClient
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    await this.db.query(
      `INSERT INTO public.dim_plantillas
        (id, nombre, categoria, descripcion, nombre_archivo, storage_path, mime_type, subido_por)
       VALUES
        (@id, @nombre, @categoria, @descripcion, @nombreArchivo, @storagePath, @mimeType, @subidoPor)`,
      {
        id,
        nombre: meta.nombre,
        categoria: meta.categoria,
        descripcion: meta.descripcion ?? '',
        nombreArchivo: file.originalname,
        storagePath: data.path,
        mimeType: file.mimetype,
        subidoPor: meta.subidoPor,
      },
    );

    return { id, storagePath: data.path };
  }

  async getDownloadUrl(id: string) {
    const [tpl] = await this.db.query<any>(
      `SELECT storage_path, nombre_archivo FROM public.dim_plantillas WHERE id = @id LIMIT 1`,
      { id },
    );
    if (!tpl) throw new NotFoundException(`Plantilla ${id} no encontrada.`);

    const { data, error } = await this.db.storageClient
      .from(BUCKET)
      .createSignedUrl(tpl.storage_path, SIGNED_URL_TTL, { download: tpl.nombre_archivo });
    if (error) throw new Error(`Signed URL error: ${error.message}`);

    return { id, signedUrl: data.signedUrl, expiresInSeconds: SIGNED_URL_TTL };
  }

  async delete(id: string) {
    const [tpl] = await this.db.query<any>(
      `SELECT storage_path FROM public.dim_plantillas WHERE id = @id LIMIT 1`,
      { id },
    );
    if (!tpl) throw new NotFoundException(`Plantilla ${id} no encontrada.`);

    await this.db.storageClient.from(BUCKET).remove([tpl.storage_path]);
    await this.db.query(`DELETE FROM public.dim_plantillas WHERE id = @id`, { id });
    return { deleted: true };
  }
}
