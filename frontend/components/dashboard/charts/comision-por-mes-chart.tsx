'use client';

import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatCompactCurrency, formatMonthLabel } from '@/lib/utils';

interface ComisionPorMesRow {
  mes: string;
  comisionTotal: number;
  ingresoInmobiliaria: number;
  operaciones: number;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
      borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', padding: 10, fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: 6 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCompactCurrency(p.value)}</p>
      ))}
    </div>
  );
}

export function ComisionPorMesChart({ data }: { data: ComisionPorMesRow[] }) {
  if (!data.length) {
    return (
      <div className="empty-state" style={{ padding: '20px 0' }}>
        <p style={{ fontSize: 13 }}>Sin operaciones registradas aún</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, mes_label: formatMonthLabel(d.mes) }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
        <XAxis dataKey="mes_label" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
        <YAxis
          tickFormatter={formatCompactCurrency}
          tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }}
          width={60}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
        <Bar dataKey="comisionTotal" name="Comisión total" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="ingresoInmobiliaria"
          name="Ingreso inmobiliaria"
          stroke="var(--color-secondary)"
          strokeWidth={2}
          dot={{ r: 3, fill: 'var(--color-secondary)' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
