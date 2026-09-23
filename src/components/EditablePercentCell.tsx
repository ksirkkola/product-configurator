import { Editable, EditableInput, EditablePreview } from '@chakra-ui/react';

interface Props {
  value: number; // 0-100
  onCommit: (pct: number) => void;
}

function parsePct(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0; // clearing the field resets the discount to 0
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, 100);
}

// Click-to-edit section discount percentage — renders as plain text ("0%")
// until clicked, same pattern as EditablePriceCell.
export default function EditablePercentCell({ value, onCommit }: Props) {
  return (
    <Editable
      key={value}
      defaultValue={`${value}%`}
      textAlign="right"
      fontWeight={value > 0 ? 'bold' : undefined}
      color={value > 0 ? 'orange.500' : undefined}
      onSubmit={(raw) => {
        const parsed = parsePct(raw);
        if (parsed != null) onCommit(parsed);
      }}
    >
      <EditablePreview />
      <EditableInput textAlign="right" width="4rem" className="no-print" />
    </Editable>
  );
}
