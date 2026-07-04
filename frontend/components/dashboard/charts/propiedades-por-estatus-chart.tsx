'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  Publicable: 'var(--color-success)',
  Compartible: 'var(--color-success)',
  Activa: 'var(--color-primary)',
  disponible: 'var(--color-primary)',
  'En revisión': 'var(--color-secondary)',
  Incompleta: 'var(--color-error)',
  vendida: 'var(--color-on-surface-variant)',
  rentada: 'var(--color-on-surface-variant)',
  Inactiva: 'var(--color-outline)',
};

export function PropiedadesPorEstatusChart({ data }: { data: { status: string; c: number | string }[] }) {
  const chartData = data
    .map((d) => ({ estatus: d.status || 'Sin estatus', count: Number(d.c || 0) }))
    .sort((a, b) => b.count - a.count);

  if (!chartData.length) {
    return (
      <div className="empty-state" style={{ padding: '20px 0' }}>
        <p style={{ fontSize: 13 }}>Sin propiedades registradas aún</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} allowDecimals={false} />
        <YAxis dataKey="estatus" type="category" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} width={90} />
        <Tooltip formatter={(v) => [`${v} propiedades`, '']} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={STATUS_COLORS[entry.estatus] ?? 'var(--color-primary)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
