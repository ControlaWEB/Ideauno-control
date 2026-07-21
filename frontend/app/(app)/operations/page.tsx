'use client';

import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operationsApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useState } from 'react';
import {
  Plus, FileText, Search, Eye, Clock, CheckCircle2, DollarSign, ShieldAlert, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const STATUS_MAP: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  'Solicitado':                    { label: 'Solicitado',              class: 'badge-warning', icon: <Clock size={10} /> },
  'En revisión':                   { label: 'En revisión',             class: 'badge-primary', icon: <Clock size={10} /> },
  'Validado por administración':   { label: 'Validado',                class: 'badge-success', icon: <CheckCircle2 size={10} /> },
  'Bloqueado por documentación':   { label: 'Bloqueado',               class: 'badge-error',   icon: <ShieldAlert size={10} /> },
  'Liberado para pago':            { label: 'Liberado para pago',      class: 'badge-success', icon: <DollarSign size={10} /> },
  'Pagado':                        { label: 'Pagado',                  class: 'badge-neutral', icon: <CheckCircle2 size={10} /> },
  'Cancelado':                     { label: 'Cancelado',               class: 'badge-neutral', icon: <X size={10} /> },
};

type Operation = Record<string, any>;

function OpModal({ op, onClose, onValidate }: { op: Operation; onClose: () => void; onValidate: (id: string) => void }) {
  const s = STATUS_MAP[op.status] ?? { label: op.status, class: 'badge-neutral', icon: null };
  const pldFlag = Number(op.precio_final_cierre || 0) >= 941412.75;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Cierre {op.code}</div>
            <span className={`badge ${s.class}`} style={{ marginTop: 4 }}>{s.icon} {s.label}</span>
          </div>
          <button className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        {pldFlag && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: '#b91c1c', display: 'flex', gap: 8, alignItems: 'center' }}>
            <ShieldAlert size={14} /> Operación ≥ umbral PLD ($941,412.75 MXN) — expediente KYC obligatorio
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            ['Tipo', op.type],
            ['Asesor cerrador', op.advisor_name || op.advisor_id || '—'],
            ['Precio de cierre', formatCurrency(Number(op.precio_final_cierre || 0))],
            ['Comisión generada', formatCurrency(Number(op.monto_comision_generada || 0))],
            ['Fecha cierre', op.fecha_cierre ? formatDate(op.fecha_cierre) : '—'],
            ['Expediente PLD', op.pld_expediente_completo === 'true' || op.pld_expediente_completo === true ? 'Completo' : 'Incompleto'],
            ['Tipo PLD cliente', op.pld_tipo_cliente || '—'],
            ['Rep. vendedor', op.rep_vendedor_tipo || '—'],
            ['Rep. comprador', op.rep_comprador_tipo || '—'],
            ['Observaciones', op.observaciones || '—'],
          ].map(([l, v]) => (
            <div key={String(l)} style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 13.5 }}>{v}</div>
            </div>
          ))}
        </div>

        {(op.status === 'Solicitado' || op.status === 'En revisión') && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
            <button className="btn btn-primary" onClick={() => { onValidate(op.id); onClose(); }}>
              <CheckCircle2 size={14} /> Validar cierre
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OperationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewOp, setViewOp] = useState<Operation | null>(null);

  const { data: apiData, isLoading } = useQuery({
    queryKey: ['operations'],
    queryFn: () => operationsApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });

  const ops: Operation[] = Array.isArray(apiData) ? apiData : [];

  const filtered = ops.filter(op => {
    const q = search.toLowerCase();
    const matchSearch = !q || (op.code || '').toLowerCase().includes(q) || (op.advisor_name || '').toLowerCase().includes(q);
    const matchStatus = !filterStatus || op.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const pendientes = ops.filter(o => ['Solicitado', 'En revisión'].includes(o.status)).length;
  const validados = ops.filter(o => o.status === 'Validado por administración').length;
  const totalComisiones = ops.reduce((a, o) => a + Number(o.monto_comision_generada || 0), 0);

  const handleValidate = async (id: string) => {
    await operationsApi.updateStatus(id, 'Validado por administración');
    queryClient.invalidateQueries({ queryKey: ['operations'] });
  };

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Cierres de Operación</h1>
            <p className="page-desc">{ops.length} registrados · {pendientes} pendientes validación</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/operations/new')}>
            <Plus size={15} /> Nuevo Cierre
          </button>
        </div>

        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="kpi-card" style={pendientes > 0 ? { borderLeft: '3px solid var(--color-caution)' } : {}}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">Pendientes validación</div>
                <div className="kpi-value" style={{ fontSize: 26, marginTop: 4, color: pendientes > 0 ? 'var(--color-caution)' : undefined }}>{pendientes}</div>
              </div>
              <div className="kpi-icon" style={{ background: '#fef3c7', color: '#78350f' }}><Clock size={18} /></div>
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">Validados</div>
                <div className="kpi-value" style={{ fontSize: 26, marginTop: 4 }}>{validados}</div>
              </div>
              <div className="kpi-icon" style={{ background: '#d1fae5', color: '#065f46' }}><CheckCircle2 size={18} /></div>
            </div>
          </div>
          <div className="kpi-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="kpi-label">Comisiones totales generadas</div>
                <div className="kpi-value" style={{ fontSize: 20, marginTop: 4 }}>{formatCurrency(totalComisiones)}</div>
              </div>
              <div className="kpi-icon" style={{ background: '#d1fae5', color: '#006c49' }}><DollarSign size={18} /></div>
            </div>
          </div>
        </div>

        <div className="filter-bar">
          <div className="search-wrapper">
            <Search />
            <input className="search-input" placeholder="Buscar por código, asesor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 200, height: 36, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="Solicitado">Solicitado</option>
            <option value="En revisión">En revisión</option>
            <option value="Validado por administración">Validado</option>
            <option value="Bloqueado por documentación">Bloqueado</option>
            <option value="Liberado para pago">Liberado para pago</option>
            <option value="Pagado">Pagado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <FileText size={32} />
            <p>Sin cierres registrados</p>
            <button className="btn btn-primary" onClick={() => router.push('/operations/new')}>Registrar primer cierre</button>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Código / Fecha</th>
                  <th>Tipo</th>
                  <th>Asesor</th>
                  <th>Precio cierre</th>
                  <th>Comisión generada</th>
                  <th>PLD</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(op => {
                  const s = STATUS_MAP[op.status] ?? { label: op.status, class: 'badge-neutral', icon: null };
                  const pldOk = op.pld_expediente_completo === 'true' || op.pld_expediente_completo === true;
                  const pldFlag = Number(op.precio_final_cierre || 0) >= 941412.75;
                  return (
                    <tr
                      key={op.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/operations/${op.id}`)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{op.code}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                          {op.fecha_cierre ? formatDate(op.fecha_cierre) : formatDate(op.created_at)}
                        </div>
                      </td>
                      <td><span className="badge badge-neutral">{op.type}</span></td>
                      <td style={{ fontSize: 13 }}>{op.advisor_name || '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(Number(op.precio_final_cierre || 0))}</td>
                      <td style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>{formatCurrency(Number(op.monto_comision_generada || 0))}</td>
                      <td>
                        {pldFlag && !pldOk
                          ? <span className="badge badge-error" style={{ fontSize: 10.5 }}><ShieldAlert size={9} /> Incompleto</span>
                          : pldOk
                          ? <span className="badge badge-success" style={{ fontSize: 10.5 }}>OK</span>
                          : <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>—</span>}
                      </td>
                      <td><span className={`badge ${s.class}`}>{s.icon} {s.label}</span></td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: '5px 8px' }}
                          onClick={(e) => { e.stopPropagation(); setViewOp(op); }}
                        >
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

      {viewOp && <OpModal op={viewOp} onClose={() => setViewOp(null)} onValidate={handleValidate} />}
    </>
  );
}
