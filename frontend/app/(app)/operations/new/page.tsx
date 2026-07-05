'use client';

import { Header } from '@/components/header';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { operationsApi, propertiesApi, advisorsApi, uploadDocuments, templatesApi } from '@/lib/api';
import { checkDocSize, ensureRequiredDocs, notifyFormErrors } from '@/lib/upload';
import { useQuery } from '@tanstack/react-query';
import { useState, useRef, ChangeEvent } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
  ArrowLeft, CheckCircle, Building2, DollarSign, Users, FileText,
  ShieldAlert, AlertCircle, Upload, X, Calculator,
} from 'lucide-react';
import { useHasAccess, AccessDenied } from '@/components/access-guard';
import { MAX_MONTO } from '@/lib/validators';
import { notify } from '@/lib/toast';

const ALLOWED_ROLES = ['Super Admin', 'Admin', 'Asesor'];

/* ─── Schema ─── */
const zMonto = (msgReq: string) =>
  z.coerce.number({ message: 'Ingresa un monto válido.' })
    .positive(msgReq)
    .max(MAX_MONTO, 'El monto excede el máximo permitido.')
    .refine((v) => Math.round(v * 100) === v * 100, 'Máximo 2 decimales.');

const schemaBase = z.object({
  // S1 Origen
  tipoOperacion:          z.enum(['Venta', 'Renta']),
  propiedadEnInventario:  z.enum(['si', 'no']),
  propertyId:             z.string().optional().or(z.literal('')),
  tipoCierreExterno:      z.string().optional().or(z.literal('')),
  direccionCierreExterno: z.string().optional().or(z.literal('')),
  tipoInmuebleExterno:    z.string().optional().or(z.literal('')),
  valorExternoOperacion:  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: 'Ingresa un monto válido.' })
      .nonnegative('No puede ser negativo.')
      .max(MAX_MONTO, 'El monto excede el máximo permitido.')
      .optional(),
  ),
  docCierreTipo:          z.string().min(1, 'Selecciona el tipo de documento'),

  // S2 Económicos
  precioFinalCierre:      zMonto('El precio debe ser mayor a cero.'),
  fechaCierre:            z.string().min(1, 'Fecha requerida')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida.')
    .refine((v) => new Date(v + 'T00:00:00') <= new Date(), 'La fecha de cierre no puede ser futura.'),
  montoComisionGenerada:  zMonto('El monto de comisión debe ser mayor a cero.'),

  // S3 Asesores
  closerId:               z.string().min(1, 'Selecciona el asesor cerrador'),
  repVendedorTipo:        z.string().min(1, 'Requerido'),
  repCompradorTipo:       z.string().min(1, 'Requerido'),
  asesorInternoVendedor:  z.string().optional().or(z.literal('')),
  asesorInternoComprador: z.string().optional().or(z.literal('')),
  asesorExternoVendedor:  z.string().optional().or(z.literal('')),
  asesorExternoComprador: z.string().optional().or(z.literal('')),

  // S4 PLD
  pldTipoCliente: z.string().min(1, 'Selecciona tipo de cliente'),

  // S5 Declaraciones
  decl1: z.literal(true, { error: () => ({ message: 'Requerido' }) }),
  decl2: z.literal(true, { error: () => ({ message: 'Requerido' }) }),
  decl3: z.literal(true, { error: () => ({ message: 'Requerido' }) }),
  decl4: z.literal(true, { error: () => ({ message: 'Requerido' }) }),
  decl5: z.literal(true, { error: () => ({ message: 'Requerido' }) }),

  // S6 Pago
  solicitaLiberacion: z.enum(['si', 'no']),
  observaciones:      z.string().optional().or(z.literal('')),
});

const schema = schemaBase
  // Si la propiedad está en inventario, hay que seleccionarla; si no, describir el cierre externo
  .refine(
    (d) => d.propiedadEnInventario === 'no' || (d.propertyId ?? '') !== '',
    { message: 'Selecciona la propiedad del inventario.', path: ['propertyId'] },
  )
  .refine(
    (d) => d.propiedadEnInventario === 'si' || (d.direccionCierreExterno ?? '').trim() !== '',
    { message: 'Indica la dirección del cierre externo.', path: ['direccionCierreExterno'] },
  )
  // La comisión no puede exceder el precio final del cierre
  .refine(
    (d) => !(d.montoComisionGenerada > 0 && d.precioFinalCierre > 0) || d.montoComisionGenerada <= d.precioFinalCierre,
    { message: 'La comisión no puede ser mayor al precio final del cierre.', path: ['montoComisionGenerada'] },
  );

type FormData = z.infer<typeof schema>;

type FileKey = 'doc_cierre' | 'kyc' | 'pld_hoja' | 'identificacion' | 'rfc_doc' | 'curp_doc' | 'domicilio' | 'acta_constitutiva' | 'poder_rep';

const DOC_TIPOS_CIERRE = [
  'Contrato de Arrendamiento firmado',
  'Promesa de Compraventa firmada',
  'Escritura',
  'Contrato privado',
  'Otro',
];
const REP_TIPOS = ['Yo mismo', 'Otro asesor de Idea Uno', 'Asesor externo', 'Cliente directo'];
const TIPOS_INMUEBLE_EXT = ['Casa', 'Departamento', 'Terreno', 'Local comercial', 'Oficina', 'Bodega', 'Otro'];

/* ─── Helpers UI ─── */
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

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span style={{ fontSize: 11.5, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
      <AlertCircle size={11} />{msg}
    </span>
  );
}

function FileSlot({ label, required, fileKey, file, onPick, onRemove, onDownloadTemplate }: {
  label: string; required?: boolean; fileKey: FileKey;
  file?: File; onPick: () => void; onRemove: () => void; onDownloadTemplate?: () => void;
}) {
  return (
    <div style={{
      border: `1.5px dashed ${file ? 'var(--color-secondary)' : '#d1d5db'}`,
      borderRadius: 'var(--radius-md)', padding: '10px 12px',
      background: file ? '#f0fdf4' : 'var(--color-surface-variant)',
    }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span>{label}{required && <span style={{ color: 'var(--color-error)', marginLeft: 3 }}>*</span>}</span>
        {onDownloadTemplate && (
          <button type="button" onClick={onDownloadTemplate}
             style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-primary)', whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Descargar plantilla
          </button>
        )}
      </div>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={12} color="var(--color-secondary)" />
          <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#065f46' }}>{file.name}</span>
          <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2 }}><X size={12} /></button>
        </div>
      ) : (
        <button type="button" onClick={onPick} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Upload size={12} />Seleccionar archivo
        </button>
      )}
    </div>
  );
}

/* ─── Main ─── */
export default function NewOperationPage() {
  const router = useRouter();
  const hasAccess = useHasAccess(ALLOWED_ROLES);
  const [success, setSuccess]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [commBreakdown, setComm]      = useState<any>(null);
  const [files, setFiles]             = useState<Partial<Record<FileKey, File>>>({});
  const fileRefs = useRef<Partial<Record<FileKey, HTMLInputElement>>>({});

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });
  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => advisorsApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });
  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });

  const downloadTemplate = async (categoria: string) => {
    const list: any[] = Array.isArray(templatesData) ? templatesData : [];
    const tpl = list.find(t => t.categoria === categoria);
    if (!tpl) {
      alert(`No hay plantilla de ${categoria} cargada todavía. Pide al Admin que la suba en "Plantillas y Contratos".`);
      return;
    }
    const { data } = await templatesApi.getDownloadUrl(tpl.id);
    const url = data?.data?.signedUrl ?? data?.signedUrl;
    if (url) window.open(url, '_blank');
  };

  const properties: any[] = Array.isArray(propertiesData) ? propertiesData : [];
  const advisors: any[]   = Array.isArray(advisorsData)   ? advisorsData   : [];

  const {
    register, handleSubmit, control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      tipoOperacion: 'Venta', propiedadEnInventario: 'si',
      repVendedorTipo: '', repCompradorTipo: '',
      solicitaLiberacion: 'si',
    },
  });

  const tipoOp       = useWatch({ control, name: 'tipoOperacion' });
  const enInventario = useWatch({ control, name: 'propiedadEnInventario' });
  const repVend      = useWatch({ control, name: 'repVendedorTipo' });
  const repComp      = useWatch({ control, name: 'repCompradorTipo' });
  const pldTipo      = useWatch({ control, name: 'pldTipoCliente' });
  const precio       = useWatch({ control, name: 'precioFinalCierre' }) || 0;
  const comision     = useWatch({ control, name: 'montoComisionGenerada' }) || 0;

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

  const pldFlag = precio >= 941412.75;

  const onSubmit = async (data: any) => {
    // Documentos obligatorios (marcados con *)
    const requiredDocs = [
      { key: 'doc_cierre', label: 'documento de cierre' },
      { key: 'kyc', label: 'Formato KYC firmado' },
      { key: 'pld_hoja', label: 'Hoja de Reporte y Entrega Expediente PLD' },
      { key: 'identificacion', label: 'identificación oficial' },
      { key: 'rfc_doc', label: 'RFC o Constancia de Situación Fiscal' },
      { key: 'curp_doc', label: 'CURP' },
      { key: 'domicilio', label: 'comprobante de domicilio' },
    ];
    if (pldTipo === 'Persona moral') {
      requiredDocs.push(
        { key: 'acta_constitutiva', label: 'acta constitutiva' },
        { key: 'poder_rep', label: 'poder del representante legal' },
      );
    }
    if (!ensureRequiredDocs(files as Record<string, File | undefined>, requiredDocs)) return;

    try {
      const res = await operationsApi.create({
        tipoOperacion:          data.tipoOperacion,
        propiedadEnInventario:  data.propiedadEnInventario === 'si',
        propertyId:             data.propertyId || '',
        tipoCierreExterno:      data.tipoCierreExterno || '',
        direccionCierreExterno: data.direccionCierreExterno || '',
        tipoInmuebleExterno:    data.tipoInmuebleExterno || '',
        docCierreTipo:          data.docCierreTipo,
        precioFinalCierre:      data.precioFinalCierre,
        fechaCierre:            data.fechaCierre,
        montoComisionGenerada:  data.montoComisionGenerada,
        advisorId:              data.closerId,
        closerId:               data.closerId,
        repVendedorTipo:        data.repVendedorTipo,
        repCompradorTipo:       data.repCompradorTipo,
        asesorExternoVendedor:  data.asesorExternoVendedor || '',
        asesorExternoComprador: data.asesorExternoComprador || '',
        pldTipoCliente:         data.pldTipoCliente,
        pldExpedienteCompleto:  true,
        solicitaLiberacion:     data.solicitaLiberacion === 'si',
        observaciones:          data.observaciones || '',
      } as Record<string, unknown>);

      const operationId = res.data?.id;
      if (operationId && Object.keys(files).length > 0) {
        setUploading(true);
        await uploadDocuments(files, {
          doc_cierre:       'documento_cierre',
          kyc:              'kyc',
          pld_hoja:         'pld_hoja',
          identificacion:   'identificacion',
          rfc_doc:          'rfc',
          curp_doc:         'curp',
          domicilio:        'comprobante_domicilio',
          acta_constitutiva:'acta_constitutiva',
          poder_rep:        'poder_representante',
        }, 'cierre', operationId);
      }

      setComm(res.data?.commBreakdown ?? null);
      setSuccess(true);
      notify.success('Cierre registrado correctamente.');
      setTimeout(() => router.push('/operations'), 3000);
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
        <div className="page-content animate-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
          <div className="card" style={{ padding: '40px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={30} color="#059669" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6 }}>
                Cierre Registrado
              </h2>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
                Comisión calculada. Pendiente validación administrativa.
              </p>
            </div>

            {commBreakdown && (
              <div style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', padding: '18px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: 'var(--color-primary)' }}>
                  Desglose de comisión
                </div>
                {[
                  ['Comisión total', commBreakdown.monto_comision_total],
                  ['Gratificación invitación (2.5%)', commBreakdown.monto_invitacion],
                  ['Remanente', commBreakdown.monto_remanente],
                  ['Base asesor', commBreakdown.monto_base_asesor],
                  ['Descuento mentoría', commBreakdown.monto_mentoria],
                  ['Neto asesor', commBreakdown.monto_neto_asesor],
                  ['Ingreso inmobiliaria', commBreakdown.monto_inmobiliaria],
                ].map(([label, val]) => (
                  <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                    <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatCurrency(Number(val))}</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span>Avance AMA</span>
                  <span style={{ fontWeight: 700, color: commBreakdown.ama_alcanzada ? 'var(--color-secondary)' : 'inherit' }}>
                    {commBreakdown.ama_avance_pct?.toFixed(1)}%
                    {commBreakdown.ama_alcanzada && ' 🎯 AMA alcanzada'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  if (!hasAccess) return <AccessDenied title="Nuevo Cierre" />;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>

        <button onClick={() => router.push('/operations')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}>
          <ArrowLeft size={14} />Volver a operaciones
        </button>

        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">Registro de Cierre de Operación</h1>
            <p className="page-desc">Formulario 6 · Detona cálculo de comisiones automáticamente</p>
          </div>
        </div>


        {pldFlag && (
          <div style={{ background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20, fontSize: 12.5, color: '#c2410c', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={16} />
            <span><strong>Umbral PLD superado.</strong> Esta operación requiere expediente KYC completo. La comisión quedará bloqueada hasta validación administrativa.</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, notifyFormErrors)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── S1: Origen ─── */}
          <div className="card">
            <SectionHeader index={1} icon={<Building2 size={14} />} title="Origen de la Operación" subtitle="Tipo de cierre y propiedad involucrada" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Tipo de operación *</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                  {(['Venta', 'Renta'] as const).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" {...register('tipoOperacion')} value={v} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">¿La propiedad está en el inventario? *</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                  {(['si', 'no'] as const).map(v => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" {...register('propiedadEnInventario')} value={v} />
                      {v === 'si' ? 'Sí' : 'No (externa)'}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {enInventario === 'si' ? (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Propiedad del inventario *</label>
                <select {...register('propertyId')} className="select">
                  <option value="">— Seleccionar propiedad —</option>
                  {properties.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.address || p.title} — {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ marginTop: 14, padding: 14, background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="input-group">
                    <label className="input-label">Tipo de cierre externo</label>
                    <select {...register('tipoCierreExterno')} className="select">
                      <option value="">— Seleccionar —</option>
                      <option value="Venta en conjunto">Venta en conjunto</option>
                      <option value="Referido externo">Referido externo</option>
                      <option value="Propiedad de otro asesor">Propiedad de otro asesor</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Tipo de inmueble externo</label>
                    <select {...register('tipoInmuebleExterno')} className="select">
                      <option value="">— Seleccionar —</option>
                      {TIPOS_INMUEBLE_EXT.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Dirección del inmueble externo</label>
                  <input {...register('direccionCierreExterno')} className="input" placeholder="Dirección completa del inmueble" />
                </div>
              </div>
            )}

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Documento que acredita el cierre *</label>
              <select {...register('docCierreTipo')} className="select">
                <option value="">— Seleccionar —</option>
                {DOC_TIPOS_CIERRE.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <Err msg={errors.docCierreTipo?.message} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Archivo del documento de cierre *</label>
              <FileSlot label="Documento de cierre" required fileKey="doc_cierre" file={files.doc_cierre} onPick={() => pickFile('doc_cierre')} onRemove={() => removeFile('doc_cierre')} />
              <input ref={el => { if (el) fileRefs.current.doc_cierre = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile('doc_cierre')} style={{ display: 'none' }} />
            </div>
          </div>

          {/* ─── S2: Datos económicos ─── */}
          <div className="card">
            <SectionHeader index={2} icon={<DollarSign size={14} />} title="Datos Económicos" subtitle="Precio de cierre y comisión generada" />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">
                  {tipoOp === 'Renta' ? 'Renta mensual final ($)' : 'Precio final de cierre ($)'} *
                </label>
                <input {...register('precioFinalCierre')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="0" />
                <Err msg={errors.precioFinalCierre?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Fecha de cierre *</label>
                <input {...register('fechaCierre')} type="date" className="input"
                  max={new Date().toISOString().split('T')[0]} />
                <Err msg={errors.fechaCierre?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Monto de comisión generada ($) *</label>
                <input {...register('montoComisionGenerada')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="0" />
                <Err msg={errors.montoComisionGenerada?.message} />
              </div>
            </div>

            {/* Preview comisión estimada */}
            {comision > 0 && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)' }}>
                  <Calculator size={13} /> Estimado del motor de comisiones
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Comisión total',    val: comision },
                    { label: 'Invitación (2.5%)', val: comision * 0.025 },
                    { label: 'Base asesor (80%)',  val: (comision - comision * 0.025) * 0.8 },
                    { label: 'Neto aprox.',        val: (comision - comision * 0.025) * 0.8 * 0.95 },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{formatCurrency(item.val)}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)', marginTop: 8 }}>
                  El cálculo exacto depende de AMA y mentoría del asesor. Se calcula al guardar.
                </p>
              </div>
            )}
          </div>

          {/* ─── S3: Participación de asesores ─── */}
          <div className="card">
            <SectionHeader index={3} icon={<Users size={14} />} title="Participación de Asesores" subtitle="Quién representó a cada parte" />

            <div className="input-group">
              <label className="input-label">Asesor cerrador (Closer) *</label>
              <select {...register('closerId')} className="select">
                <option value="">— Seleccionar asesor —</option>
                {advisors.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <Err msg={errors.closerId?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">¿Quién representó al {tipoOp === 'Renta' ? 'arrendador' : 'vendedor'}? *</label>
                <select {...register('repVendedorTipo')} className="select">
                  <option value="">— Seleccionar —</option>
                  {REP_TIPOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Err msg={errors.repVendedorTipo?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">¿Quién representó al {tipoOp === 'Renta' ? 'arrendatario' : 'comprador'}? *</label>
                <select {...register('repCompradorTipo')} className="select">
                  <option value="">— Seleccionar —</option>
                  {REP_TIPOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <Err msg={errors.repCompradorTipo?.message} />
              </div>
            </div>

            {(repVend === 'Otro asesor de Idea Uno') && (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Asesor Idea Uno (parte vendedora)</label>
                <select {...register('asesorInternoVendedor')} className="select">
                  <option value="">— Seleccionar —</option>
                  {advisors.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {(repVend === 'Asesor externo') && (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Nombre del asesor externo (vendedor)</label>
                <input {...register('asesorExternoVendedor')} className="input" placeholder="Nombre y teléfono del asesor externo" />
              </div>
            )}
            {(repComp === 'Otro asesor de Idea Uno') && (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Asesor Idea Uno (parte compradora)</label>
                <select {...register('asesorInternoComprador')} className="select">
                  <option value="">— Seleccionar —</option>
                  {advisors.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            {(repComp === 'Asesor externo') && (
              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Nombre del asesor externo (comprador)</label>
                <input {...register('asesorExternoComprador')} className="input" placeholder="Nombre y teléfono del asesor externo" />
              </div>
            )}
          </div>

          {/* ─── S4: Expediente PLD ─── */}
          <div className="card">
            <SectionHeader index={4} icon={<ShieldAlert size={14} />} title="Expediente PLD" subtitle="Prevención de Lavado de Dinero — documentación del cliente" />

            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Tipo de cliente sujeto a identificación *</label>
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                {['Persona física', 'Persona moral'].map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('pldTipoCliente')} value={v} />
                    {v}
                  </label>
                ))}
              </div>
              <Err msg={errors.pldTipoCliente?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {(
                [
                  { key: 'kyc',          label: 'Formato KYC firmado',                         req: true, templateCategoria: 'KYC' },
                  { key: 'pld_hoja',     label: 'Hoja de Reporte y Entrega Expediente PLD',    req: true, templateCategoria: 'PLD' },
                  { key: 'identificacion',label: 'Identificación oficial',                      req: true  },
                  { key: 'rfc_doc',      label: 'RFC o Constancia de Situación Fiscal',         req: true  },
                  { key: 'curp_doc',     label: 'CURP',                                         req: true  },
                  { key: 'domicilio',    label: 'Comprobante de domicilio',                     req: true  },
                  ...(pldTipo === 'Persona moral' ? [
                    { key: 'acta_constitutiva', label: 'Acta constitutiva', req: true  },
                    { key: 'poder_rep',         label: 'Poder del representante legal', req: true },
                  ] : []),
                ] as { key: FileKey; label: string; req: boolean; templateCategoria?: string }[]
              ).map(slot => (
                <div key={slot.key}>
                  <FileSlot
                    label={slot.label} required={slot.req} fileKey={slot.key}
                    file={files[slot.key]} onPick={() => pickFile(slot.key)} onRemove={() => removeFile(slot.key)}
                    onDownloadTemplate={slot.templateCategoria ? () => downloadTemplate(slot.templateCategoria!) : undefined}
                  />
                  <input ref={el => { if (el) fileRefs.current[slot.key] = el; }} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile(slot.key)} style={{ display: 'none' }} />
                </div>
              ))}
            </div>
          </div>

          {/* ─── S5: Declaraciones ─── */}
          <div className="card">
            <SectionHeader index={5} icon={<FileText size={14} />} title="Declaraciones del Asesor" subtitle="Todos los campos son obligatorios" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([
                { name: 'decl1', text: 'Tuve a la vista los documentos originales.' },
                { name: 'decl2', text: 'La información proporcionada es correcta.' },
                { name: 'decl3', text: 'El expediente entregado se encuentra completo.' },
                { name: 'decl4', text: 'No informé al cliente sobre posibles reportes regulatorios.' },
                { name: 'decl5', text: 'Entiendo que el pago de mi comisión dependerá de la validación administrativa y de cumplimiento.' },
              ] as { name: any; text: string }[]).map(d => (
                <label key={d.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" {...register(d.name)} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 13 }}>{d.text}</span>
                  <Err msg={(errors as any)[d.name]?.message} />
                </label>
              ))}
            </div>
          </div>

          {/* ─── S6: Solicitud de pago ─── */}
          <div className="card">
            <SectionHeader index={6} icon={<DollarSign size={14} />} title="Solicitud de Liberación de Comisión" subtitle="El monto se calcula automáticamente al guardar" />

            <div className="input-group">
              <label className="input-label">¿Deseas solicitar la liberación de comisión ahora? *</label>
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                {(['si', 'no'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...register('solicitaLiberacion')} value={v} />
                    {v === 'si' ? 'Sí — crear solicitud de pago' : 'No — solo registrar cierre'}
                  </label>
                ))}
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Observaciones</label>
              <textarea {...register('observaciones')} className="input" rows={3} placeholder="Notas adicionales sobre este cierre..." style={{ resize: 'vertical', minHeight: 72 }} />
            </div>

            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12, color: '#166534' }}>
              Al registrar, el motor de comisiones calculará automáticamente: gratificación por invitación (2.5%), base del asesor según AMA, y descuento de mentoría si aplica.
            </div>
          </div>

          {/* ─── Acciones ─── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 32 }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/operations')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || uploading}>
              {isSubmitting ? 'Registrando cierre...' : uploading ? 'Subiendo documentos...' : 'Registrar Cierre y Calcular Comisión'}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
