import { useMemo } from 'react';
import { Box, FormControl, FormLabel, Grid, GridItem, Input, Select, Text } from '@chakra-ui/react';
import { Activity } from '@hailer/app-sdk';
import { CONTACTS, INCOTERMS, RENTAL_SHIPPING_RESPONSIBILITY_OPTIONS } from '../constants/schema';
import { readLinkId } from '../hailer/api-helpers';
import SearchableSelect from './SearchableSelect';

// Contact + Contract Reference # and the Shipping Responsibility block, shown
// once above the fleet picker and applied to every unit created in this
// batch. Contact/Contract Reference # are PDF-only (never pushed to Hailer —
// same convention as QuoteDetails.contactId/proposalReference for the main
// quote); the four Shipping Responsibility fields ARE real fields on the
// Rentals workflow and get written onto every created Rental activity.
export interface RentalDetails {
  contactId: string | null;
  contractReference: string;
  deliveryFreightResponsibility: string;
  returnFreightResponsibility: string;
  insuranceDuringTransportation: string;
  applicableDeliveryTerms: string;
}

export const EMPTY_RENTAL_DETAILS: RentalDetails = {
  contactId: null,
  contractReference: '',
  deliveryFreightResponsibility: '',
  returnFreightResponsibility: '',
  insuranceDuringTransportation: '',
  applicableDeliveryTerms: 'DAP', // same default as the main quote's Incoterms
};

interface Props {
  contacts: Activity[];
  activeAccountId: string | null;
  details: RentalDetails;
  onChange: (details: RentalDetails) => void;
}

export default function RentalDetailsBox({ contacts, activeAccountId, details, onChange }: Props) {
  // Filtered by the currently active unit's Account when one is set — same
  // pattern as QuoteDetailsBox — otherwise shows every contact.
  const contactOptions = useMemo(() => {
    const filtered = activeAccountId
      ? contacts.filter((c) => readLinkId(c.fields?.[CONTACTS.fields.company]) === activeAccountId)
      : contacts;
    return filtered
      .map((c) => {
        const first = (c.fields?.[CONTACTS.fields.firstName] as string) || '';
        const last = (c.fields?.[CONTACTS.fields.lastName] as string) || '';
        return { _id: c._id, name: `${first} ${last}`.trim() || c.name };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, activeAccountId]);

  function set<K extends keyof RentalDetails>(key: K, value: RentalDetails[K]) {
    onChange({ ...details, [key]: value });
  }

  return (
    <Box>
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={4} mb={4}>
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
      <Text fontSize="xs" color="subtleText" mt={-2} mb={4}>
        Shown on the Rental Contract header — Account/Ship To come from the unit's own Account field below.
      </Text>

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
