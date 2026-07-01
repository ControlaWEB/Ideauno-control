import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ComplianceService {
  constructor(private databaseService: DatabaseService) {}

  async findAll(filters: { status?: string; riskLevel?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.status) { clauses.push('status = @status'); params.status = filters.status; }
    if (filters.riskLevel) { clauses.push('risk_level = @riskLevel'); params.riskLevel = filters.riskLevel; }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `SELECT * FROM public.compliance_cases ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`;
    const countSql = `SELECT COUNT(*) as total FROM public.compliance_cases ${where}`;

    const [data, countResult] = await Promise.all([
      this.databaseService.query<any>(sql, params),
      this.databaseService.query<any>(countSql, params),
    ]);

    const enriched = await Promise.all(
      data.map(async (c) => {
        const opSql = `SELECT code, contract_value FROM public.operations WHERE id = @id LIMIT 1`;
        const clientSql = `SELECT name, rfc FROM public.clients WHERE id = @id LIMIT 1`;
        const [ops, clients] = await Promise.all([
          this.databaseService.query<any>(opSql, { id: c.operation_id }),
          this.databaseService.query<any>(clientSql, { id: c.client_id }),
        ]);
        return {
          ...c,
          operationCode: ops[0]?.code || c.operation_id,
          contractValue: ops[0]?.contract_value || 0,
          clientName: clients[0]?.name || c.client_id,
          clientRfc: clients[0]?.rfc || '',
        };
      }),
    );

    return {
      data: enriched,
      meta: {
        total: Number(countResult[0]?.total || 0),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0]?.total || 0) / limit),
      },
    };
  }

  async findOne(id: string) {
    const sql = `SELECT * FROM public.compliance_cases WHERE id = @id LIMIT 1`;
    const rows = await this.databaseService.query<any>(sql, { id });
    if (!rows.length) throw new NotFoundException(`Expediente de cumplimiento ${id} no encontrado.`);
    return rows[0];
  }

  async updateCase(id: string, dto: {
    status?: string;
    rfcValid?: boolean;
    identificationValid?: boolean;
    pepCheck?: string;
    observations?: string;
    alertTrigger?: string;
  }) {
    const existing = await this.findOne(id);

    const setClauses: string[] = [];
    const params: Record<string, any> = { id };

    if (dto.status !== undefined) { setClauses.push('status = @status'); params.status = dto.status; }
    if (dto.rfcValid !== undefined) { setClauses.push('rfc_valid = @rfcValid'); params.rfcValid = dto.rfcValid; }
    if (dto.identificationValid !== undefined) { setClauses.push('identification_valid = @identificationValid'); params.identificationValid = dto.identificationValid; }
    if (dto.pepCheck !== undefined) { setClauses.push('pep_check = @pepCheck'); params.pepCheck = dto.pepCheck; }
    if (dto.observations !== undefined) { setClauses.push('observations = @observations'); params.observations = dto.observations; }
    if (dto.alertTrigger !== undefined) { setClauses.push('alert_trigger = @alertTrigger'); params.alertTrigger = dto.alertTrigger; }

    if (setClauses.length > 0) {
      const sql = `UPDATE public.compliance_cases SET ${setClauses.join(', ')} WHERE id = @id`;
      await this.databaseService.query(sql, params);
    }

    if (dto.status === 'validado' && existing.status !== 'validado') {
      const unlockSql = `UPDATE public.commissions SET status = 'pendiente' WHERE operation_id = @opId AND status = 'retenido'`;
      await this.databaseService.query(unlockSql, { opId: existing.operation_id });

      const updateOp = `UPDATE public.operations SET compliance_status = 'Verde' WHERE id = @opId`;
      await this.databaseService.query(updateOp, { opId: existing.operation_id });
    }

    return this.findOne(id);
  }

  async getKpis() {
    const [overThreshold, pendingSat, criticalAlerts, thresholdInfo] = await Promise.all([
      this.databaseService.query<any>(`SELECT COUNT(*) as count FROM public.compliance_cases`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as count FROM public.compliance_cases WHERE status = 'pendiente_docs' OR status = 'en_integracion'`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as count FROM public.compliance_cases WHERE status = 'bloqueado'`, {}),
      Promise.resolve([{ threshold: 941412.75, currency: 'MXN', law: 'Art. 17 Fracc. V - LFPIORPI' }]),
    ]);

    return {
      operacionesOverThreshold: Number(overThreshold[0]?.count || 0),
      avisosSatPendientes: Number(pendingSat[0]?.count || 0),
      alertasCriticas: Number(criticalAlerts[0]?.count || 0),
      umbralActual: thresholdInfo[0],
    };
  }
}
