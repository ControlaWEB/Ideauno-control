'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operationsApi, documentsApi, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';

const MXN = (v: unknown) => {
  const num = Number(v ?? 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
};

const ADMIN_ROLES = ['Super Admin', 'Admin'];

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid var(--color-surface-variant)',
  borderTopColor: 'var(--color-primary)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

type StatusConfig = { bg: string; color: string };

const OP_STATUS_MAP: Record<string, StatusConfig> = {
  Solicitado:                     { bg: '#f3f4f6', color: '#6b7280' },
  'En revisión':                  { bg: '#fef3c7', color: '#78350f' },
  'Validado por administración':  { bg: '#d1fae5', color: '#065f46' },
  'Bloqueado por documentación':  { bg: '#fee2e2', color: '#991b1b' },
  'Liberado para pago':           { bg: 'var(--color-primary)', color: '#fff' },
  Pagado:                         { bg: '#d1fae5', color: '#065f46' },
  Cancelado:                      { bg: '#f3f4f6', color: '#6b7280' },
};

function StatusBadge({ status }: { status: string }) {
  const c = OP_STATUS_MAP[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: 'var(--color-surface-variant)', color: 'var(--color-on-surface-variant)' }}>
      {tipo}
    </span>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const colors: Record<string, StatusConfig> = {
    Pendiente: { bg: '#fef3c7', color: '#78350f' },
    Validado:  { bg: '#d1fae5', color: '#065f46' },
    Rechazado: { bg: '#fee2e2', color: '#991b1b' },
  };
  const c = colors[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5 }}>{value ?? '—'}</div>
    </div>
  );
}

export default function OperationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  const [statusError, setStatusError] = useState<string | null>(null);
  const [validatingDoc, setValidatingDoc] = useState<string | null>(null);
  const [docObservacion, setDocObservacion] = useState('');
  const [docAction, setDocAction] = useState<'Validado' | 'Rechazado' | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const { data: opData, isLoading: loadingOp, error: opError } = useQuery({
    queryKey: ['operation', id],
    queryFn: () => operationsApi.getOne(id).then(r => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { data: commData } = useQuery({
    queryKey: ['operation-commissions', id],
    queryFn: () => api.get('/operations/commissions', { params: { operationId: id } }).then(r => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['docs', 'cierre', id],
    queryFn: () => documentsApi.listByEntity('cierre', id).then(r => r.data?.data ?? r.data ?? []),
    enabled: !!id,
  });

  const data = opData ?? {};
  const comm = commData ?? data;
  const docs: Record<string, unknown>[] = Array.isArray(docsData) ? docsData : [];

  const handleDocStatus = (docId: string, action: 'Validado' | 'Rechazado') => {
    setValidatingDoc(docId);
    setDocAction(action);
  };

  const handleViewDoc = async (docId: string) => {
    const res = await documentsApi.getSignedUrl(docId);
    const url = res.data?.url ?? res.data;
    if (url) window.open(url, '_blank');
  };

  const handleConfirmDocStatus = async () => {
    if (!validatingDoc || !docAction) return;
    await documentsApi.updateStatus(validatingDoc, docAction, docObservacion || undefined);
    queryClient.invalidateQueries({ queryKey: ['docs', 'cierre', id] });
    setValidatingDoc(null);
    setDocObservacion('');
    setDocAction(null);
  };

  const handleOpStatus = async (status: string) => {
    setStatusError(null);
    try {
      await operationsApi.updateStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ['operation', id] });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      setStatusError(typeof msg === 'string' ? msg : 'Error al cambiar el estatus de la operación.');
    }
  };

  const handleCancel = async () => {
    if (!cancelMotivo.trim()) { setStatusError('El motivo de cancelación es requerido.'); return; }
    setStatusError(null);
    setCancelLoading(true);
    try {
      await operationsApi.cancel(id, cancelMotivo.trim());
      queryClient.invalidateQueries({ queryKey: ['operation', id] });
      setShowCancelForm(false);
      setCancelMotivo('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message;
      const msg = Array.isArray(raw) ? raw[0] : raw;
      setStatusError(typeof msg === 'string' ? msg : 'Error al cancelar la operación.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loadingOp) {
    return (
      <>
        <Header />
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={spinnerStyle} />
        </div>
      </>
    );
  }

  if (opError) {
    return (
      <>
        <Header />
        <div className="page-content">
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: '#991b1b' }}>
            Error al cargar la operación. Verifica que el ID sea válido.
          </div>
        </div>
      </>
    );
  }

  const pldCompleto = data.pld_expediente_completo === true || data.pld_expediente_completo === 'true';
  const currentStatus: string = data.status ?? '';
  const canValidate = currentStatus === 'Solicitado';
  const canMarkValidado = currentStatus === 'En revisión';
  const canLiberate = currentStatus === 'Validado por administración';

  // Commission rows
  const commRows: { label: string; key: string; prefix?: string }[] = [
    { label: 'Comisión Total',            key: 'monto_comision_total' },
    { label: '(-) Gratificación Invitación', key: 'monto_invitacion',   prefix: '-' },
    { label: '(=) Remanente',             key: 'monto_remanente',     prefix: '=' },
    { label: 'Monto Base Asesor',         key: 'monto_base_asesor' },
    { label: '(-) Mentoría',              key: 'monto_mentoria',      prefix: '-' },
    { label: '(=) Neto Asesor',           key: 'monto_neto_asesor',   prefix: '=' },
    { label: 'Inmobiliaria',              key: 'monto_inmobiliaria' },
  ];

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Header />
      <div className="page-content animate-fade-in">
        {/* Back + Title */}
        <div style={{ marginBottom: 24 }}>
          <button
            className="btn btn-secondary"
            style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={() => router.push('/operations')}
          >
            <ArrowLeft size={14} /> Volver a Operaciones
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{data.code ?? 'Cierre'}</h1>
            {data.type && <TipoBadge tipo={data.type} />}
            <StatusBadge status={currentStatus} />
          </div>
        </div>

        {/* Economic Summary Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Precio Final</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
              {MXN(data.precio_final_cierre)}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Comisión Total</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-secondary)' }}>
              {MXN(data.monto_comision_generada)}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Fecha Cierre</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {data.fecha_cierre ? formatDate(data.fecha_cierre) : '—'}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>PLD</div>
            {pldCompleto
              ? <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>✓ Completo</span>
              : <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>⚠ Pendiente</span>}
          </div>
        </div>

        {/* Commission Breakdown */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Desglose de Comisiones</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {commRows.map(({ label, key, prefix }) => {
                const val = comm[key];
                const isSubtotal = prefix === '=';
                return (
                  <tr
                    key={key}
                    style={{
                      borderBottom: '1px solid var(--color-surface-variant)',
                      background: isSubtotal ? 'var(--color-surface-variant)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '9px 12px', color: 'var(--color-on-surface-variant)', fontWeight: isSubtotal ? 600 : 400 }}>
                      {label}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: isSubtotal ? 700 : 500, color: isSubtotal ? 'var(--color-primary)' : 'var(--color-on-surface)' }}>
                      {val != null ? MXN(val) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Representación */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Representación</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Representación Vendedor" value={data.rep_vendedor_tipo} />
            <InfoField label="Representación Comprador" value={data.rep_comprador_tipo} />
            <InfoField label="Asesor Externo Vendedor" value={data.asesor_externo_vendedor} />
            <InfoField label="Asesor Externo Comprador" value={data.asesor_externo_comprador} />
          </div>
        </div>

        {/* Admin Validation */}
        {isAdmin && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 12 }}>Validación Administrativa</div>
            <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 14 }}>
              Estado actual: <StatusBadge status={currentStatus} />
            </div>
            {statusError && (
              <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: '#991b1b', fontSize: 13, marginBottom: 14 }}>
                {statusError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {canValidate && (
                <button
                  className="btn btn-primary"
                  style={{ background: '#059669' }}
                  onClick={() => handleOpStatus('Validado por administración')}
                >
                  Validar Cierre
                </button>
              )}
              {canMarkValidado && (
                <button
                  className="btn btn-primary"
                  style={{ background: '#059669' }}
                  onClick={() => handleOpStatus('Validado por administración')}
                >
                  Marcar validado
                </button>
              )}
              {canLiberate && (
                <button
                  className="btn btn-primary"
                  style={{ background: 'var(--color-secondary)', color: 'var(--color-primary)' }}
                  onClick={() => handleOpStatus('Liberado para pago')}
                >
                  Liberar para pago
                </button>
              )}
              <button
                className="btn"
                style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                onClick={() => handleOpStatus('Bloqueado por documentación')}
              >
                Bloquear
              </button>
              {!showCancelForm ? (
                <button
                  className="btn btn-secondary"
                  disabled={currentStatus === 'Cancelado' || currentStatus === 'Pagado'}
                  onClick={() => setShowCancelForm(true)}
                >
                  Cancelar operación
                </button>
              ) : (
                <div style={{ width: '100%', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginTop: 4 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>Motivo de cancelación (requerido)</div>
                  <textarea
                    style={{ width: '100%', minHeight: 64, padding: '8px 10px', fontSize: 13, border: '1px solid #fca5a5', borderRadius: 6, resize: 'vertical', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }}
                    placeholder="Describe el motivo de la cancelación..."
                    value={cancelMotivo}
                    onChange={e => setCancelMotivo(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn"
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: cancelLoading ? 0.6 : 1 }}
                      disabled={cancelLoading}
                      onClick={handleCancel}
                    >
                      {cancelLoading ? 'Cancelando...' : 'Confirmar cancelación'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setShowCancelForm(false); setCancelMotivo(''); setStatusError(null); }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documentos */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Documentos</div>
          {loadingDocs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={spinnerStyle} />
            </div>
          ) : docs.length === 0 ? (
            <div style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', padding: '24px', textAlign: 'center', color: 'var(--color-on-surface-variant)', fontSize: 13 }}>
              No hay documentos cargados
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map((doc) => {
                const docId = String(doc.id);
                return (
                  <div key={docId} style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px' }}>
                      <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {String(doc.nombre_archivo ?? doc.original_name ?? 'Documento')}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                          {String(doc.tipo_documento ?? '—')}
                        </div>
                      </div>
                      <DocStatusBadge status={String(doc.estatus ?? doc.status ?? 'Pendiente')} />
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => handleViewDoc(docId)}
                        >
                          Ver
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 12, padding: '4px 10px', background: '#059669' }}
                              onClick={() => { setValidatingDoc(docId); setDocAction('Validado'); setDocObservacion(''); }}
                            >
                              Validar
                            </button>
                            <button
                              className="btn"
                              style={{ fontSize: 12, padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                              onClick={() => { setValidatingDoc(docId); setDocAction('Rechazado'); setDocObservacion(''); }}
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {validatingDoc === docId && (
                      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                        <label className="input-label" style={{ display: 'block', marginBottom: 4 }}>
                          Observaciones {docAction === 'Rechazado' ? '(requerido)' : '(opcional)'}
                        </label>
                        <textarea
                          className="input"
                          style={{ width: '100%', minHeight: 64, resize: 'vertical', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
                          placeholder={docAction === 'Rechazado' ? 'Motivo del rechazo...' : 'Comentarios adicionales...'}
                          value={docObservacion}
                          onChange={e => setDocObservacion(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: '4px 12px', background: docAction === 'Rechazado' ? '#dc2626' : '#059669', opacity: (docAction === 'Rechazado' && !docObservacion.trim()) ? 0.5 : 1 }}
                            disabled={docAction === 'Rechazado' && !docObservacion.trim()}
                            onClick={handleConfirmDocStatus}
                          >
                            Confirmar {docAction}
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={() => { setValidatingDoc(null); setDocObservacion(''); setDocAction(null); }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
