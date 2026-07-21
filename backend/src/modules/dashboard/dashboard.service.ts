import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface DashboardFilters {
  fechaInicio?: string;
  fechaFin?: string;
  idAsesor?: string;
  tipoOperacion?: string;
  estatusCierre?: string;
}

@Injectable()
export class DashboardService {
  constructor(private databaseService: DatabaseService) {}

  // Filtro para queries sobre `operations` (sin alias, tabla directa en el FROM)
  private opFilter(filters: DashboardFilters, opts: { estatus?: boolean } = {}) {
    const clauses: string[] = [];
    const params: Record<string, any> = {};
    if (filters.fechaInicio) {
      clauses.push('fecha_cierre >= @fFechaInicio');
      params.fFechaInicio = filters.fechaInicio;
    }
    if (filters.fechaFin) {
      clauses.push('fecha_cierre <= @fFechaFin');
      params.fFechaFin = filters.fechaFin;
    }
    if (filters.idAsesor) {
      clauses.push('advisor_id = @fIdAsesor');
      params.fIdAsesor = filters.idAsesor;
    }
    if (filters.tipoOperacion) {
      clauses.push('type = @fTipoOperacion');
      params.fTipoOperacion = filters.tipoOperacion;
    }
    if (opts.estatus && filters.estatusCierre) {
      clauses.push('status = @fEstatusCierre');
      params.fEstatusCierre = filters.estatusCierre;
    }
    return { sql: clauses.map((c) => `AND ${c}`).join(' '), params };
  }

  // Filtro para queries sobre `operations o` (con alias, en JOIN)
  private opFilterAliased(alias: string, filters: DashboardFilters, opts: { estatus?: boolean } = {}) {
    const clauses: string[] = [];
    const params: Record<string, any> = {};
    if (filters.fechaInicio) {
      clauses.push(`${alias}.fecha_cierre >= @fFechaInicio`);
      params.fFechaInicio = filters.fechaInicio;
    }
    if (filters.fechaFin) {
      clauses.push(`${alias}.fecha_cierre <= @fFechaFin`);
      params.fFechaFin = filters.fechaFin;
    }
    if (filters.tipoOperacion) {
      clauses.push(`${alias}.type = @fTipoOperacion`);
      params.fTipoOperacion = filters.tipoOperacion;
    }
    if (opts.estatus && filters.estatusCierre) {
      clauses.push(`${alias}.status = @fEstatusCierre`);
      params.fEstatusCierre = filters.estatusCierre;
    }
    return { sql: clauses.map((c) => `AND ${c}`).join(' '), params };
  }

  // Filtro para queries sobre `properties` (sin alias)
  private propFilter(filters: DashboardFilters) {
    const clauses: string[] = [];
    const params: Record<string, any> = {};
    if (filters.fechaInicio) {
      clauses.push('fecha_captacion >= @fFechaInicio');
      params.fFechaInicio = filters.fechaInicio;
    }
    if (filters.fechaFin) {
      clauses.push('fecha_captacion <= @fFechaFin');
      params.fFechaFin = filters.fechaFin;
    }
    if (filters.idAsesor) {
      clauses.push('advisor_id = @fIdAsesor');
      params.fIdAsesor = filters.idAsesor;
    }
    if (filters.tipoOperacion) {
      clauses.push('tipo_operacion = @fTipoOperacion');
      params.fTipoOperacion = filters.tipoOperacion;
    }
    return { sql: clauses.map((c) => `AND ${c}`).join(' '), params };
  }

  // Filtro por asesor puntual para queries agrupadas `advisors a`
  private advisorFilter(filters: DashboardFilters) {
    if (filters.idAsesor) {
      return { sql: 'AND a.id = @fIdAsesor', params: { fIdAsesor: filters.idAsesor } };
    }
    return { sql: '', params: {} };
  }

  // El AMA se reinicia cada 365 días: antes de cualquier lectura, cierra
  // periodos vencidos y abre el que corresponde a hoy (idempotente).
  private async ensureAmaPeriodsCurrent() {
    await this.databaseService.query(`SELECT public.rollover_ama_periods()`, {});
  }

  async getKpis(filters: DashboardFilters = {}) {
    await this.ensureAmaPeriodsCurrent();
    const prop = this.propFilter(filters);
    const op = this.opFilter(filters);
    const opEstatus = this.opFilter(filters, { estatus: true });

    const [
      propActivas,
      propSinContrato,
      propTotal,
      propPublicables,
      cierresPendientes,
      cierresValidados,
      operacionesCerradasTotal,
      cierresTotal,
      comisionTotalGenerada,
      commPorLiberar,
      commLiberadas,
      commInmobiliaria,
      asesoresActivos,
      asesoresMentoria,
      asesoresAmaAlcanzada,
      commBloqueadas,
    ] = await Promise.all([
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE status IN ('En revisión','Activa','disponible') ${prop.sql}`,
        prop.params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE (contrato_comision_firmado IS NULL OR contrato_comision_firmado = 'false') AND status NOT IN ('vendida','rentada') ${prop.sql}`,
        prop.params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE 1=1 ${prop.sql}`,
        prop.params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE status IN ('Activa','Publicable','Compartible') ${prop.sql}`,
        prop.params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE status IN ('Solicitado','En revisión') ${op.sql}`,
        op.params,
      ),
      this.databaseService.query<any>(
        // Cuenta todos los cierres validados aunque ya hayan avanzado a Liberado/Pagado
        `SELECT COUNT(*) as c FROM public.operations WHERE validado_por_admin = true ${op.sql}`,
        op.params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE status IN ('Validado por administración','Liberado para pago','Pagado') ${op.sql}`,
        op.params,
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE 1=1 ${opEstatus.sql}`,
        opEstatus.params,
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_comision_generada),0) as t FROM public.operations WHERE status != 'Cancelado' ${opEstatus.sql}`,
        opEstatus.params,
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(amount),0) as t, COUNT(*) as c FROM public.commissions WHERE (estatus_comision IN ('Calculada','Pendiente validación') OR (estatus_comision IS NULL AND status != 'Pagada')) ${filters.idAsesor ? 'AND advisor_id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_neto_asesor),0) as t FROM public.commissions WHERE estatus_comision IN ('Liberada','Pagada') ${filters.idAsesor ? 'AND advisor_id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_inmobiliaria),0) as t FROM public.commissions WHERE estatus_comision IN ('Liberada','Pagada') ${filters.idAsesor ? 'AND advisor_id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.advisors WHERE status IN ('Activo', 'En mentoría') ${filters.idAsesor ? 'AND id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.advisors WHERE pasa_por_mentoria = 'true' AND status IN ('Activo', 'En mentoría') ${filters.idAsesor ? 'AND id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
      this.databaseService.query<any>(
        // AMA alcanzada calculada EN VIVO: acumulado real de comisiones netas
        // (cierre, no canceladas) dentro del periodo vigente de cada asesor.
        // Si el asesor pertenece a un team, la meta y el acumulado son
        // COMPARTIDOS entre todos los integrantes (misma regla que
        // computeAdvisorStats / "Mi Dashboard") — DISTINCT para no contar
        // doble a un team que ya alcanzó su meta compartida.
        `SELECT COUNT(*) as c FROM (
           SELECT DISTINCT COALESCE(a.team_id, a.id) as id
           FROM public.advisors a
           LEFT JOIN public.teams t ON t.id = a.team_id
           LEFT JOIN LATERAL (
             SELECT * FROM public.fact_ama_asesor f
             WHERE f.id_asesor = a.id AND f.estatus_ama <> 'Reiniciado'
             ORDER BY f.created_at DESC LIMIT 1
           ) fa ON true
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(c.monto_neto_asesor), 0) as acumulado
             FROM public.commissions c
             JOIN public.operations o ON o.id = c.operation_id
             WHERE c.type = 'cierre' AND o.status <> 'Cancelado'
               AND (
                 (a.team_id IS NOT NULL AND c.advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                 OR (a.team_id IS NULL AND c.advisor_id = a.id)
               )
               -- El filtro de periodo solo aplica a asesores individuales; el
               -- acumulado de team es histórico completo (igual que computeAdvisorStats).
               AND (a.team_id IS NOT NULL OR fa.fecha_inicio_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre >= fa.fecha_inicio_periodo)
               AND (a.team_id IS NOT NULL OR fa.fecha_fin_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre <= fa.fecha_fin_periodo)
           ) acc ON true
           WHERE a.status IN ('Activo', 'En mentoría') ${filters.idAsesor ? 'AND a.id = @fIdAsesor' : ''}
             AND COALESCE(t.meta_ama, fa.meta_ama) > 0 AND acc.acumulado >= COALESCE(t.meta_ama, fa.meta_ama)
         ) x`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c, COALESCE(SUM(monto_neto_asesor),0) as t FROM public.commissions WHERE estatus_comision = 'Bloqueada' ${filters.idAsesor ? 'AND advisor_id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),
    ]);

    return {
      propiedadesActivas: Number(propActivas[0]?.c || 0),
      propiedadesSinContrato: Number(propSinContrato[0]?.c || 0),
      propiedadesTotal: Number(propTotal[0]?.c || 0),
      propiedadesPublicables: Number(propPublicables[0]?.c || 0),
      cierresPendientesValidacion: Number(cierresPendientes[0]?.c || 0),
      cierresValidados: Number(cierresValidados[0]?.c || 0),
      operacionesCerradasTotal: Number(operacionesCerradasTotal[0]?.c || 0),
      cierresTotal: Number(cierresTotal[0]?.c || 0),
      comisionTotalGenerada: Number(comisionTotalGenerada[0]?.t || 0),
      comisionesPorLiberar: Number(commPorLiberar[0]?.t || 0),
      comisionesPorLiberarCount: Number(commPorLiberar[0]?.c || 0),
      comisionesLiberadas: Number(commLiberadas[0]?.t || 0),
      ingresoInmobiliaria: Number(commInmobiliaria[0]?.t || 0),
      asesoresActivos: Number(asesoresActivos[0]?.c || 0),
      asesoresMentoria: Number(asesoresMentoria[0]?.c || 0),
      asesoresAmaAlcanzada: Number(asesoresAmaAlcanzada[0]?.c || 0),
      comisionesBloqueadasCount: Number(commBloqueadas[0]?.c || 0),
      comisionesBloqueadasMonto: Number(commBloqueadas[0]?.t || 0),
    };
  }

  async getCharts(filters: DashboardFilters = {}) {
    await this.ensureAmaPeriodsCurrent();
    const opO = this.opFilterAliased('o', filters, { estatus: true });
    const op = this.opFilter(filters, { estatus: true });
    const advF = this.advisorFilter(filters);
    const prop = this.propFilter(filters);

    const [
      topAdvisors,
      ultimosCierres,
      amaAsesores,
      propSinContrato,
      topCaptadores,
      cumpleanios,
      topRentas,
      topInvitadores,
      operacionesPorTipo,
      distribucionComisiones,
      propiedadesPorEstatus,
    ] = await Promise.all([
      // Top 5 asesores/equipos por comisión total generada (vendedores)
      // Se agregan operaciones y comisiones en subconsultas SEPARADAS para
      // evitar el producto cartesiano (multiplicaba cierres y montos).
      // Si el asesor pertenece a un team, el cierre cuenta para TODOS los
      // integrantes (venta compartida, misma regla que AMA / "Mi Dashboard")
      // y el DISTINCT ON colapsa el team a una sola fila con el nombre del
      // equipo (evita mostrar el mismo resultado duplicado por integrante).
      this.databaseService.query<any>(
        `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(a.team_id, a.id))
                 COALESCE(a.team_id, a.id) as id,
                 COALESCE(t.nombre, a.name) as name,
                 a.status,
                 COALESCE(ops.cierres, 0) as cierres,
                 COALESCE(com.comision_neta, 0) as comision_neta,
                 COALESCE(com.comision_total, 0) as comision_total
          FROM public.advisors a
          LEFT JOIN public.teams t ON t.id = a.team_id
          LEFT JOIN LATERAL (
            SELECT COUNT(*) as cierres
            FROM public.operations o
            WHERE o.status <> 'Cancelado' ${opO.sql}
              AND (
                (a.team_id IS NOT NULL AND o.advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND o.advisor_id = a.id)
              )
          ) ops ON true
          LEFT JOIN LATERAL (
            SELECT SUM(c.monto_neto_asesor) as comision_neta,
                   SUM(c.monto_comision_total) as comision_total
            FROM public.commissions c
            JOIN public.operations o ON o.id = c.operation_id
            WHERE c.type = 'cierre' AND o.status <> 'Cancelado' ${opO.sql}
              AND (
                (a.team_id IS NOT NULL AND c.advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND c.advisor_id = a.id)
              )
          ) com ON true
          WHERE 1=1 ${advF.sql}
          ORDER BY COALESCE(a.team_id, a.id), a.id
        ) x
        ORDER BY comision_total DESC NULLS LAST LIMIT 5
      `,
        { ...opO.params, ...advF.params },
      ),

      // Últimos cierres registrados (respeta filtros)
      this.databaseService.query<any>(
        `
        SELECT o.id, o.code, o.type, o.status, o.fecha_cierre,
               o.monto_comision_generada, o.precio_final_cierre,
               a.name as asesor_name,
               p.address as property_address
        FROM public.operations o
        LEFT JOIN public.advisors a ON o.advisor_id = a.id
        LEFT JOIN public.properties p ON o.property_id = p.id
        WHERE 1=1 ${this.opFilterAliased('o', filters, { estatus: true }).sql} ${filters.idAsesor ? 'AND o.advisor_id = @fIdAsesor' : ''}
        ORDER BY o.created_at DESC LIMIT 8
      `,
        { ...opO.params, ...(filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {}) },
      ),

      // Avance AMA — calculado EN VIVO desde comisiones, con dedup al periodo vigente.
      // Si el asesor pertenece a un team, la meta y el acumulado son COMPARTIDOS
      // entre todos los integrantes (misma regla que computeAdvisorStats / "Mi
      // Dashboard") y el DISTINCT ON colapsa el team a una sola fila con el
      // nombre del equipo.
      this.databaseService.query<any>(
        `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(a.team_id, a.id))
                 COALESCE(a.team_id, a.id) as id,
                 COALESCE(t.nombre, a.name) as name,
                 COALESCE(t.meta_ama, fa.meta_ama) AS meta_ama, fa.estatus_ama,
                 COALESCE(acc.acumulado, 0) AS monto_acumulado,
                 CASE WHEN COALESCE(t.meta_ama, fa.meta_ama) > 0
                      THEN ROUND((COALESCE(acc.acumulado, 0) / COALESCE(t.meta_ama, fa.meta_ama)) * 100, 2)
                      ELSE 0 END AS avance_pct,
                 (COALESCE(t.meta_ama, fa.meta_ama) > 0 AND COALESCE(acc.acumulado, 0) >= COALESCE(t.meta_ama, fa.meta_ama)) AS ama_alcanzada
          FROM public.advisors a
          LEFT JOIN public.teams t ON t.id = a.team_id
          LEFT JOIN LATERAL (
            SELECT * FROM public.fact_ama_asesor f
            WHERE f.id_asesor = a.id AND f.estatus_ama <> 'Reiniciado'
            ORDER BY f.created_at DESC LIMIT 1
          ) fa ON true
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(c.monto_neto_asesor), 0) as acumulado
            FROM public.commissions c
            JOIN public.operations o ON o.id = c.operation_id
            WHERE c.type = 'cierre' AND o.status <> 'Cancelado'
              AND (
                (a.team_id IS NOT NULL AND c.advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND c.advisor_id = a.id)
              )
              -- El filtro de periodo solo aplica a asesores individuales; el
              -- acumulado de team es histórico completo (igual que computeAdvisorStats).
              AND (a.team_id IS NOT NULL OR fa.fecha_inicio_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre >= fa.fecha_inicio_periodo)
              AND (a.team_id IS NOT NULL OR fa.fecha_fin_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre <= fa.fecha_fin_periodo)
          ) acc ON true
          WHERE a.status IN ('Activo', 'En mentoría') ${advF.sql}
          ORDER BY COALESCE(a.team_id, a.id), a.id
        ) x
        ORDER BY avance_pct DESC NULLS LAST
        LIMIT 10
      `,
        advF.params,
      ),

      // Propiedades sin contrato firmado
      this.databaseService.query<any>(
        `
        SELECT id, owner_name, address, city, status, advisor_id, created_at
        FROM public.properties
        WHERE (contrato_comision_firmado IS NULL OR contrato_comision_firmado = 'false')
          AND status NOT IN ('vendida','rentada') ${prop.sql}
        ORDER BY created_at DESC LIMIT 5
      `,
        prop.params,
      ),

      // Top 5 captadores/equipos (por propiedades captadas). Si el asesor
      // pertenece a un team, la captación de cualquier integrante cuenta para
      // el equipo completo (misma regla que computeAdvisorStats / "Mi
      // Dashboard") y el DISTINCT ON colapsa el team a una sola fila.
      this.databaseService.query<any>(
        `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(a.team_id, a.id))
                 COALESCE(a.team_id, a.id) as id,
                 COALESCE(t.nombre, a.name) as name,
                 COALESCE(capt.total_captaciones, 0) as total_captaciones,
                 COALESCE(capt.captaciones_venta, 0) as captaciones_venta,
                 COALESCE(capt.captaciones_renta, 0) as captaciones_renta
          FROM public.advisors a
          LEFT JOIN public.teams t ON t.id = a.team_id
          LEFT JOIN LATERAL (
            SELECT COUNT(p.id) as total_captaciones,
                   COUNT(p.id) FILTER (WHERE p.tipo_operacion = 'Venta') as captaciones_venta,
                   COUNT(p.id) FILTER (WHERE p.tipo_operacion = 'Renta') as captaciones_renta
            FROM public.properties p
            WHERE 1=1 ${prop.sql}
              AND (
                (a.team_id IS NOT NULL AND p.advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND p.advisor_id = a.id)
              )
          ) capt ON true
          WHERE 1=1 ${advF.sql}
          ORDER BY COALESCE(a.team_id, a.id), a.id
        ) x
        WHERE total_captaciones > 0
        ORDER BY total_captaciones DESC LIMIT 5
      `,
        { ...prop.params, ...advF.params },
      ),

      // Asesores con cumpleaños en los próximos 30 días
      this.databaseService.query<any>(
        `
        SELECT id, name, email, phone, fecha_nacimiento,
               TO_CHAR(fecha_nacimiento, 'DD/MM') as cumpleanos_dia_mes
        FROM public.advisors
        WHERE fecha_nacimiento IS NOT NULL
          AND status IN ('Activo', 'En mentoría')
          ${filters.idAsesor ? 'AND id = @fIdAsesor' : ''}
          AND (
            TO_CHAR(fecha_nacimiento, 'MM-DD') BETWEEN TO_CHAR(NOW(), 'MM-DD')
            AND TO_CHAR(NOW() + INTERVAL '30 days', 'MM-DD')
            OR (
              TO_CHAR(NOW() + INTERVAL '30 days', 'MM-DD') < TO_CHAR(NOW(), 'MM-DD')
              AND (
                TO_CHAR(fecha_nacimiento, 'MM-DD') >= TO_CHAR(NOW(), 'MM-DD')
                OR TO_CHAR(fecha_nacimiento, 'MM-DD') <= TO_CHAR(NOW() + INTERVAL '30 days', 'MM-DD')
              )
            )
          )
        ORDER BY TO_CHAR(fecha_nacimiento, 'MM-DD') ASC
        LIMIT 10
      `,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),

      // Top 5 asesores/equipos en rentas. Si el asesor pertenece a un team, la
      // renta cerrada por cualquier integrante cuenta para el equipo completo
      // (misma regla que computeAdvisorStats / "Mi Dashboard") y el DISTINCT
      // ON colapsa el team a una sola fila.
      this.databaseService.query<any>(
        `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(a.team_id, a.id))
                 COALESCE(a.team_id, a.id) as id,
                 COALESCE(t.nombre, a.name) as name,
                 COALESCE(r.rentas_cerradas, 0) as rentas_cerradas,
                 COALESCE(r.comision_neta, 0) as comision_neta
          FROM public.advisors a
          LEFT JOIN public.teams t ON t.id = a.team_id
          LEFT JOIN LATERAL (
            SELECT COUNT(o.id) as rentas_cerradas,
                   COALESCE(SUM(c.monto_neto_asesor), 0) as comision_neta
            FROM public.operations o
            LEFT JOIN public.commissions c ON c.operation_id = o.id AND c.advisor_id = o.advisor_id AND c.type = 'cierre'
            WHERE o.type = 'Renta' ${this.opFilterAliased('o', { ...filters, tipoOperacion: undefined }).sql}
              AND (
                (a.team_id IS NOT NULL AND o.advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND o.advisor_id = a.id)
              )
          ) r ON true
          WHERE 1=1 ${advF.sql}
          ORDER BY COALESCE(a.team_id, a.id), a.id
        ) x
        WHERE rentas_cerradas > 0
        ORDER BY rentas_cerradas DESC, comision_neta DESC LIMIT 5
      `,
        { ...this.opFilterAliased('o', { ...filters, tipoOperacion: undefined }).params, ...advF.params },
      ),

      // Top 5 invitadores/equipos (por asesores invitados + gratificaciones
      // generadas). Si el asesor pertenece a un team, un invitado o una
      // gratificación de cualquier integrante cuenta para el equipo completo
      // (misma regla que computeAdvisorStats / "Mi Dashboard") y el DISTINCT
      // ON colapsa el team a una sola fila. Subconsultas separadas para no
      // multiplicar el conteo de invitados por el número de comisiones.
      this.databaseService.query<any>(
        `
        SELECT * FROM (
          SELECT DISTINCT ON (COALESCE(a.team_id, a.id))
                 COALESCE(a.team_id, a.id) as id,
                 COALESCE(t.nombre, a.name) as name,
                 COALESCE(inv.n, 0) as asesores_invitados,
                 COALESCE(g.grat, 0) as gratificaciones_generadas
          FROM public.advisors a
          LEFT JOIN public.teams t ON t.id = a.team_id
          LEFT JOIN LATERAL (
            SELECT COUNT(*) as n
            FROM public.advisors inv_a
            WHERE inv_a.invite_by_advisor_id IS NOT NULL
              AND inv_a.invite_by_advisor_id <> ''
              AND inv_a.invite_by_advisor_id <> 'Directo'
              AND (
                (a.team_id IS NOT NULL AND inv_a.invite_by_advisor_id IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND inv_a.invite_by_advisor_id = a.id)
              )
          ) inv ON true
          LEFT JOIN LATERAL (
            SELECT SUM(c.monto_invitacion) as grat
            FROM public.commissions c
            WHERE c.id_asesor_invitador IS NOT NULL AND c.id_asesor_invitador <> ''
              AND (
                (a.team_id IS NOT NULL AND c.id_asesor_invitador IN (SELECT id FROM public.advisors WHERE team_id = a.team_id))
                OR (a.team_id IS NULL AND c.id_asesor_invitador = a.id)
              )
          ) g ON true
          WHERE 1=1 ${advF.sql}
          ORDER BY COALESCE(a.team_id, a.id), a.id
        ) x
        WHERE asesores_invitados > 0
        ORDER BY asesores_invitados DESC, gratificaciones_generadas DESC LIMIT 5
      `,
        advF.params,
      ),

      // Operaciones por tipo (Venta / Renta)
      this.databaseService.query<any>(
        `SELECT type, COUNT(*) as c FROM public.operations WHERE status != 'Cancelado' ${op.sql} GROUP BY type`,
        op.params,
      ),

      // Distribución de comisiones (asesor / inmobiliaria / invitación / mentoría)
      this.databaseService.query<any>(
        `SELECT
           COALESCE(SUM(monto_neto_asesor),0) as asesor,
           COALESCE(SUM(monto_inmobiliaria),0) as inmobiliaria,
           COALESCE(SUM(monto_invitacion),0) as invitacion,
           COALESCE(SUM(monto_mentoria),0) as mentoria
         FROM public.commissions
         WHERE 1=1 ${filters.idAsesor ? 'AND advisor_id = @fIdAsesor' : ''}`,
        filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {},
      ),

      // Propiedades por estatus
      this.databaseService.query<any>(
        `SELECT status, COUNT(*) as c FROM public.properties WHERE 1=1 ${prop.sql} GROUP BY status`,
        prop.params,
      ),
    ]);

    return {
      topAsesores: topAdvisors,
      ultimosCierres,
      amaAsesores,
      propiedadesSinContrato: propSinContrato,
      topCaptadores,
      cumpleaniosProximos: cumpleanios,
      topRentas,
      topInvitadores,
      operacionesPorTipo,
      distribucionComisiones: distribucionComisiones[0] ?? null,
      propiedadesPorEstatus,
    };
  }

  async getComisionPorMes(filters: DashboardFilters = {}) {
    // Alias 'o' obligatorio: la query hace JOIN con commissions (que también
    // tiene advisor_id), así que el filtro por asesor debe calificarse con o.
    const op = this.opFilterAliased('o', filters, { estatus: true });
    const advisorClause = filters.idAsesor ? 'AND o.advisor_id = @fIdAsesor' : '';
    const params = {
      ...op.params,
      ...(filters.idAsesor ? { fIdAsesor: filters.idAsesor } : {}),
    };
    const rows = await this.databaseService.query<any>(
      `
      SELECT TO_CHAR(o.fecha_cierre, 'YYYY-MM') as mes,
             COALESCE(SUM(o.monto_comision_generada), 0) as comision_total,
             COALESCE(SUM(c.monto_inmobiliaria), 0) as ingreso_inmobiliaria,
             COUNT(o.id) as operaciones
      FROM public.operations o
      LEFT JOIN public.commissions c ON c.operation_id = o.id AND c.type = 'cierre'
      WHERE o.status != 'Cancelado' AND o.fecha_cierre IS NOT NULL ${op.sql} ${advisorClause}
      GROUP BY TO_CHAR(o.fecha_cierre, 'YYYY-MM')
      ORDER BY mes ASC
      `,
      params,
    );
    return rows.map((r: any) => ({
      mes: r.mes,
      comisionTotal: Number(r.comision_total || 0),
      ingresoInmobiliaria: Number(r.ingreso_inmobiliaria || 0),
      operaciones: Number(r.operaciones || 0),
    }));
  }

  async getAdvisorStats(userId: string) {
    // Resolve the advisor record from the auth user id
    const advisorRows = await this.databaseService.query<any>(
      `SELECT id FROM public.advisors WHERE user_id = @userId LIMIT 1`,
      { userId },
    );
    const advisorId: string | undefined = advisorRows[0]?.id;
    return this.computeAdvisorStats(advisorId);
  }

  // Usado por Admin/Super Admin para ver el "Mi Dashboard" de un asesor puntual
  async getAdvisorStatsByAdvisorId(advisorId: string) {
    return this.computeAdvisorStats(advisorId);
  }

  private async computeAdvisorStats(advisorId: string | undefined) {
    await this.ensureAmaPeriodsCurrent();
    if (!advisorId) {
      return {
        cierresMes: 0,
        cierresAnio: 0,
        comisionNetaTotal: 0,
        comisionNetaMes: 0,
        gratificacionesRecibidas: 0,
        propiedadesActivas: 0,
        propiedadesTotal: 0,
        amaData: null,
        asesoresInvitados: 0,
        ultimasCuatroOps: [],
        advisor: null,
        team: null,
      };
    }

    // Perfil + team del asesor. Si pertenece a un team, TODO se agrega por equipo.
    const advisorRows = await this.databaseService.query<any>(
      `SELECT id, name, email, phone, status, url_foto, specialty, team_id
       FROM public.advisors WHERE id = @advisorId LIMIT 1`,
      { advisorId },
    );
    const advisor = advisorRows[0] ?? null;
    const teamId: string | null = advisor?.team_id ?? null;
    let team: any = null;
    if (teamId) {
      const tRows = await this.databaseService.query<any>(
        `SELECT id, nombre, meta_ama FROM public.teams WHERE id = @teamId LIMIT 1`,
        { teamId },
      );
      team = tRows[0] ?? null;
    }

    // scopeId + predicado: por team (IN todos los integrantes) o por asesor individual.
    const scopeId = teamId ?? advisorId;
    const scope = (col: string) =>
      teamId
        ? `${col} IN (SELECT id FROM public.advisors WHERE team_id = @scopeId)`
        : `${col} = @scopeId`;

    const now = new Date();
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const [
      cierresMesRows,
      cierresAnioRows,
      comisionNetaRows,
      comisionMesRows,
      gratificacionesRows,
      propActivasRows,
      propTotalRows,
      asesoresInvitadosRows,
      ultimasOpsRows,
      pagosMentoriaRows,
    ] = await Promise.all([
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE ${scope('advisor_id')} AND fecha_cierre >= @monthStart AND fecha_cierre < @monthEnd`,
        { scopeId, monthStart, monthEnd },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE ${scope('advisor_id')} AND fecha_cierre >= @yearStart`,
        { scopeId, yearStart },
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_neto_asesor), 0) as t FROM public.commissions WHERE ${scope('advisor_id')}`,
        { scopeId },
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_neto_asesor), 0) as t FROM public.commissions WHERE ${scope('advisor_id')} AND created_at >= @monthStart AND created_at < @monthEnd`,
        { scopeId, monthStart, monthEnd },
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_invitacion), 0) as t FROM public.commissions WHERE ${scope('id_asesor_invitador')}`,
        { scopeId },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE ${scope('advisor_id')} AND status = 'Activa'`,
        { scopeId },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE ${scope('advisor_id')}`,
        { scopeId },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.advisors WHERE ${scope('invite_by_advisor_id')}`,
        { scopeId },
      ),
      this.databaseService.query<any>(
        `SELECT o.id, o.code, o.type, o.status, o.fecha_cierre,
                p.address as property_address,
                c.monto_neto_asesor
         FROM public.operations o
         LEFT JOIN public.properties p ON o.property_id = p.id
         LEFT JOIN public.commissions c ON c.advisor_id = o.advisor_id AND c.operation_id = o.id AND c.type = 'cierre'
         WHERE ${scope('o.advisor_id')}
         ORDER BY o.created_at DESC LIMIT 4`,
        { scopeId },
      ),
      // Pagos por mentoría: comisiones de mentoría donde el mentor está en el scope
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(c.monto_mentoria), 0) as t
         FROM public.commissions c
         JOIN public.advisors a ON a.id = c.advisor_id
         WHERE ${scope('a.id_mentor')}`,
        { scopeId },
      ),
    ]);

    // ── AMA: por team (meta del team + acumulado agregado) o por asesor (periodo vigente) ──
    let amaData: any = null;
    if (teamId) {
      const accRows = await this.databaseService.query<any>(
        `SELECT COALESCE(SUM(c.monto_neto_asesor), 0) as acumulado
         FROM public.commissions c
         JOIN public.operations o ON o.id = c.operation_id
         WHERE ${scope('c.advisor_id')} AND c.type = 'cierre' AND o.status <> 'Cancelado'`,
        { scopeId },
      );
      const acumulado = Number(accRows[0]?.acumulado || 0);
      // Meta AMA del team = valor VIVO de configuración (compartida entre los
      // integrantes, un solo objetivo — no la suma por persona).
      const [metaRow] = await this.databaseService.query<any>(
        `SELECT valor_numerico FROM public.config_parametros_comision
         WHERE nombre_parametro = 'meta_ama' AND activo = true LIMIT 1`,
        {},
      );
      const meta = Number(metaRow?.valor_numerico || 0);
      amaData = {
        meta_ama: meta,
        monto_acumulado: acumulado,
        avance_pct: meta > 0 ? Math.round((acumulado / meta) * 10000) / 100 : 0,
        ama_alcanzada: meta > 0 && acumulado >= meta,
        estatus_ama: 'En progreso',
        fecha_inicio_periodo: null,
        fecha_fin_periodo: null,
      };
    } else {
      const amaRows = await this.databaseService.query<any>(
        `SELECT fa.id, fa.meta_ama, fa.estatus_ama, fa.fecha_inicio_periodo, fa.fecha_fin_periodo,
                COALESCE(acc.acumulado, 0) AS monto_acumulado,
                CASE WHEN fa.meta_ama > 0
                     THEN ROUND((COALESCE(acc.acumulado, 0) / fa.meta_ama) * 100, 2)
                     ELSE 0 END AS avance_pct,
                (fa.meta_ama > 0 AND COALESCE(acc.acumulado, 0) >= fa.meta_ama) AS ama_alcanzada
         FROM public.fact_ama_asesor fa
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(c.monto_neto_asesor), 0) as acumulado
           FROM public.commissions c
           JOIN public.operations o ON o.id = c.operation_id
           WHERE c.advisor_id = @advisorId AND c.type = 'cierre' AND o.status <> 'Cancelado'
             AND (fa.fecha_inicio_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre >= fa.fecha_inicio_periodo)
             AND (fa.fecha_fin_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre <= fa.fecha_fin_periodo)
         ) acc ON true
         WHERE fa.id_asesor = @advisorId AND fa.estatus_ama <> 'Reiniciado'
         ORDER BY fa.created_at DESC LIMIT 1`,
        { advisorId },
      );
      amaData = amaRows[0] ?? null;
    }

    return {
      cierresMes: Number(cierresMesRows[0]?.c || 0),
      cierresAnio: Number(cierresAnioRows[0]?.c || 0),
      comisionNetaTotal: Number(comisionNetaRows[0]?.t || 0),
      comisionNetaMes: Number(comisionMesRows[0]?.t || 0),
      gratificacionesRecibidas: Number(gratificacionesRows[0]?.t || 0),
      propiedadesActivas: Number(propActivasRows[0]?.c || 0),
      propiedadesTotal: Number(propTotalRows[0]?.c || 0),
      amaData,
      asesoresInvitados: Number(asesoresInvitadosRows[0]?.c || 0),
      ultimasCuatroOps: ultimasOpsRows,
      pagosMentoria: Number(pagosMentoriaRows[0]?.t || 0),
      advisor,
      team: team ? { id: team.id, nombre: team.nombre } : null,
    };
  }

  async getConfig() {
    return this.databaseService.query<any>(
      `SELECT *, nombre_parametro AS nombre FROM public.config_parametros_comision ORDER BY id`,
      {},
    );
  }

  async updateConfig(
    id: string,
    valorNumerico: number,
    actualizadoPor?: string,
  ) {
    await this.databaseService.query(
      `UPDATE public.config_parametros_comision
         SET valor_numerico = @val, actualizado_por = @by, updated_at = now()
       WHERE id = @id`,
      { id, val: valorNumerico, by: actualizadoPor || 'admin' },
    );

    // Si se editó la meta AMA, propagar a TODO lo que la usa para que el cambio
    // sea funcional al instante (no un adorno): periodos AMA vigentes de cada
    // asesor y meta compartida de todos los teams. Se recalculan avance, estatus
    // y logro contra el acumulado ya registrado.
    const [param] = await this.databaseService.query<any>(
      `SELECT nombre_parametro FROM public.config_parametros_comision WHERE id = @id LIMIT 1`,
      { id },
    );
    if (param?.nombre_parametro === 'meta_ama') {
      await this.databaseService.query(
        `UPDATE public.fact_ama_asesor SET
           meta_ama = @val,
           avance_pct = CASE WHEN @val > 0
             THEN ROUND((monto_acumulado / @val) * 100, 2) ELSE 0 END,
           ama_alcanzada = (@val > 0 AND monto_acumulado >= @val),
           fecha_ama_alcanzada = CASE
             WHEN @val > 0 AND monto_acumulado >= @val
               THEN COALESCE(fecha_ama_alcanzada, CURRENT_DATE) ELSE NULL END,
           estatus_ama = CASE
             WHEN @val > 0 AND monto_acumulado >= @val THEN 'AMA alcanzada'
             WHEN @val > 0 AND (monto_acumulado / @val) >= 0.8 THEN '80% alcanzado'
             ELSE 'En progreso' END,
           updated_at = now()
         WHERE estatus_ama <> 'Reiniciado'`,
        { val: valorNumerico },
      );
      // Meta del team es COMPARTIDA = mismo valor de config (no × integrantes).
      await this.databaseService.query(
        `UPDATE public.teams SET meta_ama = @val, updated_at = now()`,
        { val: valorNumerico },
      );
    }

    return { success: true };
  }
}
