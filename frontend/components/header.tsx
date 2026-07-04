'use client';

// components/header.tsx
import { Search, Bell, HelpCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { user } = useAuthStore();
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();

  return (
    <header className="topbar">
      {/* Page title */}
      {(title || subtitle) && (
        <div style={{ marginRight: 'auto' }}>
          {title && (
            <h1 style={{ fontSize: 16, fontWeight: 650, color: 'var(--color-on-surface)', lineHeight: 1.2 }}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', lineHeight: 1 }}>
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Search */}
      <div className="search-wrapper" style={{ marginLeft: title ? 0 : 'auto' }}>
        <Search />
        <input
          className="search-input"
          placeholder="Buscar..."
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          id="global-search"
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <div className="tooltip-wrapper">
          <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%', position: 'relative' }}>
            <Bell size={18} />
            <span className="notif-dot" />
          </button>
          <span className="tooltip">Notificaciones</span>
        </div>

        <div className="tooltip-wrapper">
          <button className="btn-ghost" style={{ padding: 8, borderRadius: '50%' }}>
            <HelpCircle size={18} />
          </button>
          <span className="tooltip">Ayuda</span>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 6, paddingLeft: 12, borderLeft: '1px solid var(--color-outline-variant)' }}>
            <div className="avatar">
              {getInitials(user.name)}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-on-surface)' }}>
                {user.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                {user.role}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
