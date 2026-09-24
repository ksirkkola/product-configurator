import { useMemo } from 'react';
import { Box, FormControl, FormLabel, Grid, GridItem, Input, Select, Text } from '@chakra-ui/react';
import { Activity } from '@hailer/app-sdk';
import { CONTACTS, CUSTOMERS, INCOTERMS, RENTAL_SHIPPING_RESPONSIBILITY_OPTIONS } from '../constants/schema';
import { readLinkId } from '../hailer/api-helpers';
import SearchableSelect from './SearchableSelect';

// Account/Contact/Ship To/Contract Reference # and the Shipping Responsibility
// block, shown once above the fleet picker and shared across every unit
// created in this batch — a Rental Contract is one customer per document,
// same assumption the main Quote makes. Account/Contact/Ship To/Contract
// Reference # are PDF-only (never pushed to Hailer — same convention as
// QuoteDetails for the main quote); the four Shipping Responsibility fields
// ARE real fields on the Rentals workflow and get written onto every created
// Rental activity.
export interface RentalDetails {
  accountId: string | null;
  contactId: string | null;
  shipTo: string;
  contractReference: string;
  deliveryFreightResponsibility: string;
  returnFreightResponsibility: string;
  insuranceDuringTransportation: string;
  applicableDeliveryTerms: string;
}

export const EMPTY_RENTAL_DETAILS: RentalDetails = {
  accountId: null,
  contactId: null,
  shipTo: '',
  contractReference: '',
  deliveryFreightResponsibility: '',
  returnFreightResponsibility: '',
  insuranceDuringTransportation: '',
  applicableDeliveryTerms: 'DAP', // same default as the main quote's Incoterms
};

interface Props {
  customers: Activity[];
  contacts: Activity[];
  details: RentalDetails;
  onChange: (details: RentalDetails) => void;
}

export default function RentalDetailsBox({ customers, contacts, details, onChange }: Props) {
  const customerOptions = useMemo(
    () => customers.map((c) => ({ _id: c._id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [customers],
  );

  // Filtered by the currently selected Account — same pattern as
  // QuoteDetailsBox — otherwise shows every contact.
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

  function set<K extends keyof RentalDetails>(key: K, value: RentalDetails[K]) {
    onChange({ ...details, [key]: value });
  }

  function fillShipToFromAccount(next: RentalDetails, accountId: string) {
    const account = customers.find((c) => c._id === accountId);
    if (account && !next.shipTo) {
      const street = (account.fields?.[CUSTOMERS.fields.streetAddress] as string) || '';
      const city = (account.fields?.[CUSTOMERS.fields.city] as string) || '';
      const country = (account.fields?.[CUSTOMERS.fields.country] as string) || '';
      next.shipTo = [street, city, country].filter(Boolean).join(', ');
    }
  }

  // Picking an Account resets Contact (forces re-pick within the new
  // account's contacts) and auto-fills Ship To, same as QuoteDetailsBox.
  function handleAccountChange(id: string) {
    const next: RentalDetails = { ...details, accountId: id || null, contactId: null };
    if (id) fillShipToFromAccount(next, id);
    onChange(next);
  }

  // Picking a Contact BEFORE an Account is set derives the Account (and
  // then Ship To) from that contact's own Company field — "just pick the
  // contact and it populates everything." Never overrides an Account the
  // rep already chose explicitly.
  function handleContactChange(id: string) {
    const next: RentalDetails = { ...details, contactId: id || null };
    if (id && !details.accountId) {
      const contact = contacts.find((c) => c._id === id);
      const companyId = contact ? readLinkId(contact.fields?.[CONTACTS.fields.company]) : undefined;
      if (companyId) {
        next.accountId = companyId;
        fillShipToFromAccount(next, companyId);
      }
    }
    onChange(next);
  }

  return (
    <Box>
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} mb={4}>
        <GridItem>
          <FormControl isRequired>
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
              onChange={handleContactChange}
              options={contactOptions}
              placeholder="Select contact… (auto-fills Account/Ship To if not set)"
              allowClear
            />
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Ship To</FormLabel>
            <Input size="sm" value={details.shipTo} onChange={(e) => set('shipTo', e.target.value)} />
            <Text fontSize="xs" color="subtleText" mt={1}>
              Auto-filled from the Account's address — edit freely if this rental ships somewhere else.
            </Text>
          </FormControl>
        </GridItem>
        <GridItem>
          <FormControl>
            <FormLabel fontSize="sm">Contract Reference #</FormLabel>
            <Input
              size="sm"
              placeholder="Shown on the Rental Contract header"
              value={details.contractReference}
              onChange={(e) => set('contractReference', e.target.value)}
            />
          </FormControl>
        </GridItem>
      </Grid>

      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Text fontSize="xs" fontWeight="bold" mb={3} color="subtleText" textTransform="uppercase">
          Shipping Responsibility
        </Text>
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4}>
          <GridItem>
            <FormControl>
              <FormLabel fontSize="sm">Delivery Freight</FormLabel>
              <Select
                size="sm"
                placeholder="— Select —"
                value={details.deliveryFreightResponsibility}
                onChange={(e) => set('deliveryFreightResponsibility', e.target.value)}
              >
                {RENTAL_SHIPPING_RESPONSIBILITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </FormControl>
          </GridItem>
          <GridItem>
            <FormControl>
              <FormLabel fontSize="sm">Return Freight</FormLabel>
              <Select
                size="sm"
                placeholder="— Select —"
                value={details.returnFreightResponsibility}
                onChange={(e) => set('returnFreightResponsibility', e.target.value)}
              >
                {RENTAL_SHIPPING_RESPONSIBILITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </FormControl>
          </GridItem>
          <GridItem>
            <FormControl>
              <FormLabel fontSize="sm">Insurance During Transportation</FormLabel>
              <Select
                size="sm"
                placeholder="— Select —"
                value={details.insuranceDuringTransportation}
                onChange={(e) => set('insuranceDuringTransportation', e.target.value)}
              >
                {RENTAL_SHIPPING_RESPONSIBILITY_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            </FormControl>
          </GridItem>
          <GridItem>
            <FormControl>
              <FormLabel fontSize="sm">Applicable Delivery Terms / Incoterms</FormLabel>
              <Select
                size="sm"
                placeholder="— Select —"
                value={details.applicableDeliveryTerms}
                onChange={(e) => set('applicableDeliveryTerms', e.target.value)}
              >
                {INCOTERMS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </FormControl>
          </GridItem>
        </Grid>
      </Box>
    </Box>
  );
}
