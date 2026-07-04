'use client';

import { Header } from '@/components/header';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useState } from 'react';
import {
  Plus, Building2, Search, LayoutGrid, LayoutList,
  MapPin, BedDouble, Bath, Maximize2, Eye, User, AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  Incompleta:    { label: 'Incompleta',    class: 'badge-error' },
  'En revisión': { label: 'En revisión',   class: 'badge-warning' },
  Activa:        { label: 'Activa',        class: 'badge-success' },
  Publicable:    { label: 'Publicable',    class: 'badge-success' },
  vendida:       { label: 'Vendida',       class: 'badge-neutral' },
  rentada:       { label: 'Rentada',       class: 'badge-primary' },
  disponible:    { label: 'Disponible',    class: 'badge-success' },
};

type Property = {
  id: string; type?: string; tipo_inmueble?: string; status: string;
  price?: number; address?: string; city?: string; state?: string;
  owner_name?: string; advisor_id?: string;
  recamaras?: number; banos_completos?: number;
  superficie_construccion_m2?: number; superficie_terreno_m2?: number;
  contrato_comision_firmado?: string; fecha_captacion?: string; created_at?: string;
  porcentaje_comision_pactado?: number;
};

function PropertyModal({ p, onClose }: { p: Property; onClose: () => void }) {
  const s = STATUS_LABELS[p.status] ?? { label: p.status, class: 'badge-neutral' };
  const sinContrato = !p.contrato_comision_firmado || p.contrato_comision_firmado === 'false';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{p.address || '(Sin dirección)'}</div>
            <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>{p.tipo_inmueble || p.type} · {p.city}</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        {sinContrato && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 16, fontSize: 12.5, color: '#c2410c', display: 'flex', gap: 8, alignItems: 'center' }}>
            <AlertCircle size={14} /> Sin Contrato de Comisión Mercantil — no puede publicarse
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span className={`badge ${s.class}`}>{s.label}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>{formatCurrency(p.price ?? 0)}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            ['Propietario', p.owner_name || '—'],
            ['Ciudad / Estado', `${p.city || '—'} / ${p.state || '—'}`],
            ['Superficie terreno', p.superficie_terreno_m2 ? `${p.superficie_terreno_m2} m²` : '—'],
            ['Superficie construcción', p.superficie_construccion_m2 ? `${p.superficie_construccion_m2} m²` : '—'],
            ['Recámaras', p.recamaras ?? '—'],
            ['Baños completos', p.banos_completos ?? '—'],
            ['Comisión pactada', p.porcentaje_comision_pactado ? `${p.porcentaje_comision_pactado}%` : '—'],
            ['Contrato firmado', sinContrato ? 'No' : 'Sí'],
            ['Captación', p.fecha_captacion ? formatDate(p.fecha_captacion) : '—'],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13.5 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewProperty, setViewProperty] = useState<Property | null>(null);

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.getAll({ tipoOperacion: 'Venta' }).then(r => r.data?.data ?? r.data ?? []),
  });

  const properties: Property[] = Array.isArray(apiData) ? apiData : [];

  const filtered = properties.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.address || '').toLowerCase().includes(q) || (p.owner_name || '').toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const sinContrato = properties.filter(p => (!p.contrato_comision_firmado || p.contrato_comision_firmado === 'false') && p.status !== 'vendida' && p.status !== 'rentada').length;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Propiedades en Venta</h1>
            <p className="page-desc">
              {properties.length} registradas
              {sinContrato > 0 && <span style={{ color: 'var(--color-error)', marginLeft: 10 }}>· {sinContrato} sin contrato firmado</span>}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/properties/new')}>
            <Plus size={15} /> Nueva Captación
          </button>
        </div>

        <div className="filter-bar">
          <div className="search-wrapper">
            <Search />
            <input className="search-input" placeholder="Buscar por dirección, propietario, ciudad..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 160, height: 36, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Incompleta">Incompleta</option>
            <option value="En revisión">En revisión</option>
            <option value="Activa">Activa</option>
            <option value="vendida">Vendida</option>
            <option value="rentada">Rentada</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '7px 10px' }} onClick={() => setView('list')}>
              <LayoutList size={15} />
            </button>
            <button className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '7px 10px' }} onClick={() => setView('grid')}>
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Building2 size={32} />
            <p>No hay propiedades registradas</p>
            <button className="btn btn-primary" onClick={() => router.push('/properties/new')}>Registrar primera captación</button>
          </div>
        ) : view === 'list' ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Dirección / Propietario</th>
                  <th>Tipo</th>
                  <th>Precio</th>
                  <th>Contrato</th>
                  <th>Estado</th>
                  <th>Captación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const s = STATUS_LABELS[p.status] ?? { label: p.status, class: 'badge-neutral' };
                  const sinContrato = !p.contrato_comision_firmado || p.contrato_comision_firmado === 'false';
                  return (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => router.push(`/properties/${p.id}`)}
                          title="Ver detalle completo"
                          style={{
                            fontWeight: 550, fontSize: 13, color: 'var(--color-primary)',
                            background: 'none', border: 'none', padding: 0, textAlign: 'left',
                            cursor: 'pointer', userSelect: 'none', textDecoration: 'underline',
                            textUnderlineOffset: 2, textDecorationColor: 'transparent',
                            transition: 'text-decoration-color 0.15s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'currentColor'; }}
                          onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent'; }}
                        >
                          {p.address || '(Sin dirección)'}
                        </button>
                        <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', display: 'flex', gap: 4, alignItems: 'center' }}>
                          <User size={10} />{p.owner_name || '—'}
                          {p.city && <span>· {p.city}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{p.tipo_inmueble || p.type || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(p.price ?? 0)}</td>
                      <td>
                        {sinContrato
                          ? <span className="badge badge-error" style={{ fontSize: 10.5 }}><AlertCircle size={9} /> Sin contrato</span>
                          : <span className="badge badge-success" style={{ fontSize: 10.5 }}>Firmado</span>}
                      </td>
                      <td><span className={`badge ${s.class}`}>{s.label}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                        {p.fecha_captacion ? formatDate(p.fecha_captacion) : '—'}
                      </td>
                      <td>
                        <button className="btn btn-ghost" style={{ padding: '5px 8px' }} onClick={() => setViewProperty(p)}>
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid-3">
            {filtered.map(p => {
              const s = STATUS_LABELS[p.status] ?? { label: p.status, class: 'badge-neutral' };
              const sinContrato = !p.contrato_comision_firmado || p.contrato_comision_firmado === 'false';
              return (
                <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setViewProperty(p)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className={`badge ${s.class}`}>{s.label}</span>
                    {sinContrato && <span style={{ fontSize: 11, color: 'var(--color-error)', display: 'flex', gap: 3, alignItems: 'center' }}><AlertCircle size={11} />Sin contrato</span>}
                  </div>
                  <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 4 }}>{p.address || '(Sin dirección)'}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>{formatCurrency(p.price ?? 0)}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', display: 'flex', gap: 10 }}>
                    {p.recamaras ? <span><BedDouble size={11} style={{ display: 'inline' }} /> {p.recamaras}</span> : null}
                    {p.banos_completos ? <span><Bath size={11} style={{ display: 'inline' }} /> {p.banos_completos}</span> : null}
                    {p.superficie_construccion_m2 ? <span><Maximize2 size={11} style={{ display: 'inline' }} /> {p.superficie_construccion_m2}m²</span> : null}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} />{p.city || '—'}, {p.state || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewProperty && <PropertyModal p={viewProperty} onClose={() => setViewProperty(null)} />}
    </>
  );
}
