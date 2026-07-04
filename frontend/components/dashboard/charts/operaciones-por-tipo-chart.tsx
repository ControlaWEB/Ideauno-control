'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['var(--color-primary)', 'var(--color-success)'];

// Etiqueta de % DENTRO de la dona para que nunca se corte en los bordes.
function renderInsideLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (!percent) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#ffffff" fontSize={12} fontWeight={700} textAnchor="middle" dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function OperacionesPorTipoChart({ data }: { data: { type: string; c: number | string }[] }) {
  const ventas = Number(data.find((d) => d.type === 'Venta')?.c || 0);
  const rentas = Number(data.find((d) => d.type === 'Renta')?.c || 0);

  if (!ventas && !rentas) {
    return (
      <div className="empty-state" style={{ padding: '20px 0' }}>
        <p style={{ fontSize: 13 }}>Sin operaciones registradas aún</p>
      </div>
    );
  }

  const chartData = [
    { name: 'Ventas', value: ventas },
    { name: 'Rentas', value: rentas },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
          label={renderInsideLabel}
          labelLine={false}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => [`${v} operaciones`, '']} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
