'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter, X, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { advisorsApi } from '@/lib/api';
import type { DashboardFilters } from '@/lib/api';

const ESTATUS_CIERRE = ['Solicitado', 'En revisión', 'Validado por administración', 'Liberado para pago', 'Pagado', 'Cancelado'];

// Normaliza texto para búsqueda flexible: sin acentos, minúsculas, sin espacios extra
const normalize = (s: string) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

interface AdvisorComboboxProps {
  asesores: any[];
  value: string; // id del asesor seleccionado, '' = Todos
  onChange: (id: string) => void;
}

function AdvisorCombobox({ asesores, value, onChange }: AdvisorComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = asesores.find((a) => String(a.id) === String(value));

  // Cierra al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return asesores;
    // Coincidencia flexible: todos los términos deben aparecer en el nombre
    const terms = q.split(/\s+/);
    return asesores.filter((a) => {
      const name = normalize(a.name ?? '');
      return terms.every((t) => name.includes(t));
    });
  }, [asesores, query]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="select"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : 'Todos'}
        </span>
        <ChevronDown size={15} style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 30,
            background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)',
            borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.12)', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid var(--color-outline-variant)' }}>
            <Search size={14} style={{ position: 'absolute', top: 18, left: 18, color: 'var(--color-on-surface-variant)' }} />
            <input
              autoFocus
              className="input"
              placeholder="Buscar asesor..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            <button type="button" className="combo-option" onClick={() => pick('')}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13,
                background: !value ? 'var(--color-primary)' : 'none', color: !value ? '#fff' : 'var(--color-on-surface)',
                border: 'none', cursor: 'pointer',
              }}
            >
              Todos
            </button>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--color-on-surface-variant)' }}>
                Sin resultados
              </div>
            )}
            {filtered.map((a: any) => {
              const active = String(a.id) === String(value);
              return (
                <button
                  key={a.id}
                  type="button"
                  className="combo-option"
                  onClick={() => pick(String(a.id))}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13,
                    background: active ? 'var(--color-primary)' : 'none', color: active ? '#fff' : 'var(--color-on-surface)',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
            <AdvisorCombobox
              asesores={asesores}
              value={filters.idAsesor ?? ''}
              onChange={(id) => set('idAsesor', id)}
            />
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
