import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { AdvisorsService } from '../advisors/advisors.service';

// Payload de un integrante = mismo shape que el alta de asesor individual.
type MemberDto = Parameters<AdvisorsService['create']>[0];

interface CreateTeamDto {
  nombre: string;
  email: string; // correo del login compartido del team
  clabeInterbancaria?: string;
  banco?: string;
  titularCuenta?: string;
  metaAma?: number;
  fechaAltaTeam?: string;
  primerIntegrante: MemberDto;
}

@Injectable()
export class TeamsService {
  constructor(
    private db: DatabaseService,
    private auditService: AuditService,
    private advisorsService: AdvisorsService,
  ) {}

  /** Crea un team nuevo: login compartido + fila teams + primer integrante. */
  async createTeam(dto: CreateTeamDto) {
    // 1) Login compartido (una sola fila en usuarios)
    const { userId, tempPassword } = await this.advisorsService.createSharedLogin(
      dto.nombre,
      dto.email,
    );

    // 2) Fila del team
    const teamId = 'TEAM-' + Math.floor(1000 + Math.random() * 9000);
    const fechaAlta =
      dto.fechaAltaTeam ?? new Date().toISOString().split('T')[0];
    await this.db.query(
      `INSERT INTO public.teams
         (id, user_id, nombre, status, meta_ama, clabe_interbancaria, banco, titular_cuenta, fecha_alta_team)
       VALUES (@id, @userId, @nombre, 'Activo', @metaAma, @clabe, @banco, @titular, @fechaAlta)`,
      {
        id: teamId,
        userId,
        nombre: dto.nombre,
        metaAma: dto.metaAma ?? 0,
        clabe: dto.clabeInterbancaria ?? '',
        banco: dto.banco ?? '',
        titular: dto.titularCuenta ?? '',
        fechaAlta,
      },
    );

    // 3) Primer integrante (advisor con team_id, user_id NULL)
    const member = await this.advisorsService.create(dto.primerIntegrante, {
      teamId,
    });

    await this.auditService.log({
      action: 'CREATE_TEAM',
      userId: 'system',
      userEmail: 'system',
      details: { teamId, nombre: dto.nombre, primerIntegrante: member.id },
    });

    return { teamId, userId, tempPassword, member };
  }

  /** Agrega un integrante a un team existente. */
  async addMember(teamId: string, member: MemberDto) {
    await this.getTeamRow(teamId); // valida existencia
    const created = await this.advisorsService.create(member, { teamId });
    await this.auditService.log({
      action: 'ADD_TEAM_MEMBER',
      userId: 'system',
      userEmail: 'system',
      details: { teamId, advisorId: created.id },
    });
    return created;
  }

  private async getTeamRow(teamId: string) {
    const rows = await this.db.query<any>(
      `SELECT * FROM public.teams WHERE id = @id LIMIT 1`,
      { id: teamId },
    );
    if (!rows.length) throw new NotFoundException(`Team ${teamId} no encontrado.`);
    return rows[0];
  }

  /** Detalle del team + integrantes + documentos de cada integrante. */
  async getOne(teamId: string) {
    const team = await this.getTeamRow(teamId);

    const members = await this.db.query<any>(
      `SELECT id, name, email, phone, rfc, curp, status, fecha_alta_asesor
       FROM public.advisors WHERE team_id = @teamId ORDER BY name ASC`,
      { teamId },
    );

    // Documentos de cada integrante (siguen ligados a su advisor.id individual)
    const docs = await this.db.query<any>(
      `SELECT d.id, d.id_entidad AS advisor_id, d.tipo_documento, d.nombre_archivo,
              d.estatus_documento, d.fecha_carga
       FROM public.dim_documentos d
       JOIN public.advisors a ON a.id = d.id_entidad AND a.team_id = @teamId
       WHERE d.entidad_relacionada = 'asesor'
       ORDER BY d.fecha_carga DESC`,
      { teamId },
    );

    const docsByAdvisor: Record<string, any[]> = {};
    for (const d of docs) {
      (docsByAdvisor[d.advisor_id] ??= []).push(d);
    }

    return {
      ...team,
      integrantes: members.map((m: any) => ({
        ...m,
        documentos: docsByAdvisor[m.id] ?? [],
      })),
    };
  }

  /**
   * Agrega los documentos pendientes de TODOS los integrantes del team,
   * para que el admin vea de un vistazo qué falta de cada quién.
   */
  async getDocumentosPendientes(teamId: string) {
    await this.getTeamRow(teamId);
    const rows = await this.db.query<any>(
      `SELECT d.id, d.id_entidad AS advisor_id, a.name AS advisor_name,
              d.tipo_documento, d.nombre_archivo, d.estatus_documento, d.fecha_carga
       FROM public.dim_documentos d
       JOIN public.advisors a ON a.id = d.id_entidad AND a.team_id = @teamId
       WHERE d.entidad_relacionada = 'asesor'
         AND d.estatus_documento <> 'Validado'
       ORDER BY a.name ASC, d.fecha_carga DESC`,
      { teamId },
    );
    return rows;
  }
}
