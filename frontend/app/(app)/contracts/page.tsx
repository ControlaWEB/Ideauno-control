'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { ScrollText, Plus } from 'lucide-react';
import { notify } from '@/lib/toast';
import { useRouter } from 'next/navigation';

const ESTATUS_STYLE: Record<string, { label: string; cls: string; color?: string }> = {
  'Pendiente':             { label: 'Pendiente',           cls: 'badge-warning' },
  'En elaboración':        { label: 'En elaboración',      cls: 'badge-primary' },
  'Requiere información':  { label: 'Req. información',    cls: '', color: '#e65100' },
  'Entregado':             { label: 'Entregado',           cls: 'badge-success' },
  'Cancelado':             { label: 'Cancelado',           cls: 'badge-error' },
};

const ALL_STATUSES = ['Pendiente', 'En elaboración', 'Requiere información', 'Entregado', 'Cancelado'];

export default function ContractsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [statusEditMap, setStatusEditMap] = useState<Record<string, string>>({});
  const [savingMap, setSavingMap]         = useState<Record<string, boolean>>({});

  const canEdit = ['Super Admin', 'Admin', 'Jurídico'].includes(user?.role ?? '');

  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ['contracts'],
    queryFn: () => api.get('/contracts').then(r => r.data?.data ?? []),
    refetchOnWindowFocus: true,
  });

  // Toast flotante global. Los errores de API los muestra el interceptor de axios.
  const toast = (msg: string, isError = false) =>
    isError ? notify.error(msg) : notify.success(msg);

  const getStatusValue = (contract: any) =>
    statusEditMap[contract.id] ?? contract.estatus ?? contract.status ?? 'Pendiente';

  const saveStatus = async (id: string) => {
    const newStatus = statusEditMap[id];
    if (!newStatus) return;
    setSavingMap(prev => ({ ...prev, [id]: true }));
    try {
      await api.patch(`/contracts/${id}/status`, { estatus: newStatus });
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast('Estatus actualizado');
    } catch { /* toast global */ } finally {
      setSavingMap(prev => ({ ...prev, [id]: false }));
    }
  };

  const renderBadge = (estatus: string) => {
    const s = ESTATUS_STYLE[estatus];
    if (!s) return <span className="badge badge-neutral">{estatus}</span>;
    if (s.cls) return <span className={`badge ${s.cls}`}>{s.label}</span>;
    return (
      <span className="badge" style={{ background: '#fff3e0', color: s.color, border: `1px solid ${s.color}40` }}>
        {s.label}
      </span>
    );
  };

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        <div className="page-header">
          <div>
            <h1 className="page-title">Solicitudes de Contrato</h1>
            <p className="page-desc">Solicitudes de elaboración de contratos al área jurídica</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/contracts/new')}>
            <Plus size={15} /> Nueva Solicitud
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <ScrollText size={32} />
            <p>No hay solicitudes de contrato registradas.</p>
            <button className="btn btn-primary" onClick={() => router.push('/contracts/new')}>
              Nueva Solicitud
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Propiedad</th>
                  <th>Asesor</th>
                  <th>Fecha Solicitud</th>
                  <th>Estatus</th>
                  {canEdit && <th>Cambiar Estatus</th>}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c: any) => {
                  const currentStatus = getStatusValue(c);
                  const isDirty = statusEditMap[c.id] !== undefined && statusEditMap[c.id] !== (c.estatus ?? c.status);
                  return (
                    <tr
                      key={c.id}
                      style={{ cursor: 'pointer' }}
                      onClick={e => {
                        // Don't navigate when clicking the status controls
                        if ((e.target as HTMLElement).closest('select, button')) return;
                        router.push(`/contracts/${c.id}`);
                      }}
                    >
                      <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', fontFamily: 'monospace' }}>
                        {String(c.id).slice(0, 8)}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {c.tipo_solicitud === 'Promesa compraventa'
                          ? 'Promesa compraventa'
                          : c.tipo_solicitud === 'Contrato arrendamiento'
                          ? 'Contrato arrendamiento'
                          : c.tipo_solicitud ?? '—'}
                      </td>
                      <td style={{ fontSize: 13 }}>{c.property_address ?? c.propiedad ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{c.advisor_name ?? c.asesor_nombre ?? '—'}</td>
                      <td style={{ fontSize: 13 }}>{formatDate(c.fecha_solicitud ?? c.created_at)}</td>
                      <td>{renderBadge(c.estatus ?? c.status ?? 'Pendiente')}</td>
                      {canEdit && (
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <select
                              className="select"
                              style={{ width: 170, height: 30, fontSize: 12 }}
                              value={currentStatus}
                              onChange={e =>
                                setStatusEditMap(prev => ({ ...prev, [c.id]: e.target.value }))
                              }
                            >
                              {ALL_STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                            {isDirty && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 11, padding: '3px 10px' }}
                                disabled={!!savingMap[c.id]}
                                onClick={() => saveStatus(c.id)}
                              >
                                {savingMap[c.id] ? '…' : 'Guardar'}
                              </button>
                            )}
                          </div>
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
