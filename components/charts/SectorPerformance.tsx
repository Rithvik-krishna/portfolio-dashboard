'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SectorSummary } from '@/types/portfolio';
import { formatCurrency, formatCompactNumber } from '@/lib/formatters';
import { ChartSkeleton } from '@/components/ui/Skeleton';

interface SectorPerformanceProps {
  sectors: SectorSummary[];
  isLoading?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    dataKey: string;
    fill: string;
    payload: {
      sector: string;
      investment: number;
      currentValue: number | null;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md">
        <p className="text-xs font-semibold text-slate-200">{data.sector}</p>
        <div className="mt-2 space-y-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Investment:</span>
            <span className="font-bold text-white font-mono">{formatCurrency(data.investment)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Current Value:</span>
            <span className="font-bold text-sky-400 font-mono">
              {data.currentValue !== null ? formatCurrency(data.currentValue) : 'Awaiting Feed'}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function SectorPerformance({ sectors, isLoading = false }: SectorPerformanceProps) {
  if (isLoading) {
    return <ChartSkeleton />;
  }

  const chartData = sectors.map((s) => ({
    sector: s.sector.replace(' Sector', ''),
    fullSector: s.sector,
    investment: s.totalInvestment,
    currentValue: s.totalPresentValue,
  }));

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight">Sector Performance</h3>
          <p className="text-xs text-slate-400 mt-0.5">Capital deployed vs present valuation</p>
        </div>
      </div>

      <div className="relative mt-2 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="sector"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-15}
              textAnchor="end"
            />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => formatCompactNumber(val)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ top: -8, right: 0, paddingBottom: 8 }}
              formatter={(value: string) => (
                <span className="text-[11px] text-slate-300 mr-2">
                  {value === 'investment' ? 'Investment' : 'Current Value'}
                </span>
              )}
            />
            <Bar
              dataKey="investment"
              fill="#4f46e5"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="currentValue"
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
