'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/header';
import { useQuery } from '@tanstack/react-query';
import { api, documentsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import { notify } from '@/lib/toast';

const ADMIN_ROLES = ['Super Admin', 'Admin', 'Jurídico'];

const CONTRACT_STATUSES = [
  'Pendiente',
  'En elaboración',
  'Requiere información',
  'Entregado',
  'Cancelado',
];

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  border: '3px solid var(--color-surface-variant)',
  borderTopColor: 'var(--color-primary)',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

type StatusCfg = { bg: string; color: string };

const ESTATUS_MAP: Record<string, StatusCfg> = {
  'Pendiente':            { bg: '#fef3c7', color: '#78350f' },
  'En elaboración':       { bg: '#dbeafe', color: '#1e40af' },
  'Requiere información': { bg: '#fff3e0', color: '#e65100' },
  'Entregado':            { bg: '#d1fae5', color: '#065f46' },
  'Cancelado':            { bg: '#fee2e2', color: '#991b1b' },
};

function ContractStatusBadge({ status, large }: { status: string; large?: boolean }) {
  const c = ESTATUS_MAP[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span
      style={{
        padding: large ? '4px 14px' : '2px 8px',
        borderRadius: 999,
        fontSize: large ? 13 : 11,
        fontWeight: 600,
        background: c.bg,
        color: c.color,
        border: status === 'Requiere información' ? `1px solid ${c.color}40` : undefined,
      }}
    >
      {status}
    </span>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  const colors: Record<string, StatusCfg> = {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Contract = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  const [newStatus, setNewStatus] = useState('');
  const [obsJuridico, setObsJuridico] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    data: contract,
    isLoading,
    error,
    refetch,
  } = useQuery<Contract>({
    queryKey: ['contract', id],
    queryFn: () => api.get(`/contracts/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['docs', 'solicitud_contrato', id],
    queryFn: () =>
      documentsApi.listByEntity('solicitud_contrato', id).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!id,
  });

  const docs: Doc[] = Array.isArray(docsData) ? docsData : [];

  // Initialise editable fields from loaded contract
  useEffect(() => {
    if (contract) {
      setObsJuridico(contract.observaciones_juridico ?? '');
      setNewStatus(contract.estatus_solicitud ?? 'Pendiente');
    }
  }, [contract]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.patch(`/contracts/${id}/status`, {
        estatus: newStatus,
        observaciones: obsJuridico,
      });
      await refetch();
      setSaveMsg({ type: 'success', text: 'Cambios guardados' });
    } catch {
      setSaveMsg({ type: 'error', text: 'Error al guardar los cambios' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const handleViewDoc = async (docId: string) => {
    const res = await documentsApi.getSignedUrl(docId);
    const url = res.data?.signedUrl ?? res.data?.data?.signedUrl ?? res.data?.url;
    if (typeof url === 'string' && url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      notify.error('No se pudo obtener el enlace del documento.');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <Header />
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <div style={spinnerStyle} />
        </div>
      </>
    );
  }

  // ── Not found / error ────────────────────────────────────────────────────
  if (error || !contract) {
    return (
      <>
        <Header />
        <div className="page-content">
          <button
            className="btn btn-secondary"
            style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            onClick={() => router.push('/contracts')}
          >
            <ArrowLeft size={14} /> Volver a contratos
          </button>
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: '#991b1b' }}>
            Contrato no encontrado
          </div>
        </div>
      </>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const estatus: string = contract.estatus_solicitud ?? 'Pendiente';
  const precioDisplay = contract.precio_final_acordado || contract.precio_renta_acordada;

  const hasParticipacion = !!(contract.rep_vendedor_tipo || contract.rep_comprador_tipo);
  const comPct = Number(contract.comision_pactada_pct ?? 0);
  const comMonto = Number(contract.comision_pactada_monto ?? 0);
  const hasComisiones = comPct > 0 || comMonto > 0;
  const isShared = contract.existe_comision_compartida === 'true' || contract.existe_comision_compartida === true;
  const confirmado = contract.confirmacion_asesor === true || contract.confirmacion_asesor === 'true';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Header />
      <div className="page-content animate-fade-in">

        {/* ── Back button ── */}
        <button
          className="btn btn-secondary"
          style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          onClick={() => router.push('/contracts')}
        >
          <ArrowLeft size={14} /> Volver a contratos
        </button>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {contract.tipo_solicitud ?? 'Solicitud de Contrato'}
            </h1>
            <ContractStatusBadge status={estatus} large />
          </div>
          <p className="page-desc" style={{ margin: 0 }}>
            Solicitud #{id}
          </p>
        </div>

        {/* ── Info strip ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Asesor solicitante
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{contract.advisor_name ?? '—'}</div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Propiedad
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {contract.property_address ?? contract.id_propiedad ?? '—'}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Fecha solicitud
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {contract.fecha_solicitud ? formatDate(contract.fecha_solicitud) : '—'}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center', padding: '14px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Precio acordado
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
              {precioDisplay ? formatCurrency(Number(precioDisplay)) : '—'}
            </div>
          </div>
        </div>

        {/* ── Card 1: Datos de la Operación ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Datos de la Operación
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            <InfoField label="Tipo de solicitud" value={contract.tipo_solicitud} />
            <InfoField label="Estatus actual" value={<ContractStatusBadge status={estatus} />} />
            <InfoField
              label="Fecha estimada de firma"
              value={contract.fecha_firma_estimada ? formatDate(contract.fecha_firma_estimada) : null}
            />
            <InfoField
              label="Fecha estimada de entrega"
              value={contract.fecha_entrega_estimada ? formatDate(contract.fecha_entrega_estimada) : null}
            />
            <InfoField
              label="Precio / Renta acordado"
              value={
                contract.precio_renta_acordada
                  ? formatCurrency(Number(contract.precio_renta_acordada))
                  : null
              }
            />
            <InfoField
              label="Precio final"
              value={
                contract.precio_final_acordado
                  ? formatCurrency(Number(contract.precio_final_acordado))
                  : null
              }
            />
          </div>

          {/* Full-width fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <InfoField label="Condiciones de pago" value={contract.condiciones_pago || '—'} />

            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Observaciones del asesor
              </div>
              <div
                style={{
                  background: 'var(--color-surface-variant)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  fontSize: 13,
                  color: contract.observaciones_asesor ? 'inherit' : 'var(--color-on-surface-variant)',
                  whiteSpace: 'pre-wrap',
                  minHeight: 48,
                }}
              >
                {contract.observaciones_asesor || '—'}
              </div>
            </div>

            <InfoField
              label="Confirmación del asesor"
              value={
                confirmado
                  ? <span style={{ color: '#059669', fontWeight: 700 }}>✓ Confirmado</span>
                  : <span style={{ color: '#d97706', fontWeight: 700 }}>✗ Pendiente</span>
              }
            />
          </div>
        </div>

        {/* ── Card 2: Participación de Asesores ── */}
        {hasParticipacion && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
              Participación de Asesores
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {/* Parte Vendedora */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Parte Vendedora / Arrendadora
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contract.rep_vendedor_tipo && (
                    <InfoField label="Tipo de representación" value={contract.rep_vendedor_tipo} />
                  )}
                  {contract.asesor_interno_vendedor && (
                    <InfoField label="Asesor interno" value={contract.asesor_interno_vendedor} />
                  )}
                  {contract.nombre_externo_vendedor && (
                    <InfoField label="Nombre" value={contract.nombre_externo_vendedor} />
                  )}
                  {contract.telefono_externo_vendedor && (
                    <InfoField label="Teléfono" value={contract.telefono_externo_vendedor} />
                  )}
                  {contract.correo_externo_vendedor && (
                    <InfoField label="Correo" value={contract.correo_externo_vendedor} />
                  )}
                  {contract.inmobiliaria_externa_vendedor && (
                    <InfoField label="Inmobiliaria" value={contract.inmobiliaria_externa_vendedor} />
                  )}
                </div>
              </div>

              {/* Parte Compradora */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  Parte Compradora / Arrendataria
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contract.rep_comprador_tipo && (
                    <InfoField label="Tipo de representación" value={contract.rep_comprador_tipo} />
                  )}
                  {contract.asesor_interno_comprador && (
                    <InfoField label="Asesor interno" value={contract.asesor_interno_comprador} />
                  )}
                  {contract.nombre_externo_comprador && (
                    <InfoField label="Nombre" value={contract.nombre_externo_comprador} />
                  )}
                  {contract.telefono_externo_comprador && (
                    <InfoField label="Teléfono" value={contract.telefono_externo_comprador} />
                  )}
                  {contract.correo_externo_comprador && (
                    <InfoField label="Correo" value={contract.correo_externo_comprador} />
                  )}
                  {contract.inmobiliaria_externa_comprador && (
                    <InfoField label="Inmobiliaria" value={contract.inmobiliaria_externa_comprador} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Card 3: Comisiones ── */}
        {hasComisiones && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
              Comisiones
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <InfoField
                label="Comisión pactada (%)"
                value={comPct > 0 ? `${comPct}%` : null}
              />
              <InfoField
                label="Comisión pactada (monto)"
                value={comMonto > 0 ? formatCurrency(comMonto) : null}
              />
              <InfoField
                label="Comisión compartida"
                value={isShared ? 'Sí' : 'No'}
              />
              {isShared && contract.detalle_comision_compartida && (
                <InfoField label="Detalle comisión compartida" value={contract.detalle_comision_compartida} />
              )}
            </div>
          </div>
        )}

        {/* ── Card 4: Observaciones Jurídico ── */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Observaciones Jurídico
          </div>

          {/* Current obs display */}
          <div
            style={{
              background: 'var(--color-surface-variant)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              fontSize: 13,
              color: contract.observaciones_juridico ? 'inherit' : 'var(--color-on-surface-variant)',
              whiteSpace: 'pre-wrap',
              minHeight: 48,
              marginBottom: isAdmin ? 20 : 0,
            }}
          >
            {contract.observaciones_juridico || 'Sin observaciones'}
          </div>

          {/* Admin edit section */}
          {isAdmin && (
            <div style={{ borderTop: '1px solid var(--color-surface-variant)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Estado actual: <ContractStatusBadge status={estatus} />
              </div>

              {saveMsg && (
                <div
                  style={{
                    background: saveMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${saveMsg.type === 'success' ? '#86efac' : '#fecaca'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 14px',
                    fontSize: 13,
                    color: saveMsg.type === 'success' ? '#166534' : '#b91c1c',
                    marginBottom: 14,
                  }}
                >
                  {saveMsg.text}
                </div>
              )}

              <div className="input-group" style={{ marginBottom: 14 }}>
                <label className="input-label">Nueva observación (jurídico)</label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: 88, resize: 'vertical', fontSize: 13, boxSizing: 'border-box' }}
                  placeholder="Agregar o modificar observaciones..."
                  value={obsJuridico}
                  onChange={(e) => setObsJuridico(e.target.value)}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Cambiar estatus</label>
                <select
                  className="select"
                  style={{ fontSize: 13 }}
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  {CONTRACT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{ opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )}
        </div>

        {/* ── Card 5: Documentos adjuntos ── */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Documentos adjuntos
          </div>

          {loadingDocs ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={spinnerStyle} />
            </div>
          ) : docs.length === 0 ? (
            <div
              style={{
                background: 'var(--color-surface-variant)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--color-on-surface-variant)',
                fontSize: 13,
              }}
            >
              No hay documentos adjuntos a esta solicitud
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {docs.map((doc) => {
                const docId = String(doc.id);
                return (
                  <div
                    key={docId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      background: 'var(--color-surface-variant)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <FileText size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 550,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {String(doc.tipo_documento ?? doc.nombre_archivo ?? doc.original_name ?? 'Documento')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                        {doc.fecha_carga ? formatDate(String(doc.fecha_carga)) : '—'}
                      </div>
                    </div>
                    <DocStatusBadge status={String(doc.estatus_documento ?? doc.estatus ?? doc.status ?? 'Pendiente')} />
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '4px 10px', flexShrink: 0 }}
                      onClick={() => handleViewDoc(docId)}
                    >
                      Ver
                    </button>
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
