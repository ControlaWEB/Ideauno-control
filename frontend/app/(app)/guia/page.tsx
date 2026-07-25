'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/header';
import { useAuthStore } from '@/store/auth.store';
import {
  BookOpen, Search, ArrowRight, ChevronDown, Unlock, Lock, Building2, Home,
  ClipboardList, DollarSign, Wallet, ScrollText, Users, UserCheck, ShieldCheck,
  FolderOpen, History, Settings, LayoutDashboard, HelpCircle, Map, ListChecks,
  Tag, Sparkles, PlayCircle, ChevronRight, Workflow, CheckCircle2, XCircle,
  AlertTriangle, ArrowDown, ShieldAlert, GitBranch, FileCheck, Maximize2,
  Route, MapPin, ArrowRightCircle, FileText, Image as ImageIcon,
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
    keywords: 'cierre operacion venta renta registrar comision automatica propiedad inventario externa',
    steps: [
      { text: 'Abre “Nuevo Cierre” desde el menú (sección “Operaciones”).', href: '/operations/new', linkLabel: 'Nuevo Cierre' },
      { text: 'En “¿La propiedad está en el inventario?” elige: “Sí” si es una propiedad captada por nosotros (la seleccionas de la lista), o “No (externa)” si otra inmobiliaria la captó y nosotros solo colocamos al comprador.' },
      { text: 'Si es del inventario: selecciona la propiedad. Si es externa: captura tipo de cierre, tipo de inmueble, dirección y los “Datos del colocador” (ver la tarjeta específica más abajo).' },
      { text: 'Ingresa el precio final de cierre, la fecha y el monto de comisión generada.' },
      { text: 'Guarda el cierre. El motor calcula automáticamente la comisión (invitación, mentoría, neto asesor e inmobiliaria).' },
      { text: 'La nueva comisión aparece en el módulo de Comisiones en estado “Calculada”, lista para revisarse y liberarse.', href: '/commissions', linkLabel: 'Ir a Comisiones' },
    ],
  },
  {
    id: 'cierre-externo',
    title: 'Registrar un cierre externo (colocación)',
    icon: ClipboardList,
    summary: 'Cuando Idea Uno trae al comprador pero la propiedad la captó otra inmobiliaria, se cierra sin dar de alta la propiedad ni su documentación de captación.',
    roles: ['Super Admin', 'Admin', 'Asesor'],
    accent: '#006c49',
    keywords: 'cierre externo colocacion colocador inmobiliaria externa sin inventario sin documentacion captacion propiedad de otro agente referido conjunto porcentaje pactado',
    steps: [
      { text: 'En “Nuevo Cierre”, en “¿La propiedad está en el inventario?” marca “No (externa)”.', href: '/operations/new', linkLabel: 'Nuevo Cierre' },
      { text: 'Captura el tipo de cierre externo (referido, venta en conjunto, etc.), el tipo de inmueble y la dirección.' },
      { text: 'Llena “Datos del colocador”: la inmobiliaria o agente externo que captó la propiedad es OBLIGATORIA; nombre de contacto, teléfono y correo son opcionales.' },
      { text: 'El “% de comisión pactada” con el colocador es INFORMATIVO: se guarda como referencia pero NO cambia el cálculo de la comisión (el motor reparte igual que un cierre normal).' },
      { text: 'No se piden los documentos de captación de la propiedad: los resguarda la inmobiliaria externa. Sí se piden los documentos del cierre y del cliente (KYC/PLD) como siempre.' },
      { text: 'Guarda. En el detalle de la operación verás una tarjeta “Propiedad externa” con un aviso: “⚠️ Propiedad externa — documentación resguardada por [inmobiliaria]. No aplica documentación de captación.”', href: '/operations', linkLabel: 'Ver Cierres' },
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
    title: 'Configuración: qué hace cada parámetro y a qué afecta',
    icon: Settings,
    summary: 'Guía completa de los valores que controlan el motor de comisiones, la mentoría, el AMA y el PLD.',
    roles: ['Super Admin', 'Admin'],
    accent: '#213a55',
    keywords: 'configuracion parametros comision porcentaje ama motor settings umbral pld kyc invitacion mentoria meta ano operativo salir mentoria decimales editar',
    steps: [
      { text: 'Cómo editar: entra a Configuración, presiona “Editar” en el parámetro, cambia el valor y guarda. IMPORTANTE: los cambios aplican solo a los cierres NUEVOS de ahí en adelante — no recalculan comisiones ya generadas. Todo cambio queda registrado en la Auditoría.', href: '/settings', linkLabel: 'Ir a Configuración' },
      { text: 'Los porcentajes se guardan como decimales: 0.025 = 2.5%, 0.80 = 80%. Si pones el número mal (ej. 80 en vez de 0.80) el motor repartirá mal las comisiones.' },
      { text: 'Umbral PLD ($): monto a partir del cual la operación exige expediente KYC/PLD completo. Afecta a Cumplimiento y a la liberación de comisiones: si el valor de la operación supera este umbral, no se puede liberar sin el expediente completo. Bajarlo = más operaciones exigen KYC; subirlo = menos.' },
      { text: 'Porcentaje invitación (%): parte de la comisión total que se lleva el asesor que invitó. Afecta el reparto de cada comisión nueva: sube/baja lo que gana el invitador y cambia el remanente que queda para repartir.' },
      { text: 'Porcentaje asesor normal (%): parte del remanente que recibe el asesor ANTES de alcanzar su meta AMA (el resto es de la inmobiliaria). Al alcanzar el AMA el asesor pasa automáticamente al 100%. Subirlo = el asesor gana más y la inmobiliaria menos por cierre.' },
      { text: 'Porcentaje mentoría (%): deducción que se le quita a la comisión neta del asesor en periodo de mentoría y se le paga a su mentor. Afecta el neto del asesor mentoreado y el pago al mentor.' },
      { text: 'Mínimo exento mentoría renta ($): si la comisión de una RENTA es menor a este monto, no se aplica la deducción de mentoría. Sirve para no castigar rentas chicas. Solo afecta operaciones de renta.' },
      { text: 'Meta AMA ($): monto de ingreso a la inmobiliaria (monto_inmobiliaria de cada cierre, no la comisión neta del asesor) que el asesor debe acumular en su año operativo para “alcanzar AMA”. Al alcanzarla pasa de porcentaje normal a 100%. También define el % de avance que se ve en el Dashboard, Mi Dashboard y la ficha del asesor.' },
      { text: 'duracion_anio_operativo_meses: cuántos meses dura el año operativo (normalmente 12). Define la ventana del periodo AMA de cada asesor.' },
      { text: 'ventas_para_salir_mentoria: número de cierres que un asesor necesita para salir del periodo de mentoría.' },
    ],
  },
  {
    id: 'alta-team',
    title: 'Dar de alta un Team con integrantes NUEVOS',
    icon: Users,
    summary: 'Crea un equipo capturando a cada integrante desde cero: cada uno con su propio usuario, dashboard combinado y pago a la cuenta del team.',
    roles: ['Super Admin', 'Admin'],
    accent: '#78350f',
    keywords: 'team equipo alta varios asesores integrantes nuevos cuantos cantidad usuario propio login individual cuenta bancaria clabe documentos pago grupal dashboard combinado wizard',
    steps: [
      { text: 'Entra a “Nuevo Asesor” (sección Equipo) y arriba elige el modo “Team (varios integrantes)”.', href: '/advisors/new', linkLabel: 'Ir a Nuevo Asesor' },
      { text: 'En “Datos del Team”, deja la fuente en “Integrantes nuevos”.' },
      { text: 'Llena el nombre del equipo, la cuenta bancaria compartida (CLABE, banco, titular) y “¿Cuántos integrantes?”. Las comisiones de TODO el equipo se pagan a ESA cuenta. La meta AMA del team es estándar: número de integrantes × $180,000 (no se captura a mano).' },
      { text: 'Captura al integrante 1 igual que un asesor normal: sus datos, su propio correo (que será su login) y sus documentos. Cada integrante tiene su PROPIO usuario y entra por separado; sus documentos quedan ligados a ESE integrante.' },
      { text: 'Presiona “Guardar integrante 1 de N”. El formulario se limpia y se repite para el siguiente, hasta completar la cantidad indicada.' },
      { text: 'Al terminar, la pantalla muestra las credenciales de acceso de CADA integrante (cada uno con su login propio). Reparte cada credencial a su dueño y presiona “Terminar”.', href: '/advisors', linkLabel: 'Ver Asesores' },
    ],
  },
  {
    id: 'admin-tambien-asesor',
    title: 'Que un administrador también sea asesor (una sola cuenta)',
    icon: Users,
    summary: 'Un admin (ej. un dueño) que también vende puede tener su Mi Dashboard y comisiones como asesor sin abrir una segunda cuenta.',
    roles: ['Super Admin', 'Admin'],
    accent: '#059669',
    keywords: 'admin dueno duenio asesor vende una sola cuenta ligar perfil existente doble rol mi dashboard comisiones sin segunda cuenta',
    steps: [
      { text: 'Entra a “Nuevo Asesor” (sección Equipo) con el modo “Asesor individual”.', href: '/advisors/new', linkLabel: 'Ir a Nuevo Asesor' },
      { text: 'Marca la casilla “Ligar a una cuenta existente”. Aparece un selector con las cuentas que aún no tienen perfil de asesor.' },
      { text: 'Elige la cuenta (por ejemplo, la del administrador). El nombre y correo se llenan solos con los de esa cuenta.' },
      { text: 'Captura el resto de datos del asesor (fecha de alta, beneficiario) y sube sus documentos, igual que cualquier asesor.' },
      { text: 'Guarda. NO se crea un login nuevo ni se envía contraseña: esa persona entra con su cuenta de siempre y desde ahora también verá su “Mi Dashboard” y sus comisiones, y puede aparecer como cerrador en sus ventas.', href: '/advisors', linkLabel: 'Ver Asesores' },
      { text: 'Cada cuenta puede tener un solo perfil de asesor: si ya está ligada, el sistema lo impide.' },
    ],
  },
  {
    id: 'team-existentes',
    title: 'Crear un Team con asesores que YA existen',
    icon: Users,
    summary: 'Agrupa asesores ya dados de alta (ej. dos dueños que también venden) en un equipo, sin duplicar cuentas.',
    roles: ['Super Admin', 'Admin'],
    accent: '#78350f',
    keywords: 'team existentes agrupar asesores ya dados de alta duenos unir juntar sin duplicar cuenta compartida meta ama seleccionar',
    steps: [
      { text: 'Primero, cada persona debe existir como asesor: dala de alta normal, o si es un administrador usa “Ligar a una cuenta existente” (ver el punto anterior).' },
      { text: 'Entra a “Nuevo Asesor”, modo “Team (varios integrantes)”.', href: '/advisors/new', linkLabel: 'Ir a Nuevo Asesor' },
      { text: 'En “Datos del Team”, cambia la fuente a “Asesores existentes”.' },
      { text: 'Escribe el nombre del team y la cuenta bancaria compartida (CLABE, banco, titular).' },
      { text: 'Marca en la lista a los asesores que quieres agrupar (solo aparecen los que no están en ningún team). La meta AMA del team se calcula sola: número de seleccionados × $180,000.' },
      { text: 'Presiona “Crear team con N asesores”. NO se crean logins nuevos: cada quien sigue entrando con su cuenta; ahora comparten cuenta bancaria y el dashboard combinado del team.', href: '/advisors', linkLabel: 'Ver Asesores' },
      { text: 'Un asesor solo puede estar en un team a la vez; si ya pertenece a otro, el sistema lo bloquea.' },
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
    a: 'Es la meta anual de ingreso a la inmobiliaria (no de comisión neta del asesor) que genera cada asesor con sus cierres. Mientras no la alcanza, el asesor recibe el 80% de su comisión; una vez alcanzada, recibe el 100%. El avance se ve en el Dashboard y en la ficha del asesor.',
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
    q: '¿Cuál es la diferencia entre “Comisiones pendientes” y “Pagos pendientes”?',
    a: 'Son dos etapas distintas del ciclo del dinero. “Comisiones pendientes” son comisiones que todavía NO están listas para pagar: falta que un admin las revise y las libere (o desbloquee) — estados Calculada, Pendiente validación o Bloqueada. “Pagos pendientes” son comisiones YA liberadas que el asesor ya pidió cobrar, y falta que administración autorice y registre la transferencia — estados Solicitado o Autorizado. En orden: primero se libera la comisión (comisión pendiente), luego se paga lo liberado (pago pendiente).',
    href: '/commissions', linkLabel: 'Ver Comisiones',
    keywords: 'diferencia comisiones pendientes pagos pendientes liberar autorizar solicitar calculada liberada pagado ciclo dinero',
  },
  {
    q: '¿Qué es el Cumplimiento PLD?',
    a: 'Es el módulo de Prevención de Lavado de Dinero. Registra casos, verifica expedientes (RFC, identificación, PEP) y levanta alertas. Solo lo ven Super Admin y Admin.',
    href: '/compliance', linkLabel: 'Ir a Cumplimiento',
    keywords: 'pld cumplimiento lavado dinero kyc pep alerta',
  },
  {
    q: '¿Un asesor puede ver los datos de otro asesor?',
    a: 'No. Cada asesor solo ve su propia información. Únicamente los administradores pueden ver el “Mi Dashboard” de cualquier asesor usando el selector en el Dashboard. (Excepción: los integrantes de un mismo Team comparten la vista del equipo.)',
    keywords: 'asesor ver otro privacidad datos permiso mi dashboard',
  },
  {
    q: '¿Qué ve un integrante de un Team?',
    a: 'Cada integrante entra con su propio usuario, pero su “Mi Dashboard” muestra los datos COMBINADOS de todo el equipo, y sus listas de Cierres, Comisiones y Pagos muestran los registros de TODO el team (operan como una unidad). La meta AMA se mide a nivel equipo y las comisiones del equipo se pagan a la cuenta bancaria del Team.',
    keywords: 'team equipo integrante ve datos combinados dashboard cierres comisiones pagos ama cuenta',
  },
  {
    q: 'Soy dueño y administrador, pero también vendo. ¿Necesito dos cuentas?',
    a: 'No. Con tu cuenta de admin ve a “Nuevo Asesor” en modo individual, marca “Ligar a una cuenta existente” y elige tu propia cuenta. Con eso, un solo login administra Y opera como asesor: verás tu Mi Dashboard, tus comisiones y podrás aparecer como cerrador en tus ventas. No se crea contraseña nueva.',
    href: '/advisors/new', linkLabel: 'Ir a Nuevo Asesor',
    keywords: 'dueno admin vende dos cuentas una sola ligar cuenta existente doble rol asesor administrador',
  },
  {
    q: '¿Dos administradores (o dos asesores ya existentes) pueden formar un Team?',
    a: 'Sí. Primero cada uno debe existir como asesor (alta normal, o “Ligar a una cuenta existente” si es admin). Luego, en “Nuevo Asesor” modo Team, cambia la fuente a “Asesores existentes”, pon la cuenta bancaria del team y selecciónalos de la lista. No se crean logins nuevos: se agrupan y comparten cuenta y dashboard del team. Un asesor no puede estar en dos teams.',
    href: '/advisors/new', linkLabel: 'Ir a Nuevo Asesor',
    keywords: 'dos admins asesores existentes formar team agrupar unir sin duplicar cuenta duenos equipo',
  },
  {
    q: 'La propiedad la captó otra inmobiliaria y nosotros solo trajimos al comprador. ¿Cómo registro ese cierre?',
    a: 'En “Nuevo Cierre”, en “¿La propiedad está en el inventario?” marca “No (externa)”. Captura tipo de cierre, inmueble y dirección, y en “Datos del colocador” pon la inmobiliaria/agente externo (obligatorio) más contacto opcional. No se piden los documentos de captación de la propiedad — los resguarda la inmobiliaria externa. Sí van los del cierre y del cliente.',
    href: '/operations/new', linkLabel: 'Ir a Nuevo Cierre',
    keywords: 'propiedad externa otra inmobiliaria colocacion colocador comprador cierre sin inventario sin documentacion captacion',
  },
  {
    q: 'El “% de comisión pactada” con el colocador externo, ¿cambia el cálculo de la comisión?',
    a: 'No. Ese porcentaje es solo informativo: se guarda como referencia del acuerdo con la inmobiliaria externa, pero el motor reparte la comisión igual que en cualquier cierre (invitación, mentoría, neto asesor e inmobiliaria). No hay reparto automático hacia el colocador.',
    keywords: 'porcentaje pactado colocador informativo no cambia calculo comision motor reparto externo',
  },
  {
    q: '¿Por qué un cierre externo no me pide los documentos de la propiedad?',
    a: 'Porque en una colocación la propiedad no es de nuestro inventario: su documentación legal la resguarda la inmobiliaria que la captó. Por eso el cierre externo avanza sin alta en propiedades. En el detalle de la operación aparece el aviso “⚠️ Propiedad externa — documentación resguardada por [inmobiliaria]. No aplica documentación de captación.”',
    href: '/operations', linkLabel: 'Ver Cierres',
    keywords: 'cierre externo no pide documentos propiedad captacion resguarda inmobiliaria externa aviso',
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

// ──────────────────────────────────────────────────────────────────────────────
//  Mapa de proceso detallado (solo Admin / Super Admin)
// ──────────────────────────────────────────────────────────────────────────────

type RamaColor = 'success' | 'error' | 'warning' | 'primary';
const RAMA_COLOR: Record<RamaColor, string> = {
  success: '#006c49', error: '#b91c1c', warning: '#c2410c', primary: '#1e40af',
};

interface ProcesoAccion { label: string; href: string; desc?: string; }
interface ProcesoRama { label: string; desc: string; resultado: string; color: RamaColor; icon: React.ElementType; }
interface ProcesoDecision { pregunta: string; ramas: ProcesoRama[]; }
interface ProcesoFase {
  id: string;
  numero: number;
  titulo: string;
  icon: React.ElementType;
  color: string;
  resumen: string;
  acciones: ProcesoAccion[];
  documentos?: string[];
  estados?: string[];
  decision?: ProcesoDecision;
  alerta?: string;
  alertaHref?: string;
  alertaLabel?: string;
}

const PROCESO: ProcesoFase[] = [
  {
    id: 'captacion',
    numero: 1,
    titulo: 'Captación de la propiedad',
    icon: Building2,
    color: '#1e40af',
    resumen: 'Alta del inmueble (venta o renta) con los datos del propietario y su documentación legal. Aquí nace el expediente que después habilita publicar y compartir la propiedad.',
    acciones: [
      { label: 'Nueva Captación Venta', href: '/properties/new', desc: 'Da clic aquí para registrar una propiedad en venta' },
      { label: 'Nueva Captación Renta', href: '/rentals/new', desc: 'Da clic aquí para registrar una propiedad en renta' },
    ],
    documentos: ['Identificación del propietario', 'Predial', 'Contrato de Comisión Mercantil firmado', 'Documento que acredite la propiedad'],
    estados: ['Incompleta', 'En revisión', 'Activa', 'Publicable', 'Compartible', 'Vendida / Rentada'],
    decision: {
      pregunta: '¿La documentación está completa y el Contrato de Comisión Mercantil firmado?',
      ramas: [
        { label: 'Sí', color: 'success', icon: CheckCircle2, desc: 'La propiedad avanza de “En revisión” a “Activa”.', resultado: 'Puede llegar a “Publicable” y “Compartible”.' },
        { label: 'No', color: 'error', icon: XCircle, desc: 'La propiedad se queda en “Incompleta”.', resultado: 'No puede publicarse ni compartirse hasta completar los documentos.' },
      ],
    },
    alerta: 'Da clic en la propiedad (ícono del ojo) → “Validar documentos” / “Cambiar Estatus” para mover la propiedad por el flujo (Incompleta → En revisión → Activa → Publicable → Compartible).',
    alertaHref: '/properties',
    alertaLabel: 'Ir a validar documentos',
  },
  {
    id: 'cierre',
    numero: 2,
    titulo: 'Cierre (registro de la operación)',
    icon: ClipboardList,
    color: '#006c49',
    resumen: 'Se registra la operación que se cerró. Aquí se decide si la propiedad es del inventario propio o si viene de otra inmobiliaria (colocación), y el motor calcula la comisión automáticamente al guardar.',
    acciones: [
      { label: 'Nuevo Cierre', href: '/operations/new', desc: 'Da clic aquí para registrar un cierre' },
    ],
    documentos: ['Documentos del cierre (contrato de compraventa / arrendamiento)', 'Expediente KYC/PLD del cliente (identificación, RFC, PEP)'],
    estados: ['Solicitado', 'En revisión', 'Validado por administración', 'Liberado para pago', 'Pagado', 'Cancelado'],
    decision: {
      pregunta: '¿La propiedad está en el inventario (la captamos nosotros)?',
      ramas: [
        { label: 'Sí (interno)', color: 'primary', icon: CheckCircle2, desc: 'Se selecciona la propiedad de la lista; ya trae su documentación de captación validada.', resultado: 'Cierre normal.' },
        { label: 'No (externa / colocación)', color: 'warning', icon: AlertTriangle, desc: 'Se captura tipo de cierre, inmueble, dirección y “Datos del colocador” (inmobiliaria externa, obligatoria). No se piden documentos de captación: los resguarda la inmobiliaria externa.', resultado: 'Cierre externo — aparece el aviso “Propiedad externa”.' },
      ],
    },
    alerta: 'REQUISITO para poder liberar la comisión: el cierre debe llegar a “Validado por administración” y el expediente PLD debe estar completo. Si falta, al liberar verás “La operación aún no ha sido validada por administración”.',
    alertaHref: '/operations',
    alertaLabel: 'Ir a validar cierres',
  },
  {
    id: 'comision',
    numero: 3,
    titulo: 'Comisión: cálculo y liberación',
    icon: DollarSign,
    color: '#c2410c',
    resumen: 'El motor calcula la comisión automáticamente al guardar el cierre: comisión total → 2.5% invitación (si aplica) → remanente → 80% asesor (100% si ya alcanzó su AMA) → 5% mentoría (si aplica) → el resto es ingreso de la inmobiliaria.',
    acciones: [
      { label: 'Ver Comisiones', href: '/commissions', desc: 'Da clic aquí para revisar, liberar o bloquear' },
    ],
    estados: ['Calculada', 'Pend. validación', 'Liberada', 'Bloqueada', 'Solicitada', 'Pagada', 'Cancelada'],
    decision: {
      pregunta: '¿El cierre está validado por administración y el expediente PLD completo?',
      ramas: [
        { label: 'Sí → Liberar', color: 'success', icon: CheckCircle2, desc: 'En la columna “Acciones”, da clic en el botón verde “Liberar”.', resultado: 'Pasa a “Liberada”: el asesor ya puede solicitar su pago.' },
        { label: 'No → Bloquear', color: 'error', icon: XCircle, desc: 'Da clic en el botón rojo “Bloquear” y escribe el motivo (obligatorio, ej. “Falta contrato firmado” o “Alerta PLD pendiente”).', resultado: 'Pasa a “Bloqueada”; se “Desbloquea” cuando se resuelve el motivo. Queda registrado en Auditoría.' },
      ],
    },
    alerta: 'Todo bloqueo/desbloqueo queda registrado con su motivo en la Auditoría del sistema.',
    alertaHref: '/audit',
    alertaLabel: 'Ver Auditoría',
  },
  {
    id: 'pago',
    numero: 4,
    titulo: 'Pago de la comisión liberada',
    icon: Wallet,
    color: '#7c3aed',
    resumen: 'El asesor solicita el pago de una comisión ya liberada; administración lo autoriza y registra la transferencia.',
    acciones: [
      { label: 'Ir a Pagos', href: '/payments', desc: 'Da clic aquí para solicitar o autorizar' },
    ],
    estados: ['Solicitado', 'Autorizado', 'Pagado', 'Rechazado'],
    decision: {
      pregunta: '¿Quién actúa?',
      ramas: [
        { label: 'Asesor', color: 'primary', icon: CheckCircle2, desc: 'Sobre la comisión liberada, da clic en “Solicitar pago”.', resultado: 'La solicitud pasa a “Solicitado”.' },
        { label: 'Admin', color: 'success', icon: CheckCircle2, desc: 'Da clic en “Autorizar”; tras la transferencia, en “Marcar como pagado” captura forma de pago, monto y UUID de CFDI o referencia.', resultado: 'Queda “Pagado”; la comisión se marca como liquidada.' },
      ],
    },
  },
];

// ── Diagrama de flujo: nodos y conectores (lienzo de 1060 × 1900) ─────────────

type FlowKind = 'terminal' | 'process' | 'decision';

interface FlowNode {
  id: string;
  x: number; y: number; w: number; h: number;
  kind: FlowKind;
  label: string;
  sub?: string;
  /** Instrucción concreta: qué se hace exactamente en este punto */
  tip?: string;
  href?: string;
  color: string;
}

interface FlowEdge { id: string; d: string; label?: string; lx?: number; ly?: number; color?: string; dashed?: boolean; noArrow?: boolean; }

const FLOW_W = 1180;
const FLOW_H = 2340;

const FLOW_NODES: FlowNode[] = [
  { id: 'start', x: 460, y: 16, w: 260, h: 48, kind: 'terminal', label: 'INICIO', sub: 'Propiedad nueva o cliente comprador', color: '#213a55' },
  {
    id: 'captacion', x: 420, y: 104, w: 340, h: 118, kind: 'process', color: '#1e40af', href: '/properties/new',
    label: '1. Captar la propiedad',
    sub: 'Menú → Captación → Nueva Captación Venta (o Renta)',
    tip: 'Llena dirección, precio, características y datos del propietario. Adjunta identificación, predial y el Contrato de Comisión Mercantil. Presiona Guardar.',
  },
  {
    id: 'd-docs', x: 390, y: 262, w: 400, h: 170, kind: 'decision', color: '#c2410c',
    label: '¿Documentación completa y Contrato de Comisión Mercantil firmado?',
    tip: 'Abre la propiedad con el ícono del ojo y revisa su expediente.',
  },
  {
    id: 'incompleta', x: 40, y: 292, w: 300, h: 110, kind: 'process', color: '#b91c1c', href: '/properties',
    label: 'Estatus: Incompleta',
    sub: 'No se puede publicar ni compartir',
    tip: 'Pide al asesor el documento que falta, súbelo en la ficha de la propiedad y regresa a validar.',
  },
  {
    id: 'activa', x: 420, y: 472, w: 340, h: 100, kind: 'process', color: '#1e40af', href: '/properties',
    label: 'Propiedad Activa → Publicable → Compartible',
    tip: 'En la ficha, sección “Cambiar Estatus”, elige el nuevo estado y presiona “Cambiar Estatus”. Se guarda al instante.',
  },
  {
    id: 'operacion', x: 420, y: 612, w: 340, h: 100, kind: 'process', color: '#006c49',
    label: '2. Se concreta la operación',
    sub: 'Venta o renta cerrada con el cliente',
    tip: 'Antes de registrarla, reúne el contrato firmado y el expediente KYC/PLD del cliente (identificación, RFC, PEP).',
  },
  {
    id: 'd-inv', x: 390, y: 752, w: 400, h: 170, kind: 'decision', color: '#c2410c',
    label: '¿La propiedad está en nuestro inventario?',
    tip: 'Es la primera pregunta del formulario de Nuevo Cierre.',
  },
  {
    id: 'interno', x: 40, y: 782, w: 300, h: 110, kind: 'process', color: '#1e40af',
    label: 'Cierre interno',
    sub: 'Marca “Sí” en el formulario',
    tip: 'Selecciona la propiedad de la lista: ya trae validada su documentación de captación.',
  },
  {
    id: 'externo', x: 840, y: 782, w: 300, h: 110, kind: 'process', color: '#c2410c',
    label: 'Cierre externo (colocación)',
    sub: 'Marca “No (externa)”',
    tip: 'Captura tipo de cierre, inmueble, dirección y la inmobiliaria colocadora (obligatoria). El % pactado es informativo.',
  },
  {
    id: 'registrar', x: 420, y: 982, w: 340, h: 110, kind: 'process', color: '#006c49', href: '/operations/new',
    label: '3. Registrar el cierre',
    sub: 'Menú → Operaciones → Nuevo Cierre',
    tip: 'Captura precio final de cierre, fecha y monto de comisión generada. Al guardar nace la comisión.',
  },
  {
    id: 'motor', x: 420, y: 1132, w: 340, h: 110, kind: 'process', color: '#c2410c', href: '/commissions',
    label: 'El motor calcula la comisión',
    sub: 'Estado inicial: “Calculada”',
    tip: '2.5% invitación → remanente → 80% asesor (100% si ya alcanzó su AMA) → 5% mentoría. El resto es de la inmobiliaria.',
  },
  {
    id: 'validar', x: 420, y: 1282, w: 340, h: 110, kind: 'process', color: '#006c49', href: '/operations',
    label: '4. Validar el cierre',
    sub: 'Menú → Cierres → abre el cierre',
    tip: 'Cambia el estatus a “Validado por administración” y confirma que el expediente PLD esté completo.',
  },
  {
    id: 'd-liberar', x: 390, y: 1432, w: 400, h: 170, kind: 'decision', color: '#c2410c',
    label: '¿Cierre validado y expediente PLD completo?',
    tip: 'Si no, al liberar saldrá “La operación aún no ha sido validada por administración”.',
  },
  {
    id: 'bloquear', x: 40, y: 1462, w: 300, h: 110, kind: 'process', color: '#b91c1c', href: '/commissions',
    label: 'Bloquear la comisión',
    sub: 'Botón rojo “Bloquear”',
    tip: 'Escribe el motivo (es obligatorio). Queda registrado en Auditoría y la comisión no puede pagarse.',
  },
  {
    id: 'desbloquear', x: 40, y: 1622, w: 300, h: 110, kind: 'process', color: '#c2410c', href: '/commissions',
    label: 'Resolver motivo → Desbloquear',
    sub: 'Botón “Desbloquear”',
    tip: 'Filtra por estado “Bloqueada”, resuelve lo que faltaba y la comisión vuelve a “Calculada”.',
  },
  {
    id: 'liberar', x: 420, y: 1652, w: 340, h: 110, kind: 'process', color: '#006c49', href: '/commissions',
    label: '5. Liberar la comisión',
    sub: 'Columna “Acciones” → botón verde “Liberar”',
    tip: 'Antes revisa que los montos (comisión total, neto asesor e inmobiliaria) sean correctos. Pasa a “Liberada”.',
  },
  {
    id: 'solicitar', x: 420, y: 1802, w: 340, h: 110, kind: 'process', color: '#7c3aed', href: '/payments',
    label: '6. El asesor solicita el pago',
    sub: 'Menú → Pagos',
    tip: 'El asesor localiza su comisión liberada y presiona “Solicitar pago”. Queda en estado “Solicitado”.',
  },
  {
    id: 'autorizar', x: 420, y: 1952, w: 340, h: 110, kind: 'process', color: '#7c3aed', href: '/payments',
    label: '7. Administración autoriza',
    sub: 'Botón “Autorizar”',
    tip: 'Ubica la solicitud en estado “Solicitado” y autorízala. Después realiza la transferencia al asesor.',
  },
  {
    id: 'pagado', x: 420, y: 2102, w: 340, h: 110, kind: 'process', color: '#7c3aed', href: '/payments',
    label: '8. Marcar como pagado',
    sub: 'Botón “Marcar como pagado”',
    tip: 'Captura forma de pago, monto pagado y el UUID del CFDI o la referencia de transferencia.',
  },
  { id: 'end', x: 460, y: 2252, w: 260, h: 48, kind: 'terminal', label: 'FIN', sub: 'Comisión pagada y liquidada', color: '#006c49' },
];

const FLOW_EDGES: FlowEdge[] = [
  { id: 'e1', d: 'M590,64 V104' },
  { id: 'e2', d: 'M590,222 V262' },
  { id: 'e3', d: 'M390,347 H340', label: 'No', lx: 365, ly: 335, color: '#b91c1c' },
  { id: 'e4', d: 'M40,347 H14 V163 H420', label: 'Completar expediente', lx: 140, ly: 152, color: '#b91c1c', dashed: true },
  { id: 'e5', d: 'M590,432 V472', label: 'Sí', lx: 608, ly: 458, color: '#006c49' },
  { id: 'e6', d: 'M590,572 V612' },
  { id: 'e7', d: 'M590,712 V752' },
  { id: 'e8', d: 'M390,837 H340', label: 'Sí', lx: 365, ly: 825, color: '#1e40af' },
  { id: 'e9', d: 'M790,837 H840', label: 'No', lx: 815, ly: 825, color: '#c2410c' },
  { id: 'e10', d: 'M190,892 V952 H590 V982' },
  { id: 'e11', d: 'M990,892 V952 H590', noArrow: true },
  { id: 'e12', d: 'M590,1092 V1132' },
  { id: 'e13', d: 'M590,1242 V1282' },
  { id: 'e14', d: 'M590,1392 V1432' },
  { id: 'e15', d: 'M390,1517 H340', label: 'No', lx: 365, ly: 1505, color: '#b91c1c' },
  { id: 'e16', d: 'M190,1572 V1622' },
  { id: 'e17', d: 'M40,1677 H14 V1412 H590 V1432', label: 'Motivo resuelto', lx: 160, ly: 1401, color: '#c2410c', dashed: true },
  { id: 'e18', d: 'M590,1602 V1652', label: 'Sí', lx: 608, ly: 1628, color: '#006c49' },
  { id: 'e19', d: 'M590,1762 V1802' },
  { id: 'e20', d: 'M590,1912 V1952' },
  { id: 'e21', d: 'M590,2062 V2102' },
  { id: 'e22', d: 'M590,2212 V2252' },
];

// ── Ruta completa: el proceso de A a Z, paso por paso ─────────────────────────

interface RutaPaso {
  id: string;
  fase: string;
  color: string;
  titulo: string;
  quien: string;
  donde: string;
  href?: string;
  hrefLabel?: string;
  clics: string[];
  resultado: string;
  siguiente: string;
  captura: string;      // nombre del archivo en /public/guia-capturas/
  capturaDesc: string;  // qué debe mostrar esa captura
  ojo?: string;
}

const RUTA: RutaPaso[] = [
  // ── FASE 1: CAPTACIÓN ──
  {
    id: 'r01', fase: 'Captación', color: '#1e40af',
    titulo: 'Da de alta la propiedad',
    quien: 'Asesor o Admin',
    donde: 'Menú lateral → sección “Captación” → “Nueva Captación Venta” (o “Nueva Captación Renta” si es renta).',
    href: '/properties/new', hrefLabel: 'Abrir Nueva Captación Venta',
    clics: [
      'En el menú de la izquierda busca la sección “Captación”.',
      'Da clic en “Nueva Captación Venta”. Si la propiedad es para rentar, da clic en “Nueva Captación Renta”.',
      'Llena los datos del inmueble: dirección, precio, características.',
      'Llena los datos del propietario.',
      'Indica el estatus de autorización y si el Contrato de Comisión Mercantil ya está firmado.',
      'Da clic en “Guardar”.',
    ],
    resultado: 'La propiedad queda registrada y aparece en el inventario de Propiedades en Venta (o en Renta). Su estatus inicial normalmente es “Incompleta” o “En revisión”, porque todavía le faltan documentos.',
    siguiente: 'Ya diste de alta la propiedad. AHORA SIGUE: subirle los documentos del expediente (Paso 2). Sin documentos la propiedad NO se puede publicar ni compartir.',
    captura: 'r01-nueva-captacion', capturaDesc: 'El formulario “Nueva Captación Venta” completo, con el botón Guardar visible.',
  },
  {
    id: 'r02', fase: 'Captación', color: '#1e40af',
    titulo: 'Sube los documentos de la propiedad',
    quien: 'Asesor o Admin',
    donde: 'Menú lateral → “Propiedades en Venta” → busca tu propiedad → ícono del ojo para abrir su ficha.',
    href: '/properties', hrefLabel: 'Ir a Propiedades en Venta',
    clics: [
      'Entra a “Propiedades en Venta”.',
      'Localiza en la lista la propiedad que acabas de dar de alta.',
      'Da clic en el ícono del ojo (👁) al final del renglón para abrir su ficha.',
      'Busca la sección de documentos / expediente.',
      'Sube cada documento: identificación del propietario, predial, Contrato de Comisión Mercantil firmado y el documento que acredite la propiedad.',
    ],
    resultado: 'El expediente de la propiedad se va completando. Cada documento cargado queda guardado en su ficha.',
    siguiente: 'Ya subiste los documentos. AHORA SIGUE: que un administrador los revise y cambie el estatus de la propiedad (Paso 3).',
    captura: 'r02-documentos-propiedad', capturaDesc: 'La ficha de una propiedad mostrando la sección de documentos con archivos cargados.',
    ojo: 'Si te falta un documento, la propiedad se queda en “Incompleta” y no avanza. Consíguelo antes de seguir.',
  },
  {
    id: 'r03', fase: 'Captación', color: '#1e40af',
    titulo: 'Valida los documentos y cambia el estatus',
    quien: 'Admin o Super Admin',
    donde: 'Menú lateral → “Propiedades en Venta” → ficha de la propiedad (ícono del ojo) → sección “Cambiar Estatus”.',
    href: '/properties', hrefLabel: 'Ir a validar propiedades',
    clics: [
      'Abre la ficha de la propiedad con el ícono del ojo.',
      'Revisa uno por uno los documentos que subió el asesor.',
      'Baja a la sección “Cambiar Estatus”.',
      'Elige el nuevo estatus: “Activa” si ya está completa; “Publicable” si además tiene el contrato firmado; “Compartible” si se puede compartir con otras inmobiliarias.',
      'Da clic en el botón “Cambiar Estatus”. El cambio se guarda al instante.',
    ],
    resultado: 'La propiedad avanza en el flujo: Incompleta → En revisión → Activa → Publicable → Compartible. Ya se puede promocionar.',
    siguiente: 'La propiedad ya está lista para venderse. AHORA SIGUE: cuando aparezca un comprador, das de alta al cliente (Paso 4).',
    captura: 'r03-cambiar-estatus', capturaDesc: 'La sección “Cambiar Estatus” abierta con el selector de estados desplegado.',
  },

  // ── FASE 2: CLIENTE ──
  {
    id: 'r04', fase: 'Cliente', color: '#0891b2',
    titulo: 'Registra al cliente comprador',
    quien: 'Asesor o Admin',
    donde: 'Menú lateral → “Clientes”.',
    href: '/clients', hrefLabel: 'Ir a Clientes',
    clics: [
      'Entra al módulo “Clientes”.',
      'Da de alta al cliente con sus datos de contacto.',
      'Llena su expediente KYC: identificación, RFC y si es PEP (Persona Expuesta Políticamente).',
    ],
    resultado: 'El cliente queda en el directorio con su expediente iniciado.',
    siguiente: 'Ya tienes al cliente registrado. AHORA SIGUE: registrar el cierre de la operación (Paso 5).',
    captura: 'r04-alta-cliente', capturaDesc: 'El formulario de alta de cliente con los campos del expediente KYC.',
    ojo: 'Si el monto de la operación supera el umbral PLD configurado, este expediente es OBLIGATORIO y completo, o la comisión no se podrá liberar más adelante.',
  },

  // ── FASE 3: CIERRE ──
  {
    id: 'r05', fase: 'Cierre', color: '#006c49',
    titulo: 'Abre el formulario de Nuevo Cierre',
    quien: 'Asesor o Admin',
    donde: 'Menú lateral → sección “Operaciones” → “Nuevo Cierre”.',
    href: '/operations/new', hrefLabel: 'Abrir Nuevo Cierre',
    clics: [
      'En el menú de la izquierda busca la sección “Operaciones”.',
      'Da clic en “Nuevo Cierre”.',
    ],
    resultado: 'Se abre el formulario de registro de la operación.',
    siguiente: 'Ya estás dentro del formulario. AHORA SIGUE: la primera pregunta decide todo el resto — si la propiedad es tuya o de otra inmobiliaria (Paso 6).',
    captura: 'r05-nuevo-cierre', capturaDesc: 'El formulario “Nuevo Cierre” recién abierto, arriba de todo.',
  },
  {
    id: 'r06', fase: 'Cierre', color: '#006c49',
    titulo: 'Responde: ¿la propiedad está en el inventario?',
    quien: 'Asesor o Admin',
    donde: 'Dentro del formulario de Nuevo Cierre, es la primera pregunta.',
    href: '/operations/new', hrefLabel: 'Ir a Nuevo Cierre',
    clics: [
      'Busca la pregunta “¿La propiedad está en el inventario?”.',
      'Si NOSOTROS captamos la propiedad → marca “Sí” y selecciónala de la lista que aparece.',
      'Si la captó OTRA inmobiliaria y nosotros solo trajimos al comprador → marca “No (externa)”.',
      'Si marcaste “No (externa)”: captura el tipo de cierre externo, el tipo de inmueble y la dirección.',
      'Si marcaste “No (externa)”: llena “Datos del colocador”. La inmobiliaria o agente externo es OBLIGATORIO; contacto, teléfono y correo son opcionales.',
    ],
    resultado: 'El formulario se adapta a tu respuesta. En cierre externo NO te pide documentos de captación de la propiedad, porque esos los resguarda la inmobiliaria que la captó.',
    siguiente: 'Ya definiste el origen de la propiedad. AHORA SIGUE: capturar el dinero de la operación (Paso 7).',
    captura: 'r06-inventario-si-no', capturaDesc: 'La pregunta “¿La propiedad está en el inventario?” con las dos opciones, y abajo el bloque “Datos del colocador”.',
    ojo: 'El “% de comisión pactada” con el colocador externo es SOLO INFORMATIVO. No cambia el cálculo: el motor reparte igual que en cualquier cierre.',
  },
  {
    id: 'r07', fase: 'Cierre', color: '#006c49',
    titulo: 'Captura el precio y la comisión, y guarda',
    quien: 'Asesor o Admin',
    donde: 'Parte final del formulario de Nuevo Cierre.',
    href: '/operations/new', hrefLabel: 'Ir a Nuevo Cierre',
    clics: [
      'Ingresa el precio final de cierre.',
      'Ingresa la fecha del cierre.',
      'Ingresa el monto de comisión generada.',
      'Da clic en “Guardar”.',
    ],
    resultado: 'Al guardar, el motor calcula SOLO la comisión y la reparte: 2.5% de invitación (si aplica) → del remanente, 80% para el asesor (100% si ya alcanzó su meta AMA) → 5% de mentoría (si aplica). Lo que sobra es el ingreso de la inmobiliaria.',
    siguiente: 'El cierre ya existe y la comisión ya nació en estado “Calculada”. AHORA SIGUE: subir los documentos del cierre (Paso 8).',
    captura: 'r07-montos-cierre', capturaDesc: 'Los campos de precio final, fecha y comisión generada, con el botón Guardar.',
    ojo: 'Tú NO calculas la comisión a mano. Solo capturas la comisión generada total; el reparto lo hace el sistema.',
  },
  {
    id: 'r08', fase: 'Cierre', color: '#006c49',
    titulo: 'Sube los documentos del cierre',
    quien: 'Asesor o Admin',
    donde: 'Menú lateral → “Cierres” → abre la operación que acabas de crear.',
    href: '/operations', hrefLabel: 'Ir a Cierres',
    clics: [
      'Entra al módulo “Cierres”.',
      'Abre la operación que acabas de registrar.',
      'Sube los documentos del cierre (contrato de compraventa o de arrendamiento).',
      'Verifica que el expediente KYC/PLD del cliente esté completo.',
    ],
    resultado: 'El expediente de la operación queda armado y listo para que administración lo revise.',
    siguiente: 'Ya está el expediente. AHORA SIGUE: que un administrador valide el cierre (Paso 9). Sin esto NO se puede liberar la comisión.',
    captura: 'r08-docs-cierre', capturaDesc: 'El detalle de una operación mostrando sus documentos cargados.',
  },
  {
    id: 'r09', fase: 'Cierre', color: '#006c49',
    titulo: 'Valida el cierre como administración',
    quien: 'Admin o Super Admin',
    donde: 'Menú lateral → “Cierres” → abre la operación → cambia su estatus.',
    href: '/operations', hrefLabel: 'Ir a validar cierres',
    clics: [
      'Entra al módulo “Cierres”.',
      'Abre la operación que quieres validar.',
      'Revisa los documentos y los montos.',
      'Cambia el estatus a “Validado por administración”.',
    ],
    resultado: 'La operación queda aprobada y contabilizada. Este es el candado que habilita la liberación de la comisión.',
    siguiente: 'El cierre ya está validado. AHORA SIGUE: revisar la comisión que generó (Paso 10).',
    captura: 'r09-validar-cierre', capturaDesc: 'La operación con el estatus cambiado a “Validado por administración”.',
    ojo: 'Si te saltas este paso, al intentar liberar la comisión te va a salir el mensaje: “La operación aún no ha sido validada por administración”.',
  },

  // ── FASE 4: COMISIÓN ──
  {
    id: 'r10', fase: 'Comisión', color: '#c2410c',
    titulo: 'Revisa la comisión calculada',
    quien: 'Admin, Super Admin o Jurídico',
    donde: 'Menú lateral → sección “Operaciones” → “Comisiones”.',
    href: '/commissions', hrefLabel: 'Ir a Comisiones',
    clics: [
      'Entra al módulo “Comisiones”.',
      'Busca la comisión del cierre que acabas de validar. Usa el buscador o el filtro de estado.',
      'Debe estar en estado “Calculada” o “Pendiente validación”.',
      'Revisa que los montos sean correctos: comisión total, neto del asesor y monto de la inmobiliaria.',
    ],
    resultado: 'Confirmas que el reparto que hizo el motor es el correcto antes de autorizarlo.',
    siguiente: 'Ya revisaste los números. AHORA SIGUE: la decisión — liberar si todo está bien, o bloquear si algo falta (Paso 11).',
    captura: 'r10-comision-calculada', capturaDesc: 'La lista de Comisiones con una comisión en estado “Calculada” y sus montos visibles.',
  },
  {
    id: 'r11', fase: 'Comisión', color: '#c2410c',
    titulo: 'Libera la comisión (o bloquéala)',
    quien: 'Admin, Super Admin o Jurídico',
    donde: 'Módulo “Comisiones” → columna “Acciones” del renglón de la comisión.',
    href: '/commissions', hrefLabel: 'Ir a Comisiones',
    clics: [
      'SI TODO ESTÁ BIEN → da clic en el botón VERDE “Liberar”. La comisión pasa a estado “Liberada”.',
      'SI FALTA ALGO → da clic en el botón ROJO “Bloquear”.',
      'Al bloquear se abre un campo de texto: escribe el motivo (por ejemplo “Falta contrato de comisión firmado” o “Alerta PLD pendiente”). El motivo es OBLIGATORIO.',
      'Da clic en “OK” para confirmar el bloqueo.',
    ],
    resultado: 'Liberada = el asesor ya puede pedir su pago. Bloqueada = la comisión queda retenida y no se puede pagar; el motivo queda registrado en la Auditoría.',
    siguiente: 'Si la LIBERASTE, ve al Paso 13 (el asesor pide su pago). Si la BLOQUEASTE, ve al Paso 12 (resolver y desbloquear).',
    captura: 'r11-liberar-bloquear', capturaDesc: 'La columna “Acciones” con los botones verde “Liberar” y rojo “Bloquear” visibles.',
    ojo: 'Si no ves estos botones es porque tu rol es Asesor. Solo Super Admin, Admin y Jurídico pueden liberar o bloquear.',
  },
  {
    id: 'r12', fase: 'Comisión', color: '#c2410c',
    titulo: 'Solo si la bloqueaste: resuelve y desbloquea',
    quien: 'Admin, Super Admin o Jurídico',
    donde: 'Módulo “Comisiones” → filtra por estado “Bloqueada”.',
    href: '/commissions', hrefLabel: 'Ir a Comisiones',
    clics: [
      'Resuelve primero el motivo real del bloqueo (consigue el documento, cierra la alerta PLD, etc.).',
      'Entra a “Comisiones” y filtra por estado “Bloqueada”.',
      'Localiza la comisión.',
      'En la columna “Acciones”, da clic en “Desbloquear”.',
    ],
    resultado: 'La comisión regresa al estado “Calculada”.',
    siguiente: 'Ya está desbloqueada. AHORA SIGUE: regresa al Paso 11 y ahora sí dale “Liberar”.',
    captura: 'r12-desbloquear', capturaDesc: 'Una comisión en estado “Bloqueada” con el botón “Desbloquear” en Acciones.',
  },

  // ── FASE 5: PAGO ──
  {
    id: 'r13', fase: 'Pago', color: '#6d28d9',
    titulo: 'El asesor solicita su pago',
    quien: 'Asesor',
    donde: 'Menú lateral → “Pagos”.',
    href: '/payments', hrefLabel: 'Ir a Pagos',
    clics: [
      'Entra al módulo “Pagos”.',
      'En la lista de comisiones liberadas, localiza la que quieres cobrar.',
      'Da clic en “Solicitar pago”.',
    ],
    resultado: 'La solicitud se envía a administración y queda en estado “Solicitado”.',
    siguiente: 'La solicitud ya está enviada. AHORA SIGUE: que administración la autorice (Paso 14).',
    captura: 'r13-solicitar-pago', capturaDesc: 'La lista de Pagos con el botón “Solicitar pago” sobre una comisión liberada.',
    ojo: 'Solo aparecen aquí las comisiones que YA fueron liberadas. Si no ves la tuya, todavía no la liberan.',
  },
  {
    id: 'r14', fase: 'Pago', color: '#6d28d9',
    titulo: 'Administración autoriza el pago',
    quien: 'Admin o Super Admin',
    donde: 'Menú lateral → “Pagos”.',
    href: '/payments', hrefLabel: 'Ir a Pagos',
    clics: [
      'Entra al módulo “Pagos”.',
      'Ubica la solicitud en estado “Solicitado”.',
      'Da clic en “Autorizar”.',
    ],
    resultado: 'La solicitud pasa a estado “Autorizado”. Ya puedes hacer la transferencia.',
    siguiente: 'Ya autorizaste. AHORA SIGUE: haz la transferencia bancaria por fuera y luego regístrala en el sistema (Paso 15).',
    captura: 'r14-autorizar-pago', capturaDesc: 'Una solicitud en estado “Solicitado” con el botón “Autorizar”.',
  },
  {
    id: 'r15', fase: 'Pago', color: '#6d28d9',
    titulo: 'Registra la transferencia como pagada',
    quien: 'Admin o Super Admin',
    donde: 'Menú lateral → “Pagos” → sobre el pago autorizado.',
    href: '/payments', hrefLabel: 'Ir a Pagos',
    clics: [
      'Haz primero la transferencia bancaria real al asesor (o a la cuenta del Team, si es un equipo).',
      'Regresa a “Pagos” y da clic en “Marcar como pagado”.',
      'Captura la forma de pago.',
      'Captura el monto pagado.',
      'Si aplica, captura el UUID del CFDI o la referencia de la transferencia.',
      'Confirma.',
    ],
    resultado: 'El pago queda en estado “Pagado” y la comisión se marca como liquidada. El ciclo del dinero terminó.',
    siguiente: 'Operación cerrada por completo. AHORA SIGUE: verificar que todo quedó reflejado (Paso 16).',
    captura: 'r15-marcar-pagado', capturaDesc: 'El formulario de “Marcar como pagado” con forma de pago, monto y UUID del CFDI.',
  },

  // ── FASE 6: CIERRE DEL CICLO ──
  {
    id: 'r16', fase: 'Verificación', color: '#213a55',
    titulo: 'Verifica que todo quedó registrado',
    quien: 'Admin o Super Admin',
    donde: 'Dashboard, ficha del asesor y Auditoría.',
    href: '/dashboard', hrefLabel: 'Ir al Dashboard',
    clics: [
      'Entra al Dashboard y confirma que el cierre y la comisión aparecen en los indicadores.',
      'Cambia a la pestaña “Mi Dashboard” y usa el selector de asesor para ver cómo le quedó su avance AMA.',
      'Si quieres el rastro completo de quién hizo qué, entra al módulo “Auditoría”.',
    ],
    resultado: 'Confirmas que la operación impactó correctamente los números del asesor y de la inmobiliaria.',
    siguiente: 'Terminaste el ciclo completo. Para la siguiente propiedad, regresa al Paso 1.',
    captura: 'r16-verificacion', capturaDesc: 'El Dashboard mostrando los KPIs actualizados, o la pestaña “Mi Dashboard” con el avance AMA.',
  },
];

interface ProcesoTransversal { label: string; desc: string; icon: React.ElementType; color: string; href: string; linkLabel: string; }
const PROCESO_TRANSVERSAL: ProcesoTransversal[] = [
  { label: 'Cumplimiento PLD', desc: 'Corre en paralelo desde la captación del cliente hasta la liberación de la comisión: si el monto supera el umbral PLD, exige expediente KYC completo. Sin esto, la comisión no se libera.', icon: ShieldAlert, color: '#991b1b', href: '/compliance', linkLabel: 'Ir a Cumplimiento' },
  { label: 'Auditoría', desc: 'Registra automáticamente cada acción sensible del flujo: validaciones, liberaciones, bloqueos, pagos y cambios de configuración.', icon: History, color: '#5a6070', href: '/audit', linkLabel: 'Ver Auditoría' },
];

const ROLE_BADGE: Record<Role, string> = {
  'Super Admin': 'badge-primary',
  Admin: 'badge-primary',
  Asesor: 'badge-success',
  Jurídico: 'badge-warning',
};

type Category = 'inicio' | 'ruta' | 'guias' | 'faq' | 'glosario' | 'proceso';

const CATEGORIES: { id: Category; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: 'inicio', label: 'Inicio', icon: Map },
  { id: 'ruta', label: 'Ruta completa A → Z', icon: Route },
  { id: 'guias', label: 'Guías paso a paso', icon: ListChecks },
  { id: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle },
  { id: 'glosario', label: 'Glosario de estados', icon: Tag },
  { id: 'proceso', label: 'Mapa del Proceso', icon: Workflow, adminOnly: true },
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

function EstadoFlowChips({ estados }: { estados: string[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {estados.map((e, i) => (
        <span key={e} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="badge badge-neutral" style={{ fontSize: 10.5 }}>{e}</span>
          {i < estados.length - 1 && <ArrowRight size={11} style={{ color: 'var(--color-outline)' }} />}
        </span>
      ))}
    </div>
  );
}

function DecisionBlock({ decision }: { decision: ProcesoDecision }) {
  return (
    <div style={{ marginTop: 14, padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)', border: '1px dashed var(--color-outline-variant)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <GitBranch size={15} style={{ color: 'var(--color-on-surface-variant)' }} />
        <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--color-on-surface)' }}>{decision.pregunta}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {decision.ramas.map((r) => {
          const RIcon = r.icon;
          const c = RAMA_COLOR[r.color];
          return (
            <div key={r.label} style={{ flex: '1 1 220px', minWidth: 200, padding: 12, borderRadius: 'var(--radius-md)', background: `${c}0d`, border: `1px solid ${c}40` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <RIcon size={15} style={{ color: c }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: c }}>{r.label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{r.desc}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', marginTop: 6, fontStyle: 'italic' }}>→ {r.resultado}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FaseCard({ fase, isLast }: { fase: ProcesoFase; isLast: boolean }) {
  const router = useRouter();
  const Icon = fase.icon;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', gap: 16 }}>
      {/* Columna del timeline: círculo + línea conectora */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: fase.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, fontSize: 14, boxShadow: `0 0 0 4px ${fase.color}1f` }}>
          {fase.numero}
        </div>
        {!isLast && (
          <>
            <div style={{ width: 2, flex: 1, minHeight: 24, background: 'var(--color-outline-variant)', marginTop: 4 }} />
            <ArrowDown size={14} style={{ color: 'var(--color-outline)', marginBottom: 4 }} />
          </>
        )}
      </div>

      {/* Contenido de la fase */}
      <div className="card" style={{ marginBottom: isLast ? 0 : 20, borderLeft: `4px solid ${fase.color}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${fase.color}18`, color: fase.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>Fase {fase.numero}: {fase.titulo}</div>
            <div style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', marginTop: 4, lineHeight: 1.5 }}>{fase.resumen}</div>
          </div>
        </div>

        {/* Acciones (clic aquí) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: fase.documentos || fase.estados ? 12 : 0 }}>
          {fase.acciones.map((a) => (
            <button
              key={a.href}
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '6px 14px' }}
              onClick={() => router.push(a.href)}
              title={a.desc}
            >
              {a.label} <ArrowRight size={13} />
            </button>
          ))}
        </div>

        {/* Documentos requeridos */}
        {fase.documentos && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>Documentos a validar</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {fase.documentos.map((d) => (
                <span key={d} className="badge badge-primary" style={{ fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileCheck size={11} /> {d}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Estados por los que pasa */}
        {fase.estados && (
          <div style={{ marginBottom: fase.decision || fase.alerta ? 4 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 }}>Estados</div>
            <EstadoFlowChips estados={fase.estados} />
          </div>
        )}

        {/* Decisión / bifurcación */}
        {fase.decision && <DecisionBlock decision={fase.decision} />}

        {/* Alerta / requisito */}
        {fase.alerta && (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 'var(--radius-md)', background: '#fffbeb', border: '1px solid #fde68a' }}>
            <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>{fase.alerta}</div>
              {fase.alertaHref && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 8, fontSize: 11.5, padding: '5px 12px' }}
                  onClick={() => router.push(fase.alertaHref!)}
                >
                  {fase.alertaLabel ?? 'Ir'} <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlowNodeBox({ node, onGo }: { node: FlowNode; onGo: (href: string) => void }) {
  const clickable = Boolean(node.href);
  const base: React.CSSProperties = {
    position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', cursor: clickable ? 'pointer' : 'default', padding: '6px 12px',
    transition: 'transform 0.12s, box-shadow 0.12s',
  };
  const go = () => { if (node.href) onGo(node.href); };

  // Rombo de decisión: dos capas con clip-path para simular el borde
  if (node.kind === 'decision') {
    return (
      <div style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, height: node.h }}>
        <div style={{ position: 'absolute', inset: 0, background: node.color, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
        <div style={{ position: 'absolute', inset: 2, background: '#fffbeb', clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 88px', textAlign: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: '#78350f', lineHeight: 1.3 }}>{node.label}</span>
          {node.tip && (
            <span style={{ fontSize: 9.5, color: '#92400e', lineHeight: 1.35, marginTop: 5, fontStyle: 'italic' }}>{node.tip}</span>
          )}
        </div>
      </div>
    );
  }

  if (node.kind === 'terminal') {
    return (
      <div style={{ ...base, borderRadius: 999, background: node.color, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6 }}>{node.label}</span>
        {node.sub && <span style={{ fontSize: 10, opacity: 0.85, marginTop: 1 }}>{node.sub}</span>}
      </div>
    );
  }

  return (
    <div
      onClick={go}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); go(); } }}
      title={clickable ? 'Da clic para ir a esta pantalla' : undefined}
      style={{
        ...base,
        borderRadius: 'var(--radius-md)', background: '#fff',
        border: `2px solid ${node.color}`, borderLeftWidth: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={(e) => { if (clickable) { const t = e.currentTarget; t.style.transform = 'translateY(-2px)'; t.style.boxShadow = `0 6px 16px ${node.color}40`; } }}
      onMouseLeave={(e) => { const t = e.currentTarget; t.style.transform = 'none'; t.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)'; }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 700, color: node.color, lineHeight: 1.25 }}>{node.label}</span>
      {node.sub && (
        <span style={{ fontSize: 10, fontWeight: 600, color: node.color, opacity: 0.8, lineHeight: 1.3, marginTop: 3 }}>{node.sub}</span>
      )}
      {node.tip && (
        <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', lineHeight: 1.4, marginTop: 5 }}>{node.tip}</span>
      )}
      {clickable && (
        <span style={{ position: 'absolute', right: 5, top: 4, display: 'flex', alignItems: 'center', gap: 2, fontSize: 8.5, fontWeight: 700, color: node.color, opacity: 0.7 }}>
          IR <ArrowRight size={8} />
        </span>
      )}
    </div>
  );
}

function FlowDiagramModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [zoom, setZoom] = useState(0.75);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const go = (href: string) => { onClose(); router.push(href); };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: 1400, height: '100%', maxHeight: '94vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        {/* Barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--color-outline-variant)', flexWrap: 'wrap' }}>
          <Workflow size={18} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>Diagrama de flujo del proceso completo</div>
            <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', marginTop: 1 }}>Captación → cierre → comisión → liberación → pago. Da clic en cualquier caja para ir a esa pantalla.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>−</button>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 44, textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>{Math.round(zoom * 100)}%</span>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>+</button>
            <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setZoom(0.75)}>Ajustar</button>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onClose}>Cerrar</button>
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '8px 18px', borderBottom: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}>
          {[
            { c: '#213a55', t: 'Inicio / Fin', shape: 'pill' },
            { c: '#1e40af', t: 'Paso del proceso (clic = ir)', shape: 'box' },
            { c: '#c2410c', t: 'Decisión', shape: 'diamond' },
            { c: '#b91c1c', t: 'Ruta de bloqueo / faltante', shape: 'box' },
            { c: '#006c49', t: 'Ruta aprobada', shape: 'box' },
          ].map((l) => (
            <span key={l.t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
              <span style={{
                width: 14, height: 14, background: l.shape === 'diamond' ? l.c : '#fff', border: `2px solid ${l.c}`,
                borderRadius: l.shape === 'pill' ? 999 : 3,
                clipPath: l.shape === 'diamond' ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' : undefined,
                flexShrink: 0,
              }} />
              {l.t}
            </span>
          ))}
        </div>

        {/* Lienzo */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface-container-low)', padding: 20 }}>
          <div style={{ width: FLOW_W * zoom, height: FLOW_H * zoom, margin: '0 auto', position: 'relative' }}>
            <div style={{ width: FLOW_W, height: FLOW_H, position: 'relative', transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
              {/* Conectores */}
              <svg width={FLOW_W} height={FLOW_H} style={{ position: 'absolute', inset: 0 }}>
                <defs>
                  {['#5a6070', '#b91c1c', '#006c49', '#1e40af', '#c2410c'].map((c) => (
                    <marker key={c} id={`arrow-${c.replace('#', '')}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                    </marker>
                  ))}
                </defs>
                {FLOW_EDGES.map((e) => {
                  const c = e.color ?? '#5a6070';
                  return (
                    <g key={e.id}>
                      <path
                        d={e.d}
                        fill="none"
                        stroke={c}
                        strokeWidth={2}
                        strokeDasharray={e.dashed ? '6 5' : undefined}
                        markerEnd={e.noArrow ? undefined : `url(#arrow-${c.replace('#', '')})`}
                      />
                      {e.label && (
                        <text x={e.lx} y={e.ly} fontSize={11} fontWeight={700} fill={c} textAnchor="middle">{e.label}</text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Nodos */}
              {FLOW_NODES.map((n) => <FlowNodeBox key={n.id} node={n} onGo={go} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RutaCaptura({ paso }: { paso: RutaPaso }) {
  const [falla, setFalla] = useState(false);

  if (falla) {
    return (
      <div
        style={{
          borderRadius: 'var(--radius-md)', border: '2px dashed var(--color-outline-variant)',
          background: 'var(--color-surface-container-low)', padding: '26px 20px', textAlign: 'center',
        }}
      >
        <ImageIcon size={26} style={{ color: 'var(--color-outline)', margin: '0 auto' }} />
        <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--color-on-surface-variant)', marginTop: 8 }}>Captura pendiente</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', marginTop: 6, lineHeight: 1.5, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
          {paso.capturaDesc}
        </div>
        <code style={{ display: 'inline-block', marginTop: 10, fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
          public/guia-capturas/{paso.captura}.png
        </code>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/guia-capturas/${paso.captura}.png`}
      alt={paso.capturaDesc}
      onError={() => setFalla(true)}
      style={{ width: '100%', maxWidth: '100%', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)', display: 'block' }}
    />
  );
}

function RutaPasoPanel({ paso, indice, total }: { paso: RutaPaso; indice: number; total: number }) {
  const router = useRouter();

  return (
    <div className="card" style={{ borderTop: `5px solid ${paso.color}` }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: paso.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
          {indice + 1}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span className="badge" style={{ fontSize: 10, background: `${paso.color}1a`, color: paso.color, fontWeight: 700 }}>{paso.fase}</span>
            <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>Paso {indice + 1} de {total}</span>
            <span className="badge badge-neutral" style={{ fontSize: 10 }}>Lo hace: {paso.quien}</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--color-on-surface)', lineHeight: 1.25 }}>{paso.titulo}</h3>
        </div>
      </div>

      {/* Dónde estoy */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 'var(--radius-md)', background: `${paso.color}0d`, border: `1px solid ${paso.color}33` }}>
        <MapPin size={16} style={{ color: paso.color, flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: paso.color, marginBottom: 3 }}>Dónde se hace</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{paso.donde}</div>
          {paso.href && (
            <button className="btn btn-primary" style={{ marginTop: 10, fontSize: 12, padding: '6px 14px' }} onClick={() => router.push(paso.href!)}>
              {paso.hrefLabel ?? 'Ir a esta pantalla'} <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Dónde le pico */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', marginBottom: 8 }}>Dónde le picas, en orden</div>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {paso.clics.map((c, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </div>
              <span style={{ fontSize: 13, color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{c}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Captura */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', marginBottom: 8 }}>Así se ve la pantalla</div>
        <RutaCaptura paso={paso} />
      </div>

      {/* Ojo */}
      {paso.ojo && (
        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 'var(--radius-md)', background: '#fffbeb', border: '1px solid #fde68a' }}>
          <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: '#78350f', lineHeight: 1.5 }}><strong>Ojo: </strong>{paso.ojo}</div>
        </div>
      )}

      {/* Qué pasó */}
      <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--color-surface-container-low)' }}>
        <CheckCircle2 size={16} style={{ color: '#006c49', flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: '#006c49', marginBottom: 3 }}>Qué acaba de pasar</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-on-surface)', lineHeight: 1.5 }}>{paso.resultado}</div>
        </div>
      </div>

      {/* Y ahora qué sigue — lo más importante */}
      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 'var(--radius-md)', background: 'linear-gradient(120deg, var(--color-primary) 0%, #2d4f6e 100%)', color: '#fff' }}>
        <ArrowRightCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85, marginBottom: 3 }}>¿Y ahora qué sigue?</div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>{paso.siguiente}</div>
        </div>
      </div>
    </div>
  );
}

function RutaCompleta() {
  const [idx, setIdx] = useState(0);
  const [verTodo, setVerTodo] = useState(false);
  const paso = RUTA[idx];

  // Agrupa los pasos por fase para el índice lateral
  const fases = useMemo(() => {
    const map: { fase: string; color: string; pasos: { p: RutaPaso; i: number }[] }[] = [];
    RUTA.forEach((p, i) => {
      const last = map[map.length - 1];
      if (last && last.fase === p.fase) last.pasos.push({ p, i });
      else map.push({ fase: p.fase, color: p.color, pasos: [{ p, i }] });
    });
    return map;
  }, []);

  return (
    <>
      {/* Encabezado explicativo */}
      <div className="card" style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: '#1e40af18', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Route size={21} />
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-on-surface)' }}>La ruta completa, de principio a fin</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-on-surface-variant)', marginTop: 4, lineHeight: 1.55 }}>
            {RUTA.length} pasos en orden, desde que das de alta la propiedad hasta que la comisión queda pagada.
            Cada paso te dice dónde estás, dónde le picas, qué acaba de pasar y —sobre todo— <strong>qué sigue después</strong>.
          </div>
        </div>
        <button
          onClick={() => setVerTodo((v) => !v)}
          className="btn btn-secondary"
          style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
        >
          {verTodo ? <><ListChecks size={14} /> Ver paso por paso</> : <><FileText size={14} /> Ver todos los pasos seguidos</>}
        </button>
      </div>

      {verTodo ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {RUTA.map((p, i) => <RutaPasoPanel key={p.id} paso={p} indice={i} total={RUTA.length} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          {/* Índice lateral */}
          <div className="card" style={{ position: 'sticky', top: 16, padding: '14px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', margin: '0 6px 10px' }}>Los {RUTA.length} pasos</div>
            {fases.map((f) => (
              <div key={f.fase} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: f.color, margin: '0 6px 5px' }}>{f.fase}</div>
                {f.pasos.map(({ p, i }) => {
                  const activo = i === idx;
                  const hecho = i < idx;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setIdx(i)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%', textAlign: 'left',
                        padding: '7px 8px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: activo ? `${f.color}14` : 'transparent',
                        transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                        background: activo ? f.color : (hecho ? `${f.color}33` : 'var(--color-surface-container-high)'),
                        color: activo ? '#fff' : 'var(--color-on-surface-variant)',
                      }}>{i + 1}</span>
                      <span style={{ fontSize: 12, lineHeight: 1.35, color: activo ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)', fontWeight: activo ? 650 : 400 }}>
                        {p.titulo}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Paso actual */}
          <div>
            {/* Barra de avance */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--color-surface-container-high)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${((idx + 1) / RUTA.length) * 100}%`, background: paso.color, transition: 'width 0.25s' }} />
              </div>
            </div>

            <RutaPasoPanel paso={paso} indice={idx} total={RUTA.length} />

            {/* Navegación */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 13, padding: '9px 16px' }}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
              >
                ← Paso anterior
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: 13, padding: '9px 18px' }}
                onClick={() => setIdx((i) => Math.min(RUTA.length - 1, i + 1))}
                disabled={idx === RUTA.length - 1}
              >
                {idx === RUTA.length - 1 ? 'Último paso' : 'Ya lo hice, ¿qué sigue?'} <ArrowRight size={14} />
              </button>
              {idx === RUTA.length - 1 && (
                <button className="btn btn-secondary" style={{ fontSize: 13, padding: '9px 16px' }} onClick={() => setIdx(0)}>
                  Volver al Paso 1
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
//  Página
// ──────────────────────────────────────────────────────────────────────────────

export default function GuiaPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const role = (user?.role ?? '') as Role;
  const isAdmin = role === 'Super Admin' || role === 'Admin';
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [category, setCategory] = useState<Category>('inicio');

  // Sincroniza la pestaña con ?tab= (soft-navigation no re-monta el componente)
  useEffect(() => {
    if (tabParam && (['inicio', 'ruta', 'guias', 'faq', 'glosario', 'proceso'] as const).includes(tabParam as Category)) {
      if (tabParam === 'proceso' && !isAdmin) return;
      setCategory(tabParam as Category);
    }
  }, [tabParam, isAdmin]);

  // Si el usuario pierde el rol admin (o entra directo con ?tab=proceso sin serlo), regresa a Inicio
  useEffect(() => {
    if (category === 'proceso' && !isAdmin) setCategory('inicio');
  }, [category, isAdmin]);

  const [query, setQuery] = useState('');
  const [flowOpen, setFlowOpen] = useState(false);

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
  const categoriesVisible = CATEGORIES.filter((c) => !c.adminOnly || isAdmin);

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
              {categoriesVisible.map((c) => {
                const CIcon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px',
                      borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--color-primary)' : (c.adminOnly ? '#c2410c66' : 'var(--color-outline-variant)')}`,
                      background: active ? 'var(--color-primary)' : (c.adminOnly ? '#c2410c0d' : 'var(--color-surface-container-lowest)'),
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
                {/* Acceso directo a la ruta completa */}
                <button
                  onClick={() => setCategory('ruta')}
                  className="card"
                  style={{
                    marginBottom: 22, width: '100%', textAlign: 'left', cursor: 'pointer', border: 'none',
                    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    background: 'linear-gradient(120deg, #1e40af 0%, #2d4f6e 100%)', color: '#fff',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Route size={22} />
                  </div>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>¿No sabes qué sigue? Empieza aquí</div>
                    <div style={{ fontSize: 12.5, opacity: 0.88, marginTop: 3, lineHeight: 1.5 }}>
                      La ruta completa en {RUTA.length} pasos: “ya di de alta la propiedad, ¿ahora qué?”, “ya estoy en el cierre, ¿dónde le pico?”. Cada paso te dice exactamente qué hacer y qué viene después.
                    </div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 'var(--radius-md)', background: '#fff', color: '#1e40af', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                    Ver la ruta <ArrowRight size={15} />
                  </span>
                </button>

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

            {/* ─── RUTA COMPLETA ─── */}
            {category === 'ruta' && <RutaCompleta />}

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

            {/* ─── MAPA DEL PROCESO (solo Admin / Super Admin) ─── */}
            {category === 'proceso' && isAdmin && (
              <>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '12px 16px',
                    borderRadius: 'var(--radius-md)', background: 'linear-gradient(120deg, #c2410c14, #c2410c08)',
                    border: '1px solid #c2410c40',
                  }}
                >
                  <ShieldAlert size={18} style={{ color: '#c2410c', flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, color: 'var(--color-on-surface)' }}>
                    <strong>Sección solo para Admin / Super Admin.</strong> Mapa completo del proceso operativo: captación → cierre → cálculo de comisión → liberar/bloquear → pago. Cada botón te lleva directo a la pantalla; cada bifurcación muestra qué pasa según la decisión.
                  </span>
                </div>

                {/* CTA: abrir el diagrama de flujo */}
                <div
                  className="card"
                  style={{
                    marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                    background: 'linear-gradient(120deg, var(--color-primary) 0%, #2d4f6e 100%)', color: '#fff',
                    border: 'none',
                  }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Workflow size={21} />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>Ver el proceso como diagrama de flujo</div>
                    <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 3, lineHeight: 1.5 }}>
                      El mapa completo con sus rombos de decisión, ramas de bloqueo y retornos, en una sola vista. Cada caja es un botón que te lleva a la pantalla.
                    </div>
                  </div>
                  <button
                    onClick={() => setFlowOpen(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 'var(--radius-md)',
                      background: '#fff', color: 'var(--color-primary)', border: 'none', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    <Maximize2 size={15} /> Abrir diagrama
                  </button>
                </div>

                <div style={{ marginBottom: 26 }}>
                  {PROCESO.map((fase, i) => (
                    <FaseCard key={fase.id} fase={fase} isLast={i === PROCESO.length - 1} />
                  ))}
                </div>

                <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-on-surface-variant)', margin: '4px 0 12px' }}>Procesos transversales</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                  {PROCESO_TRANSVERSAL.map((t) => {
                    const TIcon = t.icon;
                    return (
                      <div key={t.label} className="card" style={{ borderLeft: `4px solid ${t.color}` }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: `${t.color}18`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <TIcon size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--color-on-surface)' }}>{t.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', marginTop: 4, lineHeight: 1.5 }}>{t.desc}</div>
                            <button
                              className="btn btn-secondary"
                              style={{ marginTop: 10, fontSize: 12, padding: '5px 12px' }}
                              onClick={() => router.push(t.href)}
                            >
                              {t.linkLabel} <ArrowRight size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

      </div>

      {/* Diagrama de flujo en pantalla completa (solo admin) */}
      {flowOpen && isAdmin && <FlowDiagramModal onClose={() => setFlowOpen(false)} />}
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
