import React from 'react';
import { CalculatedHolding } from '@/types/portfolio';
import { formatCurrency, formatPercentage, formatNumber } from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import { detectExchange } from '@/lib/portfolio/normalization';

interface PortfolioRowProps {
  holding: CalculatedHolding;
}

export function PortfolioRow({ holding }: PortfolioRowProps) {
  const exchange = detectExchange(holding.exchangeCode);

  const isGainPositive = typeof holding.gainLoss === 'number' && holding.gainLoss > 0;
  const isGainNegative = typeof holding.gainLoss === 'number' && holding.gainLoss < 0;

  const gainColor = isGainPositive
    ? 'text-emerald-400'
    : isGainNegative
    ? 'text-rose-400'
    : 'text-slate-400';

  return (
    <tr className="border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors text-xs">
      {/* 1. Stock Name & Ticker */}
      <td className="py-3 px-4 text-left">
        <div className="font-medium text-slate-100">{holding.name}</div>
        <div className="text-[11px] text-slate-400 font-mono">{holding.exchangeCode}</div>
      </td>

      {/* 2. Purchase Price */}
      <td className="py-3 px-4 text-right font-mono text-slate-300">
        {formatCurrency(holding.purchasePrice, { showDecimals: true })}
      </td>

      {/* 3. Quantity */}
      <td className="py-3 px-4 text-right font-mono text-slate-300">
        {formatNumber(holding.quantity, 0)}
      </td>

      {/* 4. Total Investment */}
      <td className="py-3 px-4 text-right font-mono font-medium text-slate-100">
        {formatCurrency(holding.investment)}
      </td>

      {/* 5. Portfolio % Weight */}
      <td className="py-3 px-4 text-right font-mono text-slate-400">
        {formatPercentage(holding.portfolioWeight, { includeSign: false })}
      </td>

      {/* 6. Exchange Badge */}
      <td className="py-3 px-4 text-center">
        <Badge variant={exchange === 'NSE' ? 'nse' : 'bse'} size="sm">
          {exchange}
        </Badge>
      </td>

      {/* 7. Current Market Price (CMP) */}
      <td className="py-3 px-4 text-right font-mono font-medium text-white">
        {formatCurrency(holding.cmp, { showDecimals: true })}
      </td>

      {/* 8. Present Value */}
      <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
        {formatCurrency(holding.presentValue)}
      </td>

      {/* 9. Gain / Loss & % */}
      <td className="py-3 px-4 text-right font-mono">
        {holding.gainLoss !== null ? (
          <div>
            <div className={`font-semibold ${gainColor}`}>
              {formatCurrency(holding.gainLoss, { includeSign: true })}
            </div>
            <div className={`text-[11px] ${gainColor}`}>
              {formatPercentage(holding.gainLossPercentage, { includeSign: true })}
            </div>
          </div>
        ) : (
          <span className="text-slate-500">N/A</span>
        )}
      </td>

      {/* 10. P/E Ratio */}
      <td className="py-3 px-4 text-right font-mono text-slate-300">
        {holding.peRatio !== null ? formatNumber(holding.peRatio, 2) : 'N/A'}
      </td>

      {/* 11. Latest Earnings (EPS) */}
      <td className="py-3 px-4 text-right font-mono text-slate-400">
        {holding.latestEarnings !== null && holding.latestEarnings !== undefined
          ? typeof holding.latestEarnings === 'number'
            ? formatNumber(holding.latestEarnings, 2)
            : holding.latestEarnings
          : 'N/A'}
      </td>
    </tr>
  );
}
