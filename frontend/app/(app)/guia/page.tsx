'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { useAuthStore } from '@/store/auth.store';
import {
  BookOpen, Search, ArrowRight, ChevronDown, Unlock, Lock, Building2, Home,
  ClipboardList, DollarSign, Wallet, ScrollText, Users, UserCheck, ShieldCheck,
  FolderOpen, History, Settings, LayoutDashboard, HelpCircle, Map, ListChecks,
  Tag, Sparkles, PlayCircle, ChevronRight,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────────
//  Datos del manual — un solo lugar para editar todo el contenido
// ──────────────────────────────────────────────────────────────────────────────

type Role = 'Super Admin' | 'Admin' | 'Asesor' | 'Jurídico';

interface ModuleItem {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
  href: string;
  roles?: Role[];
  color: string;
  bg: string;
}

const MODULES: ModuleItem[] = [
  { id: 'dashboard', label: 'Dashboard', desc: 'Vista general: KPIs, gráficas, rankings y cumpleaños. Los administradores también pueden ver el “Mi Dashboard” de cualquier asesor.', icon: LayoutDashboard, href: '/dashboard', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'properties', label: 'Propiedades en Venta', desc: 'Inventario de captaciones en venta con su estatus, precio y expediente.', icon: Building2, href: '/properties', color: '#1e40af', bg: '#dbeafe' },
  { id: 'rentals', label: 'Propiedades en Renta', desc: 'Inventario de captaciones en renta.', icon: Home, href: '/rentals', color: '#7c3aed', bg: '#ede9fe' },
  { id: 'operations', label: 'Cierres', desc: 'Operaciones de venta/renta cerradas. Aquí nace cada comisión.', icon: ClipboardList, href: '/operations', color: '#006c49', bg: '#d1fae5' },
  { id: 'commissions', label: 'Comisiones', desc: 'Motor de cálculo automático. Aquí se liberan, bloquean y desbloquean las comisiones.', icon: DollarSign, href: '/commissions', color: '#c2410c', bg: '#ffedd5' },
  { id: 'payments', label: 'Pagos', desc: 'Solicitud, autorización y registro del pago de comisiones liberadas.', icon: Wallet, href: '/payments', color: '#006c49', bg: '#d1fae5' },
  { id: 'contracts', label: 'Contratos', desc: 'Solicitudes al área jurídica y generación de contratos.', icon: ScrollText, href: '/contracts', roles: ['Super Admin', 'Admin', 'Jurídico'], color: '#1e40af', bg: '#dbeafe' },
  { id: 'advisors', label: 'Asesores', desc: 'Alta y gestión de asesores: datos, estatus, mentoría, bancarios y AMA.', icon: Users, href: '/advisors', color: '#78350f', bg: '#fef3c7' },
  { id: 'clients', label: 'Clientes', desc: 'Directorio de clientes y su expediente KYC.', icon: UserCheck, href: '/clients', color: '#1e40af', bg: '#dbeafe' },
  { id: 'compliance', label: 'Cumplimiento PLD', desc: 'Prevención de lavado de dinero: casos, alertas y verificación de expedientes.', icon: ShieldCheck, href: '/compliance', roles: ['Super Admin', 'Admin'], color: '#991b1b', bg: '#fee2e2' },
  { id: 'templates', label: 'Plantillas y Contratos', desc: 'Biblioteca de plantillas descargables por categoría.', icon: FolderOpen, href: '/templates', color: '#c2410c', bg: '#ffedd5' },
  { id: 'audit', label: 'Auditoría', desc: 'Bitácora de todas las acciones sensibles del sistema.', icon: History, href: '/audit', roles: ['Super Admin', 'Admin'], color: '#5a6070', bg: '#ede9e4' },
  { id: 'settings', label: 'Configuración', desc: 'Parámetros del motor de comisiones (porcentajes, meta AMA, etc.).', icon: Settings, href: '/settings', roles: ['Super Admin', 'Admin'], color: '#213a55', bg: '#e2e8f0' },
];

interface Step { text: string; href?: string; linkLabel?: string; }
interface Guide {
  id: string;
  title: string;
  icon: React.ElementType;
  summary: string;
  roles: Role[];
  accent: string;
  steps: Step[];
  keywords: string;
}

const GUIDES: Guide[] = [
  {
    id: 'liberar-comision',
    title: 'Cómo liberar una comisión',
    icon: Unlock,
    summary: 'Autoriza que una comisión calculada pase a estar disponible para pago.',
    roles: ['Super Admin', 'Admin', 'Jurídico'],
    accent: '#006c49',
    keywords: 'liberar comision autorizar disponible pago calculada validar cierre operacion pld requisito',
    steps: [
      { text: 'REQUISITO PREVIO: antes de liberar, el cierre (operación) que originó la comisión debe estar validado. Ve al módulo de Cierres, abre el cierre y cambia su estatus a “Validado por administración”. Además, su expediente PLD debe estar completo. Si esto falta, al liberar verás el mensaje “La operación aún no ha sido validada por administración”.', href: '/operations', linkLabel: 'Ir a Cierres a validar' },
      { text: 'Ya validado el cierre, entra al módulo de Comisiones desde el menú lateral (sección “Operaciones”).', href: '/commissions', linkLabel: 'Ir a Comisiones' },
      { text: 'Localiza la comisión que quieres liberar. Debe estar en estado “Calculada” o “Pendiente validación”. Puedes usar el buscador o el filtro de estado para encontrarla más rápido.' },
      { text: 'Revisa que los montos (comisión total, neto asesor, inmobiliaria) sean correctos.' },
      { text: 'En la columna “Acciones”, presiona el botón verde “Liberar”.' },
      { text: 'La comisión cambia a estado “Liberada”. A partir de ese momento el asesor puede solicitar su pago desde el módulo de Pagos.' },
    ],
  },
  {
    id: 'bloquear-comision',
    title: 'Cómo bloquear una comisión',
    icon: Lock,
    summary: 'Detén una comisión cuando falta documentación o hay una alerta de cumplimiento.',
    roles: ['Super Admin', 'Admin', 'Jurídico'],
    accent: '#b91c1c',
    keywords: 'bloquear comision detener retener expediente incompleto pld motivo',
    steps: [
      { text: 'Entra al módulo de Comisiones.', href: '/commissions', linkLabel: 'Ir a Comisiones' },
      { text: 'Ubica la comisión en estado “Calculada” o “Pendiente validación”.' },
      { text: 'En la columna “Acciones”, presiona el botón rojo “Bloquear”.' },
      { text: 'Se abre un campo de texto: escribe el motivo del bloqueo (por ejemplo, “Falta contrato de comisión firmado” o “Alerta PLD pendiente”). El motivo es obligatorio.' },
      { text: 'Presiona “OK” para confirmar. La comisión pasa a estado “Bloqueada” y no podrá pagarse hasta desbloquearla. El motivo queda registrado en la Auditoría.', href: '/audit', linkLabel: 'Ver Auditoría' },
    ],
  },
  {
    id: 'desbloquear-comision',
    title: 'Cómo desbloquear una comisión',
    icon: Unlock,
    summary: 'Reactiva una comisión que estaba bloqueada una vez resuelto el problema.',
    roles: ['Super Admin', 'Admin', 'Jurídico'],
    accent: '#006c49',
    keywords: 'desbloquear comision reactivar bloqueada',
    steps: [
      { text: 'Entra al módulo de Comisiones y filtra por estado “Bloqueada”.', href: '/commissions', linkLabel: 'Ir a Comisiones' },
      { text: 'Localiza la comisión bloqueada que ya resolvió su motivo.' },
      { text: 'En “Acciones”, presiona “Desbloquear”.' },
      { text: 'La comisión regresa a estado “Calculada” y ya puede liberarse normalmente.' },
    ],
  },
  {
    id: 'registrar-captacion',
    title: 'Registrar una captación (venta)',
    icon: Building2,
    summary: 'Da de alta una propiedad nueva en el inventario de venta.',
    roles: ['Super Admin', 'Admin', 'Asesor'],
    accent: '#1e40af',
    keywords: 'captar propiedad alta inventario venta captacion nueva',
    steps: [
      { text: 'Abre “Nueva Captación Venta” desde el menú (sección “Captación”).', href: '/properties/new', linkLabel: 'Nueva Captación Venta' },
      { text: 'Llena los datos del inmueble: dirección, precio, características y datos del propietario.' },
      { text: 'Indica el estatus de autorización y si el Contrato de Comisión Mercantil está firmado.' },
      { text: 'Adjunta los documentos que pida el formulario (identificación, predial, etc.).' },
      { text: 'Guarda. La propiedad aparecerá en el inventario de Propiedades en Venta.', href: '/properties', linkLabel: 'Ver inventario' },
    ],
  },
  {
    id: 'registrar-cierre',
    title: 'Registrar un cierre',
    icon: ClipboardList,
    summary: 'Registra una operación cerrada; el sistema calcula la comisión automáticamente.',
    roles: ['Super Admin', 'Admin', 'Asesor'],
    accent: '#006c49',
    keywords: 'cierre operacion venta renta registrar comision automatica',
    steps: [
      { text: 'Abre “Nuevo Cierre” desde el menú (sección “Operaciones”).', href: '/operations/new', linkLabel: 'Nuevo Cierre' },
      { text: 'Selecciona la propiedad y el cliente involucrados (o captúralos si el cierre es externo).' },
      { text: 'Ingresa el precio final de cierre, la fecha y el porcentaje de comisión pactado.' },
      { text: 'Guarda el cierre. El motor calcula automáticamente la comisión (invitación, mentoría, neto asesor e inmobiliaria).' },
      { text: 'La nueva comisión aparece en el módulo de Comisiones en estado “Calculada”, lista para revisarse y liberarse.', href: '/commissions', linkLabel: 'Ir a Comisiones' },
    ],
  },
  {
    id: 'solicitar-pago',
    title: 'Solicitar el pago de una comisión (asesor)',
    icon: Wallet,
    summary: 'Como asesor, pide el pago de una comisión que ya fue liberada.',
    roles: ['Asesor'],
    accent: '#7c3aed',
    keywords: 'solicitar pago asesor comision liberada cobrar',
    steps: [
      { text: 'Entra al módulo de Pagos.', href: '/payments', linkLabel: 'Ir a Pagos' },
      { text: 'En la lista de comisiones liberadas, localiza la que quieres cobrar.' },
      { text: 'Presiona “Solicitar pago”. La solicitud se envía a administración.' },
      { text: 'Sigue el estatus: pasará de “Solicitado” a “Autorizado” y finalmente a “Pagado”.' },
    ],
  },
  {
    id: 'autorizar-pago',
    title: 'Autorizar y registrar un pago (admin)',
    icon: DollarSign,
    summary: 'Aprueba la solicitud de pago de un asesor y registra la transferencia.',
    roles: ['Super Admin', 'Admin'],
    accent: '#c2410c',
    keywords: 'autorizar pago admin transferencia cfdi registrar pagado',
    steps: [
      { text: 'Entra al módulo de Pagos.', href: '/payments', linkLabel: 'Ir a Pagos' },
      { text: 'Ubica la solicitud en estado “Solicitado” y presiona “Autorizar”.' },
      { text: 'Una vez hecha la transferencia, presiona “Marcar como pagado”.' },
      { text: 'Captura la forma de pago, el monto pagado y (si aplica) el UUID del CFDI o la referencia de transferencia.' },
      { text: 'Confirma. El pago queda en estado “Pagado” y la comisión se marca como liquidada.' },
    ],
  },
  {
    id: 'alta-asesor',
    title: 'Dar de alta un asesor',
    icon: Users,
    summary: 'Registra un nuevo asesor, con su invitador, mentoría y estatus.',
    roles: ['Super Admin', 'Admin'],
    accent: '#78350f',
    keywords: 'alta asesor nuevo registrar mentoria invitador estatus',
    steps: [
      { text: 'Abre “Nuevo Asesor” desde el menú (sección “Equipo”).', href: '/advisors/new', linkLabel: 'Nuevo Asesor' },
      { text: 'Captura sus datos personales, de contacto y fecha de alta.' },
      { text: 'Indica si fue invitado por otro asesor y si pasa por período de mentoría (y quién es su mentor).' },
      { text: 'Selecciona el estatus inicial: “Activo” o “En mentoría”. Ambos cuentan como asesor activo en el Dashboard.' },
      { text: 'Guarda. Se genera su usuario automáticamente y se le crea su periodo AMA. Aparecerá en la lista de Asesores.', href: '/advisors', linkLabel: 'Ver Asesores' },
    ],
  },
  {
    id: 'mi-dashboard-asesor',
    title: 'Ver el “Mi Dashboard” de un asesor (admin)',
    icon: LayoutDashboard,
    summary: 'Como administrador, revisa el dashboard personal de cualquier asesor.',
    roles: ['Super Admin', 'Admin'],
    accent: '#7c3aed',
    keywords: 'mi dashboard asesor admin ver vista filtro',
    steps: [
      { text: 'Entra al Dashboard.', href: '/dashboard', linkLabel: 'Ir al Dashboard' },
      { text: 'En la parte superior, cambia de la pestaña “Dashboard Administrativo” a la pestaña “Mi Dashboard”.' },
      { text: 'Usa el selector de asesor para elegir a quién quieres ver.' },
      { text: 'Verás sus indicadores personales: comisiones, cierres, avance AMA e invitados, tal como los ve el propio asesor.' },
    ],
  },
  {
    id: 'config-comision',
    title: 'Configurar parámetros de comisión',
    icon: Settings,
    summary: 'Ajusta los porcentajes y la meta AMA que usa el motor de comisiones.',
    roles: ['Super Admin', 'Admin'],
    accent: '#213a55',
    keywords: 'configuracion parametros comision porcentaje ama motor settings',
    steps: [
      { text: 'Entra a Configuración.', href: '/settings', linkLabel: 'Ir a Configuración' },
      { text: 'En la pestaña de parámetros de comisión, ajusta el valor que necesites (porcentaje de invitación, mentoría, meta AMA, etc.).' },
      { text: 'Guarda. Los cambios aplican a los cierres registrados de ahí en adelante y quedan registrados en la Auditoría.' },
    ],
  },
];

interface Faq { q: string; a: string; href?: string; linkLabel?: string; keywords: string; }

const FAQS: Faq[] = [
  {
    q: '¿Por qué no veo el botón de “Liberar” o “Bloquear”?',
    a: 'Esas acciones solo están disponibles para los roles Super Admin, Admin y Jurídico. Si tu rol es Asesor, verás las comisiones pero no los botones de acción.',
    keywords: 'liberar bloquear boton permiso rol asesor no veo',
  },
  {
    q: '¿Cómo se calcula una comisión?',
    a: 'El motor toma la comisión total y aplica en orden: 2.5% de invitación (si aplica) → calcula el remanente → 80% para el asesor (100% si ya alcanzó su meta AMA) → 5% de mentoría (si aplica). El resto es el ingreso de la inmobiliaria.',
    href: '/commissions', linkLabel: 'Ver Comisiones',
    keywords: 'calculo comision motor porcentaje invitacion mentoria ama 80 20',
  },
  {
    q: '¿Qué es el AMA?',
    a: 'Es la meta anual de comisiones netas de cada asesor (por defecto $180,000 MXN). Mientras no la alcanza, el asesor recibe el 80% de su comisión; una vez alcanzada, recibe el 100%. El avance se ve en el Dashboard y en la ficha del asesor.',
    href: '/advisors', linkLabel: 'Ver Asesores',
    keywords: 'ama meta anual 180000 avance asesor 80 100',
  },
  {
    q: '¿Qué pasa cuando bloqueo una comisión?',
    a: 'La comisión queda retenida y no puede pagarse. El motivo del bloqueo queda guardado y visible en la Auditoría. Puedes desbloquearla en cualquier momento; regresa a estado “Calculada”.',
    keywords: 'bloquear comision retener motivo auditoria desbloquear',
  },
  {
    q: '¿Quién puede dar de alta asesores?',
    a: 'Solo los roles Super Admin y Admin pueden crear nuevos asesores desde “Nuevo Asesor”.',
    href: '/advisors/new', linkLabel: 'Nuevo Asesor',
    keywords: 'alta asesor quien permiso admin crear',
  },
  {
    q: '¿Cómo cambio el estatus de una propiedad (venta / renta)?',
    a: 'Entra a Propiedades en Venta (o Propiedades en Renta), abre la ficha de la propiedad con el ícono del ojo, y en la sección “Cambiar Estatus” elige el nuevo estado (Incompleta, En revisión, Activa, Publicable, Compartible, Vendida/Rentada) y presiona “Cambiar Estatus”. El cambio se guarda al instante.',
    href: '/properties', linkLabel: 'Ir a Propiedades',
    keywords: 'cambiar estatus estado propiedad venta renta publicable activa compartible vendida rentada inventario ficha',
  },
  {
    q: '¿Cuál es el flujo completo de una operación?',
    a: 'Captación de la propiedad → registro del Cierre → el motor genera la Comisión (Calculada) → un admin la Libera (o Bloquea) → el asesor solicita el Pago → administración lo autoriza y lo marca como Pagado.',
    keywords: 'flujo completo proceso captacion cierre comision pago',
  },
  {
    q: '¿Qué es el Cumplimiento PLD?',
    a: 'Es el módulo de Prevención de Lavado de Dinero. Registra casos, verifica expedientes (RFC, identificación, PEP) y levanta alertas. Solo lo ven Super Admin y Admin.',
    href: '/compliance', linkLabel: 'Ir a Cumplimiento',
    keywords: 'pld cumplimiento lavado dinero kyc pep alerta',
  },
  {
    q: '¿Un asesor puede ver los datos de otro asesor?',
    a: 'No. Cada asesor solo ve su propia información. Únicamente los administradores pueden ver el “Mi Dashboard” de cualquier asesor usando el selector en el Dashboard.',
    keywords: 'asesor ver otro privacidad datos permiso mi dashboard',
  },
];

interface EstadoGrupo { titulo: string; icon: React.ElementType; estados: { label: string; cls: string; desc: string }[]; }

const ESTADOS: EstadoGrupo[] = [
  {
    titulo: 'Estados de una Comisión',
    icon: DollarSign,
    estados: [
      { label: 'Calculada', cls: 'badge-warning', desc: 'Recién generada por el motor. Lista para revisarse.' },
      { label: 'Pend. validación', cls: 'badge-warning', desc: 'En espera de revisión antes de liberarse.' },
      { label: 'Liberada', cls: 'badge-success', desc: 'Autorizada. El asesor ya puede solicitar su pago.' },
      { label: 'Solicitada', cls: 'badge-primary', desc: 'El asesor pidió el pago; en trámite.' },
      { label: 'Pagada', cls: 'badge-neutral', desc: 'Liquidada por completo.' },
      { label: 'Bloqueada', cls: 'badge-error', desc: 'Retenida por un motivo (falta doc., alerta PLD, etc.).' },
      { label: 'Cancelada', cls: 'badge-neutral', desc: 'Anulada, por ejemplo si el cierre se cancela.' },
    ],
  },
  {
    titulo: 'Estados de un Cierre',
    icon: ClipboardList,
    estados: [
      { label: 'Solicitado', cls: 'badge-warning', desc: 'Registrado, en espera de revisión.' },
      { label: 'En revisión', cls: 'badge-primary', desc: 'Administración lo está validando.' },
      { label: 'Validado por administración', cls: 'badge-success', desc: 'Aprobado y contabilizado.' },
      { label: 'Liberado para pago', cls: 'badge-success', desc: 'Listo para generar el pago.' },
      { label: 'Pagado', cls: 'badge-neutral', desc: 'Operación completamente cerrada y pagada.' },
      { label: 'Cancelado', cls: 'badge-neutral', desc: 'Operación anulada.' },
    ],
  },
  {
    titulo: 'Estados de un Pago',
    icon: Wallet,
    estados: [
      { label: 'Solicitado', cls: 'badge-warning', desc: 'El asesor pidió el pago.' },
      { label: 'Autorizado', cls: 'badge-primary', desc: 'Administración aprobó el pago.' },
      { label: 'Pagado', cls: 'badge-success', desc: 'Transferencia registrada.' },
      { label: 'Rechazado', cls: 'badge-error', desc: 'La solicitud fue rechazada.' },
    ],
  },
  {
    titulo: 'Estados de una Propiedad',
    icon: Building2,
    estados: [
      { label: 'Incompleta', cls: 'badge-error', desc: 'Le falta información o expediente.' },
      { label: 'En revisión', cls: 'badge-warning', desc: 'En proceso de validación.' },
      { label: 'Activa', cls: 'badge-primary', desc: 'Captada y en inventario.' },
      { label: 'Publicable', cls: 'badge-success', desc: 'Con contrato firmado; lista para promocionarse.' },
      { label: 'Compartible', cls: 'badge-success', desc: 'Se puede compartir con otras inmobiliarias.' },
      { label: 'Vendida / Rentada', cls: 'badge-neutral', desc: 'Operación concretada.' },
    ],
  },
];

const FLUJO = [
  { label: 'Captación', desc: 'Alta de la propiedad', icon: Building2, href: '/properties/new', color: '#1e40af' },
  { label: 'Cierre', desc: 'Registro de la operación', icon: ClipboardList, href: '/operations/new', color: '#006c49' },
  { label: 'Comisión', desc: 'Cálculo automático', icon: DollarSign, href: '/commissions', color: '#c2410c' },
  { label: 'Liberar', desc: 'Autorización admin', icon: Unlock, href: '/commissions', color: '#006c49' },
  { label: 'Pago', desc: 'Solicitud y liquidación', icon: Wallet, href: '/payments', color: '#7c3aed' },
];

const ROLE_BADGE: Record<Role, string> = {
  'Super Admin': 'badge-primary',
  Admin: 'badge-primary',
  Asesor: 'badge-success',
  Jurídico: 'badge-warning',
};

type Category = 'inicio' | 'guias' | 'faq' | 'glosario';

const CATEGORIES: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: 'inicio', label: 'Inicio', icon: Map },
  { id: 'guias', label: 'Guías paso a paso', icon: ListChecks },
  { id: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle },
  { id: 'glosario', label: 'Glosario de estados', icon: Tag },
];

// ──────────────────────────────────────────────────────────────────────────────
//  Componentes
// ──────────────────────────────────────────────────────────────────────────────

function GuideCard({ guide }: { guide: Guide }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const Icon = guide.icon;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '16px 18px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: `${guide.accent}18`, color: guide.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, color: 'var(--color-on-surface)' }}>{guide.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', marginTop: 2 }}>{guide.summary}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {guide.roles.map((r) => (
            <span key={r} className={`badge ${ROLE_BADGE[r]}`} style={{ fontSize: 10 }}>{r}</span>
          ))}
          <ChevronDown size={18} style={{ color: 'var(--color-on-surface-variant)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </button>

      {open && (
        <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--color-outline-variant)' }}>
          <ol style={{ listStyle: 'none', margin: 0, padding: '12px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {guide.steps.map((step, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: guide.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, paddingTop: 1 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{step.text}</div>
                  {step.href && (
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: 8, fontSize: 12, padding: '5px 12px' }}
                      onClick={() => router.push(step.href!)}
                    >
                      {step.linkLabel ?? 'Ir'} <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function FaqCard({ faq }: { faq: Faq }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 18px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <HelpCircle size={17} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--color-on-surface)' }}>{faq.q}</span>
        <ChevronDown size={17} style={{ color: 'var(--color-on-surface-variant)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>
      {open && (
        <div style={{ padding: '0 18px 16px 47px', borderTop: '1px solid var(--color-outline-variant)' }}>
          <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', lineHeight: 1.6, marginTop: 12 }}>{faq.a}</p>
          {faq.href && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 10, fontSize: 12, padding: '5px 12px' }}
              onClick={() => router.push(faq.href!)}
            >
              {faq.linkLabel ?? 'Ir'} <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
//  Página
// ──────────────────────────────────────────────────────────────────────────────

export default function GuiaPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const role = (user?.role ?? '') as Role;
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [category, setCategory] = useState<Category>('inicio');

  // Sincroniza la pestaña con ?tab= (soft-navigation no re-monta el componente)
  useEffect(() => {
    if (tabParam && (['inicio', 'guias', 'faq', 'glosario'] as const).includes(tabParam as Category)) {
      setCategory(tabParam as Category);
    }
  }, [tabParam]);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const guidesFiltered = useMemo(
    () => GUIDES.filter((g) => !searching || (g.title + ' ' + g.summary + ' ' + g.keywords).toLowerCase().includes(q)),
    [q, searching],
  );
  const faqsFiltered = useMemo(
    () => FAQS.filter((f) => !searching || (f.q + ' ' + f.a + ' ' + f.keywords).toLowerCase().includes(q)),
    [q, searching],
  );
  const modulesVisible = MODULES.filter((m) => !m.roles || m.roles.includes(role));

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        {/* ─── Hero ─── */}
        <div
          style={{
            borderRadius: 'var(--radius-lg)', padding: '28px 30px', marginBottom: 22,
            background: 'linear-gradient(120deg, var(--color-primary) 0%, #2d4f6e 60%, #34597a 100%)',
            color: '#fff', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', right: -30, top: -30, opacity: 0.12 }}>
            <BookOpen size={180} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Sparkles size={16} style={{ color: 'var(--color-secondary)' }} />
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5, color: 'var(--color-secondary)', textTransform: 'uppercase' }}>Guía de Uso</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Todo lo que puedes hacer en Idea Uno Control</h1>
          <p style={{ fontSize: 13.5, opacity: 0.85, marginTop: 8, maxWidth: 620, lineHeight: 1.5 }}>
            Un índice interactivo de la plataforma: guías paso a paso, respuestas rápidas y el significado de cada estado.
            Toca cualquier botón para ir directo a la sección.
          </p>

          {/* Buscador */}
          <div style={{ marginTop: 18, maxWidth: 480, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-on-surface-variant)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca una acción, duda o palabra clave…"
              style={{
                width: '100%', padding: '11px 14px 11px 40px', borderRadius: 'var(--radius-md)',
                border: 'none', fontSize: 13.5, background: '#fff', color: 'var(--color-on-surface)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* ─── Resultados de búsqueda ─── */}
        {searching ? (
          <div>
            <div style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', marginBottom: 12 }}>
              {guidesFiltered.length + faqsFiltered.length} resultado(s) para “{query}”
            </div>
            {guidesFiltered.length > 0 && (
              <>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', margin: '4px 0 10px' }}>Guías</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {guidesFiltered.map((g) => <GuideCard key={g.id} guide={g} />)}
                </div>
              </>
            )}
            {faqsFiltered.length > 0 && (
              <>
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', margin: '4px 0 10px' }}>Preguntas frecuentes</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {faqsFiltered.map((f, i) => <FaqCard key={i} faq={f} />)}
                </div>
              </>
            )}
            {guidesFiltered.length === 0 && faqsFiltered.length === 0 && (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <Search size={28} />
                <p style={{ fontSize: 13 }}>Sin resultados. Prueba con otra palabra.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ─── Pestañas de categoría ─── */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {CATEGORIES.map((c) => {
                const CIcon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                      borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-outline-variant)'}`,
                      background: active ? 'var(--color-primary)' : 'var(--color-surface-container-lowest)',
                      color: active ? '#fff' : 'var(--color-on-surface-variant)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <CIcon size={15} /> {c.label}
                  </button>
                );
              })}
            </div>

            {/* ─── INICIO ─── */}
            {category === 'inicio' && (
              <>
                {/* Flujo completo */}
                <div className="card" style={{ marginBottom: 22 }}>
                  <div className="card-header">
                    <div>
                      <div className="card-title">El flujo completo de una operación</div>
                      <div className="card-subtitle">Del inmueble al pago de la comisión — toca cada paso para ir ahí</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
                    {FLUJO.map((f, i) => {
                      const FIcon = f.icon;
                      return (
                        <Fragmentish key={f.label} last={i === FLUJO.length - 1}>
                          <button
                            onClick={() => router.push(f.href)}
                            style={{
                              flex: '1 1 130px', minWidth: 120, display: 'flex', flexDirection: 'column', alignItems: 'center',
                              gap: 6, padding: '16px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                              background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${f.color}12`; (e.currentTarget as HTMLElement).style.borderColor = f.color; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-container-low)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--color-outline-variant)'; }}
                          >
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${f.color}18`, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <FIcon size={20} />
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 650, color: 'var(--color-on-surface)' }}>{i + 1}. {f.label}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>{f.desc}</div>
                          </button>
                        </Fragmentish>
                      );
                    })}
                  </div>
                </div>

                {/* Motor de comisiones */}
                <div className="card" style={{ marginBottom: 22, background: 'linear-gradient(135deg, #f0fdf4, #d1fae5)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: '#006c49', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <DollarSign size={20} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14.5, fontWeight: 650 }}>Cómo reparte el motor de comisiones</div>
                      <div style={{ fontSize: 13, color: 'var(--color-on-surface-variant)', marginTop: 6, lineHeight: 1.6 }}>
                        Comisión total → <strong>2.5% invitación</strong> (si aplica) → remanente → <strong>80% asesor</strong> (100% si ya alcanzó su AMA) → <strong>5% mentoría</strong> (si aplica). Lo restante es el ingreso de la inmobiliaria.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mapa del sistema */}
                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', margin: '4px 0 12px' }}>Mapa del sistema — {modulesVisible.length} secciones disponibles para tu rol</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {modulesVisible.map((m) => {
                    const MIcon = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => router.push(m.href)}
                        className="card"
                        style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid var(--color-outline-variant)' }}
                      >
                        <div style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', background: m.bg, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <MIcon size={19} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--color-on-surface)' }}>{m.label}</span>
                            <ChevronRight size={15} style={{ color: 'var(--color-on-surface-variant)', flexShrink: 0 }} />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 3, lineHeight: 1.45 }}>{m.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* ─── GUÍAS ─── */}
            {category === 'guias' && (
              <>
                <div className="card" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <PlayCircle size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)' }}>Toca una guía para desplegar sus pasos. Los botones azules te llevan directo a la pantalla del paso.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {GUIDES.map((g) => <GuideCard key={g.id} guide={g} />)}
                </div>
              </>
            )}

            {/* ─── FAQ ─── */}
            {category === 'faq' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FAQS.map((f, i) => <FaqCard key={i} faq={f} />)}
              </div>
            )}

            {/* ─── GLOSARIO ─── */}
            {category === 'glosario' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {ESTADOS.map((grupo) => {
                  const GIcon = grupo.icon;
                  return (
                    <div key={grupo.titulo} className="card">
                      <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GIcon size={16} style={{ color: 'var(--color-primary)' }} />
                          <div className="card-title" style={{ fontSize: 14 }}>{grupo.titulo}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {grupo.estados.map((e) => (
                          <div key={e.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <span className={`badge ${e.cls}`} style={{ flexShrink: 0, marginTop: 1 }}>{e.label}</span>
                            <span style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', lineHeight: 1.45 }}>{e.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </>
  );
}

// Pequeño helper para renderizar el paso del flujo + la flecha entre pasos
function Fragmentish({ children, last }: { children: React.ReactNode; last: boolean }) {
  return (
    <>
      {children}
      {!last && (
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--color-outline)', flexShrink: 0 }}>
          <ArrowRight size={18} />
        </div>
      )}
    </>
  );
}
