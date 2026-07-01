'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

/* ── Schema ── */
const schema = z.object({
  email:    z.string().email('Ingresa un correo válido'),
  password: z.string().min(4, 'Mínimo 4 caracteres'),
});
type Fields = z.infer<typeof schema>;

/* ── Demo users ── */
const DEMO = [
  { email: 'admin@ideauno.com',              initials: 'AI', role: 'Admin',  color: '#d1b78a', bg: 'rgba(209,183,138,.14)' },
  { email: 'angelramos@inmobiliaria.com.mx', initials: 'AR', role: 'Asesor', color: '#818cf8', bg: 'rgba(129,140,248,.14)' },
];

/* ── Inline style tokens ── */
const S = {
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#a1a1aa',
    marginBottom: 8,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  },
  input: {
    display: 'block',
    width: '100%',
    height: 52,
    padding: '0 16px',
    fontSize: 14,
    color: '#fafafa',
    background: '#0d1824',
    border: '1px solid #1e3449',
    borderRadius: 12,
    outline: 'none',
    transition: 'border-color .15s, box-shadow .15s',
    boxSizing: 'border-box' as const,
  },
  inputFocus: {
    borderColor: '#d1b78a',
    boxShadow: '0 0 0 3px rgba(209,183,138,.20)',
  },
  inputError: {
    borderColor: 'rgba(239,68,68,.6)',
  },
};

function Input({ id, error, suffix, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; error?: string; suffix?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        {...props}
        style={{
          ...S.input,
          ...(focused ? S.inputFocus : {}),
          ...(error ? S.inputError : {}),
          paddingRight: suffix ? 48 : 16,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {suffix && (
        <div style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {suffix}
        </div>
      )}
      {error && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#f87171', paddingLeft: 2 }}>
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<Fields>({
    resolver: zodResolver(schema) as any,
    defaultValues: { email: '', password: '' },
  });

  const activeEmail = watch('email');

  const onSubmit = async (data: Fields) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(data.email, data.password);
      const { accessToken, refreshToken, user } = res.data;
      setTokens(accessToken, refreshToken);
      setUser(user);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Credenciales incorrectas. Verifica e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const fill = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Idea2024!', { shouldValidate: true });
    setError(null);
  };

  return (
    <div style={{ width: '100%' }}>

      {/* Mobile-only logo */}
      <div className="flex lg:hidden" style={{ marginBottom: 40 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/IdeaUnoLogos/Logo_05.png"
          alt="Idea Uno Bienes Raíces"
          style={{ height: 28, width: 'auto', objectFit: 'contain' }}
        />
      </div>

      {/* ── Heading ── */}
      <div style={{ marginBottom: 32 }}>
        <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#d1b78a', textTransform: 'uppercase' }}>
          Plataforma Empresarial
        </p>
        <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 900, color: '#fafafa', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          Iniciar sesión
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#52525b', lineHeight: 1.6 }}>
          Ingresa tus credenciales para acceder al sistema.
        </p>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24,
          padding: '12px 16px', borderRadius: 10,
          border: '1px solid rgba(239,68,68,.2)',
          background: 'rgba(239,68,68,.07)',
        }}>
          <AlertCircle size={15} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{error}</span>
        </div>
      )}

      {/* ── Form ── */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Email */}
        <div style={{ marginBottom: 20 }}>
          <label htmlFor="email" style={S.label}>Correo electrónico</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nombre@ideauno.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: 28 }}>
          <label htmlFor="password" style={S.label}>Contraseña</label>
          <Input
            id="password"
            type={showPwd ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Introduce tu contraseña"
            error={errors.password?.message}
            suffix={
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b', display: 'flex', padding: 0 }}
              >
                {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            }
            {...register('password')}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', height: 52, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#1a2f44' : 'linear-gradient(135deg,#213a55 0%,#2d4f6e 100%)',
            boxShadow: loading ? 'none' : '0 0 28px rgba(33,58,85,.30)',
            fontSize: 14, fontWeight: 700, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'opacity .15s, transform .1s',
            opacity: loading ? 0.7 : 1,
          }}
          onMouseOver={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.88'; }}
          onMouseOut={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          onMouseDown={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          {loading ? (
            <>
              <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .6s linear infinite', display: 'inline-block' }} />
              Autenticando…
            </>
          ) : 'Continuar →'}
        </button>
      </form>

      {/* ── Quick-access section ── */}
      <div style={{ marginTop: 36 }}>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#1e3449' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#52697f', textTransform: 'uppercase' }}>
            Acceso Demo
          </span>
          <div style={{ flex: 1, height: 1, background: '#1e3449' }} />
        </div>

        {/* Three demo cards */}
        <div style={{ display: 'flex', gap: 8 }}>
          {DEMO.map(u => {
            const isActive = activeEmail === u.email;
            return (
              <button
                key={u.email}
                type="button"
                onClick={() => fill(u.email)}
                aria-label={`Acceso demo como ${u.role}`}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  padding: '16px 8px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${isActive ? u.color + '44' : '#1e3449'}`,
                  background: isActive ? u.bg : '#0d1824',
                  boxShadow: isActive ? `0 0 20px ${u.color}18` : 'none',
                  transition: 'all .15s',
                  outline: 'none',
                }}
                onMouseOver={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#12202f'; }}
                onMouseOut={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#0d1824'; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: u.bg, border: `1.5px solid ${u.color}40`,
                  fontSize: 12, fontWeight: 800, color: u.color, letterSpacing: '0.05em',
                }}>
                  {u.initials}
                </div>
                {/* Labels */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#e4e4e7', lineHeight: 1 }}>{u.role}</p>
                  <p style={{ margin: '5px 0 0', fontSize: 10, color: '#3f3f46', fontFamily: 'monospace' }}>pass: admin</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #4a6070; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0d1824 inset !important; -webkit-text-fill-color: #fafafa !important; }
      `}</style>
    </div>
  );
}
