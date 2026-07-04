'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { advisorsApi, documentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';
import { CLABE_RE, SOLO_LETRAS, soloDigitos } from '@/lib/validators';
import { notify } from '@/lib/toast';

const MXN = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const ADMIN_ROLES = ['Super Admin', 'Admin'];

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid var(--color-surface-variant)',
  borderTopColor: 'var(--color-primary)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    Activo:           { bg: '#d1fae5', color: '#065f46' },
    'En mentoría':    { bg: '#fef3c7', color: '#78350f' },
    Inactivo:         { bg: '#f3f4f6', color: '#6b7280' },
    'Baja definitiva':{ bg: '#fee2e2', color: '#991b1b' },
    Fallecido:        { bg: '#e5e7eb', color: '#374151' },
  };
  const c = colors[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
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

export default function AdvisorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  const [validatingDoc, setValidatingDoc] = useState<string | null>(null);
  const [docObservacion, setDocObservacion] = useState('');
  const [docAction, setDocAction] = useState<'Validado' | 'Rechazado' | null>(null);

  // Status change form
  const [newStatus, setNewStatus] = useState('');
  const [motivoBaja, setMotivoBaja] = useState('');
  const [fechaBaja, setFechaBaja] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // Bank form
  const [bankForm, setBankForm] = useState({ clabe: '', banco: '', titular: '' });
  const [bankSaving, setBankSaving] = useState(false);

  const { data: advisorData, isLoading: loadingAdvisor, error: advisorError } = useQuery({
    queryKey: ['advisor', id],
    queryFn: () => advisorsApi.getOne(id).then(r => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['docs', 'asesor', id],
    queryFn: () => documentsApi.listByEntity('asesor', id).then(r => r.data?.data ?? r.data ?? []),
    enabled: !!id,
  });

  const data = advisorData ?? {};
  const docs: Record<string, unknown>[] = Array.isArray(docsData) ? docsData : [];

  const handleViewDoc = async (docId: string) => {
    const res = await documentsApi.getSignedUrl(docId);
    const url = res.data?.signedUrl ?? res.data?.data?.signedUrl ?? res.data?.url;
    if (typeof url === 'string' && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      notify.error('No se pudo obtener el enlace del documento.');
    }
  };

  const handleStatusSave = async () => {
    if (!newStatus) return;
    setStatusSaving(true);
    try {
      await advisorsApi.updateStatus(id, newStatus, motivoBaja || undefined, fechaBaja || undefined);
      queryClient.invalidateQueries({ queryKey: ['advisor', id] });
      notify.success('Estatus del asesor actualizado correctamente.');
      setNewStatus('');
      setMotivoBaja('');
      setFechaBaja('');
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
    } finally {
      setStatusSaving(false);
    }
  };

  const handleBankSave = async () => {
    const clabe = bankForm.clabe.trim();
    const banco = bankForm.banco.trim();
    const titular = bankForm.titular.trim();
    if (!clabe || !banco || !titular) {
      notify.error('Todos los campos bancarios son requeridos');
      return;
    }
    if (!CLABE_RE.test(clabe)) {
      notify.error('La CLABE debe tener exactamente 18 dígitos');
      return;
    }
    if (!SOLO_LETRAS.test(titular)) {
      notify.error('El titular solo puede contener letras, espacios y acentos');
      return;
    }
    setBankSaving(true);
    try {
      await advisorsApi.updateBank(id, clabe, banco, titular);
      queryClient.invalidateQueries({ queryKey: ['advisor', id] });
      notify.success('Datos bancarios guardados.');
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
    } finally {
      setBankSaving(false);
    }
  };

  const handleConfirmDocStatus = async () => {
    if (!validatingDoc || !docAction) return;
    await documentsApi.updateStatus(validatingDoc, docAction, docObservacion || undefined);
    queryClient.invalidateQueries({ queryKey: ['docs', 'asesor', id] });
    setValidatingDoc(null);
    setDocObservacion('');
    setDocAction(null);
  };

  if (loadingAdvisor) {
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

  if (advisorError) {
    return (
      <>
        <Header />
        <div className="page-content">
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: '#991b1b' }}>
            Error al cargar el asesor. Verifica que el ID sea válido.
          </div>
        </div>
      </>
    );
  }

  const avancePct = Number(data.avance_ama_pct ?? 0);

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
            onClick={() => router.push('/advisors')}
          >
            <ArrowLeft size={14} /> Volver a Asesores
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{data.name ?? 'Asesor'}</h1>
            <StatusBadge status={data.status ?? ''} />
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Ventas Cerradas</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-primary)' }}>{data.salesClosed ?? 0}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Comisión Total</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-secondary)' }}>
              {typeof data.comision_total === 'number' ? MXN(data.comision_total) : (data.comision_total ?? '$0')}
            </div>
          </div>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Avance AMA</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{avancePct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: 'var(--color-secondary)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, avancePct)}%`, background: 'var(--color-primary)', borderRadius: 999 }} />
            </div>
          </div>
        </div>

        {/* Datos personales */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Datos Personales</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Nombre" value={data.name} />
            <InfoField label="Teléfono" value={data.phone} />
            <InfoField label="Correo" value={data.email} />
            <InfoField label="RFC" value={data.rfc} />
            <InfoField label="CURP" value={data.curp} />
            <InfoField label="Fecha de Nacimiento" value={data.fecha_nacimiento ? formatDate(data.fecha_nacimiento) : null} />
            <InfoField label="Fecha de Alta" value={data.fecha_alta_asesor ? formatDate(data.fecha_alta_asesor) : null} />
            {data.observaciones && (
              <div style={{ gridColumn: '1 / -1' }}>
                <InfoField label="Observaciones" value={data.observaciones} />
              </div>
            )}
          </div>
        </div>

        {/* Red comercial */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Red Comercial</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Invitador" value={data.inviterName || data.invite_by_advisor_id || 'Directo'} />
            <InfoField label="Mentor" value={data.mentorName || data.id_mentor} />
            <div style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Pasa por Mentoría</div>
              {data.pasa_por_mentoria === 'true' || data.pasa_por_mentoria === true
                ? <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fef3c7', color: '#78350f' }}>Sí</span>
                : <span style={{ fontSize: 13 }}>No</span>}
            </div>
          </div>
        </div>

        {/* Beneficiario */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Beneficiario</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Nombre" value={data.nombre_beneficiario} />
            <InfoField label="Teléfono" value={data.telefono_beneficiario} />
            <InfoField label="Correo" value={data.correo_beneficiario} />
          </div>
        </div>

        {/* Admin: Cambio de estatus + datos bancarios */}
        {isAdmin && (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Cambio de Estatus</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 6 }}>Nuevo estatus</div>
                  <select
                    className="select"
                    style={{ width: '100%', height: 40, fontSize: 13 }}
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value)}
                  >
                    <option value="">-- Seleccionar --</option>
                    <option value="Activo">Activo</option>
                    <option value="En mentoría">En mentoría</option>
                    <option value="Inactivo">Inactivo</option>
                    <option value="Baja definitiva">Baja definitiva</option>
                    <option value="Fallecido">Fallecido</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 6 }}>Fecha de baja (si aplica)</div>
                  <input
                    type="date"
                    className="input"
                    style={{ width: '100%', height: 40, fontSize: 13, boxSizing: 'border-box' }}
                    value={fechaBaja}
                    onChange={e => setFechaBaja(e.target.value)}
                  />
                </div>
              </div>
              {(newStatus === 'Inactivo' || newStatus === 'Baja definitiva') && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 6 }}>Motivo</div>
                  <input
                    className="input"
                    style={{ width: '100%', height: 40, fontSize: 13, boxSizing: 'border-box' }}
                    placeholder="Motivo de baja o inactivación..."
                    value={motivoBaja}
                    onChange={e => setMotivoBaja(e.target.value)}
                  />
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, opacity: (!newStatus || statusSaving) ? 0.6 : 1 }}
                disabled={!newStatus || statusSaving}
                onClick={handleStatusSave}
              >
                {statusSaving ? 'Guardando...' : 'Guardar estatus'}
              </button>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 4 }}>Datos Bancarios</div>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 16 }}>
                Requeridos para liberar pago de comisión. Valores actuales: {data.clabe_interbancaria ? `${data.banco} — ${data.clabe_interbancaria}` : 'No registrados'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  { label: 'CLABE interbancaria (18 dígitos)', key: 'clabe', placeholder: '000000000000000000' },
                  { label: 'Banco', key: 'banco', placeholder: 'BBVA, Santander...' },
                  { label: 'Titular de la cuenta', key: 'titular', placeholder: 'Nombre como aparece en cuenta' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
                    <input
                      className="input"
                      style={{ width: '100%', height: 40, fontSize: 13, boxSizing: 'border-box' }}
                      placeholder={placeholder}
                      value={bankForm[key as keyof typeof bankForm]}
                      inputMode={key === 'clabe' ? 'numeric' : undefined}
                      maxLength={key === 'clabe' ? 18 : 120}
                      onChange={e => {
                        const v = key === 'clabe' ? soloDigitos(e.target.value, 18) : e.target.value;
                        setBankForm(prev => ({ ...prev, [key]: v }));
                      }}
                    />
                  </div>
                ))}
              </div>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, opacity: bankSaving ? 0.6 : 1 }}
                disabled={bankSaving}
                onClick={handleBankSave}
              >
                {bankSaving ? 'Guardando...' : 'Guardar datos bancarios'}
              </button>
            </div>
          </>
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
                      <DocStatusBadge status={String(doc.estatus_documento ?? doc.estatus ?? doc.status ?? 'Pendiente')} />
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
