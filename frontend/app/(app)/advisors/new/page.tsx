'use client';

import { Header } from '@/components/header';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { advisorsApi, uploadDocuments } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, ChangeEvent } from 'react';
import {
  ArrowLeft, CheckCircle, User, Users, Heart, FileText, Shield,
  Upload, X, AlertCircle,
} from 'lucide-react';
import { useHasAccess, AccessDenied } from '@/components/access-guard';

const ALLOWED_ROLES = ['Super Admin', 'Admin'];

const schema = z.object({
  name:             z.string().min(2, 'Nombre requerido (mín 2 caracteres)'),
  phone:            z.string().min(10, 'Teléfono requerido (mín 10 dígitos)'),
  email:            z.string().email('Correo electrónico inválido'),
  rfc:              z.string().max(13).optional().or(z.literal('')),
  curp:             z.string().optional().or(z.literal('')),
  fechaNacimiento:  z.string().optional().or(z.literal('')),
  fechaAltaAsesor:  z.string().min(1, 'Fecha de alta requerida'),
  tieneInvitador:   z.enum(['si', 'no']),
  inviteByAdvisorId: z.string().optional().or(z.literal('')),
  pasaPorMentoria:  z.enum(['si', 'no']),
  idMentor:         z.string().optional().or(z.literal('')),
  nombreBeneficiario:   z.string().min(2, 'Nombre del beneficiario requerido'),
  telefonoBeneficiario: z.string().optional().or(z.literal('')),
  correoBeneficiario:   z.string().optional().or(z.literal('')),
  status:       z.enum(['Activo', 'En mentoría', 'Inactivo', 'Baja definitiva']),
  observaciones: z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

type FileKey =
  | 'ine' | 'curp_doc' | 'domicilio' | 'antecedentes'
  | 'contrato' | 'csf' | 'estado_cuenta';

const DOC_SLOTS: { key: FileKey; label: string; required: boolean }[] = [
  { key: 'ine',           label: 'INE vigente (ambos lados)',             required: true  },
  { key: 'curp_doc',      label: 'CURP oficial',                          required: true  },
  { key: 'domicilio',     label: 'Comprobante de domicilio',              required: true  },
  { key: 'antecedentes',  label: 'Carta de no antecedentes penales',     required: true  },
  { key: 'contrato',      label: 'Contrato firmado de comisionista',     required: true  },
  { key: 'csf',           label: 'Constancia de Situación Fiscal (CSF)', required: false },
  { key: 'estado_cuenta', label: 'Carátula de estado de cuenta bancaria', required: false },
];

function SectionHeader({ icon, title, subtitle, index }: {
  icon: React.ReactNode; title: string; subtitle?: string; index: number;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--color-primary)', borderRadius: 'var(--radius-md)',
      padding: '14px 18px', marginBottom: 20,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color: '#fff', fontSize: 13, fontWeight: 700,
      }}>
        {index}
      </div>
      <div style={{ color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon}
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span style={{ fontSize: 11.5, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
      <AlertCircle size={11} /> {msg}
    </span>
  );
}

export default function NewAdvisorPage() {
  const router = useRouter();
  const hasAccess = useHasAccess(ALLOWED_ROLES);
  const [success, setSuccess]         = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [files, setFiles]             = useState<Partial<Record<FileKey, File>>>({});
  const fileRefs = useRef<Partial<Record<FileKey, HTMLInputElement>>>({});

  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => advisorsApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });
  const allAdvisors: any[] = Array.isArray(advisorsData) ? advisorsData : [];

  const {
    register, handleSubmit, control, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tieneInvitador: 'no', pasaPorMentoria: 'no',
      status: 'Activo', curp: '', rfc: '',
    },
  });

  const tieneInvitador  = useWatch({ control, name: 'tieneInvitador' });
  const pasaPorMentoria = useWatch({ control, name: 'pasaPorMentoria' });

  const handleFileChange = (key: FileKey) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFiles(prev => ({ ...prev, [key]: file }));
  };

  const removeFile = (key: FileKey) => {
    setFiles(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (fileRefs.current[key]) fileRefs.current[key]!.value = '';
  };

  const onSubmit = async (data: FormData) => {
    setErrorMsg(null);
    try {
      const res = await advisorsApi.create({
        name:                data.name,
        email:               data.email,
        phone:               data.phone,
        rfc:                 data.rfc || '',
        curp:                data.curp || '',
        fechaNacimiento:     data.fechaNacimiento || undefined,
        fechaAltaAsesor:     data.fechaAltaAsesor,
        status:              data.status,
        inviteByAdvisorId:   data.tieneInvitador === 'si' ? (data.inviteByAdvisorId || '') : '',
        pasaPorMentoria:     data.pasaPorMentoria === 'si',
        idMentor:            data.pasaPorMentoria === 'si' ? (data.idMentor || '') : '',
        nombreBeneficiario:  data.nombreBeneficiario,
        telefonoBeneficiario: data.telefonoBeneficiario || '',
        correoBeneficiario:  data.correoBeneficiario || '',
        observaciones:       data.observaciones || '',
      } as Record<string, unknown>);

      const advisorId = res.data?.id;
      if (advisorId && Object.keys(files).length > 0) {
        setUploading(true);
        await uploadDocuments(files, {
          ine:           'ine',
          curp_doc:      'curp',
          domicilio:     'comprobante_domicilio',
          antecedentes:  'antecedentes_penales',
          contrato:      'contrato_comisionista',
          csf:           'constancia_fiscal',
          estado_cuenta: 'estado_cuenta',
        }, 'asesor', advisorId);
      }

      setCreatedEmail(data.email);
      setSuccess(true);
      setTimeout(() => router.push('/advisors'), 8000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'Error al registrar asesor. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in" style={{ maxWidth: 580, margin: '0 auto' }}>
          <div className="card" style={{ textAlign: 'center', padding: '56px 32px' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#d1fae5', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <CheckCircle size={30} color="#059669" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
              Asesor Registrado Exitosamente
            </h2>
            <div style={{ background: '#fef9ec', border: '1px solid #d1b78a', borderRadius: 8, padding: '14px 18px', margin: '16px 0', textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>CREDENCIALES DE ACCESO — compartir con el asesor</div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Correo: </span>
                <strong>{createdEmail}</strong>
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                <span style={{ color: 'var(--color-on-surface-variant)' }}>Contraseña temporal: </span>
                <strong style={{ fontFamily: 'monospace', letterSpacing: 1 }}>Idea2024!</strong>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 8 }}>
                El asesor deberá cambiar su contraseña al primer inicio de sesión.
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
              Redirigiendo al listado de asesores...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!hasAccess) return <AccessDenied title="Nuevo Asesor" />;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>

        <button
          onClick={() => router.push('/advisors')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)',
            background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20,
          }}
        >
          <ArrowLeft size={14} /> Volver a asesores
        </button>

        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Alta de Asesor</h1>
            <p className="page-desc">Registro completo de nuevo integrante del equipo comercial</p>
          </div>
        </div>

        {errorMsg && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)',
            padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#b91c1c',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={15} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── S1: Datos Generales ─── */}
          <div className="card">
            <SectionHeader index={1} icon={<User size={14} />}
              title="Datos Generales del Asesor"
              subtitle="Información personal e identificación oficial"
            />

            <div className="input-group">
              <label className="input-label">Nombre completo *</label>
              <input {...register('name')} className="input" placeholder="Ej: Laura Mendoza Ruiz" />
              <FieldError msg={errors.name?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Teléfono / WhatsApp *</label>
                <input {...register('phone')} className="input" placeholder="5512345678" />
                <FieldError msg={errors.phone?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Correo electrónico *</label>
                <input {...register('email')} type="email" className="input" placeholder="laura@ideauno.com" />
                <FieldError msg={errors.email?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">RFC</label>
                <input {...register('rfc')} className="input" placeholder="MERL850101ABC"
                  style={{ textTransform: 'uppercase' }} maxLength={13} />
                <FieldError msg={errors.rfc?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">CURP</label>
                <input {...register('curp')} className="input" placeholder="MERL850101MDFXYZ01"
                  maxLength={18} style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} />
                <FieldError msg={errors.curp?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Fecha de nacimiento</label>
                <input {...register('fechaNacimiento')} type="date" className="input" />
              </div>
              <div className="input-group">
                <label className="input-label">Fecha de alta como asesor *</label>
                <input {...register('fechaAltaAsesor')} type="date" className="input" />
                <FieldError msg={errors.fechaAltaAsesor?.message} />
              </div>
            </div>
          </div>

          {/* ─── S2: Invitación / Mentoría ─── */}
          <div className="card">
            <SectionHeader index={2} icon={<Users size={14} />}
              title="Relación de Invitación y Mentoría"
              subtitle="Árbol de red comercial y acompañamiento inicial"
            />

            <div className="input-group">
              <label className="input-label">¿Fue invitado por un asesor existente?</label>
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" {...register('tieneInvitador')} value={v} />
                    <span style={{ fontSize: 13 }}>{v === 'si' ? 'Sí' : 'No (asesor directo)'}</span>
                  </label>
                ))}
              </div>
            </div>

            {tieneInvitador === 'si' && (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Asesor que lo invitó</label>
                <select {...register('inviteByAdvisorId')} className="select">
                  <option value="">— Seleccionar asesor invitador —</option>
                  {allAdvisors.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿El asesor pasa por período de mentoría?</label>
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" {...register('pasaPorMentoria')} value={v} />
                    <span style={{ fontSize: 13 }}>{v === 'si' ? 'Sí, requiere mentoría' : 'No'}</span>
                  </label>
                ))}
              </div>
            </div>

            {pasaPorMentoria === 'si' && (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Mentor asignado</label>
                <select {...register('idMentor')} className="select">
                  <option value="">— Seleccionar mentor —</option>
                  {allAdvisors.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ─── S3: Beneficiario ─── */}
          <div className="card">
            <SectionHeader index={3} icon={<Heart size={14} />}
              title="Beneficiario Designado"
              subtitle="Persona que recibirá beneficios en caso de contingencia"
            />

            <div className="input-group">
              <label className="input-label">Nombre completo del beneficiario *</label>
              <input {...register('nombreBeneficiario')} className="input" placeholder="Ej: Carlos Mendoza Ruiz" />
              <FieldError msg={errors.nombreBeneficiario?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Teléfono del beneficiario</label>
                <input {...register('telefonoBeneficiario')} className="input" placeholder="5512345678" />
              </div>
              <div className="input-group">
                <label className="input-label">Correo del beneficiario</label>
                <input {...register('correoBeneficiario')} type="email" className="input" placeholder="beneficiario@email.com" />
              </div>
            </div>
          </div>

          {/* ─── S4: Documentos ─── */}
          <div className="card">
            <SectionHeader index={4} icon={<FileText size={14} />}
              title="Documentos del Asesor"
              subtitle="Adjuntar PDF o imagen (JPG/PNG)"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {DOC_SLOTS.map(slot => {
                const file = files[slot.key];
                return (
                  <div key={slot.key} style={{
                    border: `1.5px dashed ${file ? 'var(--color-secondary)' : '#d1d5db'}`,
                    borderRadius: 'var(--radius-md)', padding: '12px 14px',
                    background: file ? '#f0fdf4' : 'var(--color-surface-variant)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                      {slot.label}
                      {slot.required && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>}
                    </div>
                    {file ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={13} color="var(--color-secondary)" />
                        <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#065f46' }}>
                          {file.name}
                        </span>
                        <button type="button" onClick={() => removeFile(slot.key)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRefs.current[slot.key]?.click()}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                        <Upload size={13} /> Seleccionar archivo
                      </button>
                    )}
                    <input
                      ref={el => { if (el) fileRefs.current[slot.key] = el; }}
                      type="file" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange(slot.key)}
                      style={{ display: 'none' }}
                    />
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: '#fffbeb', border: '1px solid #fde68a', fontSize: 11.5, color: '#92400e' }}>
              Los archivos seleccionados se subirán automáticamente. Formatos: PDF, JPG, PNG.
            </div>
          </div>

          {/* ─── S5: Estatus ─── */}
          <div className="card">
            <SectionHeader index={5} icon={<Shield size={14} />}
              title="Estatus y Observaciones"
              subtitle="Estado inicial del asesor en el sistema"
            />

            <div className="input-group">
              <label className="input-label">Estatus inicial *</label>
              <select {...register('status')} className="select">
                <option value="Activo">Activo</option>
                <option value="En mentoría">En mentoría</option>
                <option value="Inactivo">Inactivo</option>
                <option value="Baja definitiva">Baja definitiva</option>
              </select>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Observaciones administrativas</label>
              <textarea {...register('observaciones')} className="input" rows={3}
                placeholder="Notas internas (visible solo para administradores)..."
                style={{ resize: 'vertical', minHeight: 80 }}
              />
            </div>
          </div>

          {/* ─── Acciones ─── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 32 }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/advisors')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || uploading}>
              {isSubmitting ? 'Registrando asesor...' : uploading ? 'Subiendo documentos...' : 'Registrar Asesor'}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
