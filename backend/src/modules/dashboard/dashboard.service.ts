import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class DashboardService {
  constructor(private databaseService: DatabaseService) {}

  async getKpis() {
    const [
      propActivas, propSinContrato, propTotal,
      cierresPendientes, cierresValidados, cierresTotal,
      commPorLiberar, commLiberadas, commInmobiliaria,
      asesoresActivos, asesoresMentoria,
      commBloqueadas,
    ] = await Promise.all([
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.properties WHERE status IN ('En revisión','Activa','disponible')`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.properties WHERE (contrato_comision_firmado IS NULL OR contrato_comision_firmado = 'false') AND status NOT IN ('vendida','rentada')`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.properties`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.operations WHERE status IN ('Solicitado','En revisión')`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.operations WHERE status = 'Validado por administración'`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.operations`, {}),
      this.databaseService.query<any>(`SELECT COALESCE(SUM(amount),0) as t, COUNT(*) as c FROM public.commissions WHERE estatus_comision IN ('Calculada','Pendiente validación') OR (estatus_comision IS NULL AND status != 'Pagada')`, {}),
      this.databaseService.query<any>(`SELECT COALESCE(SUM(monto_neto_asesor),0) as t FROM public.commissions WHERE estatus_comision IN ('Liberada','Pagada')`, {}),
      this.databaseService.query<any>(`SELECT COALESCE(SUM(monto_inmobiliaria),0) as t FROM public.commissions WHERE estatus_comision IN ('Liberada','Pagada')`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.advisors WHERE status = 'Activo'`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c FROM public.advisors WHERE pasa_por_mentoria = 'true' AND status = 'Activo'`, {}),
      this.databaseService.query<any>(`SELECT COUNT(*) as c, COALESCE(SUM(monto_neto_asesor),0) as t FROM public.commissions WHERE estatus_comision = 'Bloqueada'`, {}),
    ]);

    return {
      propiedadesActivas: Number(propActivas[0]?.c || 0),
      propiedadesSinContrato: Number(propSinContrato[0]?.c || 0),
      propiedadesTotal: Number(propTotal[0]?.c || 0),
      cierresPendientesValidacion: Number(cierresPendientes[0]?.c || 0),
      cierresValidados: Number(cierresValidados[0]?.c || 0),
      cierresTotal: Number(cierresTotal[0]?.c || 0),
      comisionesPorLiberar: Number(commPorLiberar[0]?.t || 0),
      comisionesPorLiberarCount: Number(commPorLiberar[0]?.c || 0),
      comisionesLiberadas: Number(commLiberadas[0]?.t || 0),
      ingresoInmobiliaria: Number(commInmobiliaria[0]?.t || 0),
      asesoresActivos: Number(asesoresActivos[0]?.c || 0),
      asesoresMentoria: Number(asesoresMentoria[0]?.c || 0),
      comisionesBloqueadasCount: Number(commBloqueadas[0]?.c || 0),
      comisionesBloqueadasMonto: Number(commBloqueadas[0]?.t || 0),
    };
  }

  async getCharts() {
    const [topAdvisors, ultimosCierres, amaAsesores, propSinContrato, topCaptadores, cumpleanios, topRentas, topInvitadores] = await Promise.all([
      // Top 5 asesores por comisión total generada (vendedores)
      this.databaseService.query<any>(`
        SELECT a.id, a.name, a.status,
               COUNT(o.id) as cierres,
               COALESCE(SUM(c.monto_neto_asesor), 0) as comision_neta,
               COALESCE(SUM(c.monto_comision_total), 0) as comision_total
        FROM public.advisors a
        LEFT JOIN public.operations o ON o.advisor_id = a.id
        LEFT JOIN public.commissions c ON c.advisor_id = a.id AND c.type = 'cierre'
        GROUP BY a.id, a.name, a.status
        ORDER BY comision_total DESC LIMIT 5
      `, {}),

      // Últimos 8 cierres registrados
      this.databaseService.query<any>(`
        SELECT o.id, o.code, o.type, o.status, o.fecha_cierre,
               o.monto_comision_generada, o.precio_final_cierre,
               a.name as asesor_name,
               p.address as property_address
        FROM public.operations o
        LEFT JOIN public.advisors a ON o.advisor_id = a.id
        LEFT JOIN public.properties p ON o.property_id = p.id
        ORDER BY o.created_at DESC LIMIT 8
      `, {}),

      // Avance AMA todos los asesores activos
      this.databaseService.query<any>(`
        SELECT a.id, a.name, fa.meta_ama, fa.monto_acumulado, fa.avance_pct,
               fa.ama_alcanzada, fa.estatus_ama
        FROM public.advisors a
        LEFT JOIN public.fact_ama_asesor fa ON fa.id_asesor = a.id AND fa.estatus_ama != 'Reiniciado'
        WHERE a.status = 'Activo'
        ORDER BY fa.avance_pct DESC NULLS LAST
        LIMIT 10
      `, {}),

      // Propiedades sin contrato firmado
      this.databaseService.query<any>(`
        SELECT id, owner_name, address, city, status, advisor_id, created_at
        FROM public.properties
        WHERE (contrato_comision_firmado IS NULL OR contrato_comision_firmado = 'false')
          AND status NOT IN ('vendida','rentada')
        ORDER BY created_at DESC LIMIT 5
      `, {}),

      // Top 5 captadores (por propiedades captadas)
      this.databaseService.query<any>(`
        SELECT a.id, a.name,
               COUNT(p.id) as total_captaciones,
               COUNT(p.id) FILTER (WHERE p.tipo_operacion = 'Venta') as captaciones_venta,
               COUNT(p.id) FILTER (WHERE p.tipo_operacion = 'Renta') as captaciones_renta
        FROM public.advisors a
        LEFT JOIN public.properties p ON p.advisor_id = a.id
        GROUP BY a.id, a.name
        HAVING COUNT(p.id) > 0
        ORDER BY total_captaciones DESC LIMIT 5
      `, {}),

      // Asesores con cumpleaños en los próximos 30 días
      this.databaseService.query<any>(`
        SELECT id, name, email, phone, fecha_nacimiento,
               TO_CHAR(fecha_nacimiento, 'DD/MM') as cumpleanos_dia_mes
        FROM public.advisors
        WHERE fecha_nacimiento IS NOT NULL
          AND status = 'Activo'
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
      `, {}),

      // Top 5 asesores en rentas
      this.databaseService.query<any>(`
        SELECT a.id, a.name,
               COUNT(o.id) as rentas_cerradas,
               COALESCE(SUM(c.monto_neto_asesor), 0) as comision_neta
        FROM public.advisors a
        LEFT JOIN public.operations o ON o.advisor_id = a.id AND o.type = 'Renta'
        LEFT JOIN public.commissions c ON c.advisor_id = a.id AND c.operation_id = o.id AND c.type = 'cierre'
        GROUP BY a.id, a.name
        HAVING COUNT(o.id) > 0
        ORDER BY rentas_cerradas DESC, comision_neta DESC LIMIT 5
      `, {}),

      // Top 5 invitadores (por asesores invitados + gratificaciones generadas)
      this.databaseService.query<any>(`
        SELECT a.id, a.name,
               COUNT(inv.id) as asesores_invitados,
               COALESCE(SUM(c.monto_invitacion), 0) as gratificaciones_generadas
        FROM public.advisors a
        LEFT JOIN public.advisors inv ON inv.invite_by_advisor_id = a.id
        LEFT JOIN public.commissions c ON c.id_asesor_invitador = a.id
        GROUP BY a.id, a.name
        HAVING COUNT(inv.id) > 0
        ORDER BY asesores_invitados DESC, gratificaciones_generadas DESC LIMIT 5
      `, {}),
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
    };
  }

  async getAdvisorStats(userId: string) {
    // Resolve the advisor record from the auth user id
    const advisorRows = await this.databaseService.query<any>(
      `SELECT id FROM public.advisors WHERE user_id = @userId LIMIT 1`,
      { userId },
    );
    const advisorId: string | undefined = advisorRows[0]?.id;

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
      cierresMesRows, cierresAnioRows, comisionNetaRows, comisionMesRows,
      gratificacionesRows, propActivasRows, propTotalRows, amaDataRows,
      asesoresInvitadosRows, ultimasOpsRows, pagosMentoriaRows,
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
        `SELECT * FROM public.fact_ama_asesor WHERE id_asesor = @advisorId AND estatus_ama != 'Reiniciado' ORDER BY created_at DESC LIMIT 1`,
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
    };
  }

  async getConfig() {
    return this.databaseService.query<any>(
      `SELECT *, nombre_parametro AS nombre FROM public.config_parametros_comision ORDER BY id`, {},
    );
  }

  async updateConfig(id: string, valorNumerico: number, actualizadoPor?: string) {
    await this.databaseService.query(
      `UPDATE public.config_parametros_comision
         SET valor_numerico = @val, actualizado_por = @by, updated_at = now()
       WHERE id = @id`,
      { id, val: valorNumerico, by: actualizadoPor || 'admin' },
    );
    return { success: true };
  }
}
