import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface CreateNotificationParams {
  advisorId: string;
  type: string;
  title: string;
  body?: string;
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private db: DatabaseService) {}

  /** Crea una notificación in-app para un asesor. No lanza si falla (best-effort). */
  async createForAdvisor(params: CreateNotificationParams): Promise<void> {
    if (!params.advisorId) return;
    try {
      const id = 'notif-' + Math.random().toString(36).substring(2, 12);
      await this.db.query(
        `INSERT INTO public.notifications (id, advisor_id, type, title, body, entity_id, read, created_at)
         VALUES (@id, @advisorId, @type, @title, @body, @entityId, false, NOW())`,
        {
          id,
          advisorId: params.advisorId,
          type: params.type,
          title: params.title,
          body: params.body ?? '',
          entityId: params.entityId ?? '',
        },
      );
    } catch (err) {
      console.error('[NotificationsService] Failed to create notification:', err);
    }
  }

  async findForAdvisor(advisorId: string, limit = 20) {
    if (!advisorId) return { data: [], unread: 0 };
    const data = await this.db.query<any>(
      `SELECT * FROM public.notifications WHERE advisor_id = @advisorId ORDER BY created_at DESC LIMIT @limit`,
      { advisorId, limit },
    );
    const countRows = await this.db.query<any>(
      `SELECT COUNT(*) as unread FROM public.notifications WHERE advisor_id = @advisorId AND read = false`,
      { advisorId },
    );
    return { data, unread: Number(countRows[0]?.unread || 0) };
  }

  async markRead(id: string, advisorId: string) {
    await this.db.query(
      `UPDATE public.notifications SET read = true WHERE id = @id AND advisor_id = @advisorId`,
      { id, advisorId },
    );
    return { ok: true };
  }

  async markAllRead(advisorId: string) {
    if (!advisorId) return { ok: true };
    await this.db.query(
      `UPDATE public.notifications SET read = true WHERE advisor_id = @advisorId AND read = false`,
      { advisorId },
    );
    return { ok: true };
  }
}
