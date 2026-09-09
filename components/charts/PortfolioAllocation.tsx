'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { SectorSummary } from '@/types/portfolio';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { ChartSkeleton } from '@/components/ui/Skeleton';

interface PortfolioAllocationProps {
  sectors: SectorSummary[];
  isLoading?: boolean;
}

const SECTOR_COLORS: Record<string, string> = {
  'Financial Sector': '#6366f1', // Indigo
  'Tech Sector': '#0ea5e9',      // Sky
  'Consumer': '#10b981',         // Emerald
  'Power': '#f59e0b',            // Amber
  'Pipe Sector': '#8b5cf6',      // Violet
  'Others': '#ec4899',           // Pink
};

const DEFAULT_COLOR = '#64748b'; // Slate

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    payload?: {
      name: string;
      value: number;
      percentage: number;
      holdingsCount: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    if (!data) return null;

    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3 shadow-xl backdrop-blur-md">
        <p className="text-xs font-semibold text-slate-200">{data.name}</p>
        <p className="mt-1 text-sm font-bold text-white font-mono">
          {formatCurrency(data.value)}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span>{formatPercentage(data.percentage)} weight</span>
          <span>•</span>
          <span>{data.holdingsCount} holdings</span>
        </div>
      </div>
    );
  }
  return null;
}

export function PortfolioAllocation({ sectors, isLoading = false }: PortfolioAllocationProps) {
  if (isLoading) {
    return <ChartSkeleton />;
  }

  const chartData = sectors.map((s) => ({
    name: s.sector,
    value: s.totalInvestment,
    percentage: s.portfolioWeight,
    holdingsCount: s.holdingsCount,
  }));

  return (
    <div className="flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight">Sector Allocation</h3>
          <p className="text-xs text-slate-400 mt-0.5">Capital distribution by total investment</p>
        </div>
      </div>

      <div className="relative mt-2 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={SECTOR_COLORS[entry.name] || DEFAULT_COLOR}
                  stroke="#0f172a"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              formatter={(value: string) => (
                <span className="text-[11px] text-slate-300 mr-2">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
