'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ShieldOff, UserCheck } from 'lucide-react';
import { useHasAccess, AccessDenied } from '@/components/access-guard';

const ALLOWED_ROLES = ['Super Admin', 'Admin'];

type RiskLevel = 'bajo' | 'medio' | 'alto';
type CaseStatus = 'pendiente_docs' | 'en_revision' | 'aprobado' | 'bloqueado' | 'rechazado';
type PepCheck = 'negativo' | 'positivo' | 'pendiente';

interface ComplianceCase {
  id: string;
  operation_id: string;
  client_id: string;
  operationCode: string;
  clientName: string;
  contractValue: number;
  risk_level: RiskLevel;
  status: CaseStatus;
  rfc_valid: boolean;
  identification_valid: boolean;
  pep_check: PepCheck;
  alert_trigger: string;
  observations: string;
  created_at: string;
}

const RISK_BADGE: Record<RiskLevel, string> = {
  bajo:  'badge-success',
  medio: 'badge-warning',
  alto:  'badge-error',
};

const STATUS_META: Record<CaseStatus, { label: string; cls: string }> = {
  pendiente_docs: { label: 'Pend. documentos', cls: 'badge-warning' },
  en_revision:    { label: 'En revisión',       cls: 'badge-primary' },
  aprobado:       { label: 'Aprobado',           cls: 'badge-success' },
  bloqueado:      { label: 'Bloqueado',          cls: 'badge-error'   },
  rechazado:      { label: 'Rechazado',          cls: 'badge-error'   },
};

function BoolCheck({ value }: { value: boolean }) {
  return (
    <span style={{ fontWeight: 700, color: value ? 'var(--color-success)' : 'var(--color-error)', fontSize: 15 }}>
      {value ? '✓' : '✗'}
    </span>
  );
}

function PepBadge({ check }: { check: PepCheck }) {
  if (check === 'negativo')
    return <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600 }}>Negativo</span>;
  if (check === 'positivo')
    return <span className="badge badge-error" style={{ fontWeight: 700 }}>¡POSITIVO!</span>;
  return <span className="badge badge-warning">Pendiente</span>;
}

export default function CompliancePage() {
  const router = useRouter();
  const hasAccess = useHasAccess(ALLOWED_ROLES);
  const [filterRisk, setFilterRisk]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: cases = [], isLoading } = useQuery<ComplianceCase[]>({
    queryKey: ['compliance'],
    queryFn: () => api.get('/compliance').then(r => r.data?.data ?? r.data ?? []),
    enabled: hasAccess,
  });

  if (!hasAccess) return <AccessDenied title="Cumplimiento PLD / KYC" />;

  const filtered = cases.filter(c => {
    if (filterRisk   && c.risk_level !== filterRisk)   return false;
    if (filterStatus && c.status     !== filterStatus) return false;
    return true;
  });

  const totalCases    = cases.length;
  const blockedCases  = cases.filter(c => c.status === 'bloqueado').length;
  const pepPositive   = cases.filter(c => c.pep_check === 'positivo').length;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Cumplimiento PLD / KYC</h1>
            <p className="page-desc">Control de expedientes de Prevención de Lavado de Dinero</p>
          </div>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: 'var(--color-primary)' }}>
              <ShieldAlert size={20} color="white" />
            </div>
            <div>
              <div className="kpi-label">Casos totales</div>
              <div className="kpi-value">{totalCases}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: '#b91c1c' }}>
              <ShieldOff size={20} color="white" />
            </div>
            <div>
              <div className="kpi-label">Casos bloqueados</div>
              <div className="kpi-value" style={{ color: '#b91c1c' }}>{blockedCases}</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ background: '#d97706' }}>
              <UserCheck size={20} color="white" />
            </div>
            <div>
              <div className="kpi-label">PEP detectados</div>
              <div className="kpi-value" style={{ color: '#d97706' }}>{pepPositive}</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="input-label" style={{ margin: 0 }}>Nivel de riesgo</label>
              <select
                className="select"
                style={{ minWidth: 160 }}
                value={filterRisk}
                onChange={e => setFilterRisk(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="input-label" style={{ margin: 0 }}>Estatus</label>
              <select
                className="select"
                style={{ minWidth: 190 }}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="pendiente_docs">Pend. documentos</option>
                <option value="en_revision">En revisión</option>
                <option value="aprobado">Aprobado</option>
                <option value="bloqueado">Bloqueado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: 46, borderRadius: 'var(--radius-md)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <ShieldAlert size={32} />
              <p>No hay expedientes de cumplimiento registrados</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Operación</th>
                    <th>Cliente</th>
                    <th>Riesgo</th>
                    <th>Estatus</th>
                    <th>RFC válido</th>
                    <th>ID válida</th>
                    <th>PEP</th>
                    <th>Alerta</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const riskCls  = RISK_BADGE[c.risk_level]  ?? 'badge-neutral';
                    const statusM  = STATUS_META[c.status]     ?? { label: c.status, cls: 'badge-neutral' };
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{c.operationCode || '—'}</td>
                        <td style={{ fontSize: 13 }}>{c.clientName || '—'}</td>
                        <td>
                          <span className={`badge ${riskCls}`} style={{ textTransform: 'capitalize' }}>
                            {c.risk_level}
                          </span>
                        </td>
                        <td><span className={`badge ${statusM.cls}`}>{statusM.label}</span></td>
                        <td style={{ textAlign: 'center' }}><BoolCheck value={c.rfc_valid} /></td>
                        <td style={{ textAlign: 'center' }}><BoolCheck value={c.identification_valid} /></td>
                        <td><PepBadge check={c.pep_check} /></td>
                        <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', maxWidth: 160 }}>
                          {c.alert_trigger || '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>
                          {formatDate(c.created_at)}
                        </td>
                        <td>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap' }}
                            onClick={() => router.push(`/operations/${c.operation_id}`)}
                          >
                            Ver operación
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

      </div>
    </>
  );
}
