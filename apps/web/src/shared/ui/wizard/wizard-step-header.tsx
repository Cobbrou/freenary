interface WizardStepHeaderProps {
  description: string;
  title: string;
}

export const WizardStepHeader = ({
  description,
  title,
}: WizardStepHeaderProps) => (
  <div className="flex flex-col gap-1.5 in-data-wizard-headline:gap-0.5">
    <h1 className="text-2xl font-bold tracking-tight text-balance in-data-wizard-headline:leading-tight in-data-wizard-headline:font-semibold">
      {title}
    </h1>
    <p className="text-muted-foreground text-sm text-pretty in-data-wizard-headline:text-2xl in-data-wizard-headline:leading-tight in-data-wizard-headline:font-medium in-data-wizard-headline:tracking-tight">
      {description}
    </p>
  </div>
);
