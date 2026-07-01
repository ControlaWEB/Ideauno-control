'use client';

import { useAuthStore } from '@/store/auth.store';
import { Header } from './header';
import { ShieldAlert } from 'lucide-react';

export function useHasAccess(allowedRoles: string[]) {
  const { user } = useAuthStore();
  return allowedRoles.includes(user?.role ?? '');
}

export function AccessDenied({ title }: { title: string }) {
  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">{title}</h1>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--color-on-surface-variant)' }}>
          <ShieldAlert size={36} style={{ marginBottom: 12, color: 'var(--color-error)' }} />
          <p style={{ fontSize: 14 }}>
            Acceso restringido. Tu rol no tiene permiso para esta sección.
          </p>
        </div>
      </div>
    </>
  );
}
