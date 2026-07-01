'use client';

import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { propertiesApi, documentsApi, api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { FileText, ArrowLeft } from 'lucide-react';
import { useState } from 'react';

const ADMIN_ROLES = ['Super Admin', 'Admin'];

const RENTAL_STATUSES = ['Incompleta', 'En revisión', 'Activa', 'Rentada'];

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
    Incompleta:    { bg: '#fee2e2', color: '#991b1b' },
    'En revisión': { bg: '#fef3c7', color: '#78350f' },
    Activa:        { bg: '#d1fae5', color: '#065f46' },
    Rentada:       { bg: '#ede9fe', color: '#5b21b6' },
    rentada:       { bg: '#ede9fe', color: '#5b21b6' },
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

function BoolField({ value }: { value: unknown }) {
  const v = value === true || value === 'true' || value === 'si' || value === 'Sí' || value === 'yes';
  return (
    <span style={{ fontWeight: 600, color: v ? '#059669' : '#dc2626' }}>
      {v ? 'Sí' : 'No'}
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

export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  const [newStatus, setNewStatus] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);

  const { data: propData, isLoading: loadingProp, error: propError } = useQuery({
    queryKey: ['rental', id],
    queryFn: () => propertiesApi.getOne(id).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });

  const { data: docsData, isLoading: loadingDocs } = useQuery({
    queryKey: ['docs', 'propiedad', id],
    queryFn: () =>
      documentsApi.listByEntity('propiedad', id).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!id,
  });

  const data = propData ?? {};
  const docs: Record<string, unknown>[] = Array.isArray(docsData) ? docsData : [];

  const handleViewDoc = async (docId: string) => {
    const res = await documentsApi.getSignedUrl(docId);
    const url = res.data?.url ?? res.data;
    if (url) window.open(url, '_blank');
  };

  const handleDocStatus = async (docId: string, status: string) => {
    await documentsApi.updateStatus(docId, status);
    queryClient.invalidateQueries({ queryKey: ['docs', 'propiedad', id] });
  };

  const handleChangeStatus = async () => {
    if (!newStatus) return;
    setChangingStatus(true);
    try {
      await api.patch(`/properties/${id}/status`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['rental', id] });
    } finally {
      setChangingStatus(false);
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

  const contratFirmado =
    data.contrato_comision_firmado === true || data.contrato_comision_firmado === 'true';

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
            onClick={() => router.push('/rentals')}
          >
            <ArrowLeft size={14} /> Volver a Rentas
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {data.address ?? 'Propiedad en Renta'}
            </h1>
            <StatusBadge status={data.status ?? ''} />
          </div>
          {data.city && (
            <p className="page-desc" style={{ marginTop: 4 }}>
              {String(data.city)}{data.state ? `, ${String(data.state)}` : ''}
            </p>
          )}
        </div>

        {/* Información de Renta */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Información de Renta
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField
              label="Renta mensual solicitada"
              value={
                data.renta_mensual_solicitada != null
                  ? formatCurrency(Number(data.renta_mensual_solicitada))
                  : null
              }
            />
            <InfoField
              label="Depósito requerido"
              value={
                data.deposito_requerido != null
                  ? formatCurrency(Number(data.deposito_requerido))
                  : null
              }
            />
            <InfoField label="Plazo mínimo de contrato" value={data.plazo_minimo_contrato} />
            <InfoField
              label="Disponible desde"
              value={data.fecha_disponibilidad ? formatDate(String(data.fecha_disponibilidad)) : null}
            />
          </div>
        </div>

        {/* Condiciones */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Condiciones
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <InfoField label="Acepta mascotas" value={<BoolField value={data.acepta_mascotas} />} />
            <InfoField label="Acepta estudiantes" value={<BoolField value={data.acepta_estudiantes} />} />
            <InfoField label="Acepta empresas" value={<BoolField value={data.acepta_empresas} />} />
            <InfoField label="Requiere aval" value={<BoolField value={data.requiere_aval} />} />
            <InfoField label="Acepta obligado solidario" value={<BoolField value={data.acepta_obligado_solidario} />} />
            <InfoField label="Requiere póliza jurídica" value={<BoolField value={data.requiere_poliza_juridica} />} />
          </div>
        </div>

        {/* Propietario */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Propietario
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Nombre" value={data.owner_name} />
            <InfoField label="Teléfono" value={data.owner_phone} />
            <InfoField label="Correo" value={data.owner_email} />
            <InfoField label="Estado Civil" value={data.owner_estado_civil} />
          </div>
        </div>

        {/* Inmueble */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Inmueble
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Tipo de Inmueble" value={data.tipo_inmueble ?? data.type} />
            <InfoField label="Recámaras" value={data.recamaras} />
            <InfoField label="Baños Completos" value={data.banos_completos} />
            <InfoField label="Medios Baños" value={data.medios_banos} />
            <InfoField label="Estacionamientos" value={data.estacionamientos} />
            <InfoField
              label="Superficie Construcción"
              value={
                data.superficie_construccion_m2 != null
                  ? `${data.superficie_construccion_m2} m²`
                  : null
              }
            />
            <InfoField label="Estado de Conservación" value={data.estado_conservacion} />
            <InfoField label="Situación Actual" value={data.situacion_actual} />
          </div>
        </div>

        {/* Captación */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Captación
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <InfoField label="Asesor Captador" value={data.advisor_name ?? data.advisor_id} />
            <InfoField
              label="Fecha Captación"
              value={data.fecha_captacion ? formatDate(String(data.fecha_captacion)) : null}
            />
            <InfoField
              label="Contrato Comisión Firmado"
              value={
                contratFirmado
                  ? <span style={{ color: '#059669', fontWeight: 700 }}>Firmado</span>
                  : <span style={{ color: '#d97706', fontWeight: 700 }}>Pendiente</span>
              }
            />
            <InfoField
              label="% Comisión Pactado"
              value={
                data.porcentaje_comision_pactado != null
                  ? `${data.porcentaje_comision_pactado}%`
                  : null
              }
            />
          </div>
        </div>

        {/* Admin — Status Change */}
        {isAdmin && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
              Cambiar Estatus
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                Estado actual: <StatusBadge status={data.status ?? ''} />
              </div>
              <select
                className="select"
                style={{ height: 36, fontSize: 13, minWidth: 200 }}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="">Seleccionar nuevo estado...</option>
                {RENTAL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
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
          </div>
        )}

        {/* Documentos */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-primary)', marginBottom: 16 }}>
            Documentos
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
              No hay documentos cargados
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
                            onClick={() => handleDocStatus(docId, 'Validado')}
                          >
                            Validar
                          </button>
                          <button
                            className="btn"
                            style={{
                              fontSize: 12,
                              padding: '4px 10px',
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                            }}
                            onClick={() => handleDocStatus(docId, 'Rechazado')}
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
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
