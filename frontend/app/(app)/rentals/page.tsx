'use client';

import { Header } from '@/components/header';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ADMIN_ROLES = ['Super Admin', 'Admin'];

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid var(--color-surface-variant)',
  borderTopColor: 'var(--color-primary)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'Activa':      return 'badge badge-success';
    case 'En revisión': return 'badge badge-warning';
    case 'Incompleta':  return 'badge badge-error';
    case 'Rentada':
    case 'rentada':     return 'badge badge-neutral';
    default:            return 'badge badge-neutral';
  }
}

export default function RentalsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['rentals'],
    queryFn: () =>
      propertiesApi
        .getAll({ tipoOperacion: 'Renta', limit: 50 })
        .then((r) => r.data?.data ?? r.data ?? []),
  });

  const properties: Record<string, unknown>[] = Array.isArray(data) ? data : [];

  const filtered = search.trim()
    ? properties.filter((p) => {
        const addr = String(p.address ?? '').toLowerCase();
        const city = String(p.city ?? '').toLowerCase();
        const q = search.toLowerCase();
        return addr.includes(q) || city.includes(q);
      })
    : properties;

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Header />
      <div className="page-content animate-fade-in">
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Inventario de Rentas</h1>
            <p className="page-desc">Propiedades disponibles para renta</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => router.push('/rentals/new')}
          >
            + Nueva Propiedad en Renta
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 20, maxWidth: 420 }}>
          <input
            className="input"
            type="text"
            placeholder="Buscar por dirección o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        {/* States */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
            <div style={spinnerStyle} />
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: '#991b1b' }}>
            Error al cargar las propiedades en renta.
          </div>
        )}

        {!isLoading && !error && filtered.length === 0 && (
          <div style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏠</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
              No hay propiedades en renta registradas
            </div>
            {search && (
              <div style={{ fontSize: 13 }}>Intenta con otra dirección o ciudad.</div>
            )}
          </div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-variant)', textAlign: 'left' }}>
                    {['Dirección', 'Ciudad', 'Renta mensual', 'Tipo inmueble', 'Estatus', 'Asesor captador', 'Acciones'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '12px 16px',
                          fontWeight: 700,
                          fontSize: 11.5,
                          color: 'var(--color-on-surface-variant)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.4px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => {
                    const id = String(p.id);
                    const status = String(p.status ?? '');
                    const renta = p.renta_mensual_solicitada != null
                      ? formatCurrency(Number(p.renta_mensual_solicitada))
                      : '—';
                    return (
                      <tr
                        key={id}
                        style={{
                          borderTop: idx === 0 ? 'none' : '1px solid var(--color-surface-variant)',
                        }}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {String(p.address ?? '—')}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {String(p.city ?? '—')}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--color-primary)' }}>
                          {renta}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {String(p.tipo_inmueble ?? p.type ?? '—')}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span className={statusBadgeClass(status)}>{status || '—'}</span>
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          {String(p.advisor_name ?? p.advisor_id ?? '—')}
                        </td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={() => router.push(`/rentals/${id}`)}
                          >
                            Ver detalle
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-surface-variant)', fontSize: 12, color: 'var(--color-on-surface-variant)', textAlign: 'right' }}>
              {filtered.length} propiedad{filtered.length !== 1 ? 'es' : ''} en renta
            </div>
          </div>
        )}
      </div>
    </>
  );
}
