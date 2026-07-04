'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompactCurrency } from '@/lib/utils';

const COLORS = ['var(--color-primary)', 'var(--color-success)', 'var(--color-secondary)', 'var(--color-on-surface-variant)'];

interface Distribucion {
  asesor: number | string;
  inmobiliaria: number | string;
  invitacion: number | string;
  mentoria: number | string;
}

export function DistribucionComisionesChart({ data }: { data: Distribucion | null }) {
  const chartData = [
    { name: 'Asesor', value: Number(data?.asesor || 0) },
    { name: 'Inmobiliaria', value: Number(data?.inmobiliaria || 0) },
    { name: 'Invitación', value: Number(data?.invitacion || 0) },
    { name: 'Mentoría', value: Number(data?.mentoria || 0) },
  ].filter((d) => d.value > 0);

  if (!chartData.length) {
    return (
      <div className="empty-state" style={{ padding: '20px 0' }}>
        <p style={{ fontSize: 13 }}>Sin comisiones registradas aún</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" outerRadius={90} paddingAngle={2} dataKey="value">
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [formatCompactCurrency(Number(v)), '']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
