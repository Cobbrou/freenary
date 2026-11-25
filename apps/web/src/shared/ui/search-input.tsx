import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@freenary/ui/components/input-addons";
import { RiSearchLine } from "@remixicon/react";

interface SearchInputProps {
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}

export const SearchInput = ({
  onChange,
  placeholder,
  value,
}: SearchInputProps) => (
  <InputGroup>
    <InputGroupAddon>
      <RiSearchLine />
    </InputGroupAddon>
    <InputGroupInput
      aria-label={placeholder}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type="search"
      value={value}
    />
  </InputGroup>
);
