import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private databaseService: DatabaseService,
    private auditService: AuditService,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  private async notifyAdvisorOfPayment(
    paymentId: string,
    subject: string,
    bodyHtml: string,
    inApp?: { type: string; title: string; body: string },
  ) {
    const [row] = await this.databaseService.query<any>(
      `SELECT p.id_asesor, a.email FROM public.fact_pagos p
       LEFT JOIN public.advisors a ON p.id_asesor = a.id
       WHERE p.id = @id LIMIT 1`,
      { id: paymentId },
    );
    if (row?.email) {
      await this.emailService.send([row.email], subject, bodyHtml);
    }
    if (inApp && row?.id_asesor) {
      await this.notificationsService.createForAdvisor({
        advisorId: row.id_asesor,
        type: inApp.type,
        title: inApp.title,
        body: inApp.body,
        entityId: paymentId,
      });
    }
  }

  async requestPayment(commissionId: string, advisorId: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT id, operation_id, advisor_id, amount, estatus_comision
       FROM public.commissions WHERE id = @id LIMIT 1`,
      { id: commissionId },
    );
    if (!rows.length)
      throw new NotFoundException(`Comisión ${commissionId} no encontrada.`);
    const commission = rows[0];

    // La comisión debe pertenecer al asesor indicado
    if (commission.advisor_id !== advisorId) {
      throw new BadRequestException(
        'La comisión no pertenece al asesor indicado.',
      );
    }

    // Evitar solicitudes duplicadas de pago para la misma comisión
    const existing = await this.databaseService.query<any>(
      `SELECT id FROM public.fact_pagos
       WHERE id_comision = @idComision AND estatus_pago IN ('Solicitado', 'Autorizado')
       LIMIT 1`,
      { idComision: commissionId },
    );
    if (existing.length > 0) {
      throw new BadRequestException(
        'Ya existe una solicitud de pago activa para esta comisión.',
      );
    }

    if (commission.estatus_comision !== 'Liberada') {
      throw new BadRequestException(
        `La comisión no está en estatus Liberada. Estatus actual: ${commission.estatus_comision}`,
      );
    }

    const id = 'pago-' + Math.random().toString(36).substring(2, 10);

    await this.databaseService.query(
      `INSERT INTO public.fact_pagos
         (id, id_comision, id_asesor, fecha_solicitud, monto_solicitado, estatus_pago)
       VALUES (@id, @idComision, @idAsesor, NOW(), @monto, 'Solicitado')`,
      {
        id,
        idComision: commissionId,
        idAsesor: advisorId,
        monto: commission.amount,
      },
    );

    return { id, estatus_pago: 'Solicitado' };
  }

  async findAll(filters: {
    advisorId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.advisorId) {
      clauses.push('p.id_asesor = @advisorId');
      params.advisorId = filters.advisorId;
    }
    if (filters.status) {
      clauses.push('p.estatus_pago = @status');
      params.status = filters.status;
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT p.*, c.amount AS commission_amount, c.operation_id, a.name AS advisor_name
      FROM public.fact_pagos p
      LEFT JOIN public.commissions c ON p.id_comision = c.id
      LEFT JOIN public.advisors a ON p.id_asesor = a.id
      ${where}
      ORDER BY p.fecha_solicitud DESC LIMIT @limit OFFSET @offset`;

    const countSql = `SELECT COUNT(*) as total FROM public.fact_pagos p ${where}`;

    const [data, countResult] = await Promise.all([
      this.databaseService.query<any>(sql, params),
      this.databaseService.query<any>(countSql, params),
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
    const rows = await this.databaseService.query<any>(
      `SELECT p.*, c.amount AS commission_amount, c.operation_id, c.estatus_comision,
              a.name AS advisor_name
       FROM public.fact_pagos p
       LEFT JOIN public.commissions c ON p.id_comision = c.id
       LEFT JOIN public.advisors a ON p.id_asesor = a.id
       WHERE p.id = @id LIMIT 1`,
      { id },
    );
    if (!rows.length) throw new NotFoundException(`Pago ${id} no encontrado.`);
    return rows[0];
  }

  async authorize(id: string, adminId: string) {
    await this.findOne(id);
    await this.databaseService.query(
      `UPDATE public.fact_pagos
       SET estatus_pago = 'Autorizado', autorizado_por = @adminId
       WHERE id = @id`,
      { id, adminId },
    );
    await this.auditService.log({
      action: 'AUTHORIZE_PAYMENT',
      userId: adminId,
      userEmail: 'system',
      details: { paymentId: id },
    });
    await this.notifyAdvisorOfPayment(
      id,
      `Pago autorizado: ${id}`,
      `<p>Tu pago <strong>${id}</strong> fue autorizado y está en proceso.</p>`,
      {
        type: 'PAYMENT_AUTHORIZED',
        title: 'Pago autorizado',
        body: `Tu pago ${id} fue autorizado y está en proceso.`,
      },
    );
    return this.findOne(id);
  }

  async markPaid(
    id: string,
    adminId: string,
    formaPago: string,
    monto: number,
    options?: {
      requiereCfdi?: boolean;
      uuidCfdi?: string;
      referenciaTransferencia?: string;
    },
  ) {
    await this.findOne(id);
    await this.databaseService.query(
      `UPDATE public.fact_pagos
       SET estatus_pago = 'Pagado', fecha_pago = NOW(),
           forma_pago = @formaPago, monto_pagado = @monto, autorizado_por = @adminId,
           requiere_cfdi = @requiereCfdi, uuid_cfdi = @uuidCfdi,
           referencia_transferencia = @refTransferencia
       WHERE id = @id`,
      {
        id,
        adminId,
        formaPago,
        monto,
        requiereCfdi: options?.requiereCfdi ?? false,
        uuidCfdi: options?.uuidCfdi ?? null,
        refTransferencia: options?.referenciaTransferencia ?? null,
      },
    );
    await this.auditService.log({
      action: 'MARK_PAYMENT_PAID',
      userId: adminId,
      userEmail: 'system',
      details: { paymentId: id, formaPago, monto },
    });
    await this.notifyAdvisorOfPayment(
      id,
      `Pago realizado: ${id}`,
      `<p>Tu pago <strong>${id}</strong> fue procesado.</p>
       <p><strong>Monto:</strong> $${Number(monto).toLocaleString('es-MX')} MXN<br/>
       <strong>Forma de pago:</strong> ${formaPago}</p>`,
      {
        type: 'PAYMENT_PAID',
        title: 'Pago realizado',
        body: `Tu pago ${id} fue procesado por $${Number(monto).toLocaleString('es-MX')} MXN (${formaPago}).`,
      },
    );
    return this.findOne(id);
  }

  async reject(id: string, adminId: string, observaciones?: string) {
    await this.findOne(id);
    await this.databaseService.query(
      `UPDATE public.fact_pagos
       SET estatus_pago = 'Rechazado', autorizado_por = @adminId, observaciones = @obs
       WHERE id = @id`,
      { id, adminId, obs: observaciones ?? null },
    );
    await this.auditService.log({
      action: 'REJECT_PAYMENT',
      userId: adminId,
      userEmail: 'system',
      details: { paymentId: id, observaciones },
    });
    await this.notifyAdvisorOfPayment(
      id,
      `Pago rechazado: ${id}`,
      `<p>Tu solicitud de pago <strong>${id}</strong> fue rechazada.</p>${observaciones ? `<p><strong>Motivo:</strong> ${observaciones}</p>` : ''}`,
      {
        type: 'PAYMENT_REJECTED',
        title: 'Pago rechazado',
        body: `Tu solicitud de pago ${id} fue rechazada.${observaciones ? ` Motivo: ${observaciones}` : ''}`,
      },
    );
    return this.findOne(id);
  }
}
