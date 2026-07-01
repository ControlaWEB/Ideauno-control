'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/header';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  details: Record<string, unknown>;
  ip_address: string;
  timestamp: string;
}

interface AuditResponse {
  data: AuditEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ALLOWED_ROLES = ['Super Admin', 'Admin'];

export default function AuditPage() {
  const { user } = useAuthStore();
  const [page, setPage]             = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser]     = useState('');

  const hasAccess = ALLOWED_ROLES.includes(user?.role ?? '');

  const { data, isLoading } = useQuery<AuditResponse>({
    queryKey: ['audit', page],
    queryFn: () =>
      api.get('/audit', { params: { page, limit: 20 } }).then(r => r.data),
    placeholderData: keepPreviousData,
    enabled: hasAccess,
  });

  const entries: AuditEntry[] = data?.data ?? [];
  const meta = data?.meta;

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filterAction && !e.action.toLowerCase().includes(filterAction.toLowerCase())) return false;
      if (filterUser   && !e.user_email.toLowerCase().includes(filterUser.toLowerCase()))   return false;
      return true;
    });
  }, [entries, filterAction, filterUser]);

  if (!hasAccess) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in">
          <div className="page-header">
            <div>
              <h1 className="page-title">Auditoría del Sistema</h1>
              <p className="page-desc">Registro de todas las acciones críticas</p>
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-on-surface-variant)' }}>
            <ShieldAlert size={36} style={{ marginBottom: 12, color: 'var(--color-error)' }} />
            <p style={{ fontSize: 14 }}>
              Acceso restringido. Solo administradores y auditores pueden ver esta sección.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Auditoría del Sistema</h1>
            <p className="page-desc">Registro de todas las acciones críticas</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="input-label" style={{ margin: 0 }}>Buscar por acción</label>
              <input
                type="text"
                className="input"
                style={{ minWidth: 220 }}
                placeholder="Ej: CREATE_ADVISOR"
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="input-label" style={{ margin: 0 }}>Buscar por usuario</label>
              <input
                type="text"
                className="input"
                style={{ minWidth: 220 }}
                placeholder="correo@ejemplo.com"
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="skeleton" style={{ height: 46, borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <ShieldAlert size={32} />
              <p>No hay registros de auditoría</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Timestamp</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Detalles</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                        {new Date(entry.timestamp).toLocaleString('es-MX')}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {entry.user_email === 'system' ? (
                          <span style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>system</span>
                        ) : (
                          entry.user_email
                        )}
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          background: 'var(--color-surface-variant)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          {entry.action}
                        </span>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <span style={{
                          fontSize: 11,
                          color: 'var(--color-on-surface-variant)',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}>
                          {JSON.stringify(entry.details)}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                        {entry.ip_address || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 12,
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--color-surface-variant)',
            }}>
              <span style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                disabled={page >= meta.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
