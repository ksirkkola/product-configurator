import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Grid,
  GridItem,
  HStack,
  Spinner,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { Activity, ActivityFieldValue, HailerApi, Workflow } from '@hailer/app-sdk';
import { listAll } from '../hailer/api-helpers';
import { createFieldResolver } from '../hailer/field-resolver';
import {
  WORKFLOWS,
  RENTAL_FLEET_PHASE,
  RENTAL_FLEET_FIELDS,
  RENTALS_DISCOVERY_PHASE,
  RENTALS_FIELDS,
} from '../constants/schema';
import { RentalUnitSummary } from '../types';
import { RentalLine, newRentalLine, estimateRentalRevenue } from '../rentalLines';
import { QuoteDetails } from './QuoteDetailsBox';
import RentalCatalogPicker from './RentalCatalogPicker';
import RentalLineEditor from './RentalLineEditor';
import RentalQuoteView from './RentalQuoteView';
import RentalSummaryPanel from './RentalSummaryPanel';
import { formatHailerError } from '../hailerError';

interface Props {
  hailer: HailerApi;
  workflows: Workflow[];
  customers: Activity[];
  contacts: Activity[];
  activeProductCode?: string | null;
  details: QuoteDetails;
}

export default function RentalPush({ hailer, workflows, customers, contacts, activeProductCode, details }: Props) {
  const [units, setUnits] = useState<RentalUnitSummary[] | null>(null);
  const [lines, setLines] = useState<RentalLine[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fleetWorkflow = useMemo(() => workflows.find((w) => w._id === WORKFLOWS.rentalFleet), [workflows]);
  const rentalsWorkflow = useMemo(() => workflows.find((w) => w._id === WORKFLOWS.rentals), [workflows]);
  const fleetResolver = useMemo(() => createFieldResolver(fleetWorkflow?.fields), [fleetWorkflow]);
  const rentalsResolver = useMemo(() => createFieldResolver(rentalsWorkflow?.fields), [rentalsWorkflow]);

  useEffect(() => {
    let cancelled = false;
    listAll(hailer, WORKFLOWS.rentalFleet, RENTAL_FLEET_PHASE).then((activities) => {
      if (cancelled) return;
      const summaries: RentalUnitSummary[] = activities.map((a) => ({
        _id: a._id,
        name: a.name,
        productFamily: a.fields?.[fleetResolver(RENTAL_FLEET_FIELDS.productFamily)] as string | undefined,
        serialNumber: a.fields?.[fleetResolver(RENTAL_FLEET_FIELDS.serialNumber)] as string | undefined,
        status: a.fields?.[fleetResolver(RENTAL_FLEET_FIELDS.status)] as string | undefined,
      }));
      setUnits(summaries);
    });
    return () => {
      cancelled = true;
    };
  }, [hailer, fleetResolver]);

  // Units matching the product being configured surface first — most likely
  // pick when a rep is quoting a rental of the same family they're configuring.
  const sortedUnits = useMemo(() => {
    if (!units) return [];
    return [...units].sort((a, b) => {
      const aMatch = activeProductCode && a.productFamily?.startsWith(activeProductCode) ? 0 : 1;
      const bMatch = activeProductCode && b.productFamily?.startsWith(activeProductCode) ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [units, activeProductCode]);

  const activeLine = useMemo(() => lines.find((l) => l.id === activeLineId) ?? null, [lines, activeLineId]);
  const activeUnit = useMemo(() => units?.find((u) => u._id === activeLine?.unitId), [units, activeLine]);
  const addedUnitIds = useMemo(() => lines.map((l) => l.unitId), [lines]);

  function handleSelectUnit(unit: RentalUnitSummary) {
    const existing = lines.find((l) => l.unitId === unit._id);
    if (existing) {
      setActiveLineId(existing.id);
      return;
    }
    const line = newRentalLine(unit._id, { accountId: details.accountId, shipTo: details.shipTo });
    setLines((prev) => [...prev, line]);
    setActiveLineId(line.id);
  }

  function removeLine(id: string) {
    setLines((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeLineId === id) setActiveLineId(next.length ? next[next.length - 1].id : null);
      return next;
    });
  }

  function updateActiveLine(updated: RentalLine) {
    setLines((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  const canCreate = lines.length > 0 && lines.every((l) => l.unitId && l.accountId && l.startDate && l.endDate);

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    setResult(null);
    try {
      const activities = lines.map((line) => {
        const unit = units?.find((u) => u._id === line.unitId);
        const account = customers.find((c) => c._id === line.accountId);
        const name = `Rental — ${unit?.productFamily || unit?.name || 'Unit'} — ${account?.name || 'TBD'}`.slice(0, 200);
        const fields: Record<string, ActivityFieldValue> = {
          [rentalsResolver(RENTALS_FIELDS.customer)]: line.accountId!,
          [rentalsResolver(RENTALS_FIELDS.rentalUnit)]: line.unitId,
          [rentalsResolver(RENTALS_FIELDS.rentalStartDate)]: line.startDate,
          [rentalsResolver(RENTALS_FIELDS.rentalEndDate)]: line.endDate,
          ...(line.shipTo ? { [rentalsResolver(RENTALS_FIELDS.shipTo)]: line.shipTo } : {}),
          ...(line.notes ? { [rentalsResolver(RENTALS_FIELDS.notes)]: line.notes } : {}),
          ...(line.weeklyRate ? { [rentalsResolver(RENTALS_FIELDS.weeklyRate)]: Number(line.weeklyRate) } : {}),
          ...(line.deposit ? { [rentalsResolver(RENTALS_FIELDS.deposit)]: Number(line.deposit) } : {}),
          ...(line.startupFee ? { [rentalsResolver(RENTALS_FIELDS.startupFee)]: Number(line.startupFee) } : {}),
          ...(line.shippingCost ? { [rentalsResolver(RENTALS_FIELDS.shippingCost)]: Number(line.shippingCost) } : {}),
        };
        return { name, phaseId: RENTALS_DISCOVERY_PHASE, fields };
      });

      const created = await hailer.activity.create(WORKFLOWS.rentals, activities);

      if (!created || created.length !== activities.length) {
        throw new Error(
          `Expected ${activities.length} rental(s) to be created, got ${created?.length ?? 0}. Nothing was confirmed — check Hailer before retrying.`,
        );
      }

      setResult({ ok: true, message: `Created ${created.length} rental${created.length === 1 ? '' : 's'}.` });
      setLines([]);
      setActiveLineId(null);
      setShowPreview(false);
    } catch (err) {
      setResult({ ok: false, message: formatHailerError(err) });
    } finally {
      setCreating(false);
    }
  }

  if (units === null) {
    return (
      <HStack>
        <Spinner size="sm" />
        <Text fontSize="sm" color="subtleText">
          Loading rental fleet…
        </Text>
      </HStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Text fontSize="sm" color="subtleText">
        Rentals live on their own timeline (Discovery → Proposal → Agreement → Out on Rental → Returned), separate
        from this quote's system-sale total — creating one here won't affect the quote pricing on the other tabs.
      </Text>

      {lines.length > 0 && (
        <Wrap spacing={2}>
          {lines.map((l) => {
            const unit = units.find((u) => u._id === l.unitId);
            return (
              <WrapItem key={l.id}>
                <Tag
                  size="md"
                  borderRadius="full"
                  variant={l.id === activeLineId ? 'solid' : 'subtle'}
                  colorScheme="blue"
                  cursor="pointer"
                  onClick={() => setActiveLineId(l.id)}
                >
                  <TagLabel>{unit?.productFamily || unit?.name || 'Unit'}</TagLabel>
                  <TagCloseButton
                    onClick={(ev) => {
                      ev.stopPropagation();
                      removeLine(l.id);
                    }}
                  />
                </Tag>
              </WrapItem>
            );
          })}
        </Wrap>
      )}

      {units.length === 0 ? (
        <Alert status="info" fontSize="sm" borderRadius="md">
          <AlertIcon />
          No rental fleet units exist yet. Add one to Rental Fleet in Hailer first, then come back here.
        </Alert>
      ) : (
        <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 320px' }} gap={4}>
          <GridItem>
            <Text fontSize="xs" fontWeight="bold" mb={2} color="subtleText">
              RENTAL FLEET ({units.length})
            </Text>
            <RentalCatalogPicker
              units={sortedUnits}
              activeUnitId={activeLine?.unitId ?? null}
              addedUnitIds={addedUnitIds}
              onSelect={handleSelectUnit}
            />
          </GridItem>
          <GridItem>
            {activeLine ? (
              <RentalLineEditor line={activeLine} unit={activeUnit} customers={customers} onChange={updateActiveLine} />
            ) : (
              <Text color="subtleText" fontSize="sm">
                Click a fleet unit to add it to this rental — fill in dates, rate, and customer for the highlighted
                one.
              </Text>
            )}
          </GridItem>
          <GridItem>
            <RentalSummaryPanel lines={lines} />
          </GridItem>
        </Grid>
      )}

      <HStack justify="flex-end">
        {activeLine && (
          <Text fontSize="xs" color="subtleText">
            {estimateRentalRevenue(activeLine) != null
              ? `Est. revenue for this unit: ${estimateRentalRevenue(activeLine)!.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}`
              : ''}
          </Text>
        )}
        <Box flex={1} />
        <Button
          variant="outline"
          size="sm"
          isDisabled={lines.length === 0}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Hide' : 'Preview'} Rental Quote
        </Button>
        <Button
          colorScheme="green"
          size="sm"
          isDisabled={!canCreate}
          isLoading={creating}
          loadingText="Creating…"
          onClick={handleCreate}
        >
          Create {lines.length} Rental{lines.length === 1 ? '' : 's'}
        </Button>
      </HStack>

      {result && (
        <Alert status={result.ok ? 'success' : 'error'} fontSize="sm" borderRadius="md">
          <AlertIcon />
          {result.message}
        </Alert>
      )}

      {showPreview && lines.length > 0 && (
        <RentalQuoteView lines={lines} units={units} customers={customers} contacts={contacts} details={details} />
      )}
    </VStack>
  );
}
