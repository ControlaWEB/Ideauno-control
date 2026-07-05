'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Home,
  FileText,
  DollarSign,
  Settings,
  LogOut,
  PlusCircle,
  ClipboardList,
  Wallet,
  ScrollText,
  UserCheck,
  ShieldCheck,
  History,
  FolderOpen,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const SUPER_ADMIN = 'Super Admin';
const ADMIN = 'Admin';
const ASESOR = 'Asesor';
const JURIDICO = 'Jurídico';

type NavLink = { label: string; href: string; icon: React.ElementType; roles?: string[] };

const NAV_PRINCIPAL: NavLink[] = [
  // El dashboard solo tiene vista para Admin/Super (administrativo) y Asesor (Mi Dashboard).
  // Jurídico no tiene dashboard, por eso se oculta para ese rol.
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: [SUPER_ADMIN, ADMIN, ASESOR] },
  { label: 'Guía de Uso', href: '/guia', icon: BookOpen },
];

const NAV_CAPTACION: NavLink[] = [
  { label: 'Propiedades en Venta', href: '/properties', icon: Building2 },
  { label: 'Nueva Captación Venta', href: '/properties/new', icon: PlusCircle, roles: [SUPER_ADMIN, ADMIN, ASESOR] },
  { label: 'Propiedades en Renta', href: '/rentals', icon: Home },
  { label: 'Nueva Captación Renta', href: '/rentals/new', icon: PlusCircle, roles: [SUPER_ADMIN, ADMIN, ASESOR] },
];

const NAV_OPERACIONES: NavLink[] = [
  { label: 'Cierres', href: '/operations', icon: ClipboardList },
  { label: 'Nuevo Cierre', href: '/operations/new', icon: PlusCircle, roles: [SUPER_ADMIN, ADMIN, ASESOR] },
  { label: 'Comisiones', href: '/commissions', icon: DollarSign },
  { label: 'Pagos', href: '/payments', icon: Wallet },
];

const NAV_JURIDICO: NavLink[] = [
  // Bandeja de solicitudes de contrato del área jurídica: no la ve el asesor.
  { label: 'Contratos', href: '/contracts', icon: ScrollText, roles: [SUPER_ADMIN, ADMIN, JURIDICO] },
  // El asesor sí puede levantar una solicitud de contrato.
  { label: 'Nueva Solicitud', href: '/contracts/new', icon: PlusCircle },
];

const NAV_EQUIPO: NavLink[] = [
  // Gestión de asesores es solo administrativa (la página usa métricas admin-only).
  { label: 'Asesores', href: '/advisors', icon: Users, roles: [SUPER_ADMIN, ADMIN] },
  { label: 'Nuevo Asesor', href: '/advisors/new', icon: PlusCircle, roles: [SUPER_ADMIN, ADMIN] },
  { label: 'Clientes', href: '/clients', icon: UserCheck },
];

const NAV_CUMPLIMIENTO: NavLink[] = [
  { label: 'Cumplimiento PLD', href: '/compliance', icon: ShieldCheck, roles: [SUPER_ADMIN, ADMIN] },
];

const NAV_ADMIN: NavLink[] = [
  { label: 'Plantillas y Contratos', href: '/templates', icon: FolderOpen },
  { label: 'Auditoría', href: '/audit', icon: History, roles: [SUPER_ADMIN, ADMIN] },
  { label: 'Configuración', href: '/settings', icon: Settings, roles: [SUPER_ADMIN, ADMIN] },
];

function visibleTo(items: NavLink[], role: string | undefined) {
  return items.filter(item => !item.roles || item.roles.includes(role ?? ''));
}

function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const EXACT_MATCH = ['/dashboard', '/properties', '/operations', '/advisors', '/contracts', '/rentals', '/clients', '/compliance', '/commissions', '/payments', '/audit', '/settings', '/templates'];
  const isActive = pathname === href
    || (!EXACT_MATCH.includes(href) && pathname.startsWith(href))
    || (EXACT_MATCH.includes(href) && pathname === href);

  return (
    <Link href={href} className={`nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={16} />
      <span>{label}</span>
    </Link>
  );
}

function NavSection({ label, items }: { label: string; items: NavLink[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 2 }}>
      <div className="nav-section-label">{label}</div>
      {items.map(item => <NavItem key={item.href} {...item} />)}
    </div>
  );
}

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const role = user?.role;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" style={{ justifyContent: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/IdeaUnoLogos/Logo_05.png"
          alt="Idea Uno Bienes Raíces"
          style={{ height: 26, width: 'auto', objectFit: 'contain', maxWidth: 180 }}
        />
      </div>

      <nav className="sidebar-nav">
        <NavSection label="Principal" items={visibleTo(NAV_PRINCIPAL, role)} />
        <NavSection label="Captación" items={visibleTo(NAV_CAPTACION, role)} />
        <NavSection label="Operaciones" items={visibleTo(NAV_OPERACIONES, role)} />
        <NavSection label="Jurídico" items={visibleTo(NAV_JURIDICO, role)} />
        <NavSection label="Equipo" items={visibleTo(NAV_EQUIPO, role)} />
        <NavSection label="Cumplimiento" items={visibleTo(NAV_CUMPLIMIENTO, role)} />
        <NavSection label="Sistema" items={visibleTo(NAV_ADMIN, role)} />
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 6px' }}>
            <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
              {getInitials(user.name)}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: 12, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: 10.5 }}>{user.role}</div>
            </div>
            <button onClick={handleLogout} className="btn-ghost" style={{ padding: '5px', borderRadius: '7px', color: 'rgba(255,255,255,0.50)' }} title="Cerrar sesión">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
