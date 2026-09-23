import { Box, Divider, Stat, StatGroup, StatLabel, StatNumber, Text, VStack } from '@chakra-ui/react';
import { formatMoney } from '../hailer/api-helpers';
import { cleaningAndCalibrationDue, RentalLine, estimateInvoiceTotal, estimateRentalRevenue } from '../rentalLines';
import { RENTAL_PURCHASE_CREDIT_PCT } from '../constants/schema';

interface Props {
  lines: RentalLine[];
}

export default function RentalSummaryPanel({ lines }: Props) {
  const totalStartupFees = lines.reduce((s, l) => s + (Number(l.startupFee) || 0), 0);
  const totalFreightDelivery = lines.reduce((s, l) => s + (Number(l.freightDelivery) || 0), 0);
  const totalFreightReturn = lines.reduce((s, l) => s + (Number(l.freightReturn) || 0), 0);
  const totalCleaningAndCalibration = lines.reduce((s, l) => s + cleaningAndCalibrationDue(l), 0);

  const revenues = lines.map(estimateRentalRevenue);
  const knownRevenues = revenues.filter((r): r is number => r != null);
  const totalRentalFee = knownRevenues.reduce((s, r) => s + r, 0);

  const invoiceTotals = lines.map(estimateInvoiceTotal).filter((t): t is number => t != null);
  const totalInvoice = invoiceTotals.reduce((s, t) => s + t, 0);

  const purchaseCredit = totalRentalFee * RENTAL_PURCHASE_CREDIT_PCT;

  return (
    <Box borderWidth="1px" borderRadius="md" p={4} position="sticky" top={4}>
      <VStack align="stretch" spacing={4}>
        <StatGroup>
          <Stat>
            <StatLabel>Units in this rental</StatLabel>
            <StatNumber fontSize="lg">{lines.length}</StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Est. rental fee</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totalRentalFee)}</StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Total setup and training</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totalStartupFees)}</StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Total freight delivery</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totalFreightDelivery)}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Total freight return</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totalFreightReturn)}</StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Total cleaning and calibration</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totalCleaningAndCalibration)}</StatNumber>
          </Stat>
        </StatGroup>

        <Divider />

        <StatGroup>
          <Stat>
            <StatLabel>Est. total to invoice</StatLabel>
            <StatNumber fontSize="xl" color="green.500">
              {formatMoney(totalInvoice)}
            </StatNumber>
            <Text fontSize="xs" color="subtleText" mt={1}>
              Rental fee + setup/training + freight delivery + freight return + cleaning and calibration (net of any
              waivers).
            </Text>
          </Stat>
        </StatGroup>

        {purchaseCredit > 0 && (
          <Text fontSize="xs" color="subtleText">
            If the customer later buys instead of just renting: {RENTAL_PURCHASE_CREDIT_PCT * 100}% of the rental
            fee ({formatMoney(purchaseCredit)}) is credited toward the purchase price.
          </Text>
        )}

        {lines.length > 0 && knownRevenues.length < lines.length && (
          <Text fontSize="xs" color="subtleText">
            {lines.length - knownRevenues.length} unit{lines.length - knownRevenues.length === 1 ? '' : 's'} still
            missing a weekly rate or date range — excluded from the estimate above. Hailer computes the real total
            once the rental is created.
          </Text>
        )}
      </VStack>
    </Box>
  );
}
