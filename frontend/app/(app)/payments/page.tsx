'use client';

import { Fragment, useState } from 'react';
import { Header } from '@/components/header';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate } from '@/lib/utils';
import {
  Wallet, CreditCard, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/validators';

const formatMXN = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  Solicitado: { label: 'Solicitado', cls: 'badge-warning' },
  Validado:   { label: 'Validado',   cls: 'badge-primary' },
  Autorizado: { label: 'Autorizado', cls: 'badge-primary' },
  Pagado:     { label: 'Pagado',     cls: 'badge-success' },
  Rechazado:  { label: 'Rechazado',  cls: 'badge-error'   },
};

type PaidForm = { formaPago: string; montoPagado: string };

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [paidForms, setPaidForms]   = useState<Record<string, PaidForm>>({});
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});

  const isAsesor = user?.role === 'Asesor';
  const isAdmin  = ['Super Admin', 'Admin'].includes(user?.role ?? '');

  const { data: payments = [], isLoading: loadingPayments } = useQuery<any[]>({
    queryKey: ['payments'],
    queryFn: () => api.get('/payments').then(r => r.data?.data ?? []),
    refetchOnWindowFocus: true,
  });

  const { data: commissions = [], isLoading: loadingCommissions } = useQuery<any[]>({
    queryKey: ['commissions', user?.advisorId],
    queryFn: () =>
      api.get('/operations/commissions', {
        params: { status: 'Liberada', advisorId: user?.advisorId ?? undefined },
      }).then(r => r.data?.data ?? []),
    enabled: isAsesor,
    refetchOnWindowFocus: true,
  });

  const toast = (msg: string, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(null); }
    else          { setSuccessMsg(msg); setErrorMsg(null); }
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 4000);
  };

  const setLoader = (key: string, val: boolean) =>
    setLoadingIds(prev => ({ ...prev, [key]: val }));

  const requestPayment = async (commId: string, advisorId: string) => {
    setLoader(commId, true);
    try {
      await api.post('/payments/request', { commissionId: commId, advisorId });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['commissions'] });
      toast('Solicitud de pago enviada correctamente');
    } catch (err: unknown) {
      toast(getApiErrorMessage(err, 'Error al solicitar el pago'), true);
    } finally {
      setLoader(commId, false);
    }
  };

  const authorize = async (id: string) => {
    setLoader(`auth-${id}`, true);
    try {
      await api.patch(`/payments/${id}/authorize`, {});
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast('Pago autorizado correctamente');
    } catch {
      toast('Error al autorizar el pago', true);
    } finally {
      setLoader(`auth-${id}`, false);
    }
  };

  const reject = async (id: string) => {
    setLoader(`rej-${id}`, true);
    try {
      await api.patch(`/payments/${id}/reject`, {});
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast('Solicitud rechazada');
    } catch {
      toast('Error al rechazar la solicitud', true);
    } finally {
      setLoader(`rej-${id}`, false);
    }
  };

  const markPaid = async (id: string) => {
    const form = paidForms[id];
    if (!form?.formaPago || !form?.montoPagado) {
      toast('Selecciona forma de pago e ingresa el monto', true);
      return;
    }
    const monto = Number(form.montoPagado);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast('El monto pagado debe ser un número mayor a cero', true);
      return;
    }
    if (Math.round(monto * 100) !== monto * 100) {
      toast('El monto pagado admite máximo 2 decimales', true);
      return;
    }
    setLoader(`paid-${id}`, true);
    try {
      await api.patch(`/payments/${id}/paid`, {
        formaPago:   form.formaPago,
        montoPagado: monto,
      });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      setPaidForms(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast('Pago registrado exitosamente');
    } catch (err: unknown) {
      toast(getApiErrorMessage(err, 'Error al registrar el pago'), true);
    } finally {
      setLoader(`paid-${id}`, false);
    }
  };

  const updatePaidForm = (id: string, field: keyof PaidForm, value: string) =>
    setPaidForms(prev => ({ ...prev, [id]: { ...(prev[id] ?? { formaPago: '', montoPagado: '' }), [field]: value } }));

  return (
    <>
      <Header />
      <div className="page-content animate-fade-in">

        <div className="page-header">
          <div>
            <h1 className="page-title">Pagos de Comisión</h1>
            <p className="page-desc">Solicitudes y autorizaciones de pago de comisiones de asesores</p>
          </div>
        </div>

        {successMsg && (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={14} /> {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#b91c1c' }}>
            {errorMsg}
          </div>
        )}

        {/* ─── ASESOR VIEW ─── */}
        {isAsesor && (
          <>
            {/* Comisiones disponibles */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>
                Comisiones disponibles para cobro
              </div>
              {loadingCommissions ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-md)' }} />)}
                </div>
              ) : commissions.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <Wallet size={28} />
                  <p>No hay comisiones liberadas disponibles para cobro</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Operación</th>
                        <th>Tipo</th>
                        <th>Monto Neto</th>
                        <th>Estatus</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissions.map((comm: any) => (
                        <tr key={comm.id}>
                          <td style={{ fontWeight: 600, fontSize: 13 }}>{comm.operation_code || '—'}</td>
                          <td><span className="badge badge-neutral">{comm.operation_type ?? comm.type ?? '—'}</span></td>
                          <td style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>
                            {formatMXN(Number(comm.monto_neto_asesor ?? comm.amount ?? 0))}
                          </td>
                          <td><span className="badge badge-success">{comm.estatus_comision ?? 'Liberada'}</span></td>
                          <td>
                            {comm.estatus_comision === 'Liberada' && (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: '5px 12px' }}
                                disabled={!!loadingIds[comm.id]}
                                onClick={() => requestPayment(comm.id, comm.advisor_id)}
                              >
                                {loadingIds[comm.id] ? 'Enviando…' : 'Solicitar Pago'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Mis solicitudes */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>
                Mis solicitudes de pago
              </div>
              {loadingPayments ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44, borderRadius: 'var(--radius-md)' }} />)}
                </div>
              ) : payments.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <Clock size={28} />
                  <p>No tienes solicitudes de pago registradas</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha Solicitud</th>
                        <th>Monto Solicitado</th>
                        <th>Forma Pago</th>
                        <th>Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any) => {
                        const st = STATUS_STYLE[p.estatus ?? p.status] ?? { label: p.estatus ?? p.status ?? '—', cls: 'badge-neutral' };
                        return (
                          <tr key={p.id}>
                            <td style={{ fontSize: 13 }}>{formatDate(p.fecha_solicitud ?? p.created_at)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>
                              {formatMXN(Number(p.monto_solicitado ?? p.amount ?? 0))}
                            </td>
                            <td style={{ fontSize: 13 }}>{p.forma_pago ?? '—'}</td>
                            <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── ADMIN VIEW ─── */}
        {isAdmin && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>
              Solicitudes de Pago
            </div>
            {loadingPayments ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 'var(--radius-md)' }} />)}
              </div>
            ) : payments.length === 0 ? (
              <div className="empty-state">
                <CreditCard size={32} />
                <p>No hay solicitudes de pago registradas</p>
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Asesor</th>
                      <th>Fecha Solicitud</th>
                      <th>Monto Solicitado</th>
                      <th>Monto Pagado</th>
                      <th>Forma Pago</th>
                      <th>Estatus</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => {
                      const st          = STATUS_STYLE[p.estatus ?? p.status] ?? { label: p.estatus ?? p.status ?? '—', cls: 'badge-neutral' };
                      const estatus     = p.estatus ?? p.status ?? '';
                      const isSolicitado = estatus === 'Solicitado';
                      const isAutorizado = ['Autorizado', 'Validado'].includes(estatus);
                      const paidFormOpen = !!paidForms[p.id];
                      return (
                        <Fragment key={p.id}>
                          <tr>
                            <td style={{ fontSize: 13, fontWeight: 600 }}>{p.advisor_name ?? '—'}</td>
                            <td style={{ fontSize: 13 }}>{formatDate(p.fecha_solicitud ?? p.created_at)}</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-secondary)' }}>
                              {formatMXN(Number(p.monto_solicitado ?? p.amount ?? 0))}
                            </td>
                            <td style={{ fontSize: 13 }}>
                              {p.monto_pagado ? formatMXN(Number(p.monto_pagado)) : '—'}
                            </td>
                            <td style={{ fontSize: 13 }}>{p.forma_pago ?? '—'}</td>
                            <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                            <td>
                              {isSolicitado && (
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-primary"
                                    style={{ fontSize: 11.5, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                                    disabled={!!loadingIds[`auth-${p.id}`]}
                                    onClick={() => authorize(p.id)}
                                  >
                                    <CheckCircle2 size={12} />
                                    {loadingIds[`auth-${p.id}`] ? '…' : 'Autorizar'}
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 11.5, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}
                                    disabled={!!loadingIds[`rej-${p.id}`]}
                                    onClick={() => reject(p.id)}
                                  >
                                    <XCircle size={12} />
                                    {loadingIds[`rej-${p.id}`] ? '…' : 'Rechazar'}
                                  </button>
                                </div>
                              )}
                              {isAutorizado && !paidFormOpen && (
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: 11.5, padding: '4px 10px' }}
                                  onClick={() => setPaidForms(prev => ({
                                    ...prev,
                                    [p.id]: { formaPago: '', montoPagado: '' },
                                  }))}
                                >
                                  Marcar Pagado
                                </button>
                              )}
                            </td>
                          </tr>
                          {paidFormOpen && (
                            <tr>
                              <td colSpan={7} style={{ background: 'var(--color-surface-variant)', padding: '12px 16px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label className="input-label" style={{ margin: 0 }}>Forma de pago</label>
                                    <select
                                      className="select"
                                      style={{ width: 180 }}
                                      value={paidForms[p.id]?.formaPago ?? ''}
                                      onChange={e => updatePaidForm(p.id, 'formaPago', e.target.value)}
                                    >
                                      <option value="">— Seleccionar —</option>
                                      <option value="Transferencia">Transferencia</option>
                                      <option value="Cheque">Cheque</option>
                                      <option value="Efectivo">Efectivo</option>
                                      <option value="Depósito">Depósito</option>
                                    </select>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <label className="input-label" style={{ margin: 0 }}>Monto pagado ($)</label>
                                    <input
                                      type="number"
                                      className="input"
                                      style={{ width: 160 }}
                                      placeholder="0"
                                      value={paidForms[p.id]?.montoPagado ?? ''}
                                      onChange={e => updatePaidForm(p.id, 'montoPagado', e.target.value)}
                                    />
                                  </div>
                                  <button
                                    className="btn btn-primary"
                                    style={{ fontSize: 12 }}
                                    disabled={!!loadingIds[`paid-${p.id}`]}
                                    onClick={() => markPaid(p.id)}
                                  >
                                    {loadingIds[`paid-${p.id}`] ? 'Guardando…' : 'Confirmar Pago'}
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 12 }}
                                    onClick={() => setPaidForms(prev => { const n = { ...prev }; delete n[p.id]; return n; })}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isAsesor && !isAdmin && (
          <div className="empty-state">
            <Wallet size={32} />
            <p>No tienes permisos para ver esta sección</p>
          </div>
        )}

      </div>
    </>
  );
}
