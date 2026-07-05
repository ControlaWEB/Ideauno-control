'use client';

import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { advisorsApi, dashboardApi } from '@/lib/api';
import { notify } from '@/lib/toast';
import { useAuthStore } from '@/store/auth.store';
import { getInitials, formatCurrency, formatDate } from '@/lib/utils';
import { useState } from 'react';
import { Plus, Search, Eye, Users, TrendingUp, Award } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ADVISOR_STATUSES = ['Activo', 'En mentoría', 'Inactivo', 'Baja definitiva', 'Fallecido'];
const ADMIN_ROLES = ['Super Admin', 'Admin'];

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  Activo:           { label: 'Activo',           class: 'badge-success' },
  'En mentoría':    { label: 'En mentoría',       class: 'badge-warning' },
  Inactivo:         { label: 'Inactivo',          class: 'badge-neutral' },
  'Baja definitiva':{ label: 'Baja definitiva',   class: 'badge-error' },
  Fallecido:        { label: 'Fallecido',          class: 'badge-neutral' },
};

type Advisor = {
  id: string; name: string; email: string; phone: string;
  status: string; rfc?: string; curp?: string;
  invite_by_advisor_id?: string; inviterName?: string; pasa_por_mentoria?: string;
  fecha_alta_asesor?: string; created_at?: string;
};

function AdvisorModal({ advisor, onClose, amaMap }: { advisor: Advisor; onClose: () => void; amaMap: Record<string, any> }) {
  const s = STATUS_MAP[advisor.status] ?? { label: advisor.status, class: 'badge-neutral' };
  const ama = amaMap[advisor.id];
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const canEdit = ADMIN_ROLES.includes(user?.role ?? '');
  const [newStatus, setNewStatus] = useState(advisor.status);
  const [saving, setSaving] = useState(false);

  const handleSaveStatus = async () => {
    if (newStatus === advisor.status) return;
    setSaving(true);
    try {
      await advisorsApi.updateStatus(advisor.id, newStatus);
      await queryClient.invalidateQueries({ queryKey: ['advisors'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-charts'] });
      notify.success(`Estatus cambiado a "${newStatus}".`);
      onClose();
    } catch {
      // el interceptor de axios ya muestra el toast de error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>{getInitials(advisor.name)}</div>
            <div>
              <div className="modal-title">{advisor.name}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <span className={`badge ${s.class}`}>{s.label}</span>
                {advisor.pasa_por_mentoria === 'true' && <span className="badge badge-warning">En mentoría</span>}
              </div>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            ['Correo', advisor.email],
            ['Teléfono', advisor.phone || '—'],
            ['RFC', advisor.rfc || '—'],
            ['CURP', advisor.curp || '—'],
            ['Fecha alta', advisor.fecha_alta_asesor ? formatDate(advisor.fecha_alta_asesor) : '—'],
            ['Invitado por', advisor.inviterName || advisor.invite_by_advisor_id || 'Directo'],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13.5 }}>{v}</div>
            </div>
          ))}
        </div>

        {ama && (
          <div style={{ padding: '14px 16px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--color-primary)' }}>Avance AMA</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
              <span>Acumulado</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(Number(ama.monto_acumulado || 0))}</span>
            </div>
            <div className="progress-bar" style={{ height: 10, marginBottom: 6 }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, Number(ama.avance_pct || 0))}%`, background: ama.ama_alcanzada ? '#059669' : 'var(--color-secondary)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
              <span>{Number(ama.avance_pct || 0).toFixed(1)}% de {formatCurrency(Number(ama.meta_ama || 180000))}</span>
              <span style={{ fontWeight: 700, color: ama.ama_alcanzada ? '#059669' : undefined }}>
                {ama.estatus_ama}
              </span>
            </div>
          </div>
        )}

        {canEdit && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-outline-variant)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--color-primary)' }}>Cambio de Estatus</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="select"
                style={{ flex: 1, minWidth: 180, height: 38 }}
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              >
                {ADVISOR_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              <button
                className="btn btn-primary"
                disabled={saving || newStatus === advisor.status}
                style={{ opacity: (saving || newStatus === advisor.status) ? 0.6 : 1 }}
                onClick={handleSaveStatus}
              >
                {saving ? 'Guardando...' : 'Guardar estatus'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdvisorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewAdvisor, setViewAdvisor] = useState<Advisor | null>(null);

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => advisorsApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });

  const { data: chartsData } = useQuery({
    queryKey: ['dashboard-charts'],
    queryFn: () => dashboardApi.getCharts().then(r => r.data),
    staleTime: 30000,
  });

  const advisors: Advisor[] = Array.isArray(apiData) ? apiData : [];
  const amaList: any[] = chartsData?.amaAsesores ?? [];
  const amaMap: Record<string, any> = Object.fromEntries(amaList.map(a => [a.id, a]));

  const filtered = advisors.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
    const matchStatus = !filterStatus || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount = advisors.filter(a => a.status === 'Activo').length;
  const mentoriaCount = advisors.filter(a => a.pasa_por_mentoria === 'true').length;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Asesores</h1>
            <p className="page-desc">{advisors.length} registrados · {activeCount} activos · {mentoriaCount} en mentoría</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/advisors/new')}>
            <Plus size={15} /> Nuevo Asesor
          </button>
        </div>

        <div className="filter-bar">
          <div className="search-wrapper">
            <Search />
            <input className="search-input" placeholder="Buscar asesor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 170, height: 36, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="En mentoría">En mentoría</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Baja definitiva">Baja definitiva</option>
            <option value="Fallecido">Fallecido</option>
          </select>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <p>No se encontraron asesores</p>
            <button className="btn btn-primary" onClick={() => router.push('/advisors/new')}>Registrar primer asesor</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Asesor</th>
                  <th>Estatus</th>
                  <th>Mentoría</th>
                  <th>Invitado por</th>
                  <th>Avance AMA</th>
                  <th>Alta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const s = STATUS_MAP[a.status] ?? { label: a.status, class: 'badge-neutral' };
                  const ama = amaMap[a.id];
                  const amaPct = ama ? Number(ama.avance_pct || 0) : null;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{getInitials(a.name)}</div>
                          <div>
                            <div
                              onClick={() => router.push(`/advisors/${a.id}`)}
                              title="Ver ficha del asesor"
                              style={{ fontWeight: 550, fontSize: 13, cursor: 'pointer', color: 'var(--color-primary)' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                            >
                              {a.name}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{a.email}</div>
                          </div>
                        </div>
                      </td>
                      <td><span className={`badge ${s.class}`}>{s.label}</span></td>
                      <td>
                        {a.pasa_por_mentoria === 'true'
                          ? <span className="badge badge-warning">Sí</span>
                          : <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>No</span>}
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)' }}>
                        {a.invite_by_advisor_id && a.invite_by_advisor_id !== 'Directo' && a.invite_by_advisor_id !== ''
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Award size={11} />{a.inviterName || a.invite_by_advisor_id}</span>
                          : '—'}
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {amaPct !== null ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                              <span>{amaPct.toFixed(1)}%</span>
                              {ama.ama_alcanzada && <span style={{ color: '#059669', fontWeight: 700 }}>🎯 Alcanzada</span>}
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${Math.min(100, amaPct)}%`, background: ama.ama_alcanzada ? '#059669' : amaPct >= 80 ? '#d97706' : 'var(--color-secondary)' }} />
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>Sin periodo AMA</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                        {a.fecha_alta_asesor ? formatDate(a.fecha_alta_asesor) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setViewAdvisor(a)}>
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewAdvisor && <AdvisorModal advisor={viewAdvisor} onClose={() => setViewAdvisor(null)} amaMap={amaMap} />}
    </>
  );
}
