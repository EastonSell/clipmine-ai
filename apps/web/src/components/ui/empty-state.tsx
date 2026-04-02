import type { ReactNode } from "react";

import { Card } from "./card";
import { SectionHeader } from "./section-header";

type EmptyStateProps = {
  title: string;
  description: string;
  eyebrow?: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  eyebrow = "No data",
  action,
}: EmptyStateProps) {
  return (
    <Card>
      <SectionHeader eyebrow={eyebrow} title={title} description={description} action={action} />
    </Card>
  );
}
