'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api, propertiesApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Home, AlertCircle, CheckCircle } from 'lucide-react';
import {
  zNombre, zEmailOpcional, zTelefono, zTelefonoOpcional, zNombreOpcional,
  MAX_MONTO, MAX_TEXTO_LARGO, soloDigitos,
} from '@/lib/validators';
import { notify } from '@/lib/toast';
import { notifyFormErrors } from '@/lib/upload';

/* ─── Piezas numéricas ─── */
const zNumOpcional = (max: number, msg = 'Ingresa un monto válido.') =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: msg })
      .nonnegative('No puede ser negativo.')
      .max(max, 'Excede el máximo permitido.')
      .optional(),
  );

/* ─── Schema ─── */
const schema = z.object({
  idPropiedad:              z.string().min(1, 'Selecciona una propiedad'),
  precioRentaAcordada:      z.coerce.number({ message: 'Ingresa un monto válido.' })
    .positive('Ingresa el monto acordado.')
    .max(MAX_MONTO, 'El monto excede el máximo permitido.')
    .refine((v) => Math.round(v * 100) === v * 100, 'Máximo 2 decimales.'),
  fechaEstimadaFirma:       z.string().min(1, 'Fecha de firma requerida')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida.'),
  condicionesEspeciales:    z.string().trim().max(MAX_TEXTO_LARGO).optional().or(z.literal('')),
  observacionesJuridico:    z.string().trim().max(MAX_TEXTO_LARGO).optional().or(z.literal('')),
  // Comprador / Arrendatario
  clienteTipo:              z.enum(['Persona física', 'Persona moral']),
  clienteNombre:            zNombre,
  clienteTelefono:          zTelefono,
  clienteCorreo:            zEmailOpcional,
  clienteEstadoCivil:       z.string().optional().or(z.literal('')),
  // Compraventa optional fields
  fpContado:                z.boolean().optional(),
  fpCredito:                z.boolean().optional(),
  fpInfonavit:              z.boolean().optional(),
  fpFovissste:              z.boolean().optional(),
  fpCofinavit:              z.boolean().optional(),
  fpCombinado:              z.boolean().optional(),
  montoApartado:            zNumOpcional(MAX_MONTO),
  fechaEstimadaEscritura:   z.string().optional().or(z.literal('')),
  // Arrendamiento optional fields
  fechaInicioContrato:      z.string().optional().or(z.literal('')),
  fechaEntregaInmueble:     z.string().optional().or(z.literal('')),
  vigencia:                 z.string().optional().or(z.literal('')),
  depositoGarantia:         zNumOpcional(MAX_MONTO),
  primerPagoRenta:          zNumOpcional(MAX_MONTO),
  formaPagoRenta:           z.string().optional().or(z.literal('')),
  diaPagoMensual:           z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: 'Ingresa un día válido.' })
      .int('Debe ser un número entero.')
      .min(1, 'El día debe estar entre 1 y 31.')
      .max(31, 'El día debe estar entre 1 y 31.')
      .optional(),
  ),
  incluyeMantenimiento:     z.boolean().optional(),
  srvAgua:                  z.boolean().optional(),
  srvLuz:                   z.boolean().optional(),
  srvGas:                   z.boolean().optional(),
  srvInternet:              z.boolean().optional(),
  permiteMascotas:          z.boolean().optional(),
  entregaAmueblado:         z.boolean().optional(),
  observacionesAcuerdos:    z.string().optional().or(z.literal('')),
  // Comprador campos adicionales
  clienteRegimenPatrimonial: z.string().optional().or(z.literal('')),
  clienteNombreConyuge:      z.string().optional().or(z.literal('')),
  // Section 3 - Documentación vendedor/arrendador
  docsVendedorCompletos:    z.string().optional().or(z.literal('')),
  docFaltanteActaNacimiento: z.boolean().optional(),
  docFaltanteActaMatrimonio: z.boolean().optional(),
  docFaltanteIneConyugue:    z.boolean().optional(),
  docFaltanteCurp:           z.boolean().optional(),
  docFaltanteRfc:            z.boolean().optional(),
  docFaltantePredial:        z.boolean().optional(),
  docFaltanteAgua:           z.boolean().optional(),
  docFaltanteOtro:           z.boolean().optional(),
  // Section 5 - Documentación comprador/arrendatario
  docsCompradorCompletos:   z.string().optional().or(z.literal('')),
  docComprFaltanteIne:      z.boolean().optional(),
  docComprFaltanteCurp:     z.boolean().optional(),
  docComprFaltanteRfc:      z.boolean().optional(),
  docComprFaltanteActaMatrimonio: z.boolean().optional(),
  docComprFaltanteActaConstitutiva: z.boolean().optional(),
  docComprFaltantePoder:    z.boolean().optional(),
  docComprFaltanteIneRep:   z.boolean().optional(),
  // Section 6 arrendamiento - Aval
  requiereAval:             z.boolean().optional(),
  tipoAval:                 z.string().optional().or(z.literal('')),
  nombreAval:               zNombreOpcional,
  telefonoAval:             zTelefonoOpcional,
  correoAval:               zEmailOpcional,
  // Section 6 - Participación de asesores
  repVendedorTipo:             z.string().optional().or(z.literal('')),
  asesorInternoVendedor:       z.string().optional().or(z.literal('')),
  nombreExternoVendedor:       zNombreOpcional,
  telefonoExternoVendedor:     zTelefonoOpcional,
  correoExternoVendedor:       zEmailOpcional,
  inmobiliariaExternaVendedor: z.string().optional().or(z.literal('')),
  repCompradorTipo:            z.string().optional().or(z.literal('')),
  asesorInternoComprador:      z.string().optional().or(z.literal('')),
  nombreExternoComprador:      zNombreOpcional,
  telefonoExternoComprador:    zTelefonoOpcional,
  correoExternoComprador:      zEmailOpcional,
  inmobiliariaExternaComprador: z.string().optional().or(z.literal('')),
  // Section 7 - Comisiones
  comisionPactadaPct:          z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number({ message: 'Ingresa un porcentaje válido.' })
      .nonnegative('No puede ser negativo.')
      .max(100, 'El porcentaje no puede ser mayor a 100.')
      .optional(),
  ),
  comisionPactadaMonto:        zNumOpcional(MAX_MONTO),
  existeComisionCompartida:    z.boolean().optional(),
  detalleComisionCompartida:   z.string().optional().or(z.literal('')),
  precioFinalAcordado:         zNumOpcional(MAX_MONTO),
  // Confirmation
  confirmacion: z.literal(true, { error: () => ({ message: 'Debes confirmar que la información es correcta' }) }),
});

type FormData = z.infer<typeof schema>;
type TipoSolicitud = 'Promesa compraventa' | 'Contrato arrendamiento';

/* ─── Helpers ─── */
function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <span style={{ fontSize: 11.5, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
      <AlertCircle size={11} />{msg}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 13, fontWeight: 700, color: 'var(--color-primary)',
      borderBottom: '1px solid var(--color-surface-variant)',
      paddingBottom: 8, marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

/* ─── Page ─── */
export default function NewContractPage() {
  const router = useRouter();
  const [tipoSolicitud, setTipoSolicitud] = useState<TipoSolicitud | null>(null);
  const [success, setSuccess]             = useState(false);

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => propertiesApi.getAll().then(r => r.data?.data ?? r.data ?? []),
  });
  const properties: any[] = Array.isArray(propertiesData) ? propertiesData : [];

  const { data: advisorsData } = useQuery({
    queryKey: ['advisors'],
    queryFn: () => api.get('/advisors').then(r => r.data?.data ?? r.data ?? []),
  });
  const advisors: any[] = Array.isArray(advisorsData) ? advisorsData : [];

  const {
    register, handleSubmit, control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      clienteTipo: 'Persona física',
    },
  });

  const clienteTipo              = useWatch({ control, name: 'clienteTipo' });
  const repVendedorTipo          = useWatch({ control, name: 'repVendedorTipo' });
  const repCompradorTipo         = useWatch({ control, name: 'repCompradorTipo' });
  const existeComisionCompartida = useWatch({ control, name: 'existeComisionCompartida' });
  const docsVendedorCompletos    = useWatch({ control, name: 'docsVendedorCompletos' });
  const docsCompradorCompletos   = useWatch({ control, name: 'docsCompradorCompletos' });
  const requiereAval             = useWatch({ control, name: 'requiereAval' });
  const clienteEstadoCivil       = useWatch({ control, name: 'clienteEstadoCivil' });
  const incluyeMantenimiento     = useWatch({ control, name: 'incluyeMantenimiento' });

  const onSubmit = async (data: FormData) => {
    // Manual validation for conditional required fields
    if (tipoSolicitud === 'Contrato arrendamiento') {
      if (!data.fechaInicioContrato) { notify.error('La fecha de inicio del contrato es requerida'); return; }
      if (!data.vigencia)             { notify.error('La vigencia del contrato es requerida'); return; }
      if (!data.depositoGarantia)     { notify.error('El depósito en garantía es requerido'); return; }
      if (!data.diaPagoMensual)       { notify.error('El día de pago mensual es requerido'); return; }
    }

    try {
      const formasPago = tipoSolicitud === 'Promesa compraventa'
        ? [
            data.fpContado    && 'Contado',
            data.fpCredito    && 'Crédito bancario',
            data.fpInfonavit  && 'Infonavit',
            data.fpFovissste  && 'Fovissste',
            data.fpCofinavit  && 'Cofinavit',
            data.fpCombinado  && 'Combinado',
          ].filter(Boolean)
        : [];

      // Build docs faltantes strings
      const docsVendFaltantes = [
        data.docFaltanteActaNacimiento && 'Acta de nacimiento',
        data.docFaltanteActaMatrimonio && 'Acta de matrimonio',
        data.docFaltanteIneConyugue    && 'INE del cónyuge',
        data.docFaltanteCurp           && 'CURP',
        data.docFaltanteRfc            && 'RFC / Constancia',
        data.docFaltantePredial        && 'Predial vigente',
        data.docFaltanteAgua           && 'Recibo de agua',
        data.docFaltanteOtro           && 'Otro',
      ].filter(Boolean).join(', ');

      const docsComprFaltantes = [
        data.docComprFaltanteIne              && 'INE vigente',
        data.docComprFaltanteCurp             && 'CURP',
        data.docComprFaltanteRfc              && 'RFC / Constancia',
        data.docComprFaltanteActaMatrimonio   && 'Acta de matrimonio',
        data.docComprFaltanteActaConstitutiva && 'Acta constitutiva',
        data.docComprFaltantePoder            && 'Poder del representante legal',
        data.docComprFaltanteIneRep           && 'INE del representante legal',
      ].filter(Boolean).join(', ');

      await api.post('/contracts', {
        tipo_solicitud:                    tipoSolicitud,
        id_propiedad:                      data.idPropiedad,
        precio_renta_acordada:             data.precioRentaAcordada,
        fecha_estimada_firma:              data.fechaEstimadaFirma,
        condiciones_especiales:            data.condicionesEspeciales ?? '',
        observaciones_juridico:            data.observacionesJuridico ?? '',
        cliente_tipo:                      data.clienteTipo,
        cliente_nombre:                    data.clienteNombre,
        cliente_telefono:                  data.clienteTelefono,
        cliente_correo:                    data.clienteCorreo ?? '',
        cliente_estado_civil:              data.clienteTipo === 'Persona física' ? (data.clienteEstadoCivil ?? '') : '',
        cliente_regimen_patrimonial:       data.clienteRegimenPatrimonial ?? '',
        cliente_nombre_conyuge:            data.clienteNombreConyuge ?? '',
        // Compraventa — el backend espera texto, no arreglo
        formas_pago:                       formasPago.join(', '),
        monto_apartado:                    data.montoApartado ?? null,
        fecha_estimada_escritura:          data.fechaEstimadaEscritura ?? '',
        // Arrendamiento
        fecha_inicio_contrato:             data.fechaInicioContrato ?? '',
        fecha_entrega_inmueble:            data.fechaEntregaInmueble ?? '',
        vigencia:                          data.vigencia ?? '',
        deposito_garantia:                 data.depositoGarantia ?? null,
        primer_pago_renta:                 data.primerPagoRenta ?? null,
        forma_pago_renta:                  data.formaPagoRenta ?? '',
        dia_pago_mensual:                  data.diaPagoMensual ?? null,
        incluye_mantenimiento:             data.incluyeMantenimiento ?? false,
        servicios_incluidos:               [data.srvAgua && 'Agua', data.srvLuz && 'Luz', data.srvGas && 'Gas', data.srvInternet && 'Internet'].filter(Boolean).join(', '),
        permite_mascotas:                  data.permiteMascotas ?? false,
        entrega_amueblado:                 data.entregaAmueblado ?? false,
        observaciones_acuerdos:            data.observacionesAcuerdos ?? '',
        // Docs vendedor (Sec 3)
        docs_vendedor_completos:           data.docsVendedorCompletos ?? 'no',
        docs_vendedor_faltantes:           docsVendFaltantes,
        // Docs comprador (Sec 5)
        docs_comprador_completos:          data.docsCompradorCompletos ?? 'no',
        docs_comprador_faltantes:          docsComprFaltantes,
        // Aval (Sec 6 arrendamiento)
        requiere_aval:                     data.requiereAval ?? false,
        tipo_aval:                         data.tipoAval ?? '',
        nombre_aval:                       data.nombreAval ?? '',
        telefono_aval:                     data.telefonoAval ?? '',
        correo_aval:                       data.correoAval ?? '',
        // Asesores
        rep_vendedor_tipo:                 data.repVendedorTipo ?? '',
        asesor_interno_vendedor:           data.asesorInternoVendedor ?? '',
        nombre_externo_vendedor:           data.nombreExternoVendedor ?? '',
        telefono_externo_vendedor:         data.telefonoExternoVendedor ?? '',
        correo_externo_vendedor:           data.correoExternoVendedor ?? '',
        inmobiliaria_externa_vendedor:     data.inmobiliariaExternaVendedor ?? '',
        rep_comprador_tipo:                data.repCompradorTipo ?? '',
        asesor_interno_comprador:          data.asesorInternoComprador ?? '',
        nombre_externo_comprador:          data.nombreExternoComprador ?? '',
        telefono_externo_comprador:        data.telefonoExternoComprador ?? '',
        correo_externo_comprador:          data.correoExternoComprador ?? '',
        inmobiliaria_externa_comprador:    data.inmobiliariaExternaComprador ?? '',
        // Comisiones
        comision_pactada_pct:              data.comisionPactadaPct ?? 0,
        comision_pactada_monto:            data.comisionPactadaMonto ?? 0,
        existe_comision_compartida:        data.existeComisionCompartida ?? false,
        detalle_comision_compartida:       data.detalleComisionCompartida ?? '',
        precio_final_acordado:             data.precioFinalAcordado ?? 0,
      });

      setSuccess(true);
      notify.success('Solicitud de contrato enviada correctamente.');
      setTimeout(() => router.push('/contracts'), 2500);
    } catch {
      // El error se muestra como toast flotante global (interceptor de axios).
    }
  };

  /* ─── Success screen ─── */
  if (success) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in" style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="card" style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle size={30} color="#059669" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6 }}>
              Solicitud Enviada
            </h2>
            <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)' }}>
              La solicitud de contrato fue enviada al área jurídica. Redirigiendo…
            </p>
          </div>
        </div>
      </>
    );
  }

  /* ─── Step 1: Tipo selection ─── */
  if (!tipoSolicitud) {
    return (
      <>
        <Header />
        <div className="page-content animate-fade-in" style={{ maxWidth: 700, margin: '0 auto' }}>
          <button
            onClick={() => router.push('/contracts')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}
          >
            <ArrowLeft size={14} /> Volver a contratos
          </button>

          <div className="page-header" style={{ marginBottom: 28 }}>
            <div>
              <h1 className="page-title">Nueva Solicitud de Contrato</h1>
              <p className="page-desc">Selecciona el tipo de contrato a solicitar</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Compraventa card */}
            <button
              onClick={() => setTipoSolicitud('Promesa compraventa')}
              style={{
                background: 'var(--color-surface)', border: '2px solid var(--color-surface-variant)',
                borderRadius: 'var(--radius-lg)', padding: '32px 24px', cursor: 'pointer',
                textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: 'var(--shadow-md)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-surface-variant)'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <FileText size={22} color="#fff" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                Promesa de Compraventa
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                Solicitar contrato para operación de compraventa
              </div>
            </button>

            {/* Arrendamiento card */}
            <button
              onClick={() => setTipoSolicitud('Contrato arrendamiento')}
              style={{
                background: 'var(--color-surface)', border: '2px solid var(--color-surface-variant)',
                borderRadius: 'var(--radius-lg)', padding: '32px 24px', cursor: 'pointer',
                textAlign: 'left', transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: 'var(--shadow-md)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-secondary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-surface-variant)'; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Home size={22} color="#fff" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>
                Contrato de Arrendamiento
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                Solicitar contrato para operación de renta
              </div>
            </button>
          </div>
        </div>
      </>
    );
  }

  /* ─── Step 2: Form ─── */
  const isCompraventa   = tipoSolicitud === 'Promesa compraventa';
  const isArrendamiento = tipoSolicitud === 'Contrato arrendamiento';

  // El contrato de compraventa solo aplica a propiedades en Venta; el de
  // arrendamiento solo a las de Renta. Se filtra el selector por tipo_operacion.
  const tipoOperacionEsperado = isCompraventa ? 'Venta' : 'Renta';
  const propertiesFiltradas = properties.filter(
    (p: any) => (p.tipo_operacion ?? p.tipoOperacion) === tipoOperacionEsperado,
  );

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>

        <button
          onClick={() => setTipoSolicitud(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--color-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> Cambiar tipo de contrato
        </button>

        <div className="page-header" style={{ marginBottom: 24 }}>
          <div>
            <h1 className="page-title">
              {isCompraventa ? 'Promesa de Compraventa' : 'Contrato de Arrendamiento'}
            </h1>
            <p className="page-desc">Completa los datos para solicitar el contrato al área jurídica</p>
          </div>
        </div>


        <form onSubmit={handleSubmit(onSubmit, notifyFormErrors)} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ─── Datos generales ─── */}
          <div className="card">
            <SectionTitle>Datos Generales de la Operación</SectionTitle>

            <div className="input-group">
              <label className="input-label">Propiedad *</label>
              <select {...register('idPropiedad')} className="select">
                <option value="">— Seleccionar propiedad —</option>
                {propertiesFiltradas.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.address ?? p.title ?? p.nombre} ({p.city ?? p.ciudad ?? '—'})
                  </option>
                ))}
              </select>
              {propertiesFiltradas.length === 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', display: 'block', marginTop: 4 }}>
                  No hay propiedades en {isCompraventa ? 'venta' : 'renta'} disponibles.
                </span>
              )}
              <Err msg={errors.idPropiedad?.message} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div className="input-group">
                <label className="input-label">
                  {isCompraventa ? 'Precio final acordado ($)' : 'Renta mensual acordada ($)'} *
                </label>
                <input {...register('precioRentaAcordada')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="0" />
                <Err msg={errors.precioRentaAcordada?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Fecha estimada de firma *</label>
                <input {...register('fechaEstimadaFirma')} type="date" className="input" />
                <Err msg={errors.fechaEstimadaFirma?.message} />
              </div>
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Condiciones especiales</label>
              <textarea {...register('condicionesEspeciales')} className="input" rows={3} placeholder="Condiciones especiales acordadas entre las partes…" style={{ resize: 'vertical', minHeight: 68 }} />
            </div>

            <div className="input-group" style={{ marginTop: 14 }}>
              <label className="input-label">Observaciones para jurídico</label>
              <textarea {...register('observacionesJuridico')} className="input" rows={3} placeholder="Indicaciones específicas para el área jurídica…" style={{ resize: 'vertical', minHeight: 68 }} />
            </div>
          </div>

          {/* ─── Sec 3: Documentación del vendedor / arrendador ─── */}
          <div className="card">
            <SectionTitle>
              {isCompraventa ? 'Documentación del Vendedor' : 'Documentación del Arrendador'}
            </SectionTitle>

            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">
                ¿Se cuenta con documentación completa del {isCompraventa ? 'vendedor' : 'arrendador'}? *
              </label>
              <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                {(['sí', 'no', 'parcial'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                    <input type="radio" {...(register as any)('docsVendedorCompletos')} value={v} />
                    {v === 'sí' ? 'Sí, completa' : v === 'no' ? 'No' : 'Parcial'}
                  </label>
                ))}
              </div>
            </div>

            {(docsVendedorCompletos === 'no' || docsVendedorCompletos === 'parcial') && (
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                  Documentación faltante (marcar los que faltan)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {([
                    { name: 'docFaltanteActaNacimiento', label: 'Acta de nacimiento' },
                    { name: 'docFaltanteActaMatrimonio', label: 'Acta de matrimonio' },
                    { name: 'docFaltanteIneConyugue',    label: 'INE del cónyuge' },
                    { name: 'docFaltanteCurp',           label: 'CURP' },
                    { name: 'docFaltanteRfc',            label: 'RFC / Constancia de situación fiscal' },
                    { name: 'docFaltantePredial',        label: 'Predial vigente' },
                    { name: 'docFaltanteAgua',           label: 'Recibo de agua' },
                    { name: 'docFaltanteOtro',           label: 'Otro' },
                  ] as { name: any; label: string }[]).map(d => (
                    <label key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 10px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                      <input type="checkbox" {...register(d.name)} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── COMPRAVENTA: campos extra ─── */}
          {isCompraventa && (
            <div className="card">
              <SectionTitle>Datos de Compraventa</SectionTitle>

              <div style={{ marginBottom: 14 }}>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Forma de pago</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {([
                    { name: 'fpContado',   label: 'Contado' },
                    { name: 'fpCredito',   label: 'Crédito bancario' },
                    { name: 'fpInfonavit', label: 'Infonavit' },
                    { name: 'fpFovissste', label: 'Fovissste' },
                    { name: 'fpCofinavit', label: 'Cofinavit' },
                    { name: 'fpCombinado', label: 'Combinado' },
                  ] as { name: any; label: string }[]).map(fp => (
                    <label key={fp.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '8px 10px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                      <input type="checkbox" {...register(fp.name)} />
                      {fp.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="input-group">
                  <label className="input-label">Monto de apartado ($)</label>
                  <input {...register('montoApartado')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="Opcional" />
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha estimada de escrituración</label>
                  <input {...register('fechaEstimadaEscritura')} type="date" className="input" />
                </div>
              </div>
            </div>
          )}

          {/* ─── ARRENDAMIENTO: campos extra ─── */}
          {isArrendamiento && (
            <div className="card">
              <SectionTitle>Condiciones de Arrendamiento</SectionTitle>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="input-group">
                  <label className="input-label">Fecha inicio contrato *</label>
                  <input {...register('fechaInicioContrato')} type="date" className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Fecha de entrega del inmueble *</label>
                  <input {...register('fechaEntregaInmueble')} type="date" className="input" />
                </div>
                <div className="input-group">
                  <label className="input-label">Vigencia *</label>
                  <select {...register('vigencia')} className="select">
                    <option value="">— Seleccionar —</option>
                    <option value="12 meses">12 meses</option>
                    <option value="24 meses">24 meses</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Depósito en garantía ($) *</label>
                  <input {...register('depositoGarantia')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Primer pago de renta ($)</label>
                  <input {...register('primerPagoRenta')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="0" />
                </div>
                <div className="input-group">
                  <label className="input-label">Forma de pago de renta</label>
                  <select {...register('formaPagoRenta')} className="select">
                    <option value="">— Seleccionar —</option>
                    <option value="Transferencia bancaria">Transferencia bancaria</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Depósito bancario">Depósito bancario</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Día de pago mensual (1–31) *</label>
                  <input {...register('diaPagoMensual')} type="number" className="input" min={1} max={31} placeholder="1" />
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
                {([
                  { name: 'incluyeMantenimiento', label: '¿Incluye cuota de mantenimiento?' },
                  { name: 'permiteMascotas',       label: '¿Se permiten mascotas?' },
                  { name: 'entregaAmueblado',      label: '¿El inmueble se entrega amueblado?' },
                ] as { name: any; label: string }[]).map(f => (
                  <label key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '8px 12px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', minWidth: 220 }}>
                    <input type="checkbox" {...register(f.name)} />
                    {f.label}
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Servicios incluidos en renta</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {([
                    { name: 'srvAgua',     label: 'Agua' },
                    { name: 'srvLuz',      label: 'Luz' },
                    { name: 'srvGas',      label: 'Gas' },
                    { name: 'srvInternet', label: 'Internet' },
                  ] as { name: any; label: string }[]).map(s => (
                    <label key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer', padding: '7px 12px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                      <input type="checkbox" {...register(s.name)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="input-group" style={{ marginTop: 14 }}>
                <label className="input-label">Observaciones o acuerdos especiales</label>
                <textarea {...register('observacionesAcuerdos')} className="input" rows={3} placeholder="Condiciones adicionales acordadas entre las partes…" style={{ resize: 'vertical', minHeight: 68 }} />
              </div>
            </div>
          )}

          {/* ─── Comprador / Arrendatario ─── */}
          <div className="card">
            <SectionTitle>
              {isCompraventa ? 'Datos del Comprador' : 'Datos del Arrendatario'}
            </SectionTitle>

            <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
              {(['Persona física', 'Persona moral'] as const).map(tipo => (
                <label key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                  <input type="radio" {...register('clienteTipo')} value={tipo} />
                  {tipo}
                </label>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label className="input-label">
                  {clienteTipo === 'Persona moral' ? 'Razón social' : 'Nombre completo'} *
                </label>
                <input {...register('clienteNombre')} className="input" placeholder={clienteTipo === 'Persona moral' ? 'Razón social' : 'Nombre completo'} />
                <Err msg={errors.clienteNombre?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Teléfono *</label>
                <input {...register('clienteTelefono')} className="input" placeholder="10 dígitos"
                  inputMode="numeric" maxLength={10}
                  onInput={(e) => { e.currentTarget.value = soloDigitos(e.currentTarget.value, 10); }} />
                <Err msg={errors.clienteTelefono?.message} />
              </div>
              <div className="input-group">
                <label className="input-label">Correo electrónico</label>
                <input {...register('clienteCorreo')} type="email" className="input" placeholder="correo@ejemplo.com" />
              </div>
              {clienteTipo === 'Persona física' && (
                <div className="input-group">
                  <label className="input-label">Estado civil</label>
                  <select {...register('clienteEstadoCivil')} className="select">
                    <option value="">— Seleccionar —</option>
                    <option value="Soltero(a)">Soltero(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viudo(a)">Viudo(a)</option>
                    <option value="Unión libre">Unión libre</option>
                  </select>
                </div>
              )}
              {clienteTipo === 'Persona física' && clienteEstadoCivil === 'Casado(a)' && (
                <>
                  <div className="input-group">
                    <label className="input-label">Régimen patrimonial</label>
                    <select {...register('clienteRegimenPatrimonial')} className="select">
                      <option value="">— Seleccionar —</option>
                      <option value="Sociedad conyugal">Sociedad conyugal</option>
                      <option value="Separación de bienes">Separación de bienes</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Nombre del cónyuge</label>
                    <input {...register('clienteNombreConyuge')} className="input" placeholder="Nombre completo" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── Sec 5: Documentación del comprador / arrendatario ─── */}
          <div className="card">
            <SectionTitle>
              {isCompraventa ? 'Documentos del Comprador' : 'Documentos del Arrendatario'}
            </SectionTitle>

            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">
                ¿Se cuenta con documentación completa del {isCompraventa ? 'comprador' : 'arrendatario'}? *
              </label>
              <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                {(['sí', 'no', 'parcial'] as const).map(v => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                    <input type="radio" {...(register as any)('docsCompradorCompletos')} value={v} />
                    {v === 'sí' ? 'Sí, completa' : v === 'no' ? 'No' : 'Parcial'}
                  </label>
                ))}
              </div>
            </div>

            {(docsCompradorCompletos === 'no' || docsCompradorCompletos === 'parcial') && (
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                  Documentación faltante (marcar los que faltan)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {([
                    { name: 'docComprFaltanteIne',              label: 'INE vigente' },
                    { name: 'docComprFaltanteCurp',             label: 'CURP' },
                    { name: 'docComprFaltanteRfc',              label: 'RFC / Constancia de situación fiscal' },
                    { name: 'docComprFaltanteActaMatrimonio',   label: 'Acta de matrimonio' },
                    ...(clienteTipo === 'Persona moral' ? [
                      { name: 'docComprFaltanteActaConstitutiva', label: 'Acta constitutiva' },
                      { name: 'docComprFaltantePoder',            label: 'Poder del representante legal' },
                      { name: 'docComprFaltanteIneRep',           label: 'INE del representante legal' },
                    ] : []),
                  ] as { name: any; label: string }[]).map(d => (
                    <label key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '7px 10px', background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)' }}>
                      <input type="checkbox" {...register(d.name)} />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── Sec 6 Arrendamiento: Aval u obligado solidario ─── */}
          {isArrendamiento && (
            <div className="card">
              <SectionTitle>Aval u Obligado Solidario</SectionTitle>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
                <input type="checkbox" {...register('requiereAval')} />
                <span style={{ fontSize: 13 }}>¿El contrato requiere aval u obligado solidario?</span>
              </label>

              {requiereAval && (
                <div>
                  <div className="input-group" style={{ marginBottom: 14 }}>
                    <label className="input-label">Tipo *</label>
                    <select {...register('tipoAval')} className="select">
                      <option value="">— Seleccionar —</option>
                      <option value="Aval">Aval</option>
                      <option value="Obligado solidario">Obligado solidario</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="input-group">
                      <label className="input-label">Nombre completo *</label>
                      <input {...register('nombreAval')} className="input" placeholder="Nombre completo del aval" />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Teléfono</label>
                      <input {...register('telefonoAval')} className="input" placeholder="10 dígitos"
                  inputMode="numeric" maxLength={10}
                  onInput={(e) => { e.currentTarget.value = soloDigitos(e.currentTarget.value, 10); }} />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Correo electrónico</label>
                      <input {...register('correoAval')} type="email" className="input" placeholder="correo@ejemplo.com" />
                    </div>
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef9c3', borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#854d0e' }}>
                    Los documentos del aval (INE, comprobante domicilio, CURP, RFC) se adjuntan en la sección de expedientes del contrato.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Participación de Asesores ─── */}
          <div className="card">
            <SectionTitle>Participación de Asesores</SectionTitle>

            {/* Vendedor / Arrendador */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Parte {isCompraventa ? 'vendedora' : 'arrendadora'}
              </div>
              <div className="input-group">
                <label className="input-label">
                  ¿Quién representó al {isCompraventa ? 'vendedor' : 'arrendador'}?
                </label>
                <select {...register('repVendedorTipo')} className="select">
                  <option value="">— Seleccionar —</option>
                  <option value="Yo mismo">Yo mismo</option>
                  <option value="Otro asesor de Idea Uno">Otro asesor de Idea Uno</option>
                  <option value="Asesor externo">Asesor externo</option>
                  <option value="Cliente directo">Cliente directo</option>
                </select>
              </div>
              {repVendedorTipo === 'Otro asesor de Idea Uno' && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  <label className="input-label">Asesor de Idea Uno</label>
                  <select {...register('asesorInternoVendedor')} className="select">
                    <option value="">— Seleccionar asesor —</option>
                    {advisors.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {repVendedorTipo === 'Asesor externo' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div className="input-group">
                    <label className="input-label">Nombre del asesor externo</label>
                    <input {...register('nombreExternoVendedor')} className="input" placeholder="Nombre completo" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Teléfono</label>
                    <input {...register('telefonoExternoVendedor')} className="input" placeholder="10 dígitos"
                  inputMode="numeric" maxLength={10}
                  onInput={(e) => { e.currentTarget.value = soloDigitos(e.currentTarget.value, 10); }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Correo</label>
                    <input {...register('correoExternoVendedor')} type="email" className="input" placeholder="correo@ejemplo.com" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Inmobiliaria</label>
                    <input {...register('inmobiliariaExternaVendedor')} className="input" placeholder="Nombre de la inmobiliaria" />
                  </div>
                </div>
              )}
            </div>

            {/* Comprador / Arrendatario */}
            <div style={{ borderTop: '1px solid var(--color-surface-variant)', paddingTop: 20 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Parte {isCompraventa ? 'compradora' : 'arrendataria'}
              </div>
              <div className="input-group">
                <label className="input-label">
                  ¿Quién representó al {isCompraventa ? 'comprador' : 'arrendatario'}?
                </label>
                <select {...register('repCompradorTipo')} className="select">
                  <option value="">— Seleccionar —</option>
                  <option value="Yo mismo">Yo mismo</option>
                  <option value="Otro asesor de Idea Uno">Otro asesor de Idea Uno</option>
                  <option value="Asesor externo">Asesor externo</option>
                  <option value="Cliente directo">Cliente directo</option>
                </select>
              </div>
              {repCompradorTipo === 'Otro asesor de Idea Uno' && (
                <div className="input-group" style={{ marginTop: 12 }}>
                  <label className="input-label">Asesor de Idea Uno</label>
                  <select {...register('asesorInternoComprador')} className="select">
                    <option value="">— Seleccionar asesor —</option>
                    {advisors.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {repCompradorTipo === 'Asesor externo' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div className="input-group">
                    <label className="input-label">Nombre del asesor externo</label>
                    <input {...register('nombreExternoComprador')} className="input" placeholder="Nombre completo" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Teléfono</label>
                    <input {...register('telefonoExternoComprador')} className="input" placeholder="10 dígitos"
                  inputMode="numeric" maxLength={10}
                  onInput={(e) => { e.currentTarget.value = soloDigitos(e.currentTarget.value, 10); }} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Correo</label>
                    <input {...register('correoExternoComprador')} type="email" className="input" placeholder="correo@ejemplo.com" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Inmobiliaria</label>
                    <input {...register('inmobiliariaExternaComprador')} className="input" placeholder="Nombre de la inmobiliaria" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Comisiones ─── */}
          <div className="card">
            <SectionTitle>Comisiones</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="input-group">
                <label className="input-label">Precio/Renta final acordado ($)</label>
                <input {...register('precioFinalAcordado')} type="number" min={0} step="0.01" inputMode="decimal" className="input" placeholder="0" />
              </div>
              <div className="input-group">
                <label className="input-label">Comisión pactada (%)</label>
                <input {...register('comisionPactadaPct')} type="number" min={0} max={100} step={0.01} inputMode="decimal" className="input" placeholder="0.00" />
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14 }}>
              <input type="checkbox" {...register('existeComisionCompartida')} />
              <span style={{ fontSize: 13 }}>¿Existe comisión compartida con otra parte?</span>
            </label>

            {existeComisionCompartida && (
              <div className="input-group">
                <label className="input-label">Describe el acuerdo de comisión compartida</label>
                <textarea
                  {...register('detalleComisionCompartida')}
                  className="input"
                  rows={3}
                  placeholder="Detalla el acuerdo de comisión compartida…"
                  style={{ resize: 'vertical', minHeight: 68 }}
                />
              </div>
            )}
          </div>

          {/* ─── Confirmación ─── */}
          <div className="card">
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" {...register('confirmacion')} style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13 }}>
                Confirmo que la información proporcionada es correcta y que cuento con el acuerdo de las partes para proceder con la elaboración del contrato.
              </span>
            </label>
            <Err msg={(errors.confirmacion as any)?.message} />
          </div>

          {/* ─── Acciones ─── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingBottom: 32 }}>
            <button type="button" className="btn btn-secondary" onClick={() => router.push('/contracts')}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando solicitud…' : 'Enviar Solicitud al Jurídico'}
            </button>
          </div>

        </form>
      </div>
    </>
  );
}
