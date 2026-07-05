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

  async getKpis(filters: DashboardFilters = {}) {
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
        `SELECT COUNT(*) as c FROM (
           SELECT a.id
           FROM public.advisors a
           LEFT JOIN LATERAL (
             SELECT * FROM public.fact_ama_asesor f
             WHERE f.id_asesor = a.id AND f.estatus_ama <> 'Reiniciado'
             ORDER BY f.created_at DESC LIMIT 1
           ) fa ON true
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(c.monto_neto_asesor), 0) as acumulado
             FROM public.commissions c
             JOIN public.operations o ON o.id = c.operation_id
             WHERE c.advisor_id = a.id AND c.type = 'cierre' AND o.status <> 'Cancelado'
               AND (fa.fecha_inicio_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre >= fa.fecha_inicio_periodo)
               AND (fa.fecha_fin_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre <= fa.fecha_fin_periodo)
           ) acc ON true
           WHERE a.status IN ('Activo', 'En mentoría') ${filters.idAsesor ? 'AND a.id = @fIdAsesor' : ''}
             AND fa.meta_ama > 0 AND acc.acumulado >= fa.meta_ama
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
      // Top 5 asesores por comisión total generada (vendedores)
      // Se agregan operaciones y comisiones en subconsultas SEPARADAS para
      // evitar el producto cartesiano (multiplicaba cierres y montos).
      this.databaseService.query<any>(
        `
        SELECT a.id, a.name, a.status,
               COALESCE(ops.cierres, 0) as cierres,
               COALESCE(com.comision_neta, 0) as comision_neta,
               COALESCE(com.comision_total, 0) as comision_total
        FROM public.advisors a
        LEFT JOIN (
          SELECT advisor_id, COUNT(*) as cierres
          FROM public.operations
          WHERE status <> 'Cancelado' ${op.sql}
          GROUP BY advisor_id
        ) ops ON ops.advisor_id = a.id
        LEFT JOIN (
          SELECT c.advisor_id,
                 SUM(c.monto_neto_asesor) as comision_neta,
                 SUM(c.monto_comision_total) as comision_total
          FROM public.commissions c
          JOIN public.operations o ON o.id = c.operation_id
          WHERE c.type = 'cierre' AND o.status <> 'Cancelado' ${opO.sql}
          GROUP BY c.advisor_id
        ) com ON com.advisor_id = a.id
        WHERE 1=1 ${advF.sql}
        ORDER BY comision_total DESC NULLS LAST LIMIT 5
      `,
        { ...op.params, ...opO.params, ...advF.params },
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
      this.databaseService.query<any>(
        `
        SELECT a.id, a.name, fa.meta_ama, fa.estatus_ama,
               COALESCE(acc.acumulado, 0) AS monto_acumulado,
               CASE WHEN fa.meta_ama > 0
                    THEN ROUND((COALESCE(acc.acumulado, 0) / fa.meta_ama) * 100, 2)
                    ELSE 0 END AS avance_pct,
               (fa.meta_ama > 0 AND COALESCE(acc.acumulado, 0) >= fa.meta_ama) AS ama_alcanzada
        FROM public.advisors a
        LEFT JOIN LATERAL (
          SELECT * FROM public.fact_ama_asesor f
          WHERE f.id_asesor = a.id AND f.estatus_ama <> 'Reiniciado'
          ORDER BY f.created_at DESC LIMIT 1
        ) fa ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(c.monto_neto_asesor), 0) as acumulado
          FROM public.commissions c
          JOIN public.operations o ON o.id = c.operation_id
          WHERE c.advisor_id = a.id AND c.type = 'cierre' AND o.status <> 'Cancelado'
            AND (fa.fecha_inicio_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre >= fa.fecha_inicio_periodo)
            AND (fa.fecha_fin_periodo IS NULL OR o.fecha_cierre IS NULL OR o.fecha_cierre <= fa.fecha_fin_periodo)
        ) acc ON true
        WHERE a.status IN ('Activo', 'En mentoría') ${advF.sql}
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

      // Top 5 captadores (por propiedades captadas)
      this.databaseService.query<any>(
        `
        SELECT a.id, a.name,
               COUNT(p.id) as total_captaciones,
               COUNT(p.id) FILTER (WHERE p.tipo_operacion = 'Venta') as captaciones_venta,
               COUNT(p.id) FILTER (WHERE p.tipo_operacion = 'Renta') as captaciones_renta
        FROM public.advisors a
        LEFT JOIN public.properties p ON p.advisor_id = a.id ${prop.sql}
        WHERE 1=1 ${advF.sql}
        GROUP BY a.id, a.name
        HAVING COUNT(p.id) > 0
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

      // Top 5 asesores en rentas
      this.databaseService.query<any>(
        `
        SELECT a.id, a.name,
               COUNT(o.id) as rentas_cerradas,
               COALESCE(SUM(c.monto_neto_asesor), 0) as comision_neta
        FROM public.advisors a
        LEFT JOIN public.operations o ON o.advisor_id = a.id AND o.type = 'Renta' ${this.opFilterAliased('o', { ...filters, tipoOperacion: undefined }).sql}
        LEFT JOIN public.commissions c ON c.advisor_id = a.id AND c.operation_id = o.id AND c.type = 'cierre'
        WHERE 1=1 ${advF.sql}
        GROUP BY a.id, a.name
        HAVING COUNT(o.id) > 0
        ORDER BY rentas_cerradas DESC, comision_neta DESC LIMIT 5
      `,
        { ...this.opFilterAliased('o', { ...filters, tipoOperacion: undefined }).params, ...advF.params },
      ),

      // Top 5 invitadores (por asesores invitados + gratificaciones generadas)
      // Subconsultas separadas para no multiplicar el conteo de invitados por
      // el número de comisiones de invitación (producto cartesiano).
      this.databaseService.query<any>(
        `
        SELECT a.id, a.name,
               COALESCE(inv.n, 0) as asesores_invitados,
               COALESCE(g.grat, 0) as gratificaciones_generadas
        FROM public.advisors a
        JOIN (
          SELECT invite_by_advisor_id as inv_id, COUNT(*) as n
          FROM public.advisors
          WHERE invite_by_advisor_id IS NOT NULL
            AND invite_by_advisor_id <> ''
            AND invite_by_advisor_id <> 'Directo'
          GROUP BY invite_by_advisor_id
        ) inv ON inv.inv_id = a.id
        LEFT JOIN (
          SELECT id_asesor_invitador as inv_id, SUM(monto_invitacion) as grat
          FROM public.commissions
          WHERE id_asesor_invitador IS NOT NULL AND id_asesor_invitador <> ''
          GROUP BY id_asesor_invitador
        ) g ON g.inv_id = a.id
        WHERE 1=1 ${advF.sql}
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
      };
    }

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
      amaDataRows,
      asesoresInvitadosRows,
      ultimasOpsRows,
      pagosMentoriaRows,
      advisorRows,
    ] = await Promise.all([
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE advisor_id = @advisorId AND fecha_cierre >= @monthStart AND fecha_cierre < @monthEnd`,
        { advisorId, monthStart, monthEnd },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.operations WHERE advisor_id = @advisorId AND fecha_cierre >= @yearStart`,
        { advisorId, yearStart },
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_neto_asesor), 0) as t FROM public.commissions WHERE advisor_id = @advisorId`,
        { advisorId },
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_neto_asesor), 0) as t FROM public.commissions WHERE advisor_id = @advisorId AND created_at >= @monthStart AND created_at < @monthEnd`,
        { advisorId, monthStart, monthEnd },
      ),
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(monto_invitacion), 0) as t FROM public.commissions WHERE id_asesor_invitador = @advisorId`,
        { advisorId },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE advisor_id = @advisorId AND status = 'Activa'`,
        { advisorId },
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.properties WHERE advisor_id = @advisorId`,
        { advisorId },
      ),
      this.databaseService.query<any>(
        // AMA del asesor calculada EN VIVO (periodo vigente + acumulado real)
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
      ),
      this.databaseService.query<any>(
        `SELECT COUNT(*) as c FROM public.advisors WHERE invite_by_advisor_id = @advisorId`,
        { advisorId },
      ),
      this.databaseService.query<any>(
        `SELECT o.id, o.code, o.type, o.status, o.fecha_cierre,
                p.address as property_address,
                c.monto_neto_asesor
         FROM public.operations o
         LEFT JOIN public.properties p ON o.property_id = p.id
         LEFT JOIN public.commissions c ON c.advisor_id = o.advisor_id AND c.operation_id = o.id AND c.type = 'cierre'
         WHERE o.advisor_id = @advisorId
         ORDER BY o.created_at DESC LIMIT 4`,
        { advisorId },
      ),
      // Pagos por mentoría: dinero recibido de comisiones de asesores bajo mi mentoría
      this.databaseService.query<any>(
        `SELECT COALESCE(SUM(c.monto_mentoria), 0) as t
         FROM public.commissions c
         JOIN public.advisors a ON a.id = c.advisor_id
         WHERE a.id_mentor = @advisorId`,
        { advisorId },
      ),
      // Perfil del asesor (para el encabezado de Mi Dashboard)
      this.databaseService.query<any>(
        `SELECT id, name, email, phone, status, url_foto, specialty
         FROM public.advisors WHERE id = @advisorId LIMIT 1`,
        { advisorId },
      ),
    ]);

    return {
      cierresMes: Number(cierresMesRows[0]?.c || 0),
      cierresAnio: Number(cierresAnioRows[0]?.c || 0),
      comisionNetaTotal: Number(comisionNetaRows[0]?.t || 0),
      comisionNetaMes: Number(comisionMesRows[0]?.t || 0),
      gratificacionesRecibidas: Number(gratificacionesRows[0]?.t || 0),
      propiedadesActivas: Number(propActivasRows[0]?.c || 0),
      propiedadesTotal: Number(propTotalRows[0]?.c || 0),
      amaData: amaDataRows[0] ?? null,
      asesoresInvitados: Number(asesoresInvitadosRows[0]?.c || 0),
      ultimasCuatroOps: ultimasOpsRows,
      pagosMentoria: Number(pagosMentoriaRows[0]?.t || 0),
      advisor: advisorRows[0] ?? null,
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
    return { success: true };
  }
}
