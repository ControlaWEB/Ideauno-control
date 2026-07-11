import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AuditService } from '../audit/audit.service';
import { AdvisorsService } from '../advisors/advisors.service';

const META_AMA_POR_INTEGRANTE = 180000;

// Payload de un integrante = mismo shape que el alta de asesor individual.
type MemberDto = Parameters<AdvisorsService['create']>[0];

interface CreateTeamDto {
  nombre: string;
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

  /**
   * Crea un team nuevo: fila teams (nombre + cuenta bancaria compartida) +
   * primer integrante (que tiene su PROPIO login, como cualquier asesor).
   */
  async createTeam(dto: CreateTeamDto) {
    const teamId = 'TEAM-' + Math.floor(1000 + Math.random() * 9000);
    const fechaAlta =
      dto.fechaAltaTeam ?? new Date().toISOString().split('T')[0];
    // user_id queda NULL: el team no tiene login propio, cada integrante sí.
    await this.db.query(
      `INSERT INTO public.teams
         (id, user_id, nombre, status, meta_ama, clabe_interbancaria, banco, titular_cuenta, fecha_alta_team)
       VALUES (@id, NULL, @nombre, 'Activo', @metaAma, @clabe, @banco, @titular, @fechaAlta)`,
      {
        id: teamId,
        nombre: dto.nombre,
        metaAma: dto.metaAma ?? 0,
        clabe: dto.clabeInterbancaria ?? '',
        banco: dto.banco ?? '',
        titular: dto.titularCuenta ?? '',
        fechaAlta,
      },
    );

    // Primer integrante: advisor con team_id y su propio login/contraseña.
    const member = await this.advisorsService.create(dto.primerIntegrante, {
      teamId,
    });

    await this.auditService.log({
      action: 'CREATE_TEAM',
      userId: 'system',
      userEmail: 'system',
      details: { teamId, nombre: dto.nombre, primerIntegrante: member.id },
    });

    return { teamId, member };
  }

  /**
   * Crea un team a partir de asesores QUE YA EXISTEN (p. ej. dos dueños que ya
   * se dieron de alta como asesores). No crea logins: solo agrupa. Cada asesor
   * debe existir y no pertenecer aún a ningún team.
   */
  async createTeamFromExisting(dto: {
    nombre: string;
    clabeInterbancaria?: string;
    banco?: string;
    titularCuenta?: string;
    fechaAltaTeam?: string;
    advisorIds: string[];
  }) {
    const advisorIds = [...new Set(dto.advisorIds ?? [])];
    if (advisorIds.length < 1) {
      throw new BadRequestException('Selecciona al menos un asesor.');
    }

    // DatabaseService serializa cada valor con String(), así que un array no
    // sirve para ANY(); se arma un IN (@id0, @id1, ...) con un param por id.
    const idParams: Record<string, string> = {};
    const placeholders = advisorIds
      .map((aid, i) => {
        idParams[`id${i}`] = aid;
        return `@id${i}`;
      })
      .join(', ');

    // Validar que todos existan y ninguno tenga ya un team.
    const rows = await this.db.query<any>(
      `SELECT id, name, team_id FROM public.advisors WHERE id IN (${placeholders})`,
      idParams,
    );
    if (rows.length !== advisorIds.length) {
      throw new NotFoundException('Uno o más asesores no existen.');
    }
    const yaEnTeam = rows.filter((r: any) => r.team_id);
    if (yaEnTeam.length) {
      throw new ConflictException(
        `Ya pertenecen a un team: ${yaEnTeam.map((r: any) => r.name).join(', ')}.`,
      );
    }

    const teamId = 'TEAM-' + Math.floor(1000 + Math.random() * 9000);
    const fechaAlta =
      dto.fechaAltaTeam ?? new Date().toISOString().split('T')[0];
    const metaAma = advisorIds.length * META_AMA_POR_INTEGRANTE;

    await this.db.query(
      `INSERT INTO public.teams
         (id, user_id, nombre, status, meta_ama, clabe_interbancaria, banco, titular_cuenta, fecha_alta_team)
       VALUES (@id, NULL, @nombre, 'Activo', @metaAma, @clabe, @banco, @titular, @fechaAlta)`,
      {
        id: teamId,
        nombre: dto.nombre,
        metaAma,
        clabe: dto.clabeInterbancaria ?? '',
        banco: dto.banco ?? '',
        titular: dto.titularCuenta ?? '',
        fechaAlta,
      },
    );

    await this.db.query(
      `UPDATE public.advisors SET team_id = @teamId, updated_at = NOW()
       WHERE id IN (${placeholders})`,
      { teamId, ...idParams },
    );

    await this.auditService.log({
      action: 'CREATE_TEAM_FROM_EXISTING',
      userId: 'system',
      userEmail: 'system',
      details: { teamId, nombre: dto.nombre, advisorIds },
    });

    return { teamId, advisorIds, meta_ama: metaAma };
  }

  /** Agrega un asesor QUE YA EXISTE (sin team) a un team existente. */
  async addExistingMember(teamId: string, advisorId: string) {
    await this.getTeamRow(teamId);
    const [adv] = await this.db.query<any>(
      `SELECT id, name, team_id FROM public.advisors WHERE id = @id LIMIT 1`,
      { id: advisorId },
    );
    if (!adv) throw new NotFoundException('El asesor no existe.');
    if (adv.team_id) {
      throw new ConflictException(
        adv.team_id === teamId
          ? 'Ese asesor ya está en este team.'
          : 'Ese asesor ya pertenece a otro team.',
      );
    }
    await this.db.query(
      `UPDATE public.advisors SET team_id = @teamId, updated_at = NOW() WHERE id = @id`,
      { teamId, id: advisorId },
    );
    await this.auditService.log({
      action: 'ADD_EXISTING_TEAM_MEMBER',
      userId: 'system',
      userEmail: 'system',
      details: { teamId, advisorId },
    });
    return { teamId, advisorId };
  }

  /** Asesores que pueden formar/unirse a un team: los que no tienen team aún. */
  async listUnteamedAdvisors() {
    return this.db.query<any>(
      `SELECT id, name, email, status FROM public.advisors
       WHERE team_id IS NULL AND status <> 'Baja definitiva'
       ORDER BY name ASC`,
    );
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
