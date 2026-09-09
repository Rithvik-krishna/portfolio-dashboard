'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { CalculatedHolding, SectorSummary } from '@/types/portfolio';
import { SectorSection } from './SectorSection';
import { TableRowSkeleton } from '@/components/ui/Skeleton';

interface PortfolioTableProps {
  holdings: CalculatedHolding[];
  sectorSummaries: SectorSummary[];
  isLoading?: boolean;
}

export function PortfolioTable({
  holdings,
  sectorSummaries,
  isLoading = false,
}: PortfolioTableProps) {
  // Initialize all sectors as expanded by default
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sectorSummaries) {
      initial[s.sector] = true;
    }
    return initial;
  });

  const toggleSector = (sectorName: string) => {
    setExpandedSectors((prev) => ({
      ...prev,
      [sectorName]: !prev[sectorName],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    for (const s of sectorSummaries) {
      allExpanded[s.sector] = true;
    }
    setExpandedSectors(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed: Record<string, boolean> = {};
    for (const s of sectorSummaries) {
      allCollapsed[s.sector] = false;
    }
    setExpandedSectors(allCollapsed);
  };

  const allAreExpanded = sectorSummaries.every((s) => expandedSectors[s.sector]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-slate-800 bg-slate-900/80">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Portfolio Holdings
          </h2>
          <span className="text-xs text-slate-400">
            ({holdings.length} securities across {sectorSummaries.length} sectors)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allAreExpanded ? collapseAll : expandAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
          >
            {allAreExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                <span>Expand All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Table Structure */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider font-medium">
            <tr>
              <th scope="col" className="py-3 px-4 text-left">Stock</th>
              <th scope="col" className="py-3 px-4 text-right">Purchase</th>
              <th scope="col" className="py-3 px-4 text-right">Qty</th>
              <th scope="col" className="py-3 px-4 text-right">Investment</th>
              <th scope="col" className="py-3 px-4 text-right">Weight</th>
              <th scope="col" className="py-3 px-4 text-center">Exch</th>
              <th scope="col" className="py-3 px-4 text-right">CMP</th>
              <th scope="col" className="py-3 px-4 text-right">Present Val</th>
              <th scope="col" className="py-3 px-4 text-right">Gain / Loss</th>
              <th scope="col" className="py-3 px-4 text-right">P/E</th>
              <th scope="col" className="py-3 px-4 text-right">Latest EPS</th>
            </tr>
          </thead>
          {isLoading && holdings.length === 0 ? (
            <tbody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </tbody>
          ) : null}
        </table>
      </div>

      {/* Sector Groups */}
      <div>
        {sectorSummaries.map((sector) => {
          const sectorHoldings = holdings.filter(
            (h) => h.sector.trim().toLowerCase() === sector.sector.trim().toLowerCase()
          );

          return (
            <SectorSection
              key={sector.sector}
              sector={sector}
              holdings={sectorHoldings}
              isExpanded={expandedSectors[sector.sector] ?? true}
              onToggle={() => toggleSector(sector.sector)}
            />
          );
        })}
      </div>
    </div>
  );
}
