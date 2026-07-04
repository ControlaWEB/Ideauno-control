export function KpiCard({ label, value, sub, icon, iconBg, iconColor, alert }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; iconBg: string; iconColor: string; alert?: boolean;
}) {
  return (
    <div className="kpi-card" style={alert ? { borderLeft: '3px solid var(--color-error)' } : {}}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="kpi-label">{label}</div>
          <div className="kpi-value" style={{ marginTop: 6, color: alert ? 'var(--color-error)' : undefined }}>{value}</div>
          {sub && <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div className="kpi-icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      </div>
    </div>
  );
}
