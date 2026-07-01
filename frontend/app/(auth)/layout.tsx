'use client';

import { useAuthStore } from '@/store/auth.store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace('/dashboard');
  }, [hydrated, isAuthenticated, router]);

  if (!hydrated) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a1520' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #d1b78a', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', overflow: 'hidden', background: '#0a1520' }}>

      {/* ═══════════════════════════════════════
          LEFT — brand / hero (hidden on mobile)
      ═══════════════════════════════════════ */}
      <div
        className="hidden lg:flex"
        style={{
          width: '58%',
          flexShrink: 0,
          position: 'relative',
          flexDirection: 'column',
          backgroundImage: "url('/mansion_bg.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center 55%',
          overflow: 'hidden',
        }}
      >
        {/* Layered overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(10,20,35,0.94) 0%, rgba(10,20,35,0.70) 60%, rgba(10,20,35,0.45) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(10,20,35,0.5) 0%, transparent 35%, rgba(10,20,35,0.80) 100%)' }} />

        {/* Content: top / middle / bottom */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 48px' }}>

          {/* ── TOP: Logo ── */}
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/IdeaUnoLogos/Logo_05.png"
              alt="Idea Uno Bienes Raíces"
              style={{ height: 32, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {/* ── MIDDLE: Hero copy ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 32 }}>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
              padding: '6px 14px', borderRadius: 999,
              border: '1px solid rgba(209,183,138,.35)',
              background: 'rgba(209,183,138,.10)',
              width: 'fit-content',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d1b78a', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#d1b78a' }}>
                Plataforma Inmobiliaria Enterprise
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, lineHeight: 1.2, color: '#fff', letterSpacing: '-0.02em' }}>
              Gestiona tu<br />
              <span style={{ color: '#d1b78a' }}>portafolio</span>{' '}
              <span style={{ color: '#fff' }}>inmobiliario</span>
            </h1>

            {/* Sub */}
            <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7, color: '#71717a', maxWidth: 280 }}>
              Plataforma ágil para el control de operaciones, asesores y comisiones inmobiliarias de última generación.
            </p>

            {/* Accent line */}
            <div style={{ marginTop: 32, width: 40, height: 2, background: 'linear-gradient(90deg,#d1b78a,transparent)', borderRadius: 2 }} />

            {/* Stats */}
            <div style={{ marginTop: 24, display: 'flex', gap: 32 }}>
              {[
                { v: '100%',  l: 'Digital' },
                { v: 'Cero',  l: 'Burocracia' },
                { v: '24/7',  l: 'Monitoreo' },
              ].map(s => (
                <div key={s.l}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{s.v}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#52525b', fontWeight: 500, letterSpacing: '0.04em' }}>{s.l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── BOTTOM: Legal ── */}
          <p style={{ margin: 0, fontSize: 11, color: '#3f3f46', fontWeight: 500 }}>
            © 2025 Idea Uno · Todos los derechos reservados
          </p>
        </div>

        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT — login form
      ═══════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a1520',
        padding: '48px 24px',
        overflowY: 'auto',
      }}>
        {/* Subtle top border accent */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '56%', height: 1, background: 'linear-gradient(90deg,transparent,rgba(209,183,138,.20),transparent)', pointerEvents: 'none' }} />

        <div style={{ width: '100%', maxWidth: 400 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
