'use client';

import { Header } from '@/components/header';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { propertiesApi, advisorsApi, uploadDocuments } from '@/lib/api';
import { checkDocSize, ensureRequiredDocs, notifyFormErrors } from '@/lib/upload';
import { useAuthStore } from '@/store/auth.store';
import { useState, useRef, ChangeEvent } from 'react';
import {
  ArrowLeft, CheckCircle, User, FileText, Building2,
  DollarSign, Camera, Shield, Upload, X, AlertCircle, Home,
} from 'lucide-react';
import { useHasAccess, AccessDenied } from '@/components/access-guard';
import {
  zNombre, zEmailOpcional, zTelefono, zFechaNoFutura,
  MAX_TEXTO_LARGO, MAX_MONTO, MAX_SUPERFICIE,
  soloDigitos,
} from '@/lib/validators';
import { notify } from '@/lib/toast';

/* ─── Piezas numéricas: vacío → undefined, sin NaN/negativos, con tope ─── */
const zNumOpcional = (max: number, msg = 'Ingresa un número válido.') =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: msg })
      .nonnegative('No puede ser negativo.')
      .max(max, 'Excede el máximo permitido.')
      .optional(),
  );

const zEnteroOpcional = (max: number) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: 'Ingresa un número entero.' })
      .int('Debe ser un número entero.')
      .nonnegative('No puede ser negativo.')
      .max(max, 'Excede el máximo permitido.')
      .optional(),
  );

/* ─── Schema ─── */
const schema = z.object({
  // S1 Propietario
  ownerName:            zNombre,
  ownerPhone:           zTelefono,
  ownerEmail:           zEmailOpcional,
  ownerEstadoCivil:     z.string().min(1, 'Estado civil requerido'),
  tieneCopropietarios:  z.enum(['si', 'no']),
  quienRealizaContrato: z.string().min(1, 'Requerido'),

  // S2 Documentos propiedad
  docAcreditaPropiedad: z.string().min(1, 'Tipo de documento requerido'),
  tienePredial:         z.enum(['si', 'no']),
  tieneAgua:            z.enum(['si', 'no']),
  tieneLuz:             z.enum(['si', 'no']),

  // S3 Datos inmueble
  tipoInmueble:           z.string().min(1, 'Tipo de inmueble requerido'),
  address:                z.string().trim().min(5, 'Dirección requerida'),
  city:                   zNombre,
  state:                  zNombre,
  zona:                   z.string().optional().or(z.literal('')),
  mapsUrl:                z.string().trim().max(500).refine(
    (v) => v === '' || /^https?:\/\/\S+$/i.test(v),
    'Ingresa una URL válida (http/https).',
  ).optional().or(z.literal('')),
  superficieTerreno:      zNumOpcional(MAX_SUPERFICIE, 'Superficie inválida.'),
  superficieConstruccion: zNumOpcional(MAX_SUPERFICIE, 'Superficie inválida.'),
  recamaras:              zEnteroOpcional(100),
  banosCompletos:         zEnteroOpcional(100),
  mediosBanos:            zEnteroOpcional(100),
  estacionamientos:       zEnteroOpcional(1000),
  niveles:                zEnteroOpcional(200),
  estadoConservacion:     z.string().min(1, 'Requerido'),
  situacionActual:        z.string().min(1, 'Requerido'),

  // S4 Información de renta
  rentaMensual: z.coerce.number({ message: 'Ingresa un monto válido.' })
    .positive('La renta debe ser mayor a cero.')
    .max(MAX_MONTO, 'El monto excede el máximo permitido.')
    .refine((v) => Math.round(v * 100) === v * 100, 'Máximo 2 decimales.'),
  deposito:           z.string().min(1, 'Requerido'),
  plazoMinimo:        z.string().min(1, 'Requerido'),
  aceptaMascotas:     z.string().min(1, 'Requerido'),
  aceptaEstudiantes:  z.string().min(1, 'Requerido'),
  aceptaEmpresas:     z.enum(['si', 'no']),
  requiereAval:       z.enum(['si', 'no']),
  aceptaObligadoSol:  z.enum(['si', 'no']),
  requierePolizaJur:  z.enum(['si', 'no']),
  tieneMantenimiento: z.enum(['si', 'no']),
  montoMantenimiento: zNumOpcional(MAX_MONTO, 'Ingresa una cuota válida.'),
  amenidades:         z.string().optional().or(z.literal('')),

  // S5 Comercialización y autorización
  advisorId:                 z.string().optional().or(z.literal('')),
  disponibleMostrar:         z.enum(['si', 'no']),
  fechaDisponibilidad:       z.string().min(1, 'Fecha de disponibilidad requerida'),
  autorizacionPromocion:     z.enum(['si', 'no']),
  tipoAutorizacion:          z.string().optional().or(z.literal('')),
  contratoComisionFirmado:   z.enum(['si', 'no']),
  fechaFirmaContrato:        zFechaNoFutura,
  vigenciaContrato:          z.string().optional().or(z.literal('')),
  porcentajeComisionPactado: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: 'Ingresa un porcentaje válido.' })
      .nonnegative('No puede ser negativo.')
      .max(100, 'El porcentaje no puede ser mayor a 100.')
      .optional(),
  ),
  observaciones: z.string().trim().max(MAX_TEXTO_LARGO, `Máximo ${MAX_TEXTO_LARGO} caracteres.`).optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

type FileKey =
  | 'owner_ine' | 'doc_propiedad' | 'predial' | 'agua' | 'luz'
  | 'poder_notarial' | 'ine_coprop' | 'fotos' | 'contrato_comision';

const TIPOS_INMUEBLE     = ['Casa', 'Departamento', 'Terreno', 'Local comercial', 'Oficina', 'Bodega', 'Nave industrial', 'Rancho', 'Otro'];
const ESTADOS_CIVIL      = ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)', 'Unión libre'];
const ESTADOS_CONSERVACION = ['Excelente', 'Bueno', 'Regular', 'Requiere remodelación'];
const SITUACIONES        = ['Habitada por propietario', 'Rentada', 'Desocupada'];
const DOCS_PROPIEDAD     = ['Escritura pública', 'Título de propiedad', 'Contrato de cesión', 'Resolución judicial', 'Otro'];
const QUIEN_CONTRATA     = ['Propietario', 'Apoderado', 'Representante legal'];
const SERVICIOS_OPTS     = ['Agua', 'Luz', 'Gas', 'Internet', 'Mantenimiento', 'Ninguno'];
const EQUIPAMIENTO_OPTS  = ['Cocina integral', 'Closets', 'Minisplits', 'Aire central', 'Refrigerador', 'Estufa', 'Lavadora', 'Secadora', 'Persianas', 'Amueblado', 'Otro'];

/* ─── Helpers ─── */
function SectionHeader({ index, icon, title, subtitle }: {
  index: number; icon: React.ReactNode; title: string; subtitle?: string;
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

const ALLOWED_ROLES = ['Super Admin', 'Admin', 'Asesor'];

/* ─── Page ─── */
export default function RentalsNewPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const hasAccess = useHasAccess(ALLOWED_ROLES);
  // Un Admin/Super Admin sin perfil de asesor propio debe elegir explícitamente
  // qué asesor se lleva el crédito de la captación (antes se guardaba
  // silenciosamente el UUID de su cuenta de usuario, que no existe en
  // public.advisors — la propiedad quedaba huérfana y no aparecía en rankings).
  const needsAdvisorPicker = !user?.advisorId;
  const { data: advisorsData } = useQuery({
    queryKey: ['advisors-for-captacion'],
    queryFn: () => advisorsApi.getAll().then(r => r.data?.data ?? r.data ?? []),
    enabled: needsAdvisorPicker,
  });
  const advisorsList: any[] = Array.isArray(advisorsData) ? advisorsData : [];
  const [success, setSuccess]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles]       = useState<Partial<Record<FileKey, File>>>({});
  const [servicios, setServicios]     = useState<string[]>([]);
  const [equipamiento, setEquipamiento] = useState<string[]>([]);
  const fileRefs = useRef<Partial<Record<FileKey, HTMLInputElement>>>({});

  const {
    register, handleSubmit, control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      tieneCopropietarios: 'no',
      tienePredial: 'no', tieneAgua: 'no', tieneLuz: 'no',
      aceptaEmpresas: 'si', requiereAval: 'si',
      aceptaObligadoSol: 'si', requierePolizaJur: 'no',
      tieneMantenimiento: 'no', disponibleMostrar: 'si',
      autorizacionPromocion: 'si', contratoComisionFirmado: 'no',
    },
  });

  const coprop       = useWatch({ control, name: 'tieneCopropietarios' });
  const quienContrata= useWatch({ control, name: 'quienRealizaContrato' });
  const predial      = useWatch({ control, name: 'tienePredial' });
  const agua         = useWatch({ control, name: 'tieneAgua' });
  const luz          = useWatch({ control, name: 'tieneLuz' });
  const tieneMant    = useWatch({ control, name: 'tieneMantenimiento' });
  const autoriza     = useWatch({ control, name: 'autorizacionPromocion' });
  const contrato     = useWatch({ control, name: 'contratoComisionFirmado' });

  const handleFile = (key: FileKey) => (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!checkDocSize(f, key)) { e.target.value = ''; return; }
    setFiles(p => ({ ...p, [key]: f }));
  };
  const removeFile = (key: FileKey) => {
    setFiles(p => { const n = { ...p }; delete n[key]; return n; });
    if (fileRefs.current[key]) fileRefs.current[key]!.value = '';
  };
  const pickFile = (key: FileKey) => fileRefs.current[key]?.click();

  const toggleChip = (arr: string[], setArr: (v: string[]) => void, val: string) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const onSubmit = async (data: any) => {
    // Documentos obligatorios (marcados con *)
    const requiredDocs = [
      { key: 'owner_ine', label: 'INE del propietario' },
      { key: 'doc_propiedad', label: 'documento que acredita la propiedad (escritura)' },
      { key: 'fotos', label: 'fotografías del inmueble' },
    ];
    if (quienContrata && quienContrata !== 'Propietario') {
      requiredDocs.push({ key: 'poder_notarial', label: 'documento legal (poder / representación)' });
    }
    if (contrato === 'si') {
      requiredDocs.push({ key: 'contrato_comision', label: 'Contrato de Comisión Mercantil firmado' });
    }
    if (!ensureRequiredDocs(files as Record<string, File | undefined>, requiredDocs)) return;

    if (needsAdvisorPicker && !data.advisorId) {
      notify.error('Selecciona el asesor que se lleva el crédito de esta captación.');
      return;
    }

    try {
      const res = await propertiesApi.create({
        // Campos comunes (camelCase, mismos que el DTO CreatePropertyDto)
        advisorId: user?.advisorId ?? data.advisorId,
        tipoOperacion:           'Renta',
        tipoInmueble:            data.tipoInmueble,
        type:                    data.tipoInmueble,
        address:                 data.address,
        city:                    data.city,
        state:                   data.state,
        zona:                    data.zona,
        mapsUrl:                 data.mapsUrl,
        ownerName:               data.ownerName,
        ownerPhone:              data.ownerPhone,
        ownerEmail:              data.ownerEmail,
        ownerEstadoCivil:        data.ownerEstadoCivil,
        tieneCopropietarios:     data.tieneCopropietarios === 'si',
        tienePredial:            data.tienePredial,
        tieneAgua:               data.tieneAgua,
        tieneLuz:                data.tieneLuz,
        superficieTerreno:       data.superficieTerreno,
        superficieConstruccion:  data.superficieConstruccion,
        recamaras:               data.recamaras,
        banosCompletos:          data.banosCompletos,
        mediosBanos:             data.mediosBanos,
        estacionamientos:        data.estacionamientos,
        niveles:                 data.niveles,
        estadoConservacion:      data.estadoConservacion,
        situacionActual:         data.situacionActual,
        // En renta, el precio de la propiedad es la renta mensual solicitada
        price:                   data.rentaMensual,
        cuotaMantenimiento:      data.tieneMantenimiento === 'si' ? data.montoMantenimiento : undefined,
        amenidades:              data.amenidades,
        autorizacionPromocion:   data.autorizacionPromocion === 'si',
        tipoAutorizacion:        data.tipoAutorizacion,
        contratoComisionFirmado: data.contratoComisionFirmado === 'si',
        fechaFirmaContrato:      data.fechaFirmaContrato || undefined,
        vigenciaContrato:        data.vigenciaContrato,
        porcentajeComisionPactado: data.porcentajeComisionPactado,
        observaciones:           data.observaciones,
        // Campos específicos de renta (snake_case = columnas reales en BD)
        tipo_operacion_principal:  'Renta',
        quien_realiza_contrato:    data.quienRealizaContrato,
        doc_acredita_propiedad:    data.docAcreditaPropiedad,
        renta_mensual_solicitada:  data.rentaMensual,
        deposito_requerido:        data.deposito,
        plazo_minimo_contrato:     data.plazoMinimo,
        acepta_mascotas:           data.aceptaMascotas,
        acepta_estudiantes:        data.aceptaEstudiantes,
        acepta_empresas:           data.aceptaEmpresas === 'si',
        requiere_aval:             data.requiereAval === 'si',
        acepta_obligado_solidario: data.aceptaObligadoSol === 'si',
        requiere_poliza_juridica:  data.requierePolizaJur === 'si',
        servicios_incluidos:       JSON.stringify(servicios),
        equipamiento_incluido:     JSON.stringify(equipamiento),
        disponible_mostrarse:      data.disponibleMostrar === 'si',
        fecha_disponibilidad:      data.fechaDisponibilidad,
        status: data.contratoComisionFirmado === 'si' ? 'En revisión' : 'Incompleta',
      } as Record<string, unknown>);
      const propertyId = res.data?.id;
      if (propertyId && Object.keys(files).length > 0) {
        setUploading(true);
        await uploadDocuments(files, {
          owner_ine:        'ine_propietario',
          doc_propiedad:    'escritura',
          predial:          'predial',
          agua:             'agua',
          luz:              'luz',
          poder_notarial:   'poder_notarial',
          ine_coprop:       'ine_copropietario',
          fotos:            'fotografia',
          contrato_comision:'contrato_comision',
        }, 'propiedad', propertyId);
      }

      setSuccess(true);
      notify.success('Propiedad en renta guardada correctamente.');
      setTimeout(() => router.push('/properties'), 2500);
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
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
              Captación en Renta Registrada
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

  if (!hasAccess) return <AccessDenied title="Nueva Captación Renta" />;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>

        <button onClick={() => router.push('/properties')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14} />Volver al inventario
        </button>

        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Captación de Propiedad en Renta</h1>
            <p className="page-desc">Registro completo del expediente de captación — Formulario 3</p>
          </div>
        </div>


        <form onSubmit={handleSubmit(onSubmit, notifyFormErrors)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── S1: Propietario ─── */}
          <div className="card">
            <SectionHeader index={1} icon={<User size={14} />} title="Datos del Propietario" subtitle="Identificación y contacto del propietario del inmueble" />

            <div className="input-group">
              <label className="input-label">Nombre completo del propietario *</label>
              <input {...register('ownerName')} className="input" placeholder="Ej: María Fernanda López Ruiz" />
              <FieldError msg={errors.ownerName?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Teléfono *</label>
                <input {...register('ownerPhone')} className="input" placeholder="5512345678"
                  inputMode="numeric" maxLength={10}
                  onInput={(e) => { e.currentTarget.value = soloDigitos(e.currentTarget.value, 10); }} />
                <FieldError msg={errors.ownerPhone?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Correo electrónico</label>
                <input {...register('ownerEmail')} type="email" className="input" placeholder="propietario@email.com" />
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

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿Existen copropietarios registrados? *</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('tieneCopropietarios')} value={v} />
                    {v === 'si' ? 'Sí' : 'No'}
                  </label>
                ))}
              </div>
            </div>

            {coprop === 'si' && (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="input-group">
                  <label className="input-label">Nombre(s) de copropietario(s)</label>
                  <textarea className="input" rows={2} placeholder="Un nombre por línea" style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>INE de copropietario(s)</label>
                  <FileSlot label="INE copropietario(s)" fileKey="ine_coprop" file={files.ine_coprop} onPick={() => pickFile('ine_coprop')} onRemove={() => removeFile('ine_coprop')} />
                  <input ref={el => { if (el) fileRefs.current.ine_coprop = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('ine_coprop')} style={{ display: 'none' }} />
                </div>
              </div>
            )}

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿Quién está realizando la contratación? *</label>
              <select {...register('quienRealizaContrato')} className="select">
                <option value="">— Seleccionar —</option>
                {QUIEN_CONTRATA.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
              <FieldError msg={errors.quienRealizaContrato?.message} />
            </div>

            {quienContrata && quienContrata !== 'Propietario' && (
              <div style={{ marginTop: 14 }}>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                  {quienContrata === 'Apoderado' ? 'Poder notarial *' : 'Documento de representación legal *'}
                </label>
                <FileSlot label="Documento legal" required fileKey="poder_notarial" file={files.poder_notarial} onPick={() => pickFile('poder_notarial')} onRemove={() => removeFile('poder_notarial')} />
                <input ref={el => { if (el) fileRefs.current.poder_notarial = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('poder_notarial')} style={{ display: 'none' }} />
              </div>
            )}
          </div>

          {/* ─── S2: Documentos de la propiedad ─── */}
          <div className="card">
            <SectionHeader index={2} icon={<FileText size={14} />} title="Documentos de la Propiedad" subtitle="Escritura, recibos y acreditación legal" />

            <div className="input-group">
              <label className="input-label">Documento que acredita la propiedad *</label>
              <select {...register('docAcreditaPropiedad')} className="select">
                <option value="">— Seleccionar —</option>
                {DOCS_PROPIEDAD.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <FieldError msg={errors.docAcreditaPropiedad?.message} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Archivo del documento de propiedad *</label>
              <FileSlot label="Escritura / Título / Otro" required fileKey="doc_propiedad" file={files.doc_propiedad} onPick={() => pickFile('doc_propiedad')} onRemove={() => removeFile('doc_propiedad')} />
              <input ref={el => { if (el) fileRefs.current.doc_propiedad = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('doc_propiedad')} style={{ display: 'none' }} />
            </div>

            {([
              { field: 'tienePredial' as const, label: '¿Cuenta con predial?',         val: predial, docKey: 'predial' as FileKey, docLabel: 'Último recibo de predial' },
              { field: 'tieneAgua'    as const, label: '¿Cuenta con recibo de agua?',   val: agua,    docKey: 'agua'    as FileKey, docLabel: 'Último recibo de agua' },
              { field: 'tieneLuz'     as const, label: '¿Cuenta con recibo de luz?',    val: luz,     docKey: 'luz'     as FileKey, docLabel: 'Último recibo de luz' },
            ]).map(item => (
              <div key={item.field} style={{ marginTop: 18 }}>
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
          </div>

          {/* ─── S3: Datos del Inmueble ─── */}
          <div className="card">
            <SectionHeader index={3} icon={<Home size={14} />} title="Datos del Inmueble" subtitle="Características físicas y ubicación" />

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
                <input {...register('zona')} className="input" placeholder="Ej: Polanco, Roma Norte" />
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Dirección completa *</label>
              <input {...register('address')} className="input" placeholder="Calle, Número, Colonia, Municipio" />
              <FieldError msg={errors.address?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">Ciudad *</label>
                <input {...register('city')} className="input" placeholder="Ciudad de México" />
                <FieldError msg={errors.city?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Estado *</label>
                <input {...register('state')} className="input" placeholder="Ej: Jalisco" />
                <FieldError msg={errors.state?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">URL Google Maps</label>
                <input {...register('mapsUrl')} className="input" placeholder="https://maps.google.com/..." />
                <FieldError msg={errors.mapsUrl?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              {[
                { name: 'superficieTerreno',       label: 'Terreno m²' },
                { name: 'superficieConstruccion',  label: 'Construcción m²' },
                { name: 'recamaras',               label: 'Recámaras' },
                { name: 'banosCompletos',           label: 'Baños compl.' },
              ].map(f => (
                <div key={f.name} className="input-group">
                  <label className="input-label">{f.label}</label>
                  <input {...register(f.name as any)} type="number" className="input" placeholder="0" />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginTop: 14 }}>
              {[
                { name: 'mediosBanos',     label: 'Medios baños' },
                { name: 'estacionamientos',label: 'Estac.' },
                { name: 'niveles',         label: 'Niveles' },
              ].map(f => (
                <div key={f.name} className="input-group">
                  <label className="input-label">{f.label}</label>
                  <input {...register(f.name as any)} type="number" className="input" placeholder="0" />
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
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
                  {SITUACIONES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <FieldError msg={errors.situacionActual?.message} />
              </div>
            </div>
          </div>

          {/* ─── S4: Información de Renta ─── */}
          <div className="card">
            <SectionHeader index={4} icon={<DollarSign size={14} />} title="Información de Renta" subtitle="Condiciones económicas, aceptación y equipamiento" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Renta mensual solicitada (MXN) *</label>
                <input {...register('rentaMensual')} type="number" className="input" placeholder="0" />
                <FieldError msg={errors.rentaMensual?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Depósito requerido *</label>
                <select {...register('deposito')} className="select">
                  <option value="">— Seleccionar —</option>
                  {['1 mes', '2 meses', 'Otro'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <FieldError msg={errors.deposito?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Plazo mínimo de contrato *</label>
                <select {...register('plazoMinimo')} className="select">
                  <option value="">— Seleccionar —</option>
                  {['12 meses', '24 meses', 'Otro'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <FieldError msg={errors.plazoMinimo?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">¿Acepta mascotas? *</label>
                <select {...register('aceptaMascotas')} className="select">
                  <option value="">— Seleccionar —</option>
                  {['Sí', 'No', 'Negociable'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <FieldError msg={errors.aceptaMascotas?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">¿Acepta estudiantes? *</label>
                <select {...register('aceptaEstudiantes')} className="select">
                  <option value="">— Seleccionar —</option>
                  {['Sí', 'No', 'Negociable'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <FieldError msg={errors.aceptaEstudiantes?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 14 }}>
              {([
                { field: 'aceptaEmpresas'   as const, label: '¿Acepta empresas?' },
                { field: 'requiereAval'      as const, label: '¿Requiere aval?' },
                { field: 'aceptaObligadoSol' as const, label: '¿Obligado solidario?' },
                { field: 'requierePolizaJur' as const, label: '¿Póliza jurídica?' },
              ]).map(({ field, label }) => (
                <div key={field} className="input-group">
                  <label className="input-label">{label}</label>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                    {(['si', 'no'] as const).map(v => (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                        <input type="radio" {...register(field)} value={v} /> {v === 'si' ? 'Sí' : 'No'}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">¿Tiene cuota de mantenimiento?</label>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('tieneMantenimiento')} value={v} />
                    {v === 'si' ? 'Sí' : 'No'}
                  </label>
                ))}
              </div>
            </div>
            {tieneMant === 'si' && (
              <div className="input-group" style={{ marginTop: 14, maxWidth: 240 }}>
                <label className="input-label">Monto de mantenimiento mensual ($)</label>
                <input {...register('montoMantenimiento')} type="number" className="input" placeholder="0" />
              </div>
            )}

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">Servicios incluidos</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {SERVICIOS_OPTS.map(s => {
                  const sel = servicios.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleChip(servicios, setServicios, s)} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 550,
                      cursor: 'pointer', border: `1.5px solid ${sel ? 'var(--color-primary)' : '#d1d5db'}`,
                      background: sel ? 'var(--color-primary)' : 'transparent',
                      color: sel ? '#fff' : 'var(--color-on-surface)',
                    }}>{s}</button>
                  );
                })}
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 18 }}>
              <label className="input-label">Equipamiento incluido</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {EQUIPAMIENTO_OPTS.map(e => {
                  const sel = equipamiento.includes(e);
                  return (
                    <button key={e} type="button" onClick={() => toggleChip(equipamiento, setEquipamiento, e)} style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 550,
                      cursor: 'pointer', border: `1.5px solid ${sel ? 'var(--color-secondary)' : '#d1d5db'}`,
                      background: sel ? 'var(--color-secondary)' : 'transparent',
                      color: sel ? '#fff' : 'var(--color-on-surface)',
                    }}>{e}</button>
                  );
                })}
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Principales amenidades / características</label>
              <textarea {...register('amenidades')} className="input" rows={3} placeholder="Descripción de amenidades, acabados, características destacadas..." style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
          </div>

          {/* ─── S5: Comercialización y Autorización ─── */}
          <div className="card">
            <SectionHeader index={5} icon={<Shield size={14} />} title="Comercialización y Autorización" subtitle="Disponibilidad, fotografías y contrato de comisión mercantil" />

            {needsAdvisorPicker && (
              <div className="input-group" style={{ marginBottom: 18 }}>
                <label className="input-label">Asesor que capta la propiedad *</label>
                <select {...register('advisorId')} className="select">
                  <option value="">— Seleccionar asesor —</option>
                  {advisorsList.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">¿Disponible para mostrarse? *</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                  {(['si', 'no'] as const).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" {...register('disponibleMostrar')} value={v} />
                      {v === 'si' ? 'Sí' : 'No'}
                    </label>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Fecha de disponibilidad *</label>
                <input {...register('fechaDisponibilidad')} type="date" className="input" />
                <FieldError msg={errors.fechaDisponibilidad?.message} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 18 }}>
              <div className="input-group">
                <label className="input-label">¿El propietario autoriza promover e intermediar la renta? *</label>
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
                    <input {...register('vigenciaContrato')} className="input" placeholder="Ej: 6 meses, hasta Jun 2026" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">% Comisión pactada</label>
                    <input {...register('porcentajeComisionPactado')} type="number" step="0.5" className="input" placeholder="Ej: 8.5" />
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
              <textarea {...register('observaciones')} className="input" rows={3} placeholder="Notas internas sobre esta captación de renta..." style={{ resize: 'vertical', minHeight: 72 }} />
            </div>
          </div>

          {/* ─── Acciones ─── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 32 }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/properties')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || uploading}>
              {isSubmitting ? 'Guardando captación...' : uploading ? 'Subiendo documentos...' : 'Registrar Captación en Renta'}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
