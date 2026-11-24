import { cn } from '@/lib/utils';

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('shimmer rounded-lg', className)} {...props} />
);

export const TableSkeleton = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <div className="space-y-3 p-1">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-3">
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <Skeleton
            key={columnIndex}
            className={cn('h-9 flex-1', columnIndex === 0 && 'max-w-[220px]')}
          />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ className }: { className?: string }) => (
  <div className={cn('rounded-card border border-line bg-surface p-5', className)}>
    <Skeleton className="mb-3 h-4 w-28" />
    <Skeleton className="mb-2 h-8 w-20" />
    <Skeleton className="h-3 w-36" />
  </div>
);
