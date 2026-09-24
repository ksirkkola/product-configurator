import { useMemo } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Input,
  NumberInput,
  NumberInputField,
  Select,
  Text,
} from '@chakra-ui/react';
import { Activity } from '@hailer/app-sdk';
import { readLinkId } from '../hailer/api-helpers';
import { CONTACTS, CUSTOMERS, INCOTERMS } from '../constants/schema';
import SearchableSelect from './SearchableSelect';

export interface QuoteDetails {
  accountId: string | null;
  contactId: string | null;
  agentId: string | null;
  shipTo: string;
  finalDestinationCountry: string;
  incoterms: string;
  hsCode: string;
  proposalReference: string;
  internalReference: string;
  quoteExpirationDate: string; // YYYY-MM-DD
}

export const EMPTY_QUOTE_DETAILS: QuoteDetails = {
  accountId: null,
  contactId: null,
  agentId: null,
  shipTo: '',
  finalDestinationCountry: '',
  incoterms: 'DAP',
  hsCode: '9027.89', // default per FECSA quote template — override per quote if needed
  proposalReference: '',
  internalReference: '',
  quoteExpirationDate: '',
};

interface Props {
  customers: Activity[];
  contacts: Activity[];
  details: QuoteDetails;
  onChange: (details: QuoteDetails) => void;
}

export default function QuoteDetailsBox({ customers, contacts, details, onChange }: Props) {
  const customerOptions = useMemo(
    () => customers.map((c) => ({ _id: c._id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

  const contactOptions = useMemo(() => {
    const filtered = details.accountId
      ? contacts.filter((c) => readLinkId(c.fields?.[CONTACTS.fields.company]) === details.accountId)
      : contacts;
    return filtered
      .map((c) => {
        const first = (c.fields?.[CONTACTS.fields.firstName] as string) || '';
        const last = (c.fields?.[CONTACTS.fields.lastName] as string) || '';
        return { _id: c._id, name: `${first} ${last}`.trim() || c.name };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, details.accountId]);

  function set<K extends keyof QuoteDetails>(key: K, value: QuoteDetails[K]) {
    onChange({ ...details, [key]: value });
  }

  function handleAccountChange(id: string) {
    const account = customers.find((c) => c._id === id);
    const next: QuoteDetails = { ...details, accountId: id || null, contactId: null };
    // Prefill Ship To / Final Destination Country from the account address,
    // but only if the user hasn't already typed something.
    if (account && !details.shipTo) {
      const street = (account.fields?.[CUSTOMERS.fields.streetAddress] as string) || '';
      const city = (account.fields?.[CUSTOMERS.fields.city] as string) || '';
      const country = (account.fields?.[CUSTOMERS.fields.country] as string) || '';
      next.shipTo = [street, city, country].filter(Boolean).join(', ');
    }
    if (account && !details.finalDestinationCountry) {
      next.finalDestinationCountry = (account.fields?.[CUSTOMERS.fields.country] as string) || '';
    }
    onChange(next);
  }

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Text fontSize="sm" fontWeight="bold" mb={3} color="subtleText">
        QUOTE DETAILS
      </Text>
      <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap={4}>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Account</FormLabel>
            <SearchableSelect
              value={details.accountId}
              onChange={handleAccountChange}
              options={customerOptions}
              placeholder="Select customer…"
              allowClear
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Contact</FormLabel>
            <SearchableSelect
              value={details.contactId}
              onChange={(id) => set('contactId', id || null)}
              options={contactOptions}
              placeholder="Select contact…"
              allowClear
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Agent (if sold through a reseller)</FormLabel>
            <SearchableSelect
              value={details.agentId}
              onChange={(id) => set('agentId', id || null)}
              options={customerOptions}
              placeholder="No agent"
              allowClear
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Ship To</FormLabel>
            <Input size="sm" value={details.shipTo} onChange={(e) => set('shipTo', e.target.value)} />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Final Destination Country</FormLabel>
            <Select
              size="sm"
              placeholder="Select country…"
              value={details.finalDestinationCountry}
              onChange={(e) => set('finalDestinationCountry', e.target.value)}
            >
              {[
                'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czechia', 'Denmark', 'Estonia',
                'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy',
                'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Netherlands', 'Norway', 'Poland',
                'Portugal', 'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland',
                'Türkiye', 'Ukraine', 'United Kingdom', 'United States', 'Canada', 'Other',
              ].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Incoterms</FormLabel>
            <Select
              size="sm"
              placeholder="Select…"
              value={details.incoterms}
              onChange={(e) => set('incoterms', e.target.value)}
            >
              {INCOTERMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">HS Code</FormLabel>
            <Input size="sm" value={details.hsCode} onChange={(e) => set('hsCode', e.target.value)} />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Proposal Reference #</FormLabel>
            <Input
              size="sm"
              placeholder="e.g. E4452.02 (revision 03)"
              value={details.proposalReference}
              onChange={(e) => set('proposalReference', e.target.value)}
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Internal Reference</FormLabel>
            <NumberInput
              size="sm"
              value={details.internalReference}
              onChange={(v) => set('internalReference', v)}
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Quote Expiration</FormLabel>
            <Input
              size="sm"
              type="date"
              value={details.quoteExpirationDate}
              onChange={(e) => set('quoteExpirationDate', e.target.value)}
            />
          </FormControl>
        </GridItem>
      </Grid>
    </Box>
  );
}
