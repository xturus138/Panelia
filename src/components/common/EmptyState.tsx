import { type LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      {Icon && <Icon className="mb-4 h-12 w-12 text-muted-foreground/50" />}
      <h2 className="mb-1 text-lg font-semibold text-foreground">{title}</h2>
      {description && <p className="mb-5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && action.href && (
        <Link
          href={action.href}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {action.label}
        </Link>
      )}
      {action && action.onClick && !action.href && (
        <button
          onClick={action.onClick}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
