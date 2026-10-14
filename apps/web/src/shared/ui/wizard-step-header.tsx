interface WizardStepHeaderProps {
  description: string;
  title: string;
}

export const WizardStepHeader = ({
  description,
  title,
}: WizardStepHeaderProps) => (
  <div className="flex flex-col gap-1.5">
    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);
