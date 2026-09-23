import pdfMake from 'pdfmake/build/pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { LinePricing, Totals } from './pricing';
import { formatMoney } from './hailer/api-helpers';
import { ITEM_TYPE } from './constants/schema';
import { groupQuoteSections, SectionDiscounts } from './quoteSections';
import { QuoteDetails } from './components/QuoteDetailsBox';
import { THERMETRICS_LOGO } from './assets/logo';

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfMake as any).addVirtualFileSystem(vfsFonts);
  fontsRegistered = true;
}

interface QuotePdfInput {
  totals: Totals;
  details: QuoteDetails;
  sectionDiscounts?: SectionDiscounts;
  accountName?: string;
  agentName?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

function unitPriceText(p: LinePricing): string {
  if (p.isIncluded) return 'Included';
  if (!p.hasPrice) return 'On request';
  return formatMoney(p.unitPrice) + (p.isOverridden ? ' *' : '');
}

function infoRows(rows: [string, string | undefined][]): Content[] {
  return rows
    .filter(([, value]) => !!value)
    .map(([label, value]) => ({
      columns: [
        { text: label, color: '#718096', fontSize: 9, width: '55%' },
        { text: value as string, fontSize: 9, bold: true, alignment: 'right', width: '45%' },
      ],
      margin: [0, 1, 0, 1] as [number, number, number, number],
    }));
}

// Pure builder — no browser APIs — so it can be exercised in tests/tooling
// without a DOM (the actual download trigger lives in generateQuotePdf below).
export function buildQuoteDocDefinition(input: QuotePdfInput): TDocumentDefinitions {
  const { totals, details, sectionDiscounts, accountName, agentName, contactName, contactEmail, contactPhone } = input;
  const { systemPriceSections, postSystemSections, totalSystemPrice, grandTotal } = groupQuoteSections(
    totals,
    sectionDiscounts,
  );

  let itemNumber = 0;
  const headerRow = ['Item', 'Item #', 'Product Description', 'Product Name', 'Price', 'Qty', 'Total'];

  function lineRow(p: LinePricing): TableCell[] {
    itemNumber += 1;
    const suffix = p.isIncluded ? '  (Included)' : p.hasPrice ? '' : '  (PRF)';
    return [
      String(itemNumber),
      p.line.item.itemId || p.line.item.productCode || '—',
      { text: `${p.line.item.description || p.line.item.name}${suffix}` },
      p.line.item.itemType === ITEM_TYPE.MAIN ? p.line.item.productCode : '',
      unitPriceText(p),
      String(p.line.qty),
      p.isIncluded ? 'Included' : p.hasPrice ? formatMoney(p.finalTotal) : '—',
    ];
  }

  function sectionHeaderRow(label: string): TableCell[] {
    return [{ text: label.toUpperCase(), colSpan: 7, bold: true, fontSize: 8, fillColor: '#f0f0f0' }, {}, {}, {}, {}, {}, {}];
  }

  function subtotalRow(value: string): TableCell[] {
    return [{ text: '', colSpan: 5 }, {}, {}, {}, {}, { text: 'Subtotal', bold: true, alignment: 'right', fontSize: 9 }, { text: value, bold: true, fontSize: 9 }];
  }

  function discountRows(discountPct: number, discountAmount: number): TableCell[][] {
    const rows: TableCell[][] = [
      [{ text: '', colSpan: 5 }, {}, {}, {}, {}, { text: 'Discount (%)', color: '#718096', fontSize: 9, alignment: 'right' }, { text: `${discountPct}%`, fontSize: 9, alignment: 'right' }],
    ];
    if (discountPct > 0) {
      rows.push([{ text: '', colSpan: 5 }, {}, {}, {}, {}, { text: 'Discount ($)', color: '#718096', fontSize: 9, alignment: 'right' }, { text: `-${formatMoney(discountAmount)}`, color: '#dd6b20', fontSize: 9, alignment: 'right' }]);
    }
    return rows;
  }

  const body: TableCell[][] = [headerRow];

  for (const { section, lines, discountable, discountPct, discountAmount, netSubtotal } of systemPriceSections) {
    body.push(sectionHeaderRow(section.label));
    if (lines.length === 0) {
      body.push([{ text: section.type === ITEM_TYPE.ISO_CERTIFICATION ? 'Not included' : '—', colSpan: 7, italics: true, color: '#718096' }, {}, {}, {}, {}, {}, {}]);
      if (discountable) discountRows(discountPct, discountAmount).forEach((r) => body.push(r));
      body.push(subtotalRow(section.type === ITEM_TYPE.ISO_CERTIFICATION ? '' : formatMoney(netSubtotal)));
    } else {
      lines.forEach((p) => body.push(lineRow(p)));
      if (discountable) discountRows(discountPct, discountAmount).forEach((r) => body.push(r));
      body.push(subtotalRow(formatMoney(netSubtotal)));
    }
  }

  body.push([{ text: '', colSpan: 5 }, {}, {}, {}, {}, { text: 'Total System Price', bold: true, alignment: 'right' }, { text: formatMoney(totalSystemPrice), bold: true }]);

  // Calibration only appears when used; Shipping always appears since it also
  // carries the Final Destination / Incoterms rows moved down from the header.
  for (const { section, lines, discountable, discountPct, discountAmount, netSubtotal } of postSystemSections) {
    const isShipping = section.type === ITEM_TYPE.SHIPPING;
    if (lines.length === 0 && !isShipping) continue;
    body.push(sectionHeaderRow(section.label));
    lines.forEach((p) => body.push(lineRow(p)));
    if (discountable) discountRows(discountPct, discountAmount).forEach((r) => body.push(r));
    if (lines.length > 0) body.push(subtotalRow(formatMoney(netSubtotal)));
    if (isShipping) {
      body.push([{ text: '', colSpan: 5 }, {}, {}, {}, {}, { text: 'Final Destination', color: '#718096', fontSize: 9, alignment: 'right' }, { text: details.finalDestinationCountry || '—', fontSize: 9, alignment: 'right' }]);
      body.push([{ text: '', colSpan: 5 }, {}, {}, {}, {}, { text: 'Incoterms', color: '#718096', fontSize: 9, alignment: 'right' }, { text: details.incoterms || '—', fontSize: 9, alignment: 'right' }]);
    }
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { fontSize: 9 },
    content: [
      {
        columns: [
          { text: 'Quote', fontSize: 20, bold: true },
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
              ['Agent', agentName],
              ['Ship To', details.shipTo],
              ['Contact', contactName],
              ['Email', contactEmail],
              ['Phone #', contactPhone],
            ]),
          },
          {
            width: '50%',
            stack: infoRows([
              ['Date', new Date().toLocaleDateString()],
              ['Proposal Reference #', details.proposalReference],
              [
                'Quote Expiration',
                details.quoteExpirationDate
                  ? new Date(details.quoteExpirationDate).toLocaleDateString()
                  : undefined,
              ],
              ['HS Code', details.hsCode],
              ['Internal Reference', details.internalReference],
            ]),
          },
        ],
        margin: [0, 0, 0, 15],
      },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#e2e8f0' : null),
        },
      },
      {
        text: `Items TOTAL without Tax: ${formatMoney(grandTotal)}`,
        bold: true,
        fontSize: 13,
        alignment: 'right',
        margin: [0, 15, 0, 0],
      },
      ...(totals.prfCount > 0
        ? [
            {
              text: `${totals.prfCount} item${totals.prfCount > 1 ? 's' : ''} priced on request — not included in total above.`,
              color: '#dd6b20',
              fontSize: 8,
              alignment: 'right' as const,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
      ...(totals.lines.some((p) => p.isOverridden)
        ? [
            {
              text: '* Price adjusted from catalog for this quote.',
              color: '#dd6b20',
              fontSize: 8,
              alignment: 'right' as const,
              margin: [0, 2, 0, 0] as [number, number, number, number],
            },
          ]
        : []),
      {
        text: '* All Thermetrics Systems come with a Standard Calibration Certificate.',
        fontSize: 8,
        color: '#718096',
        margin: [0, 15, 0, 10],
      },
      { text: 'Standard Sales Terms:', bold: true, margin: [0, 0, 0, 3] },
      { text: '50% Down at Order Placement; due Net 30 days from date of purchase', fontSize: 8, color: '#718096' },
      { text: '50% At Ready to Ship notification; due Net 30 from date of invoice', fontSize: 8, color: '#718096' },
      { text: 'Notes:', bold: true, margin: [0, 15, 0, 3] },
      {
        table: { widths: ['*'], body: [[{ text: '\n\n\n' }]] },
        layout: { defaultBorder: true },
      },
    ],
  };

  return docDefinition;
}

export function generateQuotePdf(input: QuotePdfInput): void {
  ensureFonts();
  const docDefinition = buildQuoteDocDefinition(input);
  const filenameParts = [input.details.proposalReference, input.accountName].filter(Boolean).join(' - ');
  pdfMake.createPdf(docDefinition).download(`Quote${filenameParts ? ` - ${filenameParts}` : ''}.pdf`);
}
