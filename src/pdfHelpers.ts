import pdfMake from 'pdfmake/build/pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell } from 'pdfmake/interfaces';

let fontsRegistered = false;
export function ensurePdfFonts(): void {
  if (fontsRegistered) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfMake as any).addVirtualFileSystem(vfsFonts);
  fontsRegistered = true;
}

// Renders a two-column "label / value" header block (e.g. Account/Ship To/...
// next to Date/Reference #/...) as ONE borderless table (5 columns: label,
// value, gap, label, value) instead of two independent side-by-side `stack`s.
// This matters because a `stack` has no concept of a shared row height — when
// a value on one side wraps to multiple lines (a multi-line address, a long
// email), that stack simply gets taller while the other stack's rows don't
// move, so unrelated label/value pairs drift into visual alignment with each
// other. A real pdfmake `table` gives every row one height (the max of its
// cells), keeping both sides in lockstep no matter how much either side
// wraps. Values are left-aligned (not right) because right-aligning a
// wrapped multi-line value makes each line jump to a different position —
// legible only when it's a single line, which real data (addresses, emails,
// references) often isn't. Shared by the main Quote PDF and the Rental
// Contract PDF so both get this fix identically.
export function infoTable(left: [string, string | undefined][], right: [string, string | undefined][]): Content {
  const leftRows = left.filter(([, v]) => !!v);
  const rightRows = right.filter(([, v]) => !!v);
  const rowCount = Math.max(leftRows.length, rightRows.length);
  const body: TableCell[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const [lLabel, lValue] = leftRows[i] ?? ['', ''];
    const [rLabel, rValue] = rightRows[i] ?? ['', ''];
    body.push([
      { text: lLabel, color: '#718096', fontSize: 9 },
      { text: (lValue as string) || '', fontSize: 9, bold: true },
      { text: '' },
      { text: rLabel, color: '#718096', fontSize: 9 },
      { text: (rValue as string) || '', fontSize: 9, bold: true },
    ]);
  }
  return {
    // label2 is a fixed width (not 'auto') because 'auto' gets squeezed once
    // the table's total width is constrained, which was wrapping "Proposal
    // Reference #" / "Internal Reference" onto two lines — 100pt fits the
    // longest of those labels on one line at fontSize 9.
    table: { widths: ['auto', '*', 20, 100, '*'], body },
    layout: 'noBorders',
    margin: [0, 0, 0, 15],
  };
}
