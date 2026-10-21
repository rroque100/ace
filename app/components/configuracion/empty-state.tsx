"use client";

import { Inbox } from "lucide-react";
import type { ReactElement } from "react";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactElement;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Icon className="size-12 text-muted/40 mb-4" />
      <h3 className="text-base font-semibold text-ink mb-1">
        {title}
      </h3>
      <p className="text-sm text-muted max-w-sm mb-4">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-md hover:bg-brand-dark"
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
