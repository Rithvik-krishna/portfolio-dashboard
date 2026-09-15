import React from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { SectorSummary, CalculatedHolding } from '@/types/portfolio';
import { PortfolioRow } from './PortfolioRow';
import { formatCurrency, formatPercentage } from '@/lib/formatters';

interface SectorSectionProps {
  sector: SectorSummary;
  holdings: CalculatedHolding[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function SectorSection({
  sector,
  holdings,
  isExpanded,
  onToggle,
}: SectorSectionProps) {
  const isGainPositive = sector.totalGainLoss !== null && sector.totalGainLoss > 0;
  const isGainNegative = sector.totalGainLoss !== null && sector.totalGainLoss < 0;

  const gainColor = isGainPositive
    ? 'text-emerald-400'
    : isGainNegative
    ? 'text-rose-400'
    : 'text-slate-400';

  return (
    <tbody className="border-b border-slate-800/80 last:border-b-0">
      {/* Sector Header / Toggle Row */}
      <tr
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="bg-slate-900/90 hover:bg-slate-850 transition-colors cursor-pointer select-none border-b border-slate-800/60"
      >
        <td colSpan={11} className="p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="text-slate-400">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 transition-transform" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-semibold text-white text-xs sm:text-sm tracking-tight">
                  {sector.sector}
                </span>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {sector.holdingsCount} {sector.holdingsCount === 1 ? 'holding' : 'holdings'}
              </span>
            </div>

            {/* Sector Summary Metrics (Right Side) */}
            <div className="flex items-center gap-4 sm:gap-6 text-xs font-mono">
              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-400 block font-sans">Investment</span>
                <span className="font-medium text-slate-200">{formatCurrency(sector.totalInvestment)}</span>
              </div>

              <div className="hidden sm:block text-right">
                <span className="text-[10px] uppercase text-slate-400 block font-sans">Weight</span>
                <span className="text-slate-400">{formatPercentage(sector.portfolioWeight, { includeSign: false })}</span>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase text-slate-400 block font-sans">Current Val</span>
                <span className="font-medium text-white">
                  {sector.totalPresentValue !== null ? formatCurrency(sector.totalPresentValue) : 'N/A'}
                </span>
              </div>

              <div className="text-right min-w-[70px]">
                <span className="text-[10px] uppercase text-slate-400 block font-sans">P&L</span>
                <span className={`font-semibold ${gainColor}`}>
                  {sector.totalGainLoss !== null
                    ? formatCurrency(sector.totalGainLoss, { includeSign: true })
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </td>
      </tr>

      {/* Sector Holdings Rows */}
      {isExpanded &&
        holdings.map((h) => (
          <PortfolioRow key={h.exchangeCode} holding={h} />
        ))}
    </tbody>
  );
}
