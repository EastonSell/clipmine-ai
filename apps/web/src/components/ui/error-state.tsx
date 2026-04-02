import type { ReactNode } from "react";

import { AlertCircle } from "lucide-react";

import { Badge } from "./badge";
import { Card } from "./card";
import { SectionHeader } from "./section-header";

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Badge tone="danger" className="w-fit gap-2 px-3 py-1.5 text-sm">
          <AlertCircle className="size-4" />
          Error
        </Badge>
        <SectionHeader title={title} description={description} action={action} />
      </div>
    </Card>
  );
}
