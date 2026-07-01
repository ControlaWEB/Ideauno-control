import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuditService {
  constructor(private db: DatabaseService) {}

  async log(params: {
    action: string;
    userId: string;
    userEmail: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }): Promise<void> {
    try {
      const id = 'log-' + Math.random().toString(36).substring(2, 12);
      const details = JSON.stringify(params.details ?? {});
      const ipAddress = params.ipAddress ?? '';

      await this.db.query(
        `INSERT INTO public.audit_logs (id, user_id, user_email, action, details, ip_address, timestamp)
         VALUES (@id, @userId, @userEmail, @action, @details, @ipAddress, NOW())`,
        {
          id,
          userId: params.userId,
          userEmail: params.userEmail,
          action: params.action,
          details,
          ipAddress,
        },
      );
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err);
    }
  }

  async findAll(filters: {
    userId?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.userId) {
      clauses.push('user_id = @userId');
      params.userId = filters.userId;
    }
    if (filters.action) {
      clauses.push('action = @action');
      params.action = filters.action;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `SELECT * FROM public.audit_logs ${where} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`;
    const countSql = `SELECT COUNT(*) as total FROM public.audit_logs ${where}`;

    const [data, countResult] = await Promise.all([
      this.db.query<any>(sql, params),
      this.db.query<any>(countSql, params),
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
}
