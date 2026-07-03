import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ClientsService {
  constructor(private databaseService: DatabaseService) {}

  async findAll(
    filters: {
      search?: string;
      type?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.search) {
      clauses.push(
        `(name ILIKE @search OR email ILIKE @search OR rfc ILIKE @search)`,
      );
      params.search = `%${filters.search}%`;
    }
    if (filters.type) {
      clauses.push(`type = @type`);
      params.type = filters.type;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [data, countResult] = await Promise.all([
      this.databaseService.query<any>(
        `SELECT * FROM public.clients ${where} ORDER BY name ASC LIMIT @limit OFFSET @offset`,
        params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as total FROM public.clients ${where}`,
        params,
      ),
    ]);

    return {
      data,
      meta: {
        total: Number(countResult[0]?.total || 0),
        page,
        limit,
        totalPages: Math.ceil(Number(countResult[0]?.total || 0) / limit),
      },
    };
  }

  async findOne(id: string) {
    const sql = `SELECT * FROM public.clients WHERE id = @id LIMIT 1`;
    const rows = await this.databaseService.query<any>(sql, { id });
    if (rows.length === 0) {
      throw new NotFoundException(`Cliente con ID ${id} no encontrado.`);
    }
    return rows[0];
  }

  async create(dto: {
    name: string;
    email: string;
    phone?: string;
    rfc?: string;
    type: string;
  }) {
    const id = 'cli-' + Math.random().toString(36).substring(2, 11);

    const sql = `INSERT INTO public.clients (
      id, name, email, phone, rfc, type, created_at, updated_at
    ) VALUES (
      @id, @name, @email, @phone, @rfc, @type, NOW(), NOW()
    )`;

    await this.databaseService.query(sql, {
      id,
      name: dto.name,
      email: dto.email,
      phone: dto.phone || '',
      rfc: dto.rfc || '',
      type: dto.type || 'Individual',
    });

    return { id, ...dto };
  }

  // Solo estas columnas son editables; los keys del body no se interpolan en el SQL
  private static readonly UPDATABLE_COLUMNS = [
    'name',
    'email',
    'phone',
    'rfc',
    'type',
  ];

  async update(id: string, dto: Partial<any>) {
    await this.findOne(id);

    const fields = Object.keys(dto).filter(
      (f) =>
        ClientsService.UPDATABLE_COLUMNS.includes(f) && dto[f] !== undefined,
    );
    if (fields.length === 0) return this.findOne(id);

    const setClauses = fields.map((field) => `${field} = @${field}`);
    const sql = `UPDATE public.clients SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = @id`;

    const params: Record<string, any> = { id };
    for (const f of fields) params[f] = dto[f];
    await this.databaseService.query(sql, params);
    return this.findOne(id);
  }
}
