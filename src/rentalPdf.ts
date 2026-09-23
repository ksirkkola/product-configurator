import pdfMake from 'pdfmake/build/pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { formatMoney } from './hailer/api-helpers';
import { RentalLine, estimateInvoiceTotal, estimateRentalRevenue, estimateRentalWeeks } from './rentalLines';
import { RentalUnitSummary } from './types';
import { QuoteDetails } from './components/QuoteDetailsBox';
import { RENTAL_PURCHASE_CREDIT_PCT } from './constants/schema';
import { THERMETRICS_LOGO } from './assets/logo';

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfMake as any).addVirtualFileSystem(vfsFonts);
  fontsRegistered = true;
}

interface RentalQuotePdfInput {
  lines: RentalLine[];
  units: RentalUnitSummary[];
  details: QuoteDetails;
  accountName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

function fmtDate(v: string): string {
  return v ? new Date(v).toLocaleDateString() : '—';
}

function infoRows(rows: [string, string | undefined][]) {
  return rows
    .filter(([, value]) => !!value)
    .map(([label, value]) => ({
      columns: [
        { text: label, color: '#718096', fontSize: 9, width: '55%' },
        { text: value as string, fontSize: 9, bold: true, alignment: 'right' as const, width: '45%' },
      ],
      margin: [0, 1, 0, 1] as [number, number, number, number],
    }));
}

export function buildRentalQuoteDocDefinition(input: RentalQuotePdfInput): TDocumentDefinitions {
  const { lines, units, details, accountName, contactName, contactEmail, contactPhone } = input;

  const headerRow: TableCell[] = [
    'Unit', 'Start Date', 'Return Due', 'Weekly Rate', 'Est. Weeks', 'Est. Rental Fee', 'Startup Fee', 'Shipping', 'Deposit', 'Est. Total',
  ];
  const body: TableCell[][] = [headerRow];

  let totalDeposit = 0;
  let totalRentalFee = 0;
  let totalInvoice = 0;
  let allKnown = true;

  for (const line of lines) {
    const unit = units.find((u) => u._id === line.unitId);
    const weeks = estimateRentalWeeks(line);
    const revenue = estimateRentalRevenue(line);
    const invoiceTotal = estimateInvoiceTotal(line);
    if (revenue == null) allKnown = false;
    totalDeposit += Number(line.deposit) || 0;
    totalRentalFee += revenue ?? 0;
    totalInvoice += invoiceTotal ?? 0;
    body.push([
      `${unit?.productFamily || unit?.name || 'Unit'}${unit?.serialNumber ? ` (${unit.serialNumber})` : ''}`,
      fmtDate(line.startDate),
      fmtDate(line.endDate),
      line.weeklyRate ? formatMoney(Number(line.weeklyRate)) : '—',
      weeks != null ? String(weeks) : '—',
      revenue != null ? formatMoney(revenue) : '—',
      line.startupFee ? formatMoney(Number(line.startupFee)) : '—',
      line.shippingCost ? formatMoney(Number(line.shippingCost)) : '—',
      line.deposit ? formatMoney(Number(line.deposit)) : '—',
      invoiceTotal != null ? formatMoney(invoiceTotal) : '—',
    ]);
  }

  const purchaseCredit = totalRentalFee * RENTAL_PURCHASE_CREDIT_PCT;

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { fontSize: 9 },
    content: [
      {
        columns: [
          { text: 'Rental Quote', fontSize: 20, bold: true },
          { image: THERMETRICS_LOGO, width: 150, alignment: 'right' as const },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        columns: [
          {
            width: '50%',
            stack: infoRows([
              ['Account', accountName],
              ['Ship To', details.shipTo],
              ['Contact', contactName],
              ['Email', contactEmail],
              ['Phone #', contactPhone],
            ]),
          },
          {
            width: '50%',
            stack: infoRows([['Date', new Date().toLocaleDateString()]]),
          },
        ],
        margin: [0, 0, 0, 15],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e2e8f0' : null),
        },
      },
      {
        text: `Total Deposit: ${formatMoney(totalDeposit)}`,
        fontSize: 10,
        alignment: 'right',
        margin: [0, 10, 0, 0],
      },
      {
        text: `Est. Total to Invoice: ${formatMoney(totalInvoice)}`,
        bold: true,
        fontSize: 13,
        alignment: 'right',
        margin: [0, 4, 0, 0],
      },
      {
        text: 'Rental fee + startup + shipping (deposit excluded \u2014 refundable, not revenue).',
        fontSize: 8,
        color: '#718096',
        alignment: 'right',
        margin: [0, 2, 0, 0],
      },
      ...(!allKnown
        ? [
            {
              text: 'Some units are missing a weekly rate or date range and are excluded from the estimate above.',
              color: '#dd6b20',
              fontSize: 8,
              alignment: 'right' as const,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
      {
        text: 'Rental Terms:',
        bold: true,
        margin: [0, 15, 0, 3],
      },
      { text: 'Deposit due at rental agreement; refunded on return subject to condition inspection.', fontSize: 8, color: '#718096' },
      { text: 'Weekly rate billed for each week or part-week the unit is out, rounded up to the nearest full week.', fontSize: 8, color: '#718096' },
      { text: 'Startup / training and shipping are one-time charges, billed separately from the weekly rate.', fontSize: 8, color: '#718096' },
      ...(purchaseCredit > 0
        ? [
            {
              text: `${RENTAL_PURCHASE_CREDIT_PCT * 100}% of the rental fee (${formatMoney(purchaseCredit)}) will be credited against the purchase price if the customer later decides to buy instead of renting.`,
              fontSize: 8,
              color: '#718096',
            },
          ]
        : []),
      { text: 'Estimated total is not final — actual total depends on the unit\u2019s real return date.', fontSize: 8, color: '#718096' },
    ],
  };

  return docDefinition;
}

export function generateRentalQuotePdf(input: RentalQuotePdfInput): void {
  ensureFonts();
  const docDefinition = buildRentalQuoteDocDefinition(input);
  const filenameParts = [input.accountName].filter(Boolean).join(' - ');
  pdfMake.createPdf(docDefinition).download(`Rental Quote${filenameParts ? ` - ${filenameParts}` : ''}.pdf`);
}
