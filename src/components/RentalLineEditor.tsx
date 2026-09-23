import {
  Alert,
  AlertIcon,
  Badge,
  Box,
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
import { Activity } from '@hailer/app-sdk';
import { RentalUnitSummary } from '../types';
import { RentalLine } from '../rentalLines';
import { CUSTOMERS } from '../constants/schema';
import SearchableSelect, { SelectOption } from './SearchableSelect';

interface Props {
  line: RentalLine;
  unit: RentalUnitSummary | undefined;
  customers: Activity[];
  onChange: (line: RentalLine) => void;
}

export default function RentalLineEditor({ line, unit, customers, onChange }: Props) {
  const customerOptions: SelectOption[] = customers
    .map((c) => ({ _id: c._id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  function set<K extends keyof RentalLine>(key: K, value: RentalLine[K]) {
    onChange({ ...line, [key]: value });
  }

  // Mirrors QuoteDetailsBox.handleAccountChange: pull Ship To from the
  // selected customer's address, but only fill it in — never overwrite
  // something the rep already typed, and re-runs every time the Account
  // changes (not just when the line is first created).
  function handleAccountChange(id: string) {
    const account = customers.find((c) => c._id === id);
    const next: RentalLine = { ...line, accountId: id || null };
    if (account && !line.shipTo) {
      const street = (account.fields?.[CUSTOMERS.fields.streetAddress] as string) || '';
      const city = (account.fields?.[CUSTOMERS.fields.city] as string) || '';
      next.shipTo = [street, city].filter(Boolean).join(', ');
    }
    onChange(next);
  }

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

      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
        <GridItem>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Account</FormLabel>
            <SearchableSelect
              value={line.accountId}
              onChange={handleAccountChange}
              options={customerOptions}
              placeholder="Select customer…"
              allowClear
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Ship To</FormLabel>
            <Input size="sm" value={line.shipTo} onChange={(e) => set('shipTo', e.target.value)} />
            <Text fontSize="xs" color="subtleText" mt={1}>
              Auto-filled from the Account's address — edit freely if this unit ships somewhere else.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Rental Start Date</FormLabel>
            <Input size="sm" type="date" value={line.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl isRequired>
            <FormLabel fontSize="sm">Return Due Date</FormLabel>
            <Input size="sm" type="date" value={line.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Weekly Rate (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.weeklyRate} onChange={(v) => set('weeklyRate', v)}>
              <NumberInputField />
            </NumberInput>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Deposit (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.deposit} onChange={(v) => set('deposit', v)}>
              <NumberInputField />
            </NumberInput>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Startup Fee (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.startupFee} onChange={(v) => set('startupFee', v)}>
              <NumberInputField />
            </NumberInput>
            <Text fontSize="xs" color="subtleText" mt={1}>
              One-time on-site setup / training — separate from the weekly rate.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Shipping Cost (€)</FormLabel>
            <NumberInput size="sm" min={0} value={line.shippingCost} onChange={(v) => set('shippingCost', v)}>
              <NumberInputField />
            </NumberInput>
            <Text fontSize="xs" color="subtleText" mt={1}>
              Airfreight / ground shipping — billed at cost.
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
