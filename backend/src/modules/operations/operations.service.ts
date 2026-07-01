import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';

@Injectable()
export class OperationsService {
  constructor(
    private databaseService: DatabaseService,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  /* ─── Helpers ─── */

  private async notifyAdvisor(advisorId: string, subject: string, bodyHtml: string) {
    const [advisor] = await this.databaseService.query<any>(
      `SELECT email FROM public.advisors WHERE id = @id LIMIT 1`,
      { id: advisorId },
    );
    if (advisor?.email) {
      await this.emailService.send([advisor.email], subject, bodyHtml);
    }
  }

  private async getParam(name: string): Promise<number> {
    const rows = await this.databaseService.query<any>(
      `SELECT valor_numerico FROM public.config_parametros_comision WHERE nombre_parametro = @name AND activo = true LIMIT 1`,
      { name },
    );
    return rows[0]?.valor_numerico ?? 0;
  }

  private async getOrCreateAma(advisorId: string, fechaAlta: string | null): Promise<{
    id: string; montoAcumulado: number; ama_alcanzada: boolean; meta_ama: number;
  }> {
    const metaAma = await this.getParam('meta_ama');
    const today = new Date().toISOString().split('T')[0];

    const rows = await this.databaseService.query<any>(
      `SELECT * FROM public.fact_ama_asesor WHERE id_asesor = @advisorId AND estatus_ama != 'Reiniciado' LIMIT 1`,
      { advisorId },
    );

    if (rows.length > 0) return {
      id: rows[0].id,
      montoAcumulado: Number(rows[0].monto_acumulado),
      ama_alcanzada: rows[0].ama_alcanzada,
      meta_ama: Number(rows[0].meta_ama),
    };

    // Crear periodo nuevo
    const inicio = fechaAlta ?? today;
    const fechaFin = new Date(inicio);
    fechaFin.setMonth(fechaFin.getMonth() + 12);
    const amaId = 'ama-' + Math.random().toString(36).substring(2, 10);

    await this.databaseService.query(
      `INSERT INTO public.fact_ama_asesor (id, id_asesor, fecha_inicio_periodo, fecha_fin_periodo, meta_ama, monto_acumulado, avance_pct, ama_alcanzada, estatus_ama)
       VALUES (@id, @advisorId, @inicio, @fin, @meta, 0, 0, false, 'En progreso')`,
      { id: amaId, advisorId, inicio, fin: fechaFin.toISOString().split('T')[0], meta: metaAma },
    );
    return { id: amaId, montoAcumulado: 0, ama_alcanzada: false, meta_ama: metaAma };
  }

  /* ─── Motor de comisiones (spec §9) ─── */

  async calculateCommission(params: {
    operationId: string;
    advisorId: string;
    montoComision: number;
    tipoOperacion: string;
  }) {
    const { operationId, advisorId, montoComision, tipoOperacion } = params;

    // Leer params configurables
    const [pctInvitacion, pctAsesorNormal, pctMentoria, minExentoMentoriaRenta] =
      await Promise.all([
        this.getParam('porcentaje_invitacion'),
        this.getParam('porcentaje_asesor_normal'),
        this.getParam('porcentaje_mentoria'),
        this.getParam('minimo_exento_mentoria_renta'),
      ]);

    // Datos del asesor
    const advRows = await this.databaseService.query<any>(
      `SELECT * FROM public.advisors WHERE id = @id LIMIT 1`,
      { id: advisorId },
    );
    const advisor = advRows[0] ?? {};

    const tieneInvitador = advisor.invite_by_advisor_id &&
      advisor.invite_by_advisor_id !== 'Directo' &&
      advisor.invite_by_advisor_id !== '';

    const pasaMentoria = advisor.pasa_por_mentoria === true ||
      advisor.pasa_por_mentoria === 'true';

    // AMA
    const ama = await this.getOrCreateAma(advisorId, advisor.fecha_alta_asesor);
    const amaAlcanzada = ama.ama_alcanzada;

    // ── Fórmula spec §9.3 ──
    const monto_invitacion = tieneInvitador
      ? parseFloat((montoComision * pctInvitacion).toFixed(2))
      : 0;

    const remanente = parseFloat((montoComision - monto_invitacion).toFixed(2));

    const porcentaje_asesor = amaAlcanzada ? 1.0 : pctAsesorNormal;
    const monto_base_asesor = parseFloat((remanente * porcentaje_asesor).toFixed(2));
    const monto_inmobiliaria = parseFloat((remanente - monto_base_asesor).toFixed(2));

    // Mentoría: aplica si pasa_por_mentoria y no es renta < umbral
    const esRentaBajoUmbral = tipoOperacion.toLowerCase().includes('renta') &&
      montoComision < minExentoMentoriaRenta;
    const aplicaMentoria = pasaMentoria && !esRentaBajoUmbral;

    const monto_mentoria = aplicaMentoria
      ? parseFloat((monto_base_asesor * pctMentoria).toFixed(2))
      : 0;

    const monto_neto_asesor = parseFloat((monto_base_asesor - monto_mentoria).toFixed(2));

    // Guardar comisión principal
    const commId = 'comm-' + Math.random().toString(36).substring(2, 10);
    await this.databaseService.query(
      `INSERT INTO public.commissions (
        id, operation_id, advisor_id, type, amount, status,
        monto_comision_total, porcentaje_invitacion, monto_invitacion, id_asesor_invitador,
        monto_remanente, porcentaje_asesor, monto_base_asesor,
        aplica_mentoria, porcentaje_mentoria, monto_mentoria, id_mentor,
        monto_neto_asesor, monto_inmobiliaria, aplica_ama, estatus_comision
      ) VALUES (
        @id, @opId, @advId, 'cierre', @amount, 'Calculada',
        @comTotal, @pctInv, @mtoInv, @invId,
        @remanente, @pctAdv, @baseAdv,
        @aplMen, @pctMen, @mtoMen, @mentorId,
        @neto, @inmob, @aplAma, 'Calculada'
      )`,
      {
        id: commId, opId: operationId, advId: advisorId,
        amount: monto_neto_asesor,
        comTotal: montoComision,
        pctInv: pctInvitacion, mtoInv: monto_invitacion,
        invId: tieneInvitador ? advisor.invite_by_advisor_id : '',
        remanente,
        pctAdv: porcentaje_asesor, baseAdv: monto_base_asesor,
        aplMen: aplicaMentoria ? 'true' : 'false',
        pctMen: pctMentoria, mtoMen: monto_mentoria,
        mentorId: advisor.id_mentor || advisor.invite_by_advisor_id || '',
        neto: monto_neto_asesor,
        inmob: monto_inmobiliaria,
        aplAma: amaAlcanzada ? 'true' : 'false',
      },
    );

    // Comisión de invitación (al invitador)
    if (tieneInvitador && monto_invitacion > 0) {
      await this.databaseService.query(
        `INSERT INTO public.commissions (id, operation_id, advisor_id, type, amount, status, estatus_comision)
         VALUES (@id, @opId, @invId, 'invitacion', @amount, 'Calculada', 'Calculada')`,
        {
          id: 'comm-' + Math.random().toString(36).substring(2, 10),
          opId: operationId,
          invId: advisor.invite_by_advisor_id,
          amount: monto_invitacion,
        },
      );
    }

    // Comisión de mentoría (al mentor)
    if (aplicaMentoria && monto_mentoria > 0) {
      const mentorId = advisor.id_mentor || advisor.invite_by_advisor_id;
      if (mentorId && mentorId !== advisorId) {
        await this.databaseService.query(
          `INSERT INTO public.commissions (id, operation_id, advisor_id, type, amount, status, estatus_comision)
           VALUES (@id, @opId, @mentorId, 'mentoria', @amount, 'Calculada', 'Calculada')`,
          {
            id: 'comm-' + Math.random().toString(36).substring(2, 10),
            opId: operationId,
            mentorId,
            amount: monto_mentoria,
          },
        );
      }
    }

    // Actualizar AMA del asesor
    const nuevoAcumulado = parseFloat((ama.montoAcumulado + monto_neto_asesor).toFixed(2));
    const nuevoPct = parseFloat(((nuevoAcumulado / ama.meta_ama) * 100).toFixed(2));
    const nuevoAlcanzada = nuevoAcumulado >= ama.meta_ama;
    let nuevoEstatus = 'En progreso';
    if (nuevoAlcanzada) nuevoEstatus = 'AMA alcanzada';
    else if (nuevoPct >= 80) nuevoEstatus = '80% alcanzado';

    await this.databaseService.query(
      `UPDATE public.fact_ama_asesor SET
         monto_acumulado = @monto,
         avance_pct = @pct,
         ama_alcanzada = @alcanzada,
         fecha_ama_alcanzada = @fechaAlc,
         estatus_ama = @estatus,
         updated_at = now()
       WHERE id = @id`,
      {
        id: ama.id,
        monto: nuevoAcumulado,
        pct: nuevoPct,
        alcanzada: nuevoAlcanzada ? 'true' : 'false',
        fechaAlc: nuevoAlcanzada ? new Date().toISOString().split('T')[0] : null,
        estatus: nuevoEstatus,
      },
    );

    return {
      commId,
      monto_comision_total: montoComision,
      monto_invitacion,
      monto_remanente: remanente,
      monto_base_asesor,
      monto_mentoria,
      monto_neto_asesor,
      monto_inmobiliaria,
      aplica_mentoria: aplicaMentoria,
      aplica_ama: amaAlcanzada,
      ama_avance_pct: nuevoPct,
      ama_alcanzada: nuevoAlcanzada,
    };
  }

  /* ─── CRUD ─── */

  async findAll(filters: { page?: number; limit?: number; status?: string; type?: string; advisorId?: string }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.status)    { clauses.push('o.status = @status');       params.status    = filters.status; }
    if (filters.type)      { clauses.push('o.type = @type');            params.type      = filters.type; }
    if (filters.advisorId) { clauses.push('o.advisor_id = @advisorId'); params.advisorId = filters.advisorId; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `SELECT o.*, p.address as property_address, p.type as property_type,
                        a.name as advisor_name
                 FROM public.operations o
                 LEFT JOIN public.properties p ON o.property_id = p.id
                 LEFT JOIN public.advisors a ON o.advisor_id = a.id
                 ${where} ORDER BY o.created_at DESC LIMIT @limit OFFSET @offset`;

    const countSql = `SELECT COUNT(*) as total FROM public.operations o ${where}`;
    const [data, countResult] = await Promise.all([
      this.databaseService.query<any>(sql, params),
      this.databaseService.query<any>(countSql, params),
    ]);

    return {
      data,
      meta: {
        total: Number(countResult[0]?.total || 0),
        page, limit,
        totalPages: Math.ceil(Number(countResult[0]?.total || 0) / limit),
      },
    };
  }

  async findOne(id: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT * FROM public.operations WHERE id = @id LIMIT 1`, { id },
    );
    if (!rows.length) throw new NotFoundException(`Operación ${id} no encontrada.`);
    return rows[0];
  }

  async create(dto: Record<string, any>) {
    const id = 'op-' + Math.random().toString(36).substring(2, 11);
    const year = new Date().getFullYear();
    const code = `OP-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

    const montoComision = parseFloat(dto.montoComisionGenerada ?? dto.totalCommission ?? 0);
    const tipoOp = dto.tipoOperacion ?? dto.type ?? 'Venta';
    const statusInicial = dto.pldExpedienteCompleto ? 'En revisión' : 'Solicitado';

    const sql = `INSERT INTO public.operations (
      id, code, property_id, client_id, advisor_id, type, status,
      contract_value, currency, commission_rate, total_commission, compliance_status,
      propiedad_en_inventario, tipo_cierre_externo, direccion_cierre_externo,
      tipo_inmueble_externo, precio_final_cierre, fecha_cierre, monto_comision_generada,
      doc_cierre_tipo, pld_tipo_cliente, pld_expediente_completo,
      rep_vendedor_tipo, rep_comprador_tipo, asesor_externo_vendedor, asesor_externo_comprador,
      solicita_liberacion, observaciones
    ) VALUES (
      @id, @code, @propertyId, @clientId, @advisorId, @type, @status,
      @contractValue, 'MXN', @commissionRate, @totalCommission, 'Verde',
      @propInventario, @tipoCierreExt, @direccionExt,
      @tipoInmuebleExt, @precioFinal, @fechaCierre, @montoComision,
      @docCierreTipo, @pldTipoCliente, @pldCompleto,
      @repVendedor, @repComprador, @asesorExtVendedor, @asesorExtComprador,
      @solicitaLib, @observaciones
    )`;

    await this.databaseService.query(sql, {
      id, code,
      propertyId: dto.propertyId || dto.property_id || null,
      clientId: dto.clientId || dto.client_id || null,
      advisorId: dto.advisorId || dto.advisor_id || dto.closerId || '',
      type: tipoOp,
      status: statusInicial,
      contractValue: dto.precioFinalCierre ?? dto.contractValue ?? 0,
      commissionRate: dto.commissionRate ?? 0,
      totalCommission: montoComision,
      propInventario: dto.propiedadEnInventario !== false ? 'true' : 'false',
      tipoCierreExt: dto.tipoCierreExterno || '',
      direccionExt: dto.direccionCierreExterno || '',
      tipoInmuebleExt: dto.tipoInmuebleExterno || '',
      precioFinal: dto.precioFinalCierre ?? 0,
      fechaCierre: dto.fechaCierre || null,
      montoComision,
      docCierreTipo: dto.docCierreTipo || '',
      pldTipoCliente: dto.pldTipoCliente || '',
      pldCompleto: dto.pldExpedienteCompleto ? 'true' : 'false',
      repVendedor: dto.repVendedorTipo || '',
      repComprador: dto.repCompradorTipo || '',
      asesorExtVendedor: dto.asesorExternoVendedor || '',
      asesorExtComprador: dto.asesorExternoComprador || '',
      solicitaLib: dto.solicitaLiberacion ? 'true' : 'false',
      observaciones: dto.observaciones || '',
    });

    // Motor de comisiones
    const advisorId = dto.advisorId || dto.advisor_id || dto.closerId || '';
    let commBreakdown: any = null;
    if (advisorId && montoComision > 0) {
      commBreakdown = await this.calculateCommission({
        operationId: id,
        advisorId,
        montoComision,
        tipoOperacion: tipoOp,
      });
    }

    // Marcar propiedad como vendida/rentada si está en inventario
    if (dto.propiedadEnInventario && (dto.propertyId || dto.property_id)) {
      const propId = dto.propertyId || dto.property_id;
      const nuevoEstatus = tipoOp.toLowerCase().includes('renta') ? 'rentada' : 'vendida';
      await this.databaseService.query(
        `UPDATE public.properties SET status = @status WHERE id = @id`,
        { status: nuevoEstatus, id: propId },
      );
    }

    await this.auditService.log({
      action: 'CREATE_OPERATION',
      userId: 'system',
      userEmail: 'system',
      details: { operationId: id, type: tipoOp, montoComision },
    });

    return { id, code, status: statusInicial, commBreakdown };
  }

  async findAllCommissions(filters: { advisorId?: string; status?: string; type?: string; page?: number; limit?: number }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const params: Record<string, any> = { limit, offset };

    if (filters.advisorId) { clauses.push('c.advisor_id = @advId'); params.advId = filters.advisorId; }
    if (filters.status)    { clauses.push('c.estatus_comision = @status'); params.status = filters.status; }
    if (filters.type)      { clauses.push('c.type = @type'); params.type = filters.type; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const rows = await this.databaseService.query<any>(`
      SELECT c.*, a.name as advisor_name, o.code as operation_code, o.type as operation_type
      FROM public.commissions c
      LEFT JOIN public.advisors a ON c.advisor_id = a.id
      LEFT JOIN public.operations o ON c.operation_id = o.id
      ${where}
      ORDER BY c.created_at DESC LIMIT @limit OFFSET @offset
    `, params);

    const total = await this.databaseService.query<any>(`
      SELECT COUNT(*) as t FROM public.commissions c ${where}
    `, params);

    return {
      data: rows,
      meta: { total: Number(total[0]?.t || 0), page, limit, totalPages: Math.ceil(Number(total[0]?.t || 0) / limit) },
    };
  }

  async releaseCommission(commissionId: string, userId: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT id, operation_id, advisor_id, estatus_comision FROM public.commissions WHERE id = @id LIMIT 1`,
      { id: commissionId },
    );
    if (!rows.length) throw new NotFoundException(`Comisión ${commissionId} no encontrada.`);
    const comm = rows[0];

    if (comm.estatus_comision === 'Bloqueada') {
      throw new BadRequestException('Comisión bloqueada. Desbloquear antes de liberar.');
    }
    if (comm.estatus_comision === 'Liberada') {
      throw new BadRequestException('Comisión ya está Liberada.');
    }

    const [opRows] = await this.databaseService.query<any>(
      `SELECT validado_por_admin, pld_expediente_completo FROM public.operations WHERE id = @id LIMIT 1`,
      { id: comm.operation_id },
    );
    if (!opRows?.validado_por_admin) {
      throw new BadRequestException('La operación aún no ha sido validada por administración.');
    }
    if (!opRows.pld_expediente_completo || opRows.pld_expediente_completo === 'false') {
      throw new BadRequestException('Expediente PLD incompleto. No se puede liberar.');
    }

    await this.databaseService.query(
      `UPDATE public.commissions SET estatus_comision = 'Liberada' WHERE id = @id`,
      { id: commissionId },
    );
    await this.auditService.log({
      action: 'RELEASE_COMMISSION',
      userId,
      userEmail: 'system',
      details: { commissionId },
    });
    await this.notifyAdvisor(
      comm.advisor_id,
      `Comisión liberada: ${commissionId}`,
      `<p>Tu comisión <strong>${commissionId}</strong> fue liberada. Ya puedes solicitar tu pago.</p>`,
    );
    return { id: commissionId, estatus_comision: 'Liberada' };
  }

  async blockCommission(commissionId: string, userId: string, motivo: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT id, advisor_id, estatus_comision FROM public.commissions WHERE id = @id LIMIT 1`,
      { id: commissionId },
    );
    if (!rows.length) throw new NotFoundException(`Comisión ${commissionId} no encontrada.`);

    if (['Pagada', 'Cancelada'].includes(rows[0].estatus_comision)) {
      throw new BadRequestException(`No se puede bloquear comisión en estatus: ${rows[0].estatus_comision}`);
    }

    await this.databaseService.query(
      `UPDATE public.commissions SET estatus_comision = 'Bloqueada' WHERE id = @id`,
      { id: commissionId },
    );
    await this.auditService.log({
      action: 'BLOCK_COMMISSION',
      userId,
      userEmail: 'system',
      details: { commissionId, motivo },
    });
    await this.notifyAdvisor(
      rows[0].advisor_id,
      `Comisión bloqueada: ${commissionId}`,
      `<p>Tu comisión <strong>${commissionId}</strong> fue bloqueada.</p><p><strong>Motivo:</strong> ${motivo}</p>`,
    );
    return { id: commissionId, estatus_comision: 'Bloqueada' };
  }

  async unblockCommission(commissionId: string, userId: string) {
    const rows = await this.databaseService.query<any>(
      `SELECT id, advisor_id, estatus_comision FROM public.commissions WHERE id = @id LIMIT 1`,
      { id: commissionId },
    );
    if (!rows.length) throw new NotFoundException(`Comisión ${commissionId} no encontrada.`);
    if (rows[0].estatus_comision !== 'Bloqueada') {
      throw new BadRequestException('Solo se pueden desbloquear comisiones en estatus Bloqueada.');
    }

    await this.databaseService.query(
      `UPDATE public.commissions SET estatus_comision = 'Calculada' WHERE id = @id`,
      { id: commissionId },
    );
    await this.auditService.log({
      action: 'UNBLOCK_COMMISSION',
      userId,
      userEmail: 'system',
      details: { commissionId },
    });
    await this.notifyAdvisor(
      rows[0].advisor_id,
      `Comisión desbloqueada: ${commissionId}`,
      `<p>Tu comisión <strong>${commissionId}</strong> fue desbloqueada y sigue su proceso normal.</p>`,
    );
    return { id: commissionId, estatus_comision: 'Calculada' };
  }

  async cancel(id: string, adminId: string, motivo: string) {
    const op = await this.findOne(id);

    const blockedStatuses = ['Cancelado', 'Pagado'];
    if (blockedStatuses.includes(op.status)) {
      throw new BadRequestException(`Operación no puede cancelarse en estatus: ${op.status}`);
    }

    const paidCommissions = await this.databaseService.query<any>(
      `SELECT id FROM public.commissions WHERE operation_id = @id AND estatus_comision = 'Pagada' LIMIT 1`,
      { id },
    );
    if (paidCommissions.length > 0) {
      throw new BadRequestException(
        'Esta operación tiene comisión ya pagada. La cancelación debe gestionarse por fuera del sistema (contabilidad).',
      );
    }

    await this.databaseService.query(
      `UPDATE public.operations SET status = 'Cancelado', observaciones = @motivo WHERE id = @id`,
      { id, motivo },
    );

    await this.databaseService.query(
      `UPDATE public.commissions SET estatus_comision = 'Cancelada' WHERE operation_id = @id`,
      { id },
    );

    // Revert AMA: subtract commission amount from monto_acumulado
    const commRows = await this.databaseService.query<any>(
      `SELECT advisor_id, monto_neto_asesor FROM public.commissions WHERE operation_id = @id AND type = 'cierre' LIMIT 1`,
      { id },
    );
    if (commRows.length) {
      const { advisor_id, monto_neto_asesor } = commRows[0];
      if (monto_neto_asesor && Number(monto_neto_asesor) > 0) {
        await this.databaseService.query(
          `UPDATE public.fact_ama_asesor
           SET monto_acumulado = GREATEST(0, monto_acumulado - @monto),
               avance_pct = GREATEST(0, ROUND(((monto_acumulado - @monto) / NULLIF(meta_ama, 0)) * 100, 2)),
               ama_alcanzada = CASE WHEN (monto_acumulado - @monto) >= meta_ama THEN true ELSE false END,
               updated_at = now()
           WHERE id_asesor = @advisorId AND estatus_ama = 'En progreso'`,
          { advisorId: advisor_id, monto: Number(monto_neto_asesor) },
        );
      }
    }

    await this.auditService.log({
      action: 'CANCEL_OPERATION',
      userId: adminId,
      userEmail: 'system',
      details: { operationId: id, motivo },
    });

    if (commRows.length) {
      await this.notifyAdvisor(
        commRows[0].advisor_id,
        `Operación cancelada: ${id}`,
        `<p>Tu operación <strong>${id}</strong> fue cancelada.</p><p><strong>Motivo:</strong> ${motivo}</p>`,
      );
    }

    return this.findOne(id);
  }

  async updateStatus(id: string, status: string, adminId?: string) {
    await this.findOne(id);

    if (status === 'Liberado para pago' || status === 'Liberada') {
      const op = await this.findOne(id);
      if (!op.validado_por_admin) {
        throw new BadRequestException(
          'La operación debe ser validada por administración antes de liberar la comisión.'
        );
      }
      if (op.pld_expediente_completo !== 'true' && op.pld_expediente_completo !== true) {
        throw new BadRequestException(
          'El expediente PLD debe estar completo antes de liberar la comisión.'
        );
      }
      await this.databaseService.query(
        `UPDATE public.commissions SET estatus_comision = 'Liberada' WHERE operation_id = @id`,
        { id },
      );
    }

    await this.databaseService.query(
      `UPDATE public.operations SET status = @status WHERE id = @id`, { id, status },
    );
    if (status === 'Validado por administración') {
      await this.databaseService.query(
        `UPDATE public.operations SET validado_por_admin = true, fecha_validacion_admin = @today WHERE id = @id`,
        { id, today: new Date().toISOString().split('T')[0] },
      );
    }
    await this.auditService.log({
      action: 'UPDATE_OPERATION_STATUS',
      userId: adminId ?? 'system',
      userEmail: 'system',
      details: { operationId: id, newStatus: status },
    });

    return this.findOne(id);
  }
}
