import {
  ToggleGroup,
  ToggleGroupItem,
} from "@freenary/ui/components/toggle-group";

interface RangeToggleProps {
  label: string;
  onChange: (months: number) => void;
  options: readonly { label: string; months: number; name: string }[];
  value: number;
}

export const RangeToggle = ({
  label,
  onChange,
  options,
  value,
}: RangeToggleProps) => (
  <ToggleGroup
    aria-label={label}
    onValueChange={([next]) => {
      const chosen = options.find((option) => String(option.months) === next);

      if (chosen) {
        onChange(chosen.months);
      }
    }}
    size="sm"
    spacing={0}
    value={[String(value)]}
    variant="outline"
  >
    {options.map((option) => (
      <ToggleGroupItem
        aria-label={option.name}
        key={option.months}
        value={String(option.months)}
      >
        {option.label}
      </ToggleGroupItem>
    ))}
  </ToggleGroup>
);
