import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  GridItem,
  HStack,
  Heading,
  Image,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import { Fragment, useMemo, useState } from 'react';
import { Activity, HailerApi, Workflow } from '@hailer/app-sdk';
import { LinePricing, Totals } from '../pricing';
import { formatMoney } from '../hailer/api-helpers';
import { CONTACTS, ITEM_TYPE, OPPORTUNITY } from '../constants/schema';
import { groupQuoteSections, SectionDiscounts } from '../quoteSections';
import { generateQuotePdf } from '../pdf';
import { QuoteDetails } from './QuoteDetailsBox';
import EditablePriceCell from './EditablePriceCell';
import EditablePercentCell from './EditablePercentCell';
import { THERMETRICS_LOGO } from '../assets/logo';
import { formatHailerError } from '../hailerError';

interface Props {
  totals: Totals;
  commissionPct: number;
  hailer: HailerApi;
  workflows: Workflow[];
  customers: Activity[];
  contacts: Activity[];
  details: QuoteDetails;
  onPriceOverride: (itemId: string, price: number) => void;
  onResetOverride: (itemId: string) => void;
  sectionDiscounts: SectionDiscounts;
  onSectionDiscountChange: (sectionType: string, pct: number) => void;
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <HStack justify="space-between" fontSize="sm" spacing={4}>
      <Text color="subtleText">{label}</Text>
      <Text fontWeight="medium" textAlign="right">{value}</Text>
    </HStack>
  );
}

export default function QuoteView({
  totals,
  commissionPct,
  hailer,
  workflows,
  customers,
  contacts,
  details,
  onPriceOverride,
  onResetOverride,
  sectionDiscounts,
  onSectionDiscountChange,
}: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  const account = useMemo(
    () => customers.find((c) => c._id === details.accountId) || null,
    [customers, details.accountId],
  );
  const agent = useMemo(
    () => customers.find((c) => c._id === details.agentId) || null,
    [customers, details.agentId],
  );
  const contact = useMemo(
    () => contacts.find((c) => c._id === details.contactId) || null,
    [contacts, details.contactId],
  );
  const contactName = contact
    ? `${(contact.fields?.[CONTACTS.fields.firstName] as string) || ''} ${
        (contact.fields?.[CONTACTS.fields.lastName] as string) || ''
      }`.trim() || contact.name
    : undefined;
  const contactEmail = contact?.fields?.[CONTACTS.fields.email] as string | undefined;
  const contactPhone = contact?.fields?.[CONTACTS.fields.phone] as string | undefined;

  // Group priced lines into the 8 quote sections, in display order — shared
  // with the PDF export so the two never drift apart.
  const { systemPriceSections, postSystemSections, totalSystemPrice, grandTotal } = useMemo(
    () => groupQuoteSections(totals, sectionDiscounts),
    [totals, sectionDiscounts],
  );

  let itemNumber = 0;

  function downloadPdf() {
    generateQuotePdf({
      totals,
      details,
      sectionDiscounts,
      accountName: account?.name,
      agentName: agent?.name,
      contactName,
      contactEmail,
      contactPhone,
    });
  }

  function saveToOpportunity() {
    setNotice(null);
    const mainLines = totals.lines.filter((p) => p.line.item.itemType === ITEM_TYPE.MAIN);
    const main: (typeof mainLines)[number] | undefined = mainLines[0];

    const sumBy = (type: string) =>
      totals.lines
        .filter((p) => p.line.item.itemType === type)
        .reduce((s, p) => s + p.listTotal, 0);

    const calibrationSum = sumBy(ITEM_TYPE.CALIBRATION);
    if (!main && calibrationSum === 0) return;

    const oppWorkflow = workflows.find((w) => w._id === OPPORTUNITY.workflowId);
    const optionsData: string[] =
      (oppWorkflow?.fields as Record<string, { data?: string[] }> | undefined)?.[
        OPPORTUNITY.fields.productName
      ]?.data ?? [];
    const desc = (main?.line.item.description || '').trim().toLowerCase();
    const matchedProductName = desc
      ? optionsData.find(
          (opt) => opt.split(' - ').slice(1).join(' - ').trim().toLowerCase() === desc,
        )
      : undefined;

    const commissionAmount = totals.finalSum - totals.listSum;

    const fields: { [fieldId: string]: number | string } = {
      [OPPORTUNITY.fields.baseProduct]: mainLines.reduce((s, p) => s + p.listTotal, 0),
      [OPPORTUNITY.fields.standardOptions]: sumBy(ITEM_TYPE.STANDARD_OPTION),
      [OPPORTUNITY.fields.customOptions]: sumBy(ITEM_TYPE.CUSTOM_OPTION),
      [OPPORTUNITY.fields.customization]: sumBy(ITEM_TYPE.CUSTOMIZATION),
      [OPPORTUNITY.fields.startup]: sumBy(ITEM_TYPE.STARTUP),
      [OPPORTUNITY.fields.shipping]: sumBy(ITEM_TYPE.SHIPPING),
    };
    if (calibrationSum > 0) fields[OPPORTUNITY.fields.calibration] = calibrationSum;
    const isoSum = sumBy(ITEM_TYPE.ISO_CERTIFICATION);
    if (isoSum > 0) fields[OPPORTUNITY.fields.iso17025] = isoSum;
    if (matchedProductName) fields[OPPORTUNITY.fields.productName] = matchedProductName;
    if (commissionPct > 0) {
      fields[OPPORTUNITY.fields.agentCommissionPct] = commissionPct;
      fields[OPPORTUNITY.fields.commissionAmount] = commissionAmount;
    }
    if (details.accountId) fields[OPPORTUNITY.fields.leadInformation] = details.accountId;
    if (details.agentId) fields[OPPORTUNITY.fields.agent] = details.agentId;
    if (details.shipTo) fields[OPPORTUNITY.fields.shipTo] = details.shipTo;
    if (details.finalDestinationCountry) fields[OPPORTUNITY.fields.finalDestinationCountry] = details.finalDestinationCountry;
    if (details.incoterms) fields[OPPORTUNITY.fields.incoterms] = details.incoterms;
    if (details.hsCode) fields[OPPORTUNITY.fields.hsCode] = details.hsCode;
    if (details.proposalReference) fields[OPPORTUNITY.fields.proposalReference] = details.proposalReference;
    if (details.internalReference) fields[OPPORTUNITY.fields.internalReference] = Number(details.internalReference);
    if (details.quoteExpirationDate) {
      fields[OPPORTUNITY.fields.quoteExpirationDate] = new Date(details.quoteExpirationDate).getTime();
    }

    void hailer.ui.activity
      .create(OPPORTUNITY.workflowId, {
        name: `${
          main
            ? `${main.line.item.productCode}${mainLines.length > 1 ? ` +${mainLines.length - 1}` : ''}`
            : 'Calibration'
        } quote — ${new Date().toLocaleDateString()}`,
        phaseId: OPPORTUNITY.proposalPhaseId,
        fields,
      })
      .then((created) => {
        if (created?._id) void hailer.ui.activity.open(created._id);
      })
      .catch((err: unknown) => {
        setNotice(`Failed to open the opportunity form: ${formatHailerError(err)}`);
      });

    setNotice(
      matchedProductName
        ? 'Opportunity form opened with the quote prefilled — complete the sales fields and save.'
        : 'Opportunity form opened. Product Name had no matching option — pick it manually in the form.',
    );
  }

  function renderSectionRows(lines: LinePricing[]) {
    return lines.map((p) => {
      itemNumber += 1;
      return (
        <Tr key={p.line.item._id}>
          <Td isNumeric>{itemNumber}</Td>
          <Td>{p.line.item.itemId || p.line.item.productCode || '—'}</Td>
          <Td>
            {p.line.item.description || p.line.item.name}
            {p.isIncluded && (
              <Badge ml={2} colorScheme="blue" fontSize="2xs">Included</Badge>
            )}
            {!p.hasPrice && (
              <Badge ml={2} colorScheme="orange" fontSize="2xs">PRF</Badge>
            )}
          </Td>
          <Td>{p.line.item.itemType === ITEM_TYPE.MAIN ? p.line.item.productCode : ''}</Td>
          <Td isNumeric>
            <EditablePriceCell
              value={p.unitPrice}
              isOverridden={p.isOverridden}
              isIncluded={p.isIncluded}
              onCommit={(price) => onPriceOverride(p.line.item._id, price)}
              onReset={() => onResetOverride(p.line.item._id)}
            />
          </Td>
          <Td isNumeric>{p.line.qty}</Td>
          <Td isNumeric>{p.isIncluded ? 'Included' : p.hasPrice ? formatMoney(p.finalTotal) : '—'}</Td>
        </Tr>
      );
    });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} className="no-print">
        <Heading size="md">Customer Quote</Heading>
        <HStack spacing={3}>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            Download PDF
          </Button>
          <Button colorScheme="green" size="sm" onClick={saveToOpportunity}>
            Save quote to Opportunity
          </Button>
        </HStack>
      </HStack>

      {notice && (
        <Alert status="info" fontSize="sm" borderRadius="md" mb={4} className="no-print">
          <AlertIcon />
          {notice}
        </Alert>
      )}

      <Box id="quote-print-area" borderWidth="1px" borderRadius="md" p={6}>
        <HStack justify="space-between" align="flex-start" mb={4}>
          <Heading size="lg">Quote</Heading>
          <Image src={THERMETRICS_LOGO} alt="Thermetrics Europe" maxH="48px" objectFit="contain" />
        </HStack>

        {/* Header info block */}
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6} mb={6}>
          <GridItem>
            <VStack align="stretch" spacing={1}>
              <InfoRow label="Account" value={account?.name} />
              <InfoRow label="Agent" value={agent?.name} />
              <InfoRow label="Ship To" value={details.shipTo || undefined} />
              <InfoRow label="Contact" value={contactName} />
              <InfoRow label="Email" value={contactEmail} />
              <InfoRow label="Phone #" value={contactPhone} />
            </VStack>
          </GridItem>
          <GridItem>
            <VStack align="stretch" spacing={1}>
              <InfoRow label="Date" value={new Date().toLocaleDateString()} />
              <InfoRow label="Proposal Reference #" value={details.proposalReference || undefined} />
              <InfoRow
                label="Quote Expiration"
                value={
                  details.quoteExpirationDate
                    ? new Date(details.quoteExpirationDate).toLocaleDateString()
                    : undefined
                }
              />
              <InfoRow label="HS Code" value={details.hsCode || undefined} />
              <InfoRow label="Internal Reference" value={details.internalReference || undefined} />
            </VStack>
          </GridItem>
        </Grid>

        <Divider mb={4} />

        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th isNumeric>Item</Th>
              <Th>Item #</Th>
              <Th>Product Description</Th>
              <Th>Product Name</Th>
              <Th isNumeric>Price</Th>
              <Th isNumeric>Qty</Th>
              <Th isNumeric>Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {/* System-price sections: always shown, even when empty */}
            {systemPriceSections.map(({ section, lines, discountable, discountPct, discountAmount, netSubtotal }) => (
              <Fragment key={section.type}>
                <Tr bg="blackAlpha.50">
                  <Td colSpan={7} fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wider">
                    {section.label}
                  </Td>
                </Tr>
                {lines.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} color="subtleText" fontStyle="italic">
                      {section.type === ITEM_TYPE.ISO_CERTIFICATION ? 'Not included' : '—'}
                    </Td>
                  </Tr>
                ) : (
                  renderSectionRows(lines)
                )}
                {discountable && (discountPct > 0 || lines.length > 0) && (
                  <>
                    <Tr>
                      <Td colSpan={5} />
                      <Td isNumeric color="orange.500" fontWeight="bold">POS Discount (%)</Td>
                      <Td isNumeric>
                        <EditablePercentCell
                          value={discountPct}
                          onCommit={(pct) => onSectionDiscountChange(section.type, pct)}
                        />
                      </Td>
                    </Tr>
                    {discountPct > 0 && (
                      <Tr>
                        <Td colSpan={5} />
                        <Td isNumeric color="subtleText">Discount ($)</Td>
                        <Td isNumeric color="orange.500">-{formatMoney(discountAmount)}</Td>
                      </Tr>
                    )}
                  </>
                )}
                <Tr>
                  <Td colSpan={5} />
                  <Td isNumeric fontWeight="semibold" color="subtleText">Subtotal</Td>
                  <Td isNumeric fontWeight="semibold">
                    {section.type === ITEM_TYPE.ISO_CERTIFICATION && lines.length === 0
                      ? ''
                      : formatMoney(netSubtotal)}
                  </Td>
                </Tr>
              </Fragment>
            ))}

            {/* Total System Price — subtotal of the system-price sections above (net of any discounts) */}
            <Tr>
              <Td colSpan={5} />
              <Td isNumeric fontWeight="bold">Total System Price</Td>
              <Td isNumeric fontWeight="bold">{formatMoney(totalSystemPrice)}</Td>
            </Tr>

            {/* Post-system sections: Calibration Options, Shipping — Calibration only
                when used; Shipping always shown since it also carries the
                Final Destination / Incoterms rows moved down from the header. */}
            {postSystemSections
              .filter((g) => g.lines.length > 0 || g.section.type === ITEM_TYPE.SHIPPING)
              .map(({ section, lines, discountable, discountPct, discountAmount, netSubtotal }) => (
                <Fragment key={section.type}>
                  <Tr bg="blackAlpha.50">
                    <Td colSpan={7} fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wider">
                      {section.label}
                    </Td>
                  </Tr>
                  {renderSectionRows(lines)}
                  {discountable && (
                    <>
                      <Tr>
                        <Td colSpan={5} />
                        <Td isNumeric color="orange.500" fontWeight="bold">POS Discount (%)</Td>
                        <Td isNumeric>
                          <EditablePercentCell
                            value={discountPct}
                            onCommit={(pct) => onSectionDiscountChange(section.type, pct)}
                          />
                        </Td>
                      </Tr>
                      {discountPct > 0 && (
                        <Tr>
                          <Td colSpan={5} />
                          <Td isNumeric color="subtleText">Discount ($)</Td>
                          <Td isNumeric color="orange.500">-{formatMoney(discountAmount)}</Td>
                        </Tr>
                      )}
                    </>
                  )}
                  {lines.length > 0 && (
                    <Tr>
                      <Td colSpan={5} />
                      <Td isNumeric fontWeight="semibold" color="subtleText">Subtotal</Td>
                      <Td isNumeric fontWeight="semibold">{formatMoney(netSubtotal)}</Td>
                    </Tr>
                  )}
                  {section.type === ITEM_TYPE.SHIPPING && (
                    <>
                      <Tr>
                        <Td colSpan={5} />
                        <Td isNumeric color="subtleText">Final Destination</Td>
                        <Td isNumeric>{details.finalDestinationCountry || '—'}</Td>
                      </Tr>
                      <Tr>
                        <Td colSpan={5} />
                        <Td isNumeric color="subtleText">Incoterms</Td>
                        <Td isNumeric>{details.incoterms || '—'}</Td>
                      </Tr>
                    </>
                  )}
                </Fragment>
              ))}
          </Tbody>
        </Table>

        <Box mt={6} textAlign="right">
          <Heading size="md" mt={1}>
            Items TOTAL without Tax: {formatMoney(grandTotal)}
          </Heading>
          {totals.prfCount > 0 && (
            <Text fontSize="sm" color="orange.500" mt={2}>
              {totals.prfCount} item{totals.prfCount > 1 ? 's' : ''} priced on request —
              not included in total above.
            </Text>
          )}
        </Box>

        <Text fontSize="xs" color="subtleText" mt={6}>
          * All Thermetrics Systems come with a Standard Calibration Certificate.
        </Text>

        <Divider my={4} />

        <Text fontSize="sm" fontWeight="bold" mb={1}>Standard Sales Terms:</Text>
        <VStack align="stretch" spacing={0.5} fontSize="sm" color="subtleText">
          <Text>50% Down at Order Placement; due Net 30 days from date of purchase</Text>
          <Text>50% At Ready to Ship notification; due Net 30 from date of invoice</Text>
        </VStack>

        <Text fontSize="sm" fontWeight="bold" mt={4} mb={1}>Notes:</Text>
        <Box borderWidth="1px" borderRadius="md" minH="4rem" p={2} />
      </Box>
    </Box>
  );
}
