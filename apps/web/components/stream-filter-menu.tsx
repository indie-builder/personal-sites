"use client";

import { CheckIcon, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";

export function StreamFilterMenu({ ariaLabel, triggerLabel, value, options, onSelect, menuClassName }: {
  ariaLabel: string;
  triggerLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string) => void;
  menuClassName?: string;
}) {
  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <button aria-label={ariaLabel} className="ai-news__category-select" type="button">
        <span>{triggerLabel}</span><ChevronDown aria-hidden="true" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={16} className={`ai-news__category-menu${menuClassName ? ` ${menuClassName}` : ""}`}>
        <DropdownMenu.RadioGroup value={value} onValueChange={onSelect}>
          {options.map(({ value: optionValue, label }) =>
            <DropdownMenu.RadioItem data-slot="dropdown-menu-radio-item" key={optionValue} value={optionValue}>
              {label}
              <span data-slot="dropdown-menu-radio-item-indicator"><DropdownMenu.ItemIndicator><CheckIcon aria-hidden="true" /></DropdownMenu.ItemIndicator></span>
            </DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
