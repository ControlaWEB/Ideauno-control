'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { advisorsApi } from '@/lib/api';
import type { DashboardFilters } from '@/lib/api';

const ESTATUS_CIERRE = ['Solicitado', 'En revisión', 'Validado por administración', 'Liberado para pago', 'Pagado', 'Cancelado'];

interface Props {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

export function DashboardFiltersBar({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const { data: advisorsData } = useQuery({
    queryKey: ['dashboard-filters-advisors'],
    queryFn: () => advisorsApi.getAll().then((r) => r.data),
    staleTime: 60000,
  });
  const asesores: any[] = advisorsData?.data ?? advisorsData ?? [];

  const hasActive = Object.values(filters).some((v) => v && v !== '');

  const set = (key: keyof DashboardFilters, value: string) =>
    onChange({ ...filters, [key]: value || undefined });

  const clear = () => onChange({});

  return (
    <div className="card" style={{ padding: 0 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px',
          fontSize: 13, fontWeight: 600, color: 'var(--color-on-surface)', background: 'none', border: 'none', cursor: 'pointer',
        }}
      >
        <Filter size={15} style={{ color: 'var(--color-primary)' }} />
        <span>Filtros</span>
        {hasActive && (
          <span className="badge badge-primary" style={{ fontSize: 10.5 }}>Activos</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--color-on-surface-variant)' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{
          borderTop: '1px solid var(--color-outline-variant)', padding: '14px 16px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12,
        }}>
          <div className="input-group">
            <label className="input-label">Desde</label>
            <input type="date" className="input" value={filters.fechaInicio ?? ''} onChange={(e) => set('fechaInicio', e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label">Hasta</label>
            <input type="date" className="input" value={filters.fechaFin ?? ''} onChange={(e) => set('fechaFin', e.target.value)} />
          </div>

          <div className="input-group">
            <label className="input-label">Asesor</label>
            <select className="select" value={filters.idAsesor ?? ''} onChange={(e) => set('idAsesor', e.target.value)}>
              <option value="">Todos</option>
              {asesores.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Tipo de operación</label>
            <select className="select" value={filters.tipoOperacion ?? ''} onChange={(e) => set('tipoOperacion', e.target.value)}>
              <option value="">Todas</option>
              <option value="Venta">Venta</option>
              <option value="Renta">Renta</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Estatus de cierre</label>
            <select className="select" value={filters.estatusCierre ?? ''} onChange={(e) => set('estatusCierre', e.target.value)}>
              <option value="">Todos</option>
              {ESTATUS_CIERRE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="input-group" style={{ justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
            <label className="input-label" style={{ visibility: 'hidden' }}>Limpiar</label>
            <button className="btn btn-secondary" onClick={clear}>
              <X size={13} /> Limpiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
