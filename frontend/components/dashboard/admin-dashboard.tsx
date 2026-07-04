'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, commissionsApi, paymentsApi } from '@/lib/api';
import type { DashboardFilters } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Building2, Clock, DollarSign, Users, CheckCircle2, TrendingUp,
  AlertCircle, ArrowRight, ShieldAlert, Lock, Award,
} from 'lucide-react';
import { KpiCard } from './kpi-card';
import { RankingCard } from './ranking-card';
import { DashboardFiltersBar } from './filters-bar';
import { ComisionPorMesChart } from './charts/comision-por-mes-chart';
import { OperacionesPorTipoChart } from './charts/operaciones-por-tipo-chart';
import { DistribucionComisionesChart } from './charts/distribucion-comisiones-chart';
import { PropiedadesPorEstatusChart } from './charts/propiedades-por-estatus-chart';

type TabId = 'cierres' | 'comisiones' | 'propiedades' | 'pagos' | 'cumpleanos';

const TABS: { id: TabId; label: string }[] = [
  { id: 'cierres', label: 'Últimos cierres' },
  { id: 'comisiones', label: 'Comisiones pendientes' },
  { id: 'propiedades', label: 'Documentación pendiente' },
  { id: 'pagos', label: 'Pagos pendientes' },
  { id: 'cumpleanos', label: '🎂 Cumpleaños próximos' },
];

export function AdminDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [activeTab, setActiveTab] = useState<TabId>('cierres');

  const { data: kpis, isLoading: kLoading } = useQuery({
    queryKey: ['dashboard-kpis', filters],
    queryFn: () => dashboardApi.getKpis(filters).then((r) => r.data),
    staleTime: 30000,
  });

  const { data: charts, isLoading: cLoading } = useQuery({
    queryKey: ['dashboard-charts', filters],
    queryFn: () => dashboardApi.getCharts(filters).then((r) => r.data),
    staleTime: 30000,
  });

  const { data: comisionPorMes, isLoading: mLoading } = useQuery({
    queryKey: ['dashboard-comision-mes', filters],
    queryFn: () => dashboardApi.getComisionPorMes(filters).then((r) => r.data),
    staleTime: 30000,
  });

  // Solo estatus que realmente requieren acción (no Liberada/Pagada/Cancelada)
  const COMISION_PENDIENTE = ['Calculada', 'Pendiente validación', 'Bloqueada'];
  const PAGO_PENDIENTE = ['Solicitado', 'Autorizado'];

  const { data: comisionesPendientes, isLoading: cpLoading } = useQuery({
    queryKey: ['dashboard-comisiones-pendientes', filters.idAsesor],
    queryFn: () =>
      commissionsApi
        .getAll({ advisorId: filters.idAsesor, limit: 50 })
        .then((r) => (r.data?.data ?? r.data ?? []).filter((c: any) => COMISION_PENDIENTE.includes(c.estatus_comision))),
    enabled: activeTab === 'comisiones',
  });

  const { data: pagosPendientes, isLoading: ppLoading } = useQuery({
    queryKey: ['dashboard-pagos-pendientes', filters.idAsesor],
    queryFn: () =>
      paymentsApi
        .getAll({ advisorId: filters.idAsesor, limit: 50 })
        .then((r) => (r.data?.data ?? r.data ?? []).filter((p: any) => PAGO_PENDIENTE.includes(p.estatus_pago))),
    enabled: activeTab === 'pagos',
  });

  const loading = kLoading || cLoading;
  const k = kpis ?? {};
  const ch = charts ?? {};

  const topAsesores: any[] = ch.topAsesores ?? [];
  const ultimosCierres: any[] = ch.ultimosCierres ?? [];
  const propSinContrato: any[] = ch.propiedadesSinContrato ?? [];
  const topCaptadores: any[] = ch.topCaptadores ?? [];
  const cumpleanios: any[] = ch.cumpleaniosProximos ?? [];
  const topRentas: any[] = ch.topRentas ?? [];
  const topInvitadores: any[] = ch.topInvitadores ?? [];
  const amaAsesores: any[] = ch.amaAsesores ?? [];
  const masCercaAma = amaAsesores
    .filter((a) => a.ama_alcanzada !== true && a.ama_alcanzada !== 'true')
    .sort((a, b) => Number(b.avance_pct || 0) - Number(a.avance_pct || 0));

  const statusColor: Record<string, string> = {
    Solicitado: '#f59e0b',
    'En revisión': '#3b82f6',
    'Validado por administración': '#10b981',
    'Liberado para pago': '#059669',
    Pagado: '#065f46',
    Cancelado: '#6b7280',
  };

  return (
      <div className="page-content animate-fade-in">

        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h1 className="page-title">Dashboard Administrativo</h1>
            <p className="page-desc">Idea Uno Bienes Raíces</p>
          </div>
        </div>

        {/* ─── Filtros ─── */}
        <div style={{ marginBottom: 20 }}>
          <DashboardFiltersBar filters={filters} onChange={setFilters} />
        </div>

        {/* ─── KPIs ─── */}
        {loading ? (
          <div className="grid-5" style={{ marginBottom: 20 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
            ))}
          </div>
        ) : (
          <div className="grid-5" style={{ marginBottom: 20 }}>
            <KpiCard label="Operaciones cerradas" value={k.operacionesCerradasTotal ?? 0} sub={`${k.cierresTotal ?? 0} totales`} icon={<CheckCircle2 size={18} />} iconBg="#d1fae5" iconColor="#006c49" />
            <KpiCard label="Comisión total generada" value={formatCurrency(k.comisionTotalGenerada ?? 0)} icon={<TrendingUp size={18} />} iconBg="#dbeafe" iconColor="#1e40af" />
            <KpiCard label="Comisión por liberar" value={formatCurrency(k.comisionesPorLiberar ?? 0)} sub={`${k.comisionesPorLiberarCount ?? 0} solicitudes`} icon={<Clock size={18} />} iconBg="#fef3c7" iconColor="#78350f" alert={(k.comisionesPorLiberar ?? 0) > 0} />
            <KpiCard label="Comisión liberada" value={formatCurrency(k.comisionesLiberadas ?? 0)} icon={<DollarSign size={18} />} iconBg="#d1fae5" iconColor="#006c49" />
            <KpiCard label="Ingreso inmobiliaria" value={formatCurrency(k.ingresoInmobiliaria ?? 0)} icon={<TrendingUp size={18} />} iconBg="#ede9fe" iconColor="#7c3aed" />
            <KpiCard label="Propiedades captadas" value={k.propiedadesTotal ?? 0} icon={<Building2 size={18} />} iconBg="#dbeafe" iconColor="#1e40af" />
            <KpiCard label="Publicables / Activas" value={k.propiedadesPublicables ?? 0} icon={<Building2 size={18} />} iconBg="#d1fae5" iconColor="#006c49" />
            <KpiCard label="Comisiones bloqueadas" value={k.comisionesBloqueadasCount ?? 0} icon={<AlertCircle size={18} />} iconBg="#ffedd5" iconColor="#c2410c" alert={(k.comisionesBloqueadasCount ?? 0) > 0} />
            <KpiCard label="Asesores activos" value={k.asesoresActivos ?? 0} sub={`${k.asesoresMentoria ?? 0} en mentoría`} icon={<Users size={18} />} iconBg="#ede9fe" iconColor="#7c3aed" />
            <KpiCard label="AMA alcanzada" value={k.asesoresAmaAlcanzada ?? 0} sub="Asesores con meta AMA" icon={<Award size={18} />} iconBg="#d1fae5" iconColor="#006c49" />
          </div>
        )}

        {/* ─── Alertas ─── */}
        {(propSinContrato.length > 0 || (k.comisionesBloqueadasCount ?? 0) > 0) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {propSinContrato.length > 0 && (
              <div className="stat-chip" style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
                <AlertCircle size={13} /> {propSinContrato.length} prop. sin contrato firmado
              </div>
            )}
            {(k.comisionesBloqueadasCount ?? 0) > 0 && (
              <div className="stat-chip" style={{ color: 'var(--color-error)', border: '1px solid var(--color-error)' }}>
                <Lock size={13} /> {k.comisionesBloqueadasCount} comisión(es) bloqueada(s) — {formatCurrency(k.comisionesBloqueadasMonto ?? 0)}
              </div>
            )}
          </div>
        )}

        {/* ─── Gráficas ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="card">
            <div className="card-header"><div className="card-title">Comisión generada por mes</div></div>
            {mLoading ? <div className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-md)' }} /> : <ComisionPorMesChart data={comisionPorMes ?? []} />}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Propiedades por estatus</div></div>
            {loading ? <div className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-md)' }} /> : <PropiedadesPorEstatusChart data={ch.propiedadesPorEstatus ?? []} />}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Operaciones por tipo</div></div>
            {loading ? <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-md)' }} /> : <OperacionesPorTipoChart data={ch.operacionesPorTipo ?? []} />}
          </div>
          <div className="card">
            <div className="card-header"><div className="card-title">Distribución de comisiones</div></div>
            {loading ? <div className="skeleton" style={{ height: 240, borderRadius: 'var(--radius-md)' }} /> : <DistribucionComisionesChart data={ch.distribucionComisiones ?? null} />}
          </div>
        </div>

        {/* ─── Rankings ─── */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', marginBottom: 10 }}>Rankings</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <RankingCard
              title="Mejores captadores"
              items={topCaptadores.map((a) => ({ id: a.id, name: a.name, value: Number(a.total_captaciones) }))}
              valueFormat="count"
              emptyLabel="Sin captaciones registradas aún"
            />
            <RankingCard
              title="Mejores vendedores"
              items={topAsesores.map((a) => ({ id: a.id, name: a.name, value: Number(a.comision_total), secondaryValue: Number(a.cierres) }))}
              valueFormat="currency"
              secondaryLabel="cierres"
              secondaryFormat="count"
              emptyLabel="Sin cierres registrados aún"
            />
            <RankingCard
              title="Mejores en rentas"
              items={topRentas.map((a) => ({ id: a.id, name: a.name, value: Number(a.rentas_cerradas), secondaryValue: Number(a.comision_neta) }))}
              valueFormat="count"
              secondaryLabel="comisión"
              secondaryFormat="currency"
              emptyLabel="Sin rentas cerradas aún"
            />
            <RankingCard
              title="Mejores invitadores"
              items={topInvitadores.map((a) => ({ id: a.id, name: a.name, value: Number(a.gratificaciones_generadas), secondaryValue: Number(a.asesores_invitados) }))}
              valueFormat="currency"
              secondaryLabel="asesores"
              secondaryFormat="count"
              emptyLabel="Sin asesores invitados aún"
            />
            <RankingCard
              title="Más cerca de AMA"
              items={masCercaAma.map((a) => ({ id: a.id, name: a.name, value: Number(a.avance_pct || 0) }))}
              valueFormat="percent"
              emptyLabel="Sin asesores con AMA en progreso"
            />
          </div>
        </div>

        {/* ─── Tabs con tablas ─── */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)', padding: '0 12px', overflowX: 'auto' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding: '10px 16px', fontSize: 13, fontWeight: 550, whiteSpace: 'nowrap',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  marginBottom: -1, transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ padding: 16 }}>
            {activeTab === 'cierres' && (
              ultimosCierres.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p style={{ fontSize: 13 }}>Sin cierres registrados aún</p></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      {['Código', 'Asesor', 'Tipo', 'Fecha', 'Comisión', 'Estatus'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ultimosCierres.map((op) => (
                      <tr key={op.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '8px', fontSize: 12 }}>{op.code}</td>
                        <td style={{ padding: '8px', fontSize: 12 }}>{op.asesor_name || 'Sin asesor'}</td>
                        <td style={{ padding: '8px', fontSize: 12 }}>{op.type}</td>
                        <td style={{ padding: '8px', fontSize: 12 }}>{op.fecha_cierre ? formatDate(op.fecha_cierre) : '—'}</td>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 700 }}>{formatCurrency(Number(op.monto_comision_generada || 0))}</td>
                        <td style={{ padding: '8px', fontSize: 11.5, fontWeight: 600, color: statusColor[op.status] ?? '#6b7280' }}>{op.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'comisiones' && (
              cpLoading ? <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-md)' }} /> :
              !comisionesPendientes?.length ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p style={{ fontSize: 13 }}>Sin comisiones pendientes</p></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      {['Operación', 'Asesor', 'Monto neto', 'Estatus'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comisionesPendientes.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '8px', fontSize: 12 }}>{c.operation_code || '—'}</td>
                        <td style={{ padding: '8px', fontSize: 12 }}>{c.advisor_name || '—'}</td>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 700 }}>{formatCurrency(Number(c.monto_neto_asesor || 0))}</td>
                        <td style={{ padding: '8px', fontSize: 11.5, fontWeight: 600 }}>{c.estatus_comision}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'propiedades' && (
              propSinContrato.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p style={{ fontSize: 13 }}>Sin documentación pendiente</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {propSinContrato.map((p) => (
                    <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, padding: '8px 0', borderBottom: '1px solid var(--color-outline-variant)' }}>
                      <ShieldAlert size={14} style={{ color: '#c2410c', flexShrink: 0 }} />
                      <span style={{ fontWeight: 600 }}>{p.owner_name || '—'}</span>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>{p.address || p.city}</span>
                      <span className="badge" style={{ background: '#ffedd5', color: '#c2410c', fontSize: 10, marginLeft: 'auto' }}>{p.status}</span>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'pagos' && (
              ppLoading ? <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-md)' }} /> :
              !pagosPendientes?.length ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p style={{ fontSize: 13 }}>Sin pagos pendientes</p></div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                      {['Asesor', 'Monto solicitado', 'Forma de pago', 'Estatus'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11.5, color: 'var(--color-on-surface-variant)', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagosPendientes.map((p: any) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
                        <td style={{ padding: '8px', fontSize: 12 }}>{p.advisor_name || '—'}</td>
                        <td style={{ padding: '8px', fontSize: 12, fontWeight: 700 }}>{formatCurrency(Number(p.monto_solicitado || 0))}</td>
                        <td style={{ padding: '8px', fontSize: 12 }}>{p.forma_pago || '—'}</td>
                        <td style={{ padding: '8px', fontSize: 11.5, fontWeight: 600 }}>{p.estatus_pago}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'cumpleanos' && (
              cumpleanios.length === 0 ? (
                <div className="empty-state" style={{ padding: '20px 0' }}><p style={{ fontSize: 13 }}>Sin cumpleaños en los próximos 30 días</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {cumpleanios.map((a, i) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < cumpleanios.length - 1 ? '1px solid var(--color-outline-variant)' : 'none' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700 }}>
                        {a.cumpleanos_dia_mes}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 550 }}>{a.name}</div>
                        {a.phone && <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{a.phone}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>

        {/* ─── Acciones rápidas ─── */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><div className="card-title">Acciones rápidas</div></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {[
              { label: 'Registrar Cierre', desc: 'Nuevo registro de venta/renta', href: '/operations/new', color: '#006c49', bg: '#d1fae5' },
              { label: 'Captación en Venta', desc: 'Nueva propiedad en inventario', href: '/properties/new', color: '#1e40af', bg: '#dbeafe' },
              { label: 'Captación en Renta', desc: 'Nueva propiedad en renta', href: '/rentals/new', color: '#7c3aed', bg: '#ede9fe' },
              { label: 'Nuevo Asesor', desc: 'Alta de asesor inmobiliario', href: '/advisors/new', color: '#c2410c', bg: '#ffedd5' },
            ].map((a) => (
              <a key={a.href} href={a.href} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-outline-variant)', textDecoration: 'none', transition: 'all 0.15s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = a.bg; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-container-low)'; }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: a.bg, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowRight size={16} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-on-surface)' }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{a.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

      </div>
  );
}
