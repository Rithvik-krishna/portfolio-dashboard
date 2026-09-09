import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-800/80 ${className}`}
      aria-hidden="true"
    />
  );
}

export function SummaryCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-5 w-5 rounded-md" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b border-slate-800/60">
      <td className="py-3 px-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-1 h-3 w-16" />
      </td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-14" /></td>
      <td className="py-3 px-4 text-center"><Skeleton className="mx-auto h-5 w-10 rounded-full" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-16" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-20" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
      <td className="py-3 px-4 text-right"><Skeleton className="ml-auto h-4 w-14" /></td>
    </tr>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex h-64 w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-col items-center gap-2">
        <div className="h-32 w-32 rounded-full border-4 border-slate-800 border-t-indigo-500 animate-spin" />
        <Skeleton className="h-4 w-28 mt-2" />
      </div>
    </div>
  );
}
