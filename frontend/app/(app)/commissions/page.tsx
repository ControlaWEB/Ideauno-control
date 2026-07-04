'use client';

import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { commissionsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import { DollarSign, Lock, Unlock, Search, TrendingUp, Calculator, CheckCircle2 } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  Calculada:              { label: 'Calculada',        class: 'badge-warning' },
  'Pendiente validación': { label: 'Pend. validación', class: 'badge-warning' },
  Liberada:               { label: 'Liberada',          class: 'badge-success' },
  Solicitada:             { label: 'Solicitada',         class: 'badge-primary' },
  Pagada:                 { label: 'Pagada',             class: 'badge-neutral' },
  Bloqueada:              { label: 'Bloqueada',          class: 'badge-error'   },
  Cancelada:              { label: 'Cancelada',          class: 'badge-neutral' },
};

const TYPE_MAP: Record<string, { label: string; class: string }> = {
  cierre:     { label: 'Cierre',     class: 'badge-primary' },
  invitacion: { label: 'Invitación', class: 'badge-success' },
  mentoria:   { label: 'Mentoría',   class: 'badge-warning' },
};

const ACTION_ROLES = ['Super Admin', 'Admin', 'Jurídico'];

export default function CommissionsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]   = useState('');
  const [loadingId, setLoadingId]     = useState<string | null>(null);
  const [blockingId, setBlockingId]   = useState<string | null>(null);
  const [blockMotivo, setBlockMotivo] = useState('');
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  const canAct = ACTION_ROLES.includes(user?.role ?? '');

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['commissions', filterStatus, filterType],
    queryFn: () =>
      commissionsApi
        .getAll({ status: filterStatus || undefined, type: filterType || undefined })
        .then(r => r.data),
  });

  const commissions: any[] = apiData?.data ?? [];

  const filtered = commissions.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      (c.advisor_name || '').toLowerCase().includes(q) ||
      (c.operation_code || '').toLowerCase().includes(q);
  });

  const totalCalculadas = commissions
    .filter(c => c.estatus_comision === 'Calculada')
    .reduce((a, b) => a + Number(b.monto_neto_asesor || b.amount || 0), 0);
  const totalLiberadas = commissions
    .filter(c => ['Liberada', 'Pagada'].includes(c.estatus_comision))
    .reduce((a, b) => a + Number(b.monto_neto_asesor || b.amount || 0), 0);
  // Ingreso realizado: solo comisiones liberadas/pagadas (igual que el KPI del Dashboard).
  // No incluye Bloqueadas ni Calculadas, que aún no son ingreso.
  const totalInmob = commissions
    .filter(c => c.type === 'cierre' && ['Liberada', 'Pagada'].includes(c.estatus_comision))
    .reduce((a, b) => a + Number(b.monto_inmobiliaria || 0), 0);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRelease = async (id: string) => {
    setLoadingId(id);
    try {
      await commissionsApi.release(id);
      await queryClient.invalidateQueries({ queryKey: ['commissions'] });
      notify('Comisión liberada correctamente');
    } catch (e: any) {
      notify(e?.response?.data?.message ?? 'Error al liberar comisión', false);
    } finally {
      setLoadingId(null);
    }
  };

  const handleBlock = async (id: string) => {
    if (!blockMotivo.trim()) { notify('Ingresa el motivo de bloqueo', false); return; }
    setLoadingId(id);
    try {
      await commissionsApi.block(id, blockMotivo.trim());
      await queryClient.invalidateQueries({ queryKey: ['commissions'] });
      setBlockingId(null);
      setBlockMotivo('');
      notify('Comisión bloqueada');
    } catch (e: any) {
      notify(e?.response?.data?.message ?? 'Error al bloquear comisión', false);
    } finally {
      setLoadingId(null);
    }
  };

  const handleUnblock = async (id: string) => {
    setLoadingId(id);
    try {
      await commissionsApi.unblock(id);
      await queryClient.invalidateQueries({ queryKey: ['commissions'] });
      notify('Comisión desbloqueada');
    } catch (e: any) {
      notify(e?.response?.data?.message ?? 'Error al desbloquear', false);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Comisiones</h1>
            <p className="page-desc">Calculadas automáticamente por el motor de comisiones — spec §9</p>
          </div>
        </div>

        {toast && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: toast.ok ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${toast.ok ? '#86efac' : '#fecaca'}`,
            borderRadius: 'var(--radius-md)', padding: '10px 16px',
            marginBottom: 16, fontSize: 13,
            color: toast.ok ? '#166534' : '#b91c1c',
          }}>
            {toast.ok && <CheckCircle2 size={14} />}
            {toast.msg}
          </div>
        )}

        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="kpi-card" style={{ borderLeft: '3px solid var(--color-caution)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">Por liberar (asesor)</div>
                <div className="kpi-value" style={{ fontSize: 20, marginTop: 4 }}>{formatCurrency(totalCalculadas)}</div>
              </div>
              <div className="kpi-icon" style={{ background: '#fef3c7', color: '#78350f' }}><Lock size={18} /></div>
            </div>
          </div>
          <div className="kpi-card" style={{ borderLeft: '3px solid var(--color-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">Liberadas / Pagadas</div>
                <div className="kpi-value" style={{ fontSize: 20, marginTop: 4, color: 'var(--color-secondary)' }}>{formatCurrency(totalLiberadas)}</div>
              </div>
              <div className="kpi-icon" style={{ background: '#d1fae5', color: '#006c49' }}><Unlock size={18} /></div>
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">Ingreso inmobiliaria</div>
                <div className="kpi-value" style={{ fontSize: 20, marginTop: 4 }}>{formatCurrency(totalInmob)}</div>
              </div>
              <div className="kpi-icon" style={{ background: '#dbeafe', color: '#1e40af' }}><TrendingUp size={18} /></div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20, padding: '14px 18px', background: 'linear-gradient(135deg, #f0fdf4, #d1fae5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Calculator size={20} style={{ color: 'var(--color-secondary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 650 }}>Motor de comisiones automático</div>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
                Comisión total → Invitación 2.5% → Remanente → 80% asesor (100% si AMA alcanzada) → Mentoría 5%
              </div>
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <div className="search-wrapper">
            <Search />
            <input
              className="search-input"
              placeholder="Buscar por asesor, operación..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="select" style={{ width: 180, height: 36, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Calculada">Calculada</option>
            <option value="Liberada">Liberada</option>
            <option value="Pagada">Pagada</option>
            <option value="Bloqueada">Bloqueada</option>
            <option value="Cancelada">Cancelada</option>
          </select>
          <select className="select" style={{ width: 150, height: 36, fontSize: 13 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="cierre">Cierre</option>
            <option value="invitacion">Invitación</option>
            <option value="mentoria">Mentoría</option>
          </select>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 54, borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={32} />
            <p>Sin comisiones registradas aún</p>
            <p style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              Se calculan automáticamente al registrar un cierre
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Operación</th>
                  <th>Asesor</th>
                  <th>Tipo</th>
                  <th>Comisión total</th>
                  <th>Invitación</th>
                  <th>Neto asesor</th>
                  <th>Inmobiliaria</th>
                  <th>AMA</th>
                  <th>Estado</th>
                  {canAct && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const s = STATUS_MAP[c.estatus_comision ?? c.status] ?? { label: c.status, class: 'badge-neutral' };
                  const t = TYPE_MAP[c.type] ?? { label: c.type, class: 'badge-neutral' };
                  const amaAlc = c.aplica_ama === true || c.aplica_ama === 'true';
                  const busy = loadingId === c.id;
                  const isBlockingThis = blockingId === c.id;

                  return (
                    <tr key={c.id}>
                      <td style={{ fontSize: 12.5 }}>
                        <div style={{ fontWeight: 600 }}>{c.operation_code || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{c.operation_type}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{c.advisor_name || '—'}</td>
                      <td><span className={`badge ${t.class}`}>{t.label}</span></td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(Number(c.monto_comision_total || c.amount || 0))}</td>
                      <td style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)' }}>{formatCurrency(Number(c.monto_invitacion || 0))}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{formatCurrency(Number(c.monto_neto_asesor || c.amount || 0))}</td>
                      <td style={{ fontSize: 12.5 }}>{formatCurrency(Number(c.monto_inmobiliaria || 0))}</td>
                      <td>
                        {amaAlc
                          ? <span className="badge badge-success" style={{ fontSize: 10.5 }}>🎯 Alcanzada</span>
                          : <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>—</span>}
                      </td>
                      <td><span className={`badge ${s.class}`}>{s.label}</span></td>

                      {canAct && (
                        <td style={{ minWidth: 160 }}>
                          {c.estatus_comision === 'Bloqueada' ? (
                            <button
                              className="btn btn-sm"
                              style={{ fontSize: 11.5, padding: '4px 10px' }}
                              disabled={busy}
                              onClick={() => handleUnblock(c.id)}
                            >
                              {busy ? '...' : 'Desbloquear'}
                            </button>
                          ) : ['Calculada', 'Pendiente validación'].includes(c.estatus_comision) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: 11.5, padding: '4px 10px' }}
                                disabled={busy}
                                onClick={() => handleRelease(c.id)}
                              >
                                {busy ? '...' : 'Liberar'}
                              </button>
                              {isBlockingThis ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <input
                                    style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 4, flex: 1 }}
                                    placeholder="Motivo..."
                                    value={blockMotivo}
                                    onChange={e => setBlockMotivo(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleBlock(c.id)}
                                    autoFocus
                                  />
                                  <button
                                    className="btn btn-sm"
                                    style={{ fontSize: 11, padding: '3px 8px', background: '#dc2626', color: '#fff', border: 'none' }}
                                    disabled={busy}
                                    onClick={() => handleBlock(c.id)}
                                  >
                                    {busy ? '...' : 'OK'}
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ fontSize: 11, padding: '3px 8px' }}
                                    onClick={() => { setBlockingId(null); setBlockMotivo(''); }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-sm"
                                  style={{ fontSize: 11.5, padding: '4px 10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
                                  onClick={() => setBlockingId(c.id)}
                                >
                                  Bloquear
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
