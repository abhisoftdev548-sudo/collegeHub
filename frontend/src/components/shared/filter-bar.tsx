'use client';

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
  onReset?: () => void;
  className?: string;
}

export const FilterBar = ({ search, onSearchChange, placeholder = 'Search…', children, onReset, className }: FilterBarProps) => (
  <div className={cn('flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center', className)}>
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9 pr-8 text-[13px]"
        aria-label={placeholder}
      />
      {search ? (
        <button
          type="button"
          onClick={() => onSearchChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-subtle-foreground hover:text-ink"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
    {children}
    {onReset ? (
      <button type="button" onClick={onReset} className="text-[12px] font-medium text-muted-foreground hover:text-ink">
        Reset filters
      </button>
    ) : null}
  </div>
);
