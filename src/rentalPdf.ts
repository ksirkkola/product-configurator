import pdfMake from 'pdfmake/build/pdfmake';
import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { formatMoney } from './hailer/api-helpers';
import {
  RentalLine,
  cleaningAndCalibrationDue,
  estimateRentalRevenue,
  estimateRentalWeeks,
} from './rentalLines';
import { RentalUnitSummary } from './types';
import { RentalDetails } from './components/RentalDetailsBox';
import { THERMETRICS_LOGO } from './assets/logo';
import { ensurePdfFonts, infoTable } from './pdfHelpers';

interface RentalContractPdfInput {
  lines: RentalLine[];
  units: RentalUnitSummary[];
  rentalDetails: RentalDetails;
  accountName?: string;
  shipTo?: string;
  contactName?: string;
  contactEmail?: string;
}

function fmtDate(v: string): string {
  return v ? new Date(v).toLocaleDateString() : '—';
}

function unitLabel(line: RentalLine, units: RentalUnitSummary[]): string {
  const unit = units.find((u) => u._id === line.unitId);
  const base = unit?.productFamily || unit?.name || 'Unit';
  return unit?.serialNumber ? `${base} (S/N ${unit.serialNumber})` : base;
}

function sectionHeaderRow(label: string): TableCell[] {
  return [{ text: label.toUpperCase(), colSpan: 3, bold: true, fontSize: 8, fillColor: '#f0f0f0' }, {}, {}];
}

function subtotalRow(value: string): TableCell[] {
  return [{ text: '', colSpan: 1 }, { text: 'Subtotal', bold: true, alignment: 'right', fontSize: 9 }, { text: value, bold: true, fontSize: 9 }];
}

// Builds one section of the Rental Contract's item table (Item # | Description
// | Amount), one row per unit that has a nonzero amount for this charge type.
// `alwaysShow` sections (Rental Fee, Cleaning and Calibration) list every
// unit even at €0/waived; other sections collapse to "Not included" when no
// unit has anything to bill.
function buildSection(
  itemNumberRef: { n: number },
  label: string,
  lines: RentalLine[],
  rowFor: (line: RentalLine) => { desc: TableCell; amount: number; amountText?: string } | null,
  alwaysShow: boolean,
): TableCell[][] {
  const rows = lines.map(rowFor).filter((r): r is NonNullable<typeof r> => r != null && (alwaysShow || r.amount > 0));
  const body: TableCell[][] = [sectionHeaderRow(label)];
  if (rows.length === 0) {
    body.push([{ text: 'Not included', colSpan: 3, italics: true, color: '#718096' }, {}, {}]);
    return body;
  }
  let total = 0;
  for (const row of rows) {
    itemNumberRef.n += 1;
    total += row.amount;
    body.push([String(itemNumberRef.n), row.desc, row.amountText ?? formatMoney(row.amount)]);
  }
  body.push(subtotalRow(formatMoney(total)));
  return body;
}

export function buildRentalContractDocDefinition(input: RentalContractPdfInput): TDocumentDefinitions {
  const { lines, units, rentalDetails, accountName, shipTo, contactName, contactEmail } = input;

  const itemNumberRef = { n: 0 };
  const body: TableCell[][] = [['Item', 'Description', 'Amount']];

  buildSection(
    itemNumberRef,
    'Rental Fee',
    lines,
    (line) => {
      const weeks = estimateRentalWeeks(line);
      const revenue = estimateRentalRevenue(line);
      return {
        desc: {
          stack: [
            { text: `${unitLabel(line, units)} — ${fmtDate(line.startDate)} – ${fmtDate(line.endDate)}` },
            ...(weeks != null ? [{ text: `${weeks} week${weeks === 1 ? '' : 's'}`, fontSize: 8, color: '#718096' }] : []),
          ],
        },
        amount: revenue ?? 0,
        amountText: revenue != null ? formatMoney(revenue) : '—',
      };
    },
    true,
  ).forEach((r) => body.push(r));

  buildSection(
    itemNumberRef,
    'Setup and Training',
    lines,
    (line) => ({ desc: unitLabel(line, units), amount: Number(line.startupFee) || 0 }),
    false,
  ).forEach((r) => body.push(r));

  buildSection(
    itemNumberRef,
    'Freight Delivery',
    lines,
    (line) => ({ desc: unitLabel(line, units), amount: Number(line.freightDelivery) || 0 }),
    false,
  ).forEach((r) => body.push(r));

  buildSection(
    itemNumberRef,
    'Freight Return',
    lines,
    (line) => ({ desc: unitLabel(line, units), amount: Number(line.freightReturn) || 0 }),
    false,
  ).forEach((r) => body.push(r));

  buildSection(
    itemNumberRef,
    'Cleaning and Calibration',
    lines,
    (line) => {
      const listPrice = Number(line.cleaningAndCalibration) || 0;
      const due = cleaningAndCalibrationDue(line);
      return {
        desc: unitLabel(line, units),
        amount: due,
        amountText: line.cleaningAndCalibrationWaived ? `${formatMoney(listPrice)} (waived for this rental)` : undefined,
      };
    },
    true,
  ).forEach((r) => body.push(r));

  const grandTotal = lines.reduce((s, line) => {
    const revenue = estimateRentalRevenue(line) ?? 0;
    const startup = Number(line.startupFee) || 0;
    const freightDelivery = Number(line.freightDelivery) || 0;
    const freightReturn = Number(line.freightReturn) || 0;
    const cleaning = cleaningAndCalibrationDue(line);
    return s + revenue + startup + freightDelivery + freightReturn + cleaning;
  }, 0);

  function responsibilityRow(label: string, value: string): TableCell[] {
    return [{ text: label, color: '#718096', fontSize: 9 }, { text: value || '—', bold: true, fontSize: 9, alignment: 'right' }];
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { fontSize: 9 },
    content: [
      {
        columns: [
          { text: 'Rental Contract', fontSize: 20, bold: true },
          { image: THERMETRICS_LOGO, width: 150, alignment: 'right' as const },
        ],
        margin: [0, 0, 0, 10],
      },
      infoTable(
        [
          ['Account', accountName],
          ['Ship To', shipTo],
          ['Contact', contactName],
          ['Email', contactEmail],
        ],
        [
          ['Date', new Date().toLocaleDateString()],
          ['Contract Reference #', rentalDetails.contractReference],
        ],
      ),
      {
        table: {
          headerRows: 1,
          widths: ['auto', '*', 'auto'],
          body,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e2e8f0' : null),
        },
      },
      {
        text: `Est. Total to Invoice: ${formatMoney(grandTotal)}`,
        bold: true,
        fontSize: 13,
        alignment: 'right',
        margin: [0, 15, 0, 0],
      },
      {
        text: 'Shipping Responsibility',
        bold: true,
        margin: [0, 20, 0, 6],
      },
      {
        table: {
          widths: ['*', 200],
          body: [
            responsibilityRow('Delivery Freight', rentalDetails.deliveryFreightResponsibility),
            responsibilityRow('Return Freight', rentalDetails.returnFreightResponsibility),
            responsibilityRow('Insurance During Transportation', rentalDetails.insuranceDuringTransportation),
            responsibilityRow('Applicable Delivery Terms / Incoterms', rentalDetails.applicableDeliveryTerms),
          ],
        },
        layout: 'noBorders',
      },
    ],
  };

  return docDefinition;
}

export function generateRentalContractPdf(input: RentalContractPdfInput): void {
  ensurePdfFonts();
  const docDefinition = buildRentalContractDocDefinition(input);
  const filenameParts = [input.accountName].filter(Boolean).join(' - ');
  pdfMake.createPdf(docDefinition).download(`Rental Contract${filenameParts ? ` - ${filenameParts}` : ''}.pdf`);
}
