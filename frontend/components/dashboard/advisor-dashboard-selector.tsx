'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { advisorsApi } from '@/lib/api';
import { AdvisorDashboard } from './advisor-dashboard';

export function AdvisorDashboardSelector() {
  const { data } = useQuery({
    queryKey: ['dashboard-advisor-selector-list'],
    queryFn: () => advisorsApi.getAll().then((r) => r.data?.data ?? r.data ?? []),
    staleTime: 60000,
  });
  const asesores: any[] = data ?? [];
  const [selectedId, setSelectedId] = useState<string>('');
  const selected = asesores.find((a) => a.id === selectedId);

  const selector = (
    <select
      className="select"
      style={{ maxWidth: 240 }}
      value={selectedId}
      onChange={(e) => setSelectedId(e.target.value)}
    >
      <option value="">— Selecciona un asesor —</option>
      {asesores.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );

  return (
    <AdvisorDashboard
      advisorId={selectedId || undefined}
      advisorName={selected?.name}
      viewingAsAdmin
      headerExtra={selector}
    />
  );
}
