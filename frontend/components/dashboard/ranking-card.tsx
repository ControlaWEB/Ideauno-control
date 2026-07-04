import { formatCompactCurrency, formatNumber, formatPercent } from '@/lib/utils';

type ValueFormat = 'currency' | 'count' | 'percent';

export interface RankingItem {
  id: string;
  name: string;
  value: number;
  secondaryValue?: number;
}

interface Props {
  title: string;
  subtitle?: string;
  items: RankingItem[];
  valueFormat?: ValueFormat;
  secondaryLabel?: string;
  secondaryFormat?: ValueFormat;
  emptyLabel?: string;
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function formatVal(v: number, fmt: ValueFormat): string {
  if (fmt === 'currency') return formatCompactCurrency(v);
  if (fmt === 'percent') return formatPercent(v);
  return formatNumber(v);
}

export function RankingCard({
  title, subtitle, items, valueFormat = 'currency', secondaryLabel, secondaryFormat = 'count', emptyLabel,
}: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <p style={{ fontSize: 13 }}>{emptyLabel ?? 'Sin datos aún'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => {
            const pct = item.value > 0 ? Math.min(100, (item.value / (items[0]?.value || 1)) * 100) : 0;
            return (
              <div key={item.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: i < 3 ? 14 : 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', width: 18, flexShrink: 0 }}>
                      {MEDAL[i] ?? `#${i + 1}`}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-secondary)' }}>{formatVal(item.value, valueFormat)}</span>
                    {secondaryLabel && item.secondaryValue !== undefined && (
                      <div style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>
                        {secondaryLabel}: {formatVal(item.secondaryValue, secondaryFormat)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: i === 0 ? '#d97706' : 'var(--color-secondary)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
