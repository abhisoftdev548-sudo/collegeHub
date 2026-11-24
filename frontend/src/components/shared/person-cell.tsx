import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/utils';

export const PersonCell = ({
  name,
  email,
  meta,
}: {
  name?: string;
  email?: string;
  meta?: string;
}) => (
  <div className="flex items-center gap-2.5">
    <Avatar className="h-8 w-8">
      <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
    </Avatar>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-ink">{name ?? '—'}</p>
      <p className="truncate text-[11px] text-muted-foreground">{email ?? meta ?? '—'}</p>
    </div>
  </div>
);
