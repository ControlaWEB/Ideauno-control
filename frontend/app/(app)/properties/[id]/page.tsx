'use client';

import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi, documentsApi, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
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

const PROPERTY_STATUSES = [
  'Incompleta',
  'En revisión',
  'Activa',
  'Publicable',
  'Compartida',
  'Vendida',
  'Rentada',
  'Inactiva',
];

function StatusBadge({ status, colors }: { status: string; colors?: Record<string, { bg: string; color: string }> }) {
  const defaults: Record<string, { bg: string; color: string }> = {
    Incompleta:    { bg: '#fee2e2', color: '#991b1b' },
    'En revisión': { bg: '#fef3c7', color: '#78350f' },
    Activa:        { bg: '#d1fae5', color: '#065f46' },
    Publicable:    { bg: '#d1fae5', color: '#065f46' },
    Compartida:    { bg: '#dbeafe', color: '#1e40af' },
    Vendida:       { bg: '#f3f4f6', color: '#374151' },
    Rentada:       { bg: '#ede9fe', color: '#5b21b6' },
    Inactiva:      { bg: '#f3f4f6', color: '#6b7280' },
  };
  const map = colors ?? defaults;
  const c = map[status] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function TipoOpBadge({ tipo }: { tipo: string }) {
  const c = tipo === 'Venta'
    ? { bg: 'var(--color-primary)', color: '#fff' }
    : { bg: 'var(--color-secondary)', color: '#1a1a1a' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.color }}>
      {tipo}
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

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  const [newStatus, setNewStatus]       = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [markingContract, setMarkingContract] = useState(false);

  const [validatingDoc, setValidatingDoc] = useState<string | null>(null);
  const [docObservacion, setDocObservacion] = useState('');
  const [docAction, setDocAction] = useState<'Validado' | 'Rechazado' | null>(null);

  const { data: propData, isLoading: loadingProp, error: propError } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertiesApi.getOne(id).then(r => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['docs', 'propiedad', id],
    queryFn: () => documentsApi.listByEntity('propiedad', id).then(r => r.data?.data ?? r.data ?? []),
    enabled: !!id,
  });

  const data = propData ?? {};
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

  const handleConfirmDocStatus = async () => {
    if (!validatingDoc || !docAction) return;
    await documentsApi.updateStatus(validatingDoc, docAction, docObservacion || undefined);
    queryClient.invalidateQueries({ queryKey: ['docs', 'propiedad', id] });
    notify.success(`Documento ${docAction === 'Validado' ? 'validado' : 'rechazado'}.`);
    setValidatingDoc(null);
    setDocObservacion('');
    setDocAction(null);
  };

  const handleChangeStatus = async () => {
    if (!newStatus) return;
    setChangingStatus(true);
    try {
      await api.patch(`/properties/${id}/status`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      notify.success(`Estatus cambiado a "${newStatus}".`);
      setNewStatus('');
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
    } finally {
      setChangingStatus(false);
    }
  };

  const handleMarkContractSigned = async () => {
    setMarkingContract(true);
    try {
      await api.patch(`/properties/${id}`, { contratoComisionFirmado: true });
      queryClient.invalidateQueries({ queryKey: ['property', id] });
      notify.success('Contrato de comisión marcado como firmado.');
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
    } finally {
      setMarkingContract(false);
    }
  };

  if (loadingProp) {
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

  if (propError) {
    return (
      <>
        <Header />
        <div className="page-content">
          <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: '#991b1b' }}>
            Error al cargar la propiedad. Verifica que el ID sea válido.
          </div>
        </div>
      </>
    );
  }

  const tipoOp = data.tipo_operacion ?? (data.type === 'Renta' ? 'Renta' : 'Venta');
  const contratFirmado = data.contrato_comision_firmado === true || data.contrato_comision_firmado === 'true';

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
            onClick={() => router.push('/properties')}
          >
            <ArrowLeft size={14} /> Volver a Propiedades
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{data.address ?? 'Propiedad'}</h1>
            <TipoOpBadge tipo={tipoOp} />
            <StatusBadge status={data.status ?? ''} />
          </div>
        </div>

        {/* Price / Info Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Precio</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>
              {data.price != null ? MXN(Number(data.price)) : '—'}
            </div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Tipo de Inmueble</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{data.tipo_inmueble ?? data.type ?? '—'}</div>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', marginBottom: 8 }}>Contrato Comisión</div>
            {contratFirmado
              ? <span style={{ fontSize: 14, fontWeight: 700, color: '#059669' }}>✓ Firmado</span>
              : <span style={{ fontSize: 14, fontWeight: 700, color: '#d97706' }}>⚠ Pendiente</span>}
          </div>
        </div>

        {/* Propietario */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Propietario</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Nombre" value={data.owner_name} />
            <InfoField label="Teléfono" value={data.owner_phone} />
            <InfoField label="Correo" value={data.owner_email} />
            <InfoField label="Estado Civil" value={data.owner_estado_civil} />
          </div>
        </div>

        {/* Datos del inmueble */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Datos del Inmueble</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Superficie Terreno" value={data.superficie_terreno_m2 != null ? `${data.superficie_terreno_m2} m²` : null} />
            <InfoField label="Superficie Construcción" value={data.superficie_construccion_m2 != null ? `${data.superficie_construccion_m2} m²` : null} />
            <InfoField label="Recámaras" value={data.recamaras} />
            <InfoField label="Baños Completos" value={data.banos_completos} />
            <InfoField label="Medios Baños" value={data.medios_banos} />
            <InfoField label="Estacionamientos" value={data.estacionamientos} />
            <InfoField label="Niveles" value={data.niveles} />
            <InfoField label="Estado de Conservación" value={data.estado_conservacion} />
            <InfoField label="Situación Actual" value={data.situacion_actual} />
            <InfoField label="Zona" value={data.zona} />
          </div>
        </div>

        {/* Captación */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Captación</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Asesor Captador" value={data.advisor_name ?? data.id_asesor_captador} />
            <InfoField label="Fecha Captación" value={data.fecha_captacion ? formatDate(data.fecha_captacion) : null} />
            <InfoField label="Tipo de Autorización" value={data.tipo_autorizacion} />
            <InfoField label="% Comisión Pactado" value={data.porcentaje_comision_pactado != null ? `${data.porcentaje_comision_pactado}%` : null} />
            <InfoField label="Vigencia Contrato" value={data.vigencia_contrato_comision ? formatDate(data.vigencia_contrato_comision) : null} />
          </div>
        </div>

        {/* Admin — Actions */}
        {isAdmin && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>Acciones de Administración</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                Estado actual: <StatusBadge status={data.status ?? ''} />
              </div>
              <select
                className="select"
                style={{ height: 36, fontSize: 13, minWidth: 180 }}
                value={newStatus}
                onChange={e => setNewStatus(e.target.value)}
              >
                <option value="">Seleccionar nuevo estado...</option>
                {PROPERTY_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleChangeStatus}
                disabled={!newStatus || changingStatus}
                style={{ opacity: !newStatus || changingStatus ? 0.6 : 1 }}
              >
                {changingStatus ? 'Cambiando...' : 'Cambiar Estatus'}
              </button>
            </div>
            {!contratFirmado && (
              <div style={{ borderTop: '1px solid var(--color-surface-variant)', paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginBottom: 10 }}>
                  El contrato de comisión debe estar firmado antes de activar la propiedad (§11.1).
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleMarkContractSigned}
                  disabled={markingContract}
                  style={{ opacity: markingContract ? 0.6 : 1 }}
                >
                  {markingContract ? 'Guardando...' : '✓ Marcar Contrato Firmado'}
                </button>
              </div>
            )}
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
