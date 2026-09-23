import { Fragment, useMemo } from 'react';
import {
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
import { Activity } from '@hailer/app-sdk';
import { formatMoney } from '../hailer/api-helpers';
import { CONTACTS } from '../constants/schema';
import {
  RentalLine,
  cleaningAndCalibrationDue,
  estimateRentalRevenue,
  estimateRentalWeeks,
} from '../rentalLines';
import { RentalUnitSummary } from '../types';
import { RentalDetails } from './RentalDetailsBox';
import { generateRentalContractPdf } from '../rentalPdf';
import { THERMETRICS_LOGO } from '../assets/logo';

interface Props {
  lines: RentalLine[];
  units: RentalUnitSummary[];
  customers: Activity[];
  contacts: Activity[];
  rentalDetails: RentalDetails;
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

function unitLabel(line: RentalLine, units: RentalUnitSummary[]): string {
  const unit = units.find((u) => u._id === line.unitId);
  const base = unit?.productFamily || unit?.name || 'Unit';
  return unit?.serialNumber ? `${base} (S/N ${unit.serialNumber})` : base;
}

// Row builders return null (skip) when a section only shows lines that have
// a nonzero amount, or a row object when the section always shows every line
// (Rental Fee, Cleaning and Calibration) — same rule as rentalPdf.ts, kept in
// sync deliberately so the on-screen preview never drifts from the PDF.
interface SectionRow {
  desc: React.ReactNode;
  amount: number;
  amountText?: string;
}

function Section({
  label,
  lines,
  rowFor,
  alwaysShow = false,
  itemNumberRef,
}: {
  label: string;
  lines: RentalLine[];
  rowFor: (line: RentalLine) => SectionRow;
  alwaysShow?: boolean;
  itemNumberRef: { n: number };
}) {
  const rows = lines.map((l) => ({ line: l, ...rowFor(l) })).filter((r) => alwaysShow || r.amount > 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return (
    <Fragment>
      <Tr bg="blackAlpha.50">
        <Td colSpan={3} fontWeight="bold" fontSize="xs" textTransform="uppercase" letterSpacing="wider">
          {label}
        </Td>
      </Tr>
      {rows.length === 0 ? (
        <Tr>
          <Td colSpan={3} color="subtleText" fontStyle="italic">
            Not included
          </Td>
        </Tr>
      ) : (
        <>
          {rows.map((r) => {
            itemNumberRef.n += 1;
            return (
              <Tr key={r.line.id}>
                <Td isNumeric>{itemNumberRef.n}</Td>
                <Td>{r.desc}</Td>
                <Td isNumeric>{r.amountText ?? formatMoney(r.amount)}</Td>
              </Tr>
            );
          })}
          <Tr>
            <Td colSpan={1} />
            <Td isNumeric fontWeight="semibold" color="subtleText">Subtotal</Td>
            <Td isNumeric fontWeight="semibold">{formatMoney(total)}</Td>
          </Tr>
        </>
      )}
    </Fragment>
  );
}

export default function RentalQuoteView({ lines, units, customers, contacts, rentalDetails }: Props) {
  // Account/Ship To come from the first unit's own Account field — a Rental
  // Contract assumes one customer per document, same as the main Quote.
  const firstLine = lines[0];
  const account = useMemo(
    () => customers.find((c) => c._id === firstLine?.accountId) || null,
    [customers, firstLine],
  );
  const contact = useMemo(
    () => contacts.find((c) => c._id === rentalDetails.contactId) || null,
    [contacts, rentalDetails.contactId],
  );
  const contactName = contact
    ? `${(contact.fields?.[CONTACTS.fields.firstName] as string) || ''} ${
        (contact.fields?.[CONTACTS.fields.lastName] as string) || ''
      }`.trim() || contact.name
    : undefined;
  const contactEmail = contact?.fields?.[CONTACTS.fields.email] as string | undefined;

  const grandTotal = lines.reduce((s, line) => {
    const revenue = estimateRentalRevenue(line) ?? 0;
    const startup = Number(line.startupFee) || 0;
    const freightDelivery = Number(line.freightDelivery) || 0;
    const freightReturn = Number(line.freightReturn) || 0;
    const cleaning = cleaningAndCalibrationDue(line);
    return s + revenue + startup + freightDelivery + freightReturn + cleaning;
  }, 0);

  const itemNumberRef = { n: 0 };

  function downloadPdf() {
    generateRentalContractPdf({
      lines,
      units,
      rentalDetails,
      accountName: account?.name,
      shipTo: firstLine?.shipTo,
      contactName,
      contactEmail,
    });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} className="no-print">
        <Heading size="sm">Rental Contract Preview</Heading>
        <Button variant="outline" size="sm" onClick={downloadPdf}>
          Download PDF
        </Button>
      </HStack>

      <Box id="rental-quote-print-area" borderWidth="1px" borderRadius="md" p={6}>
        <HStack justify="space-between" align="flex-start" mb={4}>
          <Heading size="lg">Rental Contract</Heading>
          <Image src={THERMETRICS_LOGO} alt="Thermetrics Europe" maxH="48px" objectFit="contain" />
        </HStack>

        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6} mb={6}>
          <GridItem>
            <VStack align="stretch" spacing={1}>
              <InfoRow label="Account" value={account?.name} />
              <InfoRow label="Ship To" value={firstLine?.shipTo || undefined} />
              <InfoRow label="Contact" value={contactName} />
              <InfoRow label="Email" value={contactEmail} />
            </VStack>
          </GridItem>
          <GridItem>
            <VStack align="stretch" spacing={1}>
              <InfoRow label="Date" value={new Date().toLocaleDateString()} />
              <InfoRow label="Contract Reference #" value={rentalDetails.contractReference || undefined} />
            </VStack>
          </GridItem>
        </Grid>

        <Divider mb={4} />

        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th isNumeric>Item</Th>
              <Th>Description</Th>
              <Th isNumeric>Amount</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Section
              label="Rental Fee"
              lines={lines}
              alwaysShow
              itemNumberRef={itemNumberRef}
              rowFor={(line) => {
                const weeks = estimateRentalWeeks(line);
                const revenue = estimateRentalRevenue(line);
                return {
                  desc: (
                    <>
                      <Text>{`${unitLabel(line, units)} — ${line.startDate ? new Date(line.startDate).toLocaleDateString() : '—'} – ${line.endDate ? new Date(line.endDate).toLocaleDateString() : '—'}`}</Text>
                      {weeks != null && (
                        <Text fontSize="xs" color="subtleText">{weeks} week{weeks === 1 ? '' : 's'}</Text>
                      )}
                    </>
                  ),
                  amount: revenue ?? 0,
                  amountText: revenue != null ? undefined : '—',
                };
              }}
            />
            <Section
              label="Setup and Training"
              lines={lines}
              itemNumberRef={itemNumberRef}
              rowFor={(line) => ({ desc: unitLabel(line, units), amount: Number(line.startupFee) || 0 })}
            />
            <Section
              label="Freight Delivery"
              lines={lines}
              itemNumberRef={itemNumberRef}
              rowFor={(line) => ({ desc: unitLabel(line, units), amount: Number(line.freightDelivery) || 0 })}
            />
            <Section
              label="Freight Return"
              lines={lines}
              itemNumberRef={itemNumberRef}
              rowFor={(line) => ({ desc: unitLabel(line, units), amount: Number(line.freightReturn) || 0 })}
            />
            <Section
              label="Cleaning and Calibration"
              lines={lines}
              alwaysShow
              itemNumberRef={itemNumberRef}
              rowFor={(line) => {
                const listPrice = Number(line.cleaningAndCalibration) || 0;
                const due = cleaningAndCalibrationDue(line);
                return {
                  desc: unitLabel(line, units),
                  amount: due,
                  amountText: line.cleaningAndCalibrationWaived
                    ? `${formatMoney(listPrice)} (waived for this rental)`
                    : undefined,
                };
              }}
            />
          </Tbody>
        </Table>

        <Box mt={6} textAlign="right">
          <Heading size="md" mt={1}>
            Est. Total to Invoice: {formatMoney(grandTotal)}
          </Heading>
        </Box>

        <Divider my={4} />

        <Text fontSize="sm" fontWeight="bold" mb={1}>Shipping Responsibility</Text>
        <VStack align="stretch" spacing={0.5}>
          <InfoRow label="Delivery Freight" value={rentalDetails.deliveryFreightResponsibility || undefined} />
          <InfoRow label="Return Freight" value={rentalDetails.returnFreightResponsibility || undefined} />
          <InfoRow label="Insurance During Transportation" value={rentalDetails.insuranceDuringTransportation || undefined} />
          <InfoRow label="Applicable Delivery Terms / Incoterms" value={rentalDetails.applicableDeliveryTerms || undefined} />
        </VStack>
      </Box>
    </Box>
  );
}
