import {
  Editable,
  EditableInput,
  EditablePreview,
  HStack,
  IconButton,
  Tooltip,
} from '@chakra-ui/react';
import { formatMoney } from '../hailer/api-helpers';

interface Props {
  // Current final per-unit price, or undefined when priced-on-request (PRF).
  value: number | undefined;
  isOverridden: boolean;
  // Bundled into the parent's price at zero extra charge — shows "Included"
  // instead of "€0.00". Still click-to-edit: typing a real number here is
  // treated as a deliberate override (see pricing.ts) in the rare case a
  // rep needs to charge for it after all.
  isIncluded?: boolean;
  onCommit: (price: number) => void;
  onReset: () => void;
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// Click-to-edit unit price. Renders as plain text (prints/exports fine) until
// clicked; discounts/manual pricing are rare so this stays out of the way.
export default function EditablePriceCell({ value, isOverridden, isIncluded, onCommit, onReset }: Props) {
  // key={value} remounts the Editable whenever the computed price changes
  // externally (e.g. commission % edited elsewhere), so it never shows stale text.
  return (
    <HStack spacing={1} justify="flex-end" className="price-cell">
      <Editable
        key={value}
        defaultValue={isIncluded ? 'Included' : value != null ? formatMoney(value) : ''}
        placeholder="On request"
        fontWeight={isOverridden ? 'bold' : undefined}
        color={isOverridden ? 'orange.500' : isIncluded ? 'blue.500' : undefined}
        fontStyle={isIncluded ? 'italic' : undefined}
        textAlign="right"
        onSubmit={(raw) => {
          const parsed = parsePrice(raw);
          if (parsed != null) onCommit(parsed);
        }}
      >
        <EditablePreview />
        {/* only rendered while actively editing; no-print is a no-op in that
            moment but keeps intent clear and costs nothing */}
        <EditableInput textAlign="right" width="6.5rem" className="no-print" />
      </Editable>
      {isOverridden && (
        <Tooltip label="Reset to catalog price">
          <IconButton
            aria-label="Reset to catalog price"
            icon={<span aria-hidden>↺</span>}
            size="xs"
            variant="ghost"
            className="no-print"
            onClick={onReset}
          />
        </Tooltip>
      )}
    </HStack>
  );
}
