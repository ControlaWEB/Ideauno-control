'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AmaRow {
  id: string;
  name: string;
  avance_pct: number | string;
  ama_alcanzada: boolean | string;
}

function shortName(name: string) {
  return (name || '').split(' ').slice(0, 2).join(' ');
}

export function AvanceAmaChart({ data }: { data: AmaRow[] }) {
  const rows = (data ?? [])
    .map((a) => ({
      nombre: shortName(a.name),
      avance: Math.min(Number(a.avance_pct || 0), 100),
      ama: a.ama_alcanzada === true || a.ama_alcanzada === 'true',
    }))
    .sort((a, b) => b.avance - a.avance)
    .slice(0, 10);

  if (!rows.length) {
    return (
      <div className="empty-state" style={{ padding: '20px 0' }}>
        <p style={{ fontSize: 13 }}>Sin asesores con periodo AMA aún</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 34 + 40)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 44, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }}
        />
        <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} width={120} />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Avance AMA']}
          contentStyle={{
            background: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="avance"
          radius={[0, 4, 4, 0]}
          label={{ position: 'right', fontSize: 10.5, fill: 'var(--color-on-surface-variant)', formatter: (v: unknown) => `${Number(v).toFixed(0)}%` }}
        >
          {rows.map((entry, i) => (
            <Cell key={i} fill={entry.ama ? 'var(--color-success)' : 'var(--color-primary)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
