import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SectionCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  padded?: boolean;
}

export const SectionCard = ({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  padded = true,
}: SectionCardProps) => (
  <Card className={cn('overflow-hidden', className)}>
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription className="mt-0.5">{description}</CardDescription> : null}
      </div>
      {action}
    </CardHeader>
    <CardContent className={cn(!padded && 'p-0', contentClassName)}>{children}</CardContent>
  </Card>
);
