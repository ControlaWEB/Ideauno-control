'use client';

import { Header } from '@/components/header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { useState } from 'react';
import { Settings, Percent, User, Check, AlertCircle, Calculator, Info } from 'lucide-react';
import { useHasAccess, AccessDenied } from '@/components/access-guard';

const ALLOWED_ROLES = ['Super Admin', 'Admin'];

const PARAM_META: Record<string, { label: string; desc: string; isPercent?: boolean; isCurrency?: boolean }> = {
  porcentaje_invitacion:          { label: 'Porcentaje invitación (%)', desc: 'Parte de la comisión que va al asesor invitador.', isPercent: true },
  porcentaje_asesor_normal:       { label: 'Porcentaje asesor normal (%)', desc: 'Parte del remanente para el asesor antes de alcanzar AMA.', isPercent: true },
  porcentaje_asesor_ama:          { label: 'Porcentaje asesor AMA (%)', desc: 'Parte del remanente para el asesor al alcanzar meta AMA (normalmente 100).', isPercent: true },
  meta_ama:                       { label: 'Meta AMA ($)', desc: 'Monto de comisiones netas que el asesor debe acumular para alcanzar AMA.', isCurrency: true },
  porcentaje_mentoria:            { label: 'Porcentaje mentoría (%)', desc: 'Deducción de la comisión neta del asesor en periodo de mentoría.', isPercent: true },
  minimo_exento_mentoria_renta:   { label: 'Mínimo exento mentoría renta ($)', desc: 'Si comisión de renta < este valor, no aplica deducción por mentoría.', isCurrency: true },
  umbral_pld:                     { label: 'Umbral PLD ($)', desc: 'Monto a partir del cual la operación requiere expediente KYC completo.', isCurrency: true },
};

type ConfigParam = {
  id: string; nombre: string; valor_numerico: string | number;
  descripcion?: string; unidad?: string;
};

function ParamRow({ param, onSave, saving }: {
  param: ConfigParam;
  onSave: (id: string, val: number) => void;
  saving: boolean;
}) {
  const meta = PARAM_META[param.nombre] ?? { label: param.nombre, desc: param.descripcion || '' };
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(param.valor_numerico));
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    await onSave(param.id, n);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const displayVal = meta.isPercent
    ? `${Number(param.valor_numerico) * 100}%`
    : meta.isCurrency
    ? `$${Number(param.valor_numerico).toLocaleString('es-MX')}`
    : String(param.valor_numerico);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--color-outline-variant)', gap: 20 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{meta.label}</div>
        {meta.desc && <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{meta.desc}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {editing ? (
          <>
            <input
              type="number"
              value={val}
              onChange={e => setVal(e.target.value)}
              style={{ width: 120, height: 32, padding: '0 10px', fontSize: 13, border: '1px solid var(--color-outline)', borderRadius: 'var(--radius-sm)' }}
              autoFocus
            />
            <button className="btn btn-primary" style={{ height: 32, padding: '0 12px', fontSize: 12.5 }} onClick={handleSave} disabled={saving}>
              {saving ? '…' : 'Guardar'}
            </button>
            <button className="btn btn-ghost" style={{ height: 32, padding: '0 10px', fontSize: 12.5 }} onClick={() => { setEditing(false); setVal(String(param.valor_numerico)); }}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 14, fontWeight: 700, color: saved ? 'var(--color-secondary)' : 'var(--color-primary)', minWidth: 90, textAlign: 'right' }}>
              {saved ? <><Check size={13} style={{ display: 'inline', color: 'var(--color-secondary)' }} /> Guardado</> : displayVal}
            </span>
            <button className="btn btn-secondary" style={{ height: 30, padding: '0 12px', fontSize: 12 }} onClick={() => setEditing(true)}>
              Editar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const hasAccess = useHasAccess(ALLOWED_ROLES);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'commission'>('commission');

  const { data: configData, isLoading } = useQuery({
    queryKey: ['dashboard-config'],
    queryFn: () => dashboardApi.getConfig().then(r => r.data?.data ?? r.data ?? []),
    enabled: hasAccess,
  });

  const { mutateAsync: updateParam, isPending: saving } = useMutation({
    mutationFn: ({ id, valor }: { id: string; valor: number }) =>
      dashboardApi.updateConfig(id, valor, user?.email ?? 'admin'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-config'] }),
  });

  const params: ConfigParam[] = Array.isArray(configData) ? configData : [];

  const tabs = [
    { id: 'commission', label: 'Motor de Comisiones', icon: <Calculator size={15} /> },
    { id: 'profile',   label: 'Perfil de sesión',    icon: <User size={15} /> },
  ];

  if (!hasAccess) return <AccessDenied title="Configuración" />;

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Configuración del Sistema</h1>
            <p className="page-desc">Parámetros del motor de comisiones y perfil de sesión</p>
          </div>
          <Settings size={22} style={{ color: 'var(--color-on-surface-variant)' }} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-outline-variant)', marginBottom: 24 }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 18px', fontSize: 13.5, fontWeight: 550,
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                color: activeTab === t.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                marginBottom: -2, transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'commission' && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Parámetros del Motor de Comisiones</div>
                <div className="card-subtitle">Todos los porcentajes se guardan como decimales (ej. 0.025 = 2.5%)</div>
              </div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                Fórmula: Comisión total → Invitación ({params.find(p => p.nombre === 'porcentaje_invitacion') ? `${Number(params.find(p => p.nombre === 'porcentaje_invitacion')!.valor_numerico) * 100}%` : '2.5%'}) → Remanente → {params.find(p => p.nombre === 'porcentaje_asesor_normal') ? `${Number(params.find(p => p.nombre === 'porcentaje_asesor_normal')!.valor_numerico) * 100}%` : '80%'} asesor (o {params.find(p => p.nombre === 'porcentaje_asesor_ama') ? `${Number(params.find(p => p.nombre === 'porcentaje_asesor_ama')!.valor_numerico) * 100}%` : '100%'} si AMA alcanzada) → Mentoría {params.find(p => p.nombre === 'porcentaje_mentoria') ? `${Number(params.find(p => p.nombre === 'porcentaje_mentoria')!.valor_numerico) * 100}%` : '5%'}
              </div>
            </div>

            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-sm)' }} />)}
              </div>
            ) : params.length === 0 ? (
              <div className="empty-state">
                <AlertCircle size={28} />
                <p>Sin parámetros en base de datos</p>
                <p style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>Verifica que la migración commission_engine_tables fue aplicada</p>
              </div>
            ) : (
              <div>
                {params.map(p => (
                  <ParamRow
                    key={p.id}
                    param={p}
                    saving={saving}
                    onSave={(id, valor) => updateParam({ id, valor })}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="card" style={{ maxWidth: 480 }}>
            <div className="card-header">
              <div className="card-title">Sesión activa</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Correo', user?.email ?? '—'],
                ['ID de usuario', user?.id ?? '—'],
                ['Rol', (user as any)?.role ?? 'Administrador'],
              ].map(([l, v]) => (
                <div key={String(l)} style={{ background: 'var(--color-surface-variant)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13.5, wordBreak: 'break-all' }}>{v}</div>
                </div>
              ))}
              <div style={{ marginTop: 4, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', fontSize: 12.5, color: '#b91c1c', display: 'flex', gap: 8 }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Cambio de contraseña y edición de perfil — pendiente implementar (autenticación Supabase Auth).
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
