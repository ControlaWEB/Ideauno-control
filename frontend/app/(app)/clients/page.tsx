'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Users, Plus, X } from 'lucide-react';
import { TELEFONO_MX, RFC_RE, MAX_NOMBRE, soloDigitos, getApiErrorMessage } from '@/lib/validators';

const CREATE_ROLES = ['Super Admin', 'Admin', 'Asesor'];

// El backend/BD usan 'Individual' | 'Corporate'; 'Empresa' es solo etiqueta visual
interface Client {
  id: string;
  name: string;
  type: 'Individual' | 'Corporate';
  rfc?: string;
  phone?: string;
  email?: string;
}

interface ClientForm {
  name: string;
  type: 'Individual' | 'Corporate';
  rfc: string;
  phone: string;
  email: string;
}

export default function ClientsPage() {
  const { user } = useAuthStore();
  const canCreate = CREATE_ROLES.includes(user?.role ?? '');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ['clients'],
    // El backend pagina: la lista viene en r.data.data
    queryFn: () => api.get('/clients').then(r => r.data?.data ?? (Array.isArray(r.data) ? r.data : [])),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientForm>({
    defaultValues: { name: '', type: 'Individual', rfc: '', phone: '', email: '' },
  });

  const onSubmit = async (data: ClientForm) => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.post('/clients', {
        name: data.name.trim(),
        type: data.type,
        rfc: data.rfc?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        email: data.email.trim().toLowerCase(),
      });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      reset();
      setShowForm(false);
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err, 'Error al guardar el cliente'));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setSaveError(null);
    setShowForm(false);
  };

  const typeBadge = (type: string) => {
    if (type === 'Corporate' || type === 'Empresa') return <span className="badge badge-warning">Empresa</span>;
    return <span className="badge badge-primary">Individual</span>;
  };

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        {/* ─── Page header ─── */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1 className="page-title">Clientes / Prospectos</h1>
            <p className="page-desc">Directorio de clientes y prospectos registrados</p>
          </div>
          {canCreate && (
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowForm(v => !v)}
            >
              <Plus size={16} />
              Nuevo Cliente
            </button>
          )}
        </div>

        {/* ─── Inline form ─── */}
        {showForm && canCreate && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">Nuevo Cliente</div>
              <button className="btn btn-ghost" onClick={handleCancel} style={{ padding: '4px 8px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Nombre */}
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Nombre completo *</label>
                  <input
                    className="input"
                    placeholder="Ej. Juan García López"
                    maxLength={MAX_NOMBRE}
                    {...register('name', {
                      required: 'Nombre requerido',
                      validate: (v) => v.trim().length > 0 || 'Nombre requerido',
                      maxLength: { value: MAX_NOMBRE, message: `Máximo ${MAX_NOMBRE} caracteres.` },
                    })}
                  />
                  {errors.name && <span style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errors.name.message}</span>}
                </div>

                {/* Tipo */}
                <div className="input-group">
                  <label className="input-label">Tipo</label>
                  <div style={{ display: 'flex', gap: 24, marginTop: 6 }}>
                    {([['Individual', 'Individual'], ['Corporate', 'Empresa']] as const).map(([value, label]) => (
                      <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                        <input
                          type="radio"
                          value={value}
                          {...register('type')}
                          style={{ accentColor: 'var(--color-primary)' }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* RFC */}
                <div className="input-group">
                  <label className="input-label">RFC</label>
                  <input
                    className="input"
                    placeholder="Opcional"
                    maxLength={13}
                    style={{ textTransform: 'uppercase' }}
                    {...register('rfc', {
                      validate: (v) => v === '' || RFC_RE.test(v.trim()) || 'El RFC no tiene un formato válido.',
                    })}
                  />
                  {errors.rfc && <span style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errors.rfc.message}</span>}
                </div>

                {/* Teléfono */}
                <div className="input-group">
                  <label className="input-label">Teléfono</label>
                  <input
                    className="input"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10 dígitos"
                    onInput={(e) => { e.currentTarget.value = soloDigitos(e.currentTarget.value, 10); }}
                    {...register('phone', {
                      validate: (v) => v === '' || TELEFONO_MX.test(v) || 'El teléfono debe tener exactamente 10 dígitos.',
                    })}
                  />
                  {errors.phone && <span style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errors.phone.message}</span>}
                </div>

                {/* Correo */}
                <div className="input-group">
                  <label className="input-label">Correo electrónico</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    {...register('email', {
                      required: 'El correo electrónico es requerido.',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Ingresa un correo electrónico válido.' },
                    })}
                  />
                  {errors.email && <span style={{ fontSize: 12, color: 'var(--color-error)', marginTop: 4 }}>{errors.email.message}</span>}
                </div>
              </div>

              {saveError && (
                <div style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 12 }}>{saveError}</div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button className="btn btn-secondary" type="button" onClick={handleCancel}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Loading skeleton ─── */}
        {isLoading && (
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: 36, borderRadius: 'var(--radius-sm)' }} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Table ─── */}
        {!isLoading && (
          <div className="card">
            {(!clients || clients.length === 0) ? (
              <div className="empty-state" style={{ padding: '40px 0' }}>
                <Users size={32} />
                <p style={{ fontSize: 14 }}>No hay clientes registrados</p>
                {canCreate && (
                  <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
                    <Plus size={14} /> Agregar primer cliente
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-outline-variant)' }}>
                      {['Nombre', 'Tipo', 'RFC', 'Teléfono', 'Correo'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '10px 12px',
                          fontSize: 12, color: 'var(--color-on-surface-variant)', fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c, i) => (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: i < clients.length - 1 ? '1px solid var(--color-outline-variant)' : 'none',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-variant)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: 550 }}>{c.name}</td>
                        <td style={{ padding: '10px 12px' }}>{typeBadge(c.type)}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-on-surface-variant)' }}>{c.rfc || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-on-surface-variant)' }}>{c.phone || '—'}</td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-on-surface-variant)' }}>{c.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
