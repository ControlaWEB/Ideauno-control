'use client';

import { Header } from '@/components/header';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { propertiesApi, uploadDocuments } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useState, useRef, ChangeEvent } from 'react';
import {
  ArrowLeft, CheckCircle, User, FileText, Building2, DollarSign,
  Camera, Shield, Upload, X, AlertCircle, Home,
} from 'lucide-react';
import { useHasAccess, AccessDenied } from '@/components/access-guard';

/* ─── Schema ─── */
const schema = z.object({
  // S1 Propietario
  ownerName:        z.string().min(2, 'Nombre del propietario requerido'),
  ownerPhone:       z.string().min(10, 'Teléfono requerido'),
  ownerEmail:       z.string().optional().or(z.literal('')),
  ownerRfc:         z.string().optional().or(z.literal('')),
  ownerCurp:        z.string().optional().or(z.literal('')),
  ownerEstadoCivil: z.string().min(1, 'Estado civil requerido'),

  // S2 Condiciones legales
  adquiridaMatrimonio:  z.enum(['si', 'no', 'desconoce']),
  regimenMatrimonial:   z.string().optional().or(z.literal('')),
  nombreConyuge:        z.string().optional().or(z.literal('')),
  conyugeDeAcuerdo:     z.string().optional().or(z.literal('')),
  tieneCopropietarios:  z.enum(['si', 'no']),
  quienRealizaVenta:    z.string().min(1, 'Campo requerido'),

  // S3 Documentos propiedad
  tienePredial:  z.enum(['si', 'no']),
  tieneAgua:     z.enum(['si', 'no']),
  tieneLuz:      z.enum(['si', 'no']),
  tieneAvaluo:   z.enum(['si', 'no']),
  tieneHipoteca: z.enum(['si', 'no', 'desconoce']),
  institucionAcreedora: z.string().optional().or(z.literal('')),
  saldoHipoteca:        z.coerce.number().optional(),
  provieneHerencia:     z.enum(['si', 'no']),
  adjudicacionConcluida: z.enum(['si', 'no']).optional(),

  // S4 Datos del inmueble
  tipoInmueble:           z.string().min(1, 'Tipo de inmueble requerido'),
  address:                z.string().min(5, 'Dirección requerida'),
  city:                   z.string().min(2, 'Ciudad requerida'),
  state:                  z.string().min(2, 'Estado requerido'),
  zona:                   z.string().optional().or(z.literal('')),
  mapsUrl:                z.string().optional().or(z.literal('')),
  superficieTerreno:      z.coerce.number().optional(),
  superficieConstruccion: z.coerce.number().optional(),
  frenteM:                z.coerce.number().optional(),
  fondoM:                 z.coerce.number().optional(),
  recamaras:              z.coerce.number().optional(),
  banosCompletos:         z.coerce.number().optional(),
  mediosBanos:            z.coerce.number().optional(),
  estacionamientos:       z.coerce.number().optional(),
  niveles:                z.coerce.number().optional(),
  antiguedad:             z.string().optional().or(z.literal('')),
  estadoConservacion:     z.string().min(1, 'Estado de conservación requerido'),
  situacionActual:        z.string().min(1, 'Situación actual requerida'),

  // S5 Comercial
  price:              z.coerce.number().min(1, 'Precio requerido'),
  esNegociable:       z.enum(['si', 'no']),
  formasPago:         z.array(z.string()).min(1, 'Selecciona al menos una forma de pago'),
  cuotaMantenimiento: z.coerce.number().optional(),
  amenidades:         z.string().optional().or(z.literal('')),

  // S7 Captación/autorización
  autorizacionPromocion:     z.enum(['si', 'no']),
  tipoAutorizacion:          z.string().optional().or(z.literal('')),
  contratoComisionFirmado:   z.enum(['si', 'no']),
  fechaFirmaContrato:        z.string().optional().or(z.literal('')),
  vigenciaContrato:          z.string().optional().or(z.literal('')),
  porcentajeComisionPactado: z.coerce.number().optional(),
  observaciones:             z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

/* ─── File keys ─── */
type FileKey =
  | 'owner_ine' | 'escritura' | 'predial' | 'agua' | 'luz'
  | 'avaluo' | 'acta_matrimonio' | 'poder_notarial'
  | 'fotos' | 'contrato_comision';

const FORMAS_PAGO_OPTS = ['Contado', 'Crédito bancario', 'Infonavit', 'Fovissste', 'Cofinavit', 'Todas las anteriores'];
const TIPOS_INMUEBLE = ['Casa', 'Departamento', 'Terreno', 'Local comercial', 'Oficina', 'Bodega', 'Nave industrial', 'Rancho', 'Otro'];
const ESTADOS_CIVIL = ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)', 'Unión libre'];
const ESTADOS_CONSERVACION = ['Excelente', 'Bueno', 'Regular', 'Requiere remodelación'];
const SITUACIONES_ACTUALES = ['Habitada por propietario', 'Rentada', 'Desocupada'];
const QUIEN_VENDE = ['Propietario', 'Apoderado', 'Representante legal', 'Albacea'];

/* ─── Helpers ─── */
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
        width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
      }}>{index}</div>
      <div style={{ color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon}{title}
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
      <AlertCircle size={11} />{msg}
    </span>
  );
}

function FileSlot({ label, required, fileKey, file, onPick, onRemove }: {
  label: string; required?: boolean; fileKey: FileKey;
  file?: File; onPick: () => void; onRemove: () => void;
}) {
  return (
    <div style={{
      border: `1.5px dashed ${file ? 'var(--color-secondary)' : '#d1d5db'}`,
      borderRadius: 'var(--radius-md)', padding: '12px 14px',
      background: file ? '#f0fdf4' : 'var(--color-surface-variant)',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
        {label}{required && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>}
      </div>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={13} color="var(--color-secondary)" />
          <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#065f46' }}>
            {file.name}
          </span>
          <button type="button" onClick={onRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onPick}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Upload size={13} />Seleccionar archivo
        </button>
      )}
    </div>
  );
}

/* ─── Main ─── */
const ALLOWED_ROLES = ['Super Admin', 'Admin', 'Asesor'];

export default function NewPropertyPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const hasAccess = useHasAccess(ALLOWED_ROLES);
  const [success, setSuccess]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles]       = useState<Partial<Record<FileKey, File>>>({});
  const fileRefs = useRef<Partial<Record<FileKey, HTMLInputElement>>>({});

  const {
    register, handleSubmit, control, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      adquiridaMatrimonio: 'no', tieneCopropietarios: 'no',
      tieneHipoteca: 'no', provieneHerencia: 'no',
      tienePredial: 'no', tieneAgua: 'no', tieneLuz: 'no', tieneAvaluo: 'no',
      esNegociable: 'si', autorizacionPromocion: 'si', contratoComisionFirmado: 'no',
      formasPago: [],
    },
  });

  const adqMat       = useWatch({ control, name: 'adquiridaMatrimonio' });
  const coprop       = useWatch({ control, name: 'tieneCopropietarios' });
  const quienVende   = useWatch({ control, name: 'quienRealizaVenta' });
  const predial      = useWatch({ control, name: 'tienePredial' });
  const agua         = useWatch({ control, name: 'tieneAgua' });
  const luz          = useWatch({ control, name: 'tieneLuz' });
  const avaluo       = useWatch({ control, name: 'tieneAvaluo' });
  const hipoteca     = useWatch({ control, name: 'tieneHipoteca' });
  const herencia     = useWatch({ control, name: 'provieneHerencia' });
  const autoriza     = useWatch({ control, name: 'autorizacionPromocion' });
  const contrato     = useWatch({ control, name: 'contratoComisionFirmado' });
  const formasPago   = useWatch({ control, name: 'formasPago' }) ?? [];

  const handleFile = (key: FileKey) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFiles(p => ({ ...p, [key]: f }));
  };
  const removeFile = (key: FileKey) => {
    setFiles(p => { const n = { ...p }; delete n[key]; return n; });
    if (fileRefs.current[key]) fileRefs.current[key]!.value = '';
  };
  const pickFile = (key: FileKey) => fileRefs.current[key]?.click();

  const toggleFormaPago = (v: string) => {
    const curr = formasPago;
    setValue('formasPago', curr.includes(v) ? curr.filter(x => x !== v) : [...curr, v], { shouldValidate: true });
  };

  const onSubmit = async (data: any) => {
    setErrorMsg(null);
    try {
      const res = await propertiesApi.create({
        ...data,
        advisorId: user?.advisorId ?? user?.id,
        tieneCopropietarios: data.tieneCopropietarios === 'si',
        provieneHerencia: data.provieneHerencia === 'si',
        adjudicacionConcluida: data.adjudicacionConcluida === 'si',
        esNegociable: data.esNegociable === 'si',
        autorizacionPromocion: data.autorizacionPromocion === 'si',
        contratoComisionFirmado: data.contratoComisionFirmado === 'si',
        formasPago: JSON.stringify(data.formasPago),
        tipoOperacion: 'Venta',
        type: data.tipoInmueble,
      } as Record<string, unknown>);

      const propertyId = res.data?.id;
      if (propertyId && Object.keys(files).length > 0) {
        setUploading(true);
        await uploadDocuments(files, {
          owner_ine:        'ine_propietario',
          escritura:        'escritura',
          predial:          'predial',
          agua:             'agua',
          luz:              'luz',
          avaluo:           'avaluo',
          acta_matrimonio:  'acta_matrimonio',
          poder_notarial:   'poder_notarial',
          fotos:            'fotografia',
          contrato_comision:'contrato_comision',
        }, 'propiedad', propertyId);
      }

      setSuccess(true);
      setTimeout(() => router.push('/properties'), 2500);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message ?? 'Error al guardar la propiedad. Intenta de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  if (success) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="card" style={{ textAlign: 'center', padding: '56px 32px' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <CheckCircle size={30} color="#059669" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
              Captación Registrada
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
              {contrato === 'si'
                ? 'Propiedad registrada en estatus "En revisión".'
                : 'Propiedad registrada. Pendiente: contrato de comisión mercantil.'}
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!hasAccess) return <AccessDenied title="Nueva Captación Venta" />;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>

        <button onClick={() => router.push('/properties')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14} />Volver al inventario
        </button>

        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Captación de Propiedad en Venta</h1>
            <p className="page-desc">Registro completo del expediente de captación</p>
          </div>
        </div>

        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} />{errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── S1: Propietario ─── */}
          <div className="card">
            <SectionHeader index={1} icon={<User size={14} />} title="Datos del Propietario" subtitle="Identificación y contacto del propietario del inmueble" />

            <div className="input-group">
              <label className="input-label">Nombre completo del propietario *</label>
              <input {...register('ownerName')} className="input" placeholder="Ej: Juan Carlos Ramírez Ortiz" />
              <FieldError msg={errors.ownerName?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Teléfono *</label>
                <input {...register('ownerPhone')} className="input" placeholder="5512345678" />
                <FieldError msg={errors.ownerPhone?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Correo electrónico</label>
                <input {...register('ownerEmail')} type="email" className="input" placeholder="propietario@email.com" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">RFC</label>
                <input {...register('ownerRfc')} className="input" placeholder="RAOJ800101XXX" style={{ textTransform: 'uppercase' }} />
              </div>
              <div className="input-group">
                <label className="input-label">CURP</label>
                <input {...register('ownerCurp')} className="input" placeholder="RAOJ800101HDFXYZ01" maxLength={18} style={{ textTransform: 'uppercase', fontFamily: 'monospace' }} />
              </div>
              <div className="input-group">
                <label className="input-label">Estado civil *</label>
                <select {...register('ownerEstadoCivil')} className="select">
                  <option value="">— Seleccionar —</option>
                  {ESTADOS_CIVIL.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <FieldError msg={errors.ownerEstadoCivil?.message} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>INE vigente del propietario *</label>
              <FileSlot label="INE vigente" required fileKey="owner_ine" file={files.owner_ine} onPick={() => pickFile('owner_ine')} onRemove={() => removeFile('owner_ine')} />
              <input ref={el => { if (el) fileRefs.current.owner_ine = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('owner_ine')} style={{ display: 'none' }} />
            </div>
          </div>

          {/* ─── S2: Condiciones Legales ─── */}
          <div className="card">
            <SectionHeader index={2} icon={<Shield size={14} />} title="Condiciones Legales de la Propiedad" subtitle="Estado legal, cónyuge y copropietarios" />

            <div className="input-group">
              <label className="input-label">¿La propiedad fue adquirida durante el matrimonio? *</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no', 'desconoce'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('adquiridaMatrimonio')} value={v} />
                    {v === 'si' ? 'Sí' : v === 'no' ? 'No' : 'Desconoce'}
                  </label>
                ))}
              </div>
            </div>

            {adqMat === 'si' && (
              <div style={{ marginTop: 14, padding: '14px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Régimen matrimonial</label>
                    <select {...register('regimenMatrimonial')} className="select">
                      <option value="">— Seleccionar —</option>
                      <option value="Sociedad conyugal">Sociedad conyugal</option>
                      <option value="Separación de bienes">Separación de bienes</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nombre del cónyuge</label>
                    <input {...register('nombreConyuge')} className="input" placeholder="Nombre completo del cónyuge" />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">¿El cónyuge está enterado y de acuerdo?</label>
                  <select {...register('conyugeDeAcuerdo')} className="select">
                    <option value="">— Seleccionar —</option>
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Acta de matrimonio</label>
                  <FileSlot label="Acta de matrimonio" fileKey="acta_matrimonio" file={files.acta_matrimonio} onPick={() => pickFile('acta_matrimonio')} onRemove={() => removeFile('acta_matrimonio')} />
                  <input ref={el => { if (el) fileRefs.current.acta_matrimonio = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('acta_matrimonio')} style={{ display: 'none' }} />
                </div>
              </div>
            )}

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿Existen otros propietarios registrados en la escritura? *</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('tieneCopropietarios')} value={v} />
                    {v === 'si' ? 'Sí' : 'No'}
                  </label>
                ))}
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿Quién está realizando la venta? *</label>
              <select {...register('quienRealizaVenta')} className="select">
                <option value="">— Seleccionar —</option>
                {QUIEN_VENDE.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <FieldError msg={errors.quienRealizaVenta?.message} />
            </div>

            {quienVende && quienVende !== 'Propietario' && (
              <div style={{ marginTop: 14 }}>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                  {quienVende === 'Apoderado' ? 'Poder notarial *' :
                   quienVende === 'Representante legal' ? 'Documento de representación legal *' :
                   'Documento de adjudicación o resolución definitiva *'}
                </label>
                <FileSlot label="Documento legal" required fileKey="poder_notarial" file={files.poder_notarial} onPick={() => pickFile('poder_notarial')} onRemove={() => removeFile('poder_notarial')} />
                <input ref={el => { if (el) fileRefs.current.poder_notarial = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('poder_notarial')} style={{ display: 'none' }} />
              </div>
            )}
          </div>

          {/* ─── S3: Documentos de la propiedad ─── */}
          <div className="card">
            <SectionHeader index={3} icon={<FileText size={14} />} title="Documentos de la Propiedad" subtitle="Escritura, recibos, avalúos y situación legal" />

            <div style={{ marginBottom: 16 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Documento que acredita la propiedad *</label>
              <FileSlot label="Escritura / Título / Otro" required fileKey="escritura" file={files.escritura} onPick={() => pickFile('escritura')} onRemove={() => removeFile('escritura')} />
              <input ref={el => { if (el) fileRefs.current.escritura = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('escritura')} style={{ display: 'none' }} />
            </div>

            {/* Predial / Agua / Luz / Avalúo en grid */}
            {(
              [
                { field: 'tienePredial', label: '¿Cuenta con predial?', val: predial, docKey: 'predial' as FileKey, docLabel: 'Último recibo de predial' },
                { field: 'tieneAgua',   label: '¿Cuenta con recibo de agua?', val: agua, docKey: 'agua' as FileKey, docLabel: 'Último recibo de agua' },
                { field: 'tieneLuz',    label: '¿Cuenta con recibo de luz?', val: luz, docKey: 'luz' as FileKey, docLabel: 'Último recibo de luz' },
                { field: 'tieneAvaluo', label: '¿Cuenta con avalúo?', val: avaluo, docKey: 'avaluo' as FileKey, docLabel: 'Avalúo o estimación de valor' },
              ] as { field: any; label: string; val: string; docKey: FileKey; docLabel: string }[]
            ).map(item => (
              <div key={item.field} style={{ marginBottom: 16 }}>
                <div className="input-group">
                  <label className="input-label">{item.label}</label>
                  <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                    {(['si', 'no'] as const).map(v => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" {...register(item.field)} value={v} />
                        {v === 'si' ? 'Sí' : 'No'}
                      </label>
                    ))}
                  </div>
                </div>
                {item.val === 'si' && (
                  <div style={{ marginTop: 10 }}>
                    <FileSlot label={item.docLabel} fileKey={item.docKey} file={files[item.docKey]} onPick={() => pickFile(item.docKey)} onRemove={() => removeFile(item.docKey)} />
                    <input ref={el => { if (el) fileRefs.current[item.docKey] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile(item.docKey)} style={{ display: 'none' }} />
                  </div>
                )}
              </div>
            ))}

            {/* Hipoteca */}
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">¿Tiene hipoteca o gravamen vigente?</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no', 'desconoce'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('tieneHipoteca')} value={v} />
                    {v === 'si' ? 'Sí' : v === 'no' ? 'No' : 'Desconoce'}
                  </label>
                ))}
              </div>
            </div>
            {hipoteca === 'si' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="input-group">
                  <label className="input-label">Institución acreedora</label>
                  <input {...register('institucionAcreedora')} className="input" placeholder="Ej: BBVA, Banorte, Infonavit" />
                </div>
                <div className="input-group">
                  <label className="input-label">Saldo aproximado pendiente ($)</label>
                  <input {...register('saldoHipoteca')} type="number" className="input" placeholder="0" />
                </div>
              </div>
            )}

            {/* Herencia */}
            <div className="input-group">
              <label className="input-label">¿La propiedad proviene de herencia?</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('provieneHerencia')} value={v} />
                    {v === 'si' ? 'Sí' : 'No'}
                  </label>
                ))}
              </div>
            </div>
            {herencia === 'si' && (
              <div style={{ marginTop: 14, padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: 12, color: '#92400e', marginBottom: 12 }}>
                  Si la adjudicación no está concluida, la propiedad no podrá pasar a estatus publicable.
                </p>
                <div className="input-group">
                  <label className="input-label">¿La adjudicación ya fue concluida?</label>
                  <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                    {(['si', 'no'] as const).map(v => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" {...register('adjudicacionConcluida')} value={v} />
                        {v === 'si' ? 'Sí' : 'No'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── S4: Datos del Inmueble ─── */}
          <div className="card">
            <SectionHeader index={4} icon={<Home size={14} />} title="Datos del Inmueble" subtitle="Características físicas y ubicación" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Tipo de inmueble *</label>
                <select {...register('tipoInmueble')} className="select">
                  <option value="">— Seleccionar —</option>
                  {TIPOS_INMUEBLE.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <FieldError msg={errors.tipoInmueble?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Zona / Colonia</label>
                <input {...register('zona')} className="input" placeholder="Ej: Polanco, Santa Fe" />
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Dirección completa *</label>
              <input {...register('address')} className="input" placeholder="Calle, Número, Colonia, Municipio" />
              <FieldError msg={errors.address?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Ciudad *</label>
                <input {...register('city')} className="input" placeholder="Ciudad de México" />
                <FieldError msg={errors.city?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Estado *</label>
                <input {...register('state')} className="input" placeholder="CDMX" />
                <FieldError msg={errors.state?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">URL Google Maps</label>
                <input {...register('mapsUrl')} className="input" placeholder="https://maps.google.com/..." />
              </div>
            </div>

            {/* Superficies */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              {[
                { name: 'superficieTerreno',      label: 'Terreno m²'     },
                { name: 'superficieConstruccion', label: 'Construcción m²' },
                { name: 'frenteM',                label: 'Frente m'       },
                { name: 'fondoM',                 label: 'Fondo m'        },
              ].map(f => (
                <div key={f.name} className="input-group">
                  <label className="input-label">{f.label}</label>
                  <input {...register(f.name as any)} type="number" className="input" placeholder="0" />
                </div>
              ))}
            </div>

            {/* Características */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginTop: 14 }}>
              {[
                { name: 'recamaras',      label: 'Recámaras'      },
                { name: 'banosCompletos', label: 'Baños compl.'   },
                { name: 'mediosBanos',    label: 'Medios baños'   },
                { name: 'estacionamientos', label: 'Estac.'       },
                { name: 'niveles',        label: 'Niveles'        },
              ].map(f => (
                <div key={f.name} className="input-group">
                  <label className="input-label">{f.label}</label>
                  <input {...register(f.name as any)} type="number" className="input" placeholder="0" />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Antigüedad aprox.</label>
                <input {...register('antiguedad')} className="input" placeholder="Ej: 5 años, 2019" />
              </div>
              <div className="input-group">
                <label className="input-label">Estado de conservación *</label>
                <select {...register('estadoConservacion')} className="select">
                  <option value="">— Seleccionar —</option>
                  {ESTADOS_CONSERVACION.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <FieldError msg={errors.estadoConservacion?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Situación actual *</label>
                <select {...register('situacionActual')} className="select">
                  <option value="">— Seleccionar —</option>
                  {SITUACIONES_ACTUALES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <FieldError msg={errors.situacionActual?.message} />
              </div>
            </div>
          </div>

          {/* ─── S5: Información Comercial ─── */}
          <div className="card">
            <SectionHeader index={5} icon={<DollarSign size={14} />} title="Información Comercial" subtitle="Precio, condiciones y formas de pago aceptadas" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Precio solicitado (MXN) *</label>
                <input {...register('price')} type="number" className="input" placeholder="0" />
                <FieldError msg={errors.price?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">¿Es negociable?</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                  {(['si', 'no'] as const).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" {...register('esNegociable')} value={v} />
                      {v === 'si' ? 'Sí' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 16 }}>
              <label className="input-label">Formas de pago aceptadas *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {FORMAS_PAGO_OPTS.map(fp => {
                  const sel = formasPago.includes(fp);
                  return (
                    <button
                      key={fp} type="button"
                      onClick={() => toggleFormaPago(fp)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 550,
                        cursor: 'pointer', border: `1.5px solid ${sel ? 'var(--color-primary)' : '#d1d5db'}`,
                        background: sel ? 'var(--color-primary)' : 'transparent',
                        color: sel ? '#fff' : 'var(--color-on-surface)',
                      }}
                    >{fp}</button>
                  );
                })}
              </div>
              {errors.formasPago && <FieldError msg={errors.formasPago.message as string} />}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Cuota de mantenimiento mensual ($)</label>
                <input {...register('cuotaMantenimiento')} type="number" className="input" placeholder="0" />
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Principales amenidades / características</label>
              <textarea {...register('amenidades')} className="input" rows={3} placeholder="Descripción de amenidades, características destacadas, acabados..." style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
          </div>

          {/* ─── S6: Fotografías ─── */}
          <div className="card">
            <SectionHeader index={6} icon={<Camera size={14} />} title="Material de Comercialización" subtitle="Fotografías, video y ubicación" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Fotografías *</label>
                <FileSlot label="Fotos del inmueble" required fileKey="fotos" file={files.fotos} onPick={() => pickFile('fotos')} onRemove={() => removeFile('fotos')} />
                <input ref={el => { if (el) fileRefs.current.fotos = el; }} type="file" accept=".jpg,.jpeg,.png,.zip" onChange={handleFile('fotos')} style={{ display: 'none' }} />
                <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 6 }}>JPG, PNG o ZIP con múltiples fotos</p>
              </div>
              <div className="input-group">
                <label className="input-label">Video (URL YouTube / Drive)</label>
                <input className="input" placeholder="https://youtube.com/..." />
              </div>
            </div>
          </div>

          {/* ─── S7: Asesor y Autorización ─── */}
          <div className="card">
            <SectionHeader index={7} icon={<Building2 size={14} />} title="Asesor y Autorización de Captación" subtitle="Contrato de comisión mercantil y condiciones de promoción" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">¿El propietario autoriza promover e intermediar? *</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                  {(['si', 'no'] as const).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" {...register('autorizacionPromocion')} value={v} />
                      {v === 'si' ? 'Sí' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
              {autoriza === 'si' && (
                <div className="input-group">
                  <label className="input-label">Tipo de autorización</label>
                  <select {...register('tipoAutorizacion')} className="select">
                    <option value="">— Seleccionar —</option>
                    <option value="Exclusiva">Exclusiva</option>
                    <option value="No exclusiva">No exclusiva</option>
                    <option value="Verbal">Verbal</option>
                  </select>
                </div>
              )}
            </div>

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿Está firmado el Contrato de Comisión Mercantil? *</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('contratoComisionFirmado')} value={v} />
                    {v === 'si' ? 'Sí' : 'No — la propiedad quedará en estatus "Incompleta"'}
                  </label>
                ))}
              </div>
            </div>

            {contrato === 'si' && (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Fecha de firma *</label>
                    <input {...register('fechaFirmaContrato')} type="date" className="input" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Vigencia del contrato</label>
                    <input {...register('vigenciaContrato')} className="input" placeholder="Ej: 6 meses, hasta Dic 2025" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">% Comisión pactada</label>
                    <input {...register('porcentajeComisionPactado')} type="number" step="0.5" className="input" placeholder="Ej: 5" />
                  </div>
                </div>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Contrato de Comisión Mercantil firmado *</label>
                  <FileSlot label="Contrato firmado" required fileKey="contrato_comision" file={files.contrato_comision} onPick={() => pickFile('contrato_comision')} onRemove={() => removeFile('contrato_comision')} />
                  <input ref={el => { if (el) fileRefs.current.contrato_comision = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('contrato_comision')} style={{ display: 'none' }} />
                </div>
              </div>
            )}

            {contrato === 'no' && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#b91c1c' }}>
                Sin contrato de comisión firmado, la propiedad se guardará como <strong>Incompleta</strong> y no podrá publicarse ni compartirse.
              </div>
            )}

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">Observaciones</label>
              <textarea {...register('observaciones')} className="input" rows={3} placeholder="Notas internas sobre esta captación..." style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
          </div>

          {/* ─── Acciones ─── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 32 }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/properties')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || uploading}>
              {isSubmitting ? 'Guardando captación...' : uploading ? 'Subiendo documentos...' : 'Registrar Captación'}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
