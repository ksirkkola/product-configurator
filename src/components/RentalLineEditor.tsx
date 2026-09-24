import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { RentalUnitSummary } from '../types';
import { estimateRentalRevenue, estimateRentalWeeks, RentalLine, tieredWeeklyRate } from '../rentalLines';
import { formatMoney } from '../hailer/api-helpers';

interface Props {
  line: RentalLine;
  unit: RentalUnitSummary | undefined;
  isAlreadyAdded: boolean;
  onChange: (line: RentalLine) => void;
  onAddToQuote: () => void;
}

export default function RentalLineEditor({ line, unit, isAlreadyAdded, onChange, onAddToQuote }: Props) {
  function set<K extends keyof RentalLine>(key: K, value: RentalLine[K]) {
    onChange({ ...line, [key]: value });
  }

  // weeklyRate auto-fills from the universal tiered schedule the moment both
  // dates are set, and stays in sync as either date is adjusted — there's no
  // manual rate field anymore; the calculated price is shown as the "Add to
  // Quote" button below instead (see the price button further down).
  function handleDateChange(key: 'startDate' | 'endDate', value: string) {
    const next: RentalLine = { ...line, [key]: value };
    const weeks = estimateRentalWeeks(next);
    if (weeks != null) next.weeklyRate = String(tieredWeeklyRate(weeks));
    onChange(next);
  }

  const weeks = estimateRentalWeeks(line);
  const revenue = estimateRentalRevenue(line);
  const isNotAvailable = unit?.status && unit.status !== 'Available';

  return (
    <VStack align="stretch" spacing={4}>
      <Box borderWidth="1px" borderRadius="md" p={3}>
        <HStack justify="space-between" align="start">
          <Box>
            <Text fontWeight="bold">{unit?.productFamily || unit?.name || 'Unit'}</Text>
            <Text fontSize="sm" color="subtleText">
              {unit?.serialNumber ? `S/N ${unit.serialNumber}` : ''}
            </Text>
          </Box>
          {unit?.status && <Badge colorScheme={unit.status === 'Available' ? 'green' : 'orange'}>{unit.status}</Badge>}
        </HStack>
        {isNotAvailable && (
          <Alert status="warning" fontSize="xs" borderRadius="md" mt={2}>
            <AlertIcon />
            This unit is currently "{unit?.status}" — confirm availability before renting it out.
          </Alert>
        )}
      </Box>

      <Button
        colorScheme="green"
        size="lg"
        isDisabled={weeks == null || revenue == null}
        onClick={onAddToQuote}
      >
        {weeks != null && revenue != null
          ? `${isAlreadyAdded ? 'Update' : 'Add to'} Quote — ${formatMoney(revenue)} for ${weeks} week${weeks === 1 ? '' : 's'}`
          : 'Select both dates to calculate the price'}
      </Button>

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
        <GridItem>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Rental Start Date</FormLabel>
            <Input
              size="sm"
              type="date"
              value={line.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Return Due Date</FormLabel>
            <Input
              size="sm"
              type="date"
              value={line.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Setup and Training (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.startupFee} onChange={(v) => set('startupFee', v)}>
              <NumberInputField />
            </NumberInput>
            <Text fontSize="xs" color="subtleText" mt={1}>
              One-time on-site setup / training — separate from the rental fee.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Freight Delivery (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.freightDelivery} onChange={(v) => set('freightDelivery', v)}>
              <NumberInputField />
            </NumberInput>
            <Text fontSize="xs" color="subtleText" mt={1}>
              Shipping to deliver this unit to the customer — billed at cost.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Freight Return (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.freightReturn} onChange={(v) => set('freightReturn', v)}>
              <NumberInputField />
            </NumberInput>
            <Text fontSize="xs" color="subtleText" mt={1}>
              Shipping to return this unit once the rental ends — billed at cost.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Cleaning and Calibration (€)</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              value={line.cleaningAndCalibration}
              onChange={(v) => set('cleaningAndCalibration', v)}
              isDisabled={line.cleaningAndCalibrationWaived}
            >
              <NumberInputField />
            </NumberInput>
            <Checkbox
              size="sm"
              mt={2}
              isChecked={line.cleaningAndCalibrationWaived}
              onChange={(e) => set('cleaningAndCalibrationWaived', e.target.checked)}
            >
              Waive this fee for this rental
            </Checkbox>
            <Text fontSize="xs" color="subtleText" mt={1}>
              Already baked into the rental price — defaults to waived so the contract shows this as a gesture to
              the customer, not an extra charge. The standard price still shows on the contract, noted as waived.
              Untick to actually charge it instead.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem colSpan={{ base: 1, md: 2 }}>
          <FormControl>
            <FormLabel fontSize="sm">Notes</FormLabel>
            <Textarea size="sm" rows={2} value={line.notes} onChange={(e) => set('notes', e.target.value)} />
          </FormControl>
        </GridItem>
      </Grid>
    </VStack>
  );
}
