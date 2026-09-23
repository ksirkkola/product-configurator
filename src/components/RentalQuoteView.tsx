import { useMemo } from 'react';
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
import { CONTACTS, RENTAL_PURCHASE_CREDIT_PCT } from '../constants/schema';
import { RentalLine, estimateInvoiceTotal, estimateRentalRevenue, estimateRentalWeeks } from '../rentalLines';
import { RentalUnitSummary } from '../types';
import { QuoteDetails } from './QuoteDetailsBox';
import { generateRentalQuotePdf } from '../rentalPdf';
import { THERMETRICS_LOGO } from '../assets/logo';

interface Props {
  lines: RentalLine[];
  units: RentalUnitSummary[];
  customers: Activity[];
  contacts: Activity[];
  details: QuoteDetails;
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

export default function RentalQuoteView({ lines, units, customers, contacts, details }: Props) {
  const account = useMemo(
    () => customers.find((c) => c._id === details.accountId) || null,
    [customers, details.accountId],
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

  const totalDeposit = lines.reduce((s, l) => s + (Number(l.deposit) || 0), 0);
  const revenues = lines.map(estimateRentalRevenue);
  const knownRevenues = revenues.filter((r): r is number => r != null);
  const totalRentalFee = knownRevenues.reduce((s, r) => s + r, 0);
  const invoiceTotals = lines.map(estimateInvoiceTotal).filter((t): t is number => t != null);
  const totalInvoice = invoiceTotals.reduce((s, t) => s + t, 0);
  const purchaseCredit = totalRentalFee * RENTAL_PURCHASE_CREDIT_PCT;

  function downloadPdf() {
    generateRentalQuotePdf({
      lines,
      units,
      details,
      accountName: account?.name,
      contactName,
      contactEmail,
      contactPhone,
    });
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} className="no-print">
        <Heading size="sm">Rental Quote Preview</Heading>
        <Button variant="outline" size="sm" onClick={downloadPdf}>
          Download PDF
        </Button>
      </HStack>

      <Box id="rental-quote-print-area" borderWidth="1px" borderRadius="md" p={6}>
        <HStack justify="space-between" align="flex-start" mb={4}>
          <Heading size="lg">Rental Quote</Heading>
          <Image src={THERMETRICS_LOGO} alt="Thermetrics Europe" maxH="48px" objectFit="contain" />
        </HStack>

        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={6} mb={6}>
          <GridItem>
            <VStack align="stretch" spacing={1}>
              <InfoRow label="Account" value={account?.name} />
              <InfoRow label="Ship To" value={details.shipTo || undefined} />
              <InfoRow label="Contact" value={contactName} />
              <InfoRow label="Email" value={contactEmail} />
              <InfoRow label="Phone #" value={contactPhone} />
            </VStack>
          </GridItem>
          <GridItem>
            <VStack align="stretch" spacing={1}>
              <InfoRow label="Date" value={new Date().toLocaleDateString()} />
            </VStack>
          </GridItem>
        </Grid>

        <Divider mb={4} />

        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Unit</Th>
              <Th>Start Date</Th>
              <Th>Return Due</Th>
              <Th isNumeric>Weekly Rate</Th>
              <Th isNumeric>Est. Weeks</Th>
              <Th isNumeric>Est. Rental Fee</Th>
              <Th isNumeric>Startup Fee</Th>
              <Th isNumeric>Shipping</Th>
              <Th isNumeric>Deposit</Th>
              <Th isNumeric>Est. Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {lines.map((line) => {
              const unit = units.find((u) => u._id === line.unitId);
              const weeks = estimateRentalWeeks(line);
              const revenue = estimateRentalRevenue(line);
              const invoiceTotal = estimateInvoiceTotal(line);
              return (
                <Tr key={line.id}>
                  <Td>
                    {unit?.productFamily || unit?.name || 'Unit'}
                    {unit?.serialNumber ? ` (${unit.serialNumber})` : ''}
                  </Td>
                  <Td>{line.startDate ? new Date(line.startDate).toLocaleDateString() : '—'}</Td>
                  <Td>{line.endDate ? new Date(line.endDate).toLocaleDateString() : '—'}</Td>
                  <Td isNumeric>{line.weeklyRate ? formatMoney(Number(line.weeklyRate)) : '—'}</Td>
                  <Td isNumeric>{weeks ?? '—'}</Td>
                  <Td isNumeric>{revenue != null ? formatMoney(revenue) : '—'}</Td>
                  <Td isNumeric>{line.startupFee ? formatMoney(Number(line.startupFee)) : '—'}</Td>
                  <Td isNumeric>{line.shippingCost ? formatMoney(Number(line.shippingCost)) : '—'}</Td>
                  <Td isNumeric>{line.deposit ? formatMoney(Number(line.deposit)) : '—'}</Td>
                  <Td isNumeric fontWeight="semibold">{invoiceTotal != null ? formatMoney(invoiceTotal) : '—'}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>

        <Box mt={6} textAlign="right">
          <Text fontSize="sm" color="subtleText">Total Deposit: {formatMoney(totalDeposit)}</Text>
          <Heading size="md" mt={1}>
            Est. Total to Invoice: {formatMoney(totalInvoice)}
          </Heading>
          <Text fontSize="xs" color="subtleText" mt={1}>
            Rental fee + startup + shipping (deposit excluded — refundable, not revenue).
          </Text>
          {knownRevenues.length < lines.length && (
            <Text fontSize="sm" color="orange.500" mt={2}>
              {lines.length - knownRevenues.length} unit{lines.length - knownRevenues.length === 1 ? '' : 's'} missing
              a weekly rate or date range — excluded from the estimate above.
            </Text>
          )}
        </Box>

        <Divider my={4} />

        <Text fontSize="sm" fontWeight="bold" mb={1}>Rental Terms:</Text>
        <VStack align="stretch" spacing={0.5} fontSize="sm" color="subtleText">
          <Text>Deposit due at rental agreement; refunded on return subject to condition inspection.</Text>
          <Text>Weekly rate billed for each week or part-week the unit is out, rounded up to the nearest full week.</Text>
          <Text>Startup / training and shipping are one-time charges, billed separately from the weekly rate.</Text>
          {purchaseCredit > 0 && (
            <Text>
              {RENTAL_PURCHASE_CREDIT_PCT * 100}% of the rental fee ({formatMoney(purchaseCredit)}) will be credited
              against the purchase price if the customer later decides to buy instead of renting.
            </Text>
          )}
          <Text>Estimated total is not final — actual total depends on the unit&apos;s real return date.</Text>
        </VStack>
      </Box>
    </Box>
  );
}
