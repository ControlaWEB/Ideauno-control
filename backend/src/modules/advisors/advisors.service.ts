import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../notifications/email.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

@Injectable()
export class AdvisorsService {
  constructor(
    private databaseService: DatabaseService,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  async findAll(status?: string) {
    let sql = `SELECT * FROM public.advisors`;
    const params: Record<string, any> = {};

    if (status && status !== 'Todos') {
      sql += ` WHERE status = @status`;
      params.status = status;
    }

    sql += ` ORDER BY name ASC`;

    const advisors = await this.databaseService.query<any>(sql, params);

    const enrichedAdvisors = await Promise.all(
      advisors.map(async (adv) => {
        const opSql = `SELECT COUNT(*) as closedCount FROM public.operations
                       WHERE advisor_id = @advId AND status IN ('Validado por administración','Liberado para pago','Pagado')`;
        const ops = await this.databaseService.query<any>(opSql, { advId: adv.id });
        const salesClosed = Number(ops[0]?.closedCount || 0);

        let inviterName = 'Directo';
        if (adv.invite_by_advisor_id && adv.invite_by_advisor_id !== 'Directo') {
          const invSql = `SELECT name FROM public.advisors WHERE id = @invId LIMIT 1`;
          const invs = await this.databaseService.query<any>(invSql, { invId: adv.invite_by_advisor_id });
          if (invs.length > 0) {
            inviterName = invs[0].name;
          }
        }

        return { ...adv, salesClosed, inviterName };
      }),
    );

    return enrichedAdvisors;
  }

  async findOne(id: string) {
    const sql = `SELECT * FROM public.advisors WHERE id = @id LIMIT 1`;
    const rows = await this.databaseService.query<any>(sql, { id });
    if (rows.length === 0) {
      throw new NotFoundException(`Asesor comercial con ID ${id} no encontrado.`);
    }

    const adv = rows[0];
    const opSql = `SELECT COUNT(*) as closedCount FROM public.operations
                   WHERE advisor_id = @advId AND status IN ('Validado por administración','Liberado para pago','Pagado')`;
    const ops = await this.databaseService.query<any>(opSql, { advId: adv.id });
    const salesClosed = Number(ops[0]?.closedCount || 0);

    let inviterName = 'Directo';
    if (adv.invite_by_advisor_id && adv.invite_by_advisor_id !== 'Directo') {
      const invSql = `SELECT name FROM public.advisors WHERE id = @invId LIMIT 1`;
      const invs = await this.databaseService.query<any>(invSql, { invId: adv.invite_by_advisor_id });
      if (invs.length > 0) inviterName = invs[0].name;
    }

    let mentorName: string | null = null;
    if (adv.id_mentor && adv.id_mentor !== '') {
      const menSql = `SELECT name FROM public.advisors WHERE id = @mentorId LIMIT 1`;
      const mens = await this.databaseService.query<any>(menSql, { mentorId: adv.id_mentor });
      if (mens.length > 0) mentorName = mens[0].name;
    }

    const [commRows, amaRows] = await Promise.all([
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_neto_asesor), 0) as total FROM public.commissions WHERE advisor_id = @advId`,
        { advId: adv.id },
      ),
      this.databaseService.query<any>(
        `SELECT monto_acumulado, meta_ama, avance_pct, ama_alcanzada, estatus_ama
         FROM public.fact_ama_asesor WHERE id_asesor = @advId AND estatus_ama != 'Reiniciado'
         ORDER BY created_at DESC LIMIT 1`,
        { advId: adv.id },
      ),
    ]);

    const comision_total = Number(commRows[0]?.total || 0);
    const amaData = amaRows[0] ?? null;
    const avance_ama_pct = Number(amaData?.avance_pct || 0);

    return { ...adv, salesClosed, inviterName, mentorName, comision_total, amaData, avance_ama_pct };
  }

  async create(dto: {
    name: string;
    email: string;
    phone?: string;
    rfc?: string;
    curp?: string;
    fechaNacimiento?: string;
    fechaAltaAsesor?: string;
    specialty?: string;
    license?: string;
    status: string;
    inviteByAdvisorId?: string;
    metaAma?: number;
    pasaPorMentoria?: boolean;
    idMentor?: string;
    nombreBeneficiario?: string;
    telefonoBeneficiario?: string;
    correoBeneficiario?: string;
    observaciones?: string;
  }) {
    const id = 'ADV-' + Math.floor(1000 + Math.random() * 9000);

    // Create usuario account for the new asesor (temp password: Idea2024!)
    const userId = randomUUID();
    const tempPasswordHash = await bcrypt.hash('Idea2024!', 10);
    await this.databaseService.query(
      `INSERT INTO public.usuarios (id, name, email, password_hash, role, status, avatar_url)
       VALUES (@userId, @name, @email, @hash, 'Asesor', 'Active', '')`,
      { userId, name: dto.name, email: dto.email, hash: tempPasswordHash },
    );

    const sql = `INSERT INTO public.advisors (
      id, user_id, name, email, phone, rfc, curp, fecha_nacimiento, fecha_alta_asesor,
      specialty, license, status, invite_by_advisor_id, meta_ama,
      pasa_por_mentoria, id_mentor, nombre_beneficiario, telefono_beneficiario,
      correo_beneficiario, observaciones
    ) VALUES (
      @id, @userId, @name, @email, @phone, @rfc, @curp, @fechaNacimiento, @fechaAltaAsesor,
      @specialty, @license, @status, @inviteByAdvisorId, @metaAma,
      @pasaPorMentoria, @idMentor, @nombreBeneficiario, @telefonoBeneficiario,
      @correoBeneficiario, @observaciones
    )`;

    await this.databaseService.query(sql, {
      id,
      userId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone || '',
      rfc: dto.rfc || '',
      curp: dto.curp || '',
      fechaNacimiento: dto.fechaNacimiento || null,
      fechaAltaAsesor: dto.fechaAltaAsesor || null,
      specialty: dto.specialty || 'General',
      license: dto.license || '',
      status: dto.status || 'Activo',
      inviteByAdvisorId: dto.inviteByAdvisorId || 'Directo',
      metaAma: dto.metaAma || 0,
      pasaPorMentoria: dto.pasaPorMentoria ? 'true' : 'false',
      idMentor: dto.idMentor || '',
      nombreBeneficiario: dto.nombreBeneficiario || '',
      telefonoBeneficiario: dto.telefonoBeneficiario || '',
      correoBeneficiario: dto.correoBeneficiario || '',
      observaciones: dto.observaciones || '',
    });

    await this.auditService.log({
      action: 'CREATE_ADVISOR',
      userId: 'system',
      userEmail: 'system',
      details: { advisorId: id, name: dto.name },
    });

    // Initialize AMA period starting on advisor's high date
    const amaId = 'ama-' + Math.random().toString(36).substring(2, 10);
    const fechaInicio = dto.fechaAltaAsesor ?? new Date().toISOString().split('T')[0];
    const fechaFin = new Date(new Date(fechaInicio).setFullYear(new Date(fechaInicio).getFullYear() + 1))
      .toISOString().split('T')[0];
    await this.databaseService.query(
      `INSERT INTO public.fact_ama_asesor
         (id, id_asesor, fecha_inicio_periodo, fecha_fin_periodo, meta_ama,
          monto_acumulado, avance_pct, ama_alcanzada, estatus_ama)
       VALUES (@amaId, @advisorId, @fechaInicio, @fechaFin, @metaAma,
               0, 0, 'false', 'En progreso')`,
      { amaId, advisorId: id, fechaInicio, fechaFin, metaAma: dto.metaAma ?? 180000 },
    );

    await this.emailService.send(
      [dto.email],
      'Bienvenido a Idea Uno Control',
      `<p>Hola <strong>${dto.name}</strong>, tu cuenta de asesor fue creada.</p>
       <p><strong>Correo:</strong> ${dto.email}<br/>
       <strong>Contraseña temporal:</strong> Idea2024!</p>
       <p>Te recomendamos cambiar tu contraseña al iniciar sesión por primera vez.</p>`,
    );

    return { id, userId, tempPassword: 'Idea2024!', ...dto };
  }

  async updateStatus(id: string, dto: { status: string; motivo_baja?: string; fecha_baja?: string }) {
    const advisor = await this.findOne(id);
    await this.databaseService.query(
      `UPDATE public.advisors
       SET status = @status,
           motivo_baja = @motivo,
           fecha_baja = @fecha,
           updated_at = now()
       WHERE id = @id`,
      { id, status: dto.status, motivo: dto.motivo_baja ?? null, fecha: dto.fecha_baja ?? null },
    );
    await this.auditService.log({
      action: 'UPDATE_ADVISOR_STATUS',
      userId: 'system',
      userEmail: 'system',
      details: { advisorId: id, newStatus: dto.status },
    });

    if (dto.status === 'Fallecido' && !advisor.nombre_beneficiario) {
      await this.databaseService.query(
        `UPDATE public.commissions
         SET estatus_comision = 'Bloqueada'
         WHERE advisor_id = @id AND estatus_comision IN ('Calculada', 'Liberada')`,
        { id },
      );

      const owners = await this.databaseService.query<any>(
        `SELECT email FROM public.usuarios WHERE role = 'Super Admin'`,
        {},
      );
      const ownerEmails = owners.map((o) => o.email).filter(Boolean);
      await this.emailService.send(
        ownerEmails,
        `Comisión bloqueada — asesor fallecido sin beneficiario: ${advisor.name}`,
        `<p>El asesor <strong>${advisor.name}</strong> (ID ${id}) fue marcado como Fallecido y no tiene beneficiario registrado.</p>
         <p>Las comisiones pendientes de este asesor fueron bloqueadas automáticamente. Requiere resolución administrativa.</p>`,
      );
    }

    return this.findOne(id);
  }

  async updateBank(id: string, dto: { clabe_interbancaria: string; banco: string; titular_cuenta: string }) {
    await this.findOne(id);
    await this.databaseService.query(
      `UPDATE public.advisors
       SET clabe_interbancaria = @clabe,
           banco = @banco,
           titular_cuenta = @titular,
           updated_at = now()
       WHERE id = @id`,
      { id, clabe: dto.clabe_interbancaria, banco: dto.banco, titular: dto.titular_cuenta },
    );
    await this.auditService.log({
      action: 'UPDATE_ADVISOR_BANK',
      userId: 'system',
      userEmail: 'system',
      details: { advisorId: id },
    });
    return this.findOne(id);
  }

  async update(id: string, dto: Partial<any>) {
    await this.findOne(id);

    const fields = Object.keys(dto);
    if (fields.length === 0) return this.findOne(id);

    const setClauses = fields.map((field) => {
      const snakeField = field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      return `${snakeField} = @${field}`;
    });

    const sql = `UPDATE public.advisors SET ${setClauses.join(', ')} WHERE id = @id`;
    await this.databaseService.query(sql, { id, ...dto });

    await this.auditService.log({
      action: 'UPDATE_ADVISOR',
      userId: 'system',
      userEmail: 'system',
      details: { advisorId: id },
    });

    return this.findOne(id);
  }
}
