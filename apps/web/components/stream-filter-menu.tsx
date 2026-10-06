"use client";

import { CheckIcon, ChevronDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef } from "react";

export function StreamFilterMenu({ ariaLabel, triggerLabel, value, options, onSelect, menuClassName }: {
  ariaLabel: string;
  triggerLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onSelect: (value: string, viaKeyboard: boolean) => void;
  menuClassName?: string;
}) {
  // Radix 键盘选中会对条目派发合成 click（detail === 0，全站约定）：先记下激活来源，再交给 onValueChange。
  const viaKeyboard = useRef(false);
  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <button aria-label={ariaLabel} className="ai-news__category-select" type="button">
        <span>{triggerLabel}</span><ChevronDown aria-hidden="true" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content align="end" sideOffset={4} collisionPadding={16} className={`ai-news__category-menu${menuClassName ? ` ${menuClassName}` : ""}`}>
        <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onSelect(next, viaKeyboard.current)}>
          {options.map(({ value: optionValue, label }) =>
            <DropdownMenu.RadioItem
              data-slot="dropdown-menu-radio-item"
              key={optionValue}
              onClick={(event) => { viaKeyboard.current = event.detail === 0; }}
              value={optionValue}>
              {label}
              <span data-slot="dropdown-menu-radio-item-indicator"><DropdownMenu.ItemIndicator><CheckIcon aria-hidden="true" /></DropdownMenu.ItemIndicator></span>
            </DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}
