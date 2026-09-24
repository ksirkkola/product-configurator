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
import { RentalLine, newRentalLine, estimateRentalRevenue, cleaningAndCalibrationDue } from '../rentalLines';
import RentalCatalogPicker from './RentalCatalogPicker';
import RentalDetailsBox, { EMPTY_RENTAL_DETAILS, RentalDetails } from './RentalDetailsBox';
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
}

export default function RentalPush({ hailer, workflows, customers, contacts, activeProductCode }: Props) {
  const [units, setUnits] = useState<RentalUnitSummary[] | null>(null);
  // Committed lines — these are what count toward the summary/total and get
  // created in Hailer. A unit clicked in the catalog is NOT added here
  // immediately; it's staged in draftLine until the rep confirms the
  // calculated price via the "Add to Quote" button (same pattern as
  // CalibrationBox — configure, see the price, then commit it).
  const [lines, setLines] = useState<RentalLine[]>([]);
  const [draftLine, setDraftLine] = useState<RentalLine | null>(null);
  const [rentalDetails, setRentalDetails] = useState<RentalDetails>(EMPTY_RENTAL_DETAILS);
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

  const draftUnit = useMemo(() => units?.find((u) => u._id === draftLine?.unitId), [units, draftLine]);
  const addedUnitIds = useMemo(() => lines.map((l) => l.unitId), [lines]);
  const isDraftAlreadyAdded = useMemo(
    () => !!draftLine && lines.some((l) => l.id === draftLine.id),
    [lines, draftLine],
  );

  // Clicking a unit already in the quote re-opens ITS line for editing;
  // clicking a new one stages a fresh draft — neither is committed to
  // `lines` until "Add to Quote" is clicked.
  function handleSelectUnit(unit: RentalUnitSummary) {
    const existing = lines.find((l) => l.unitId === unit._id);
    setDraftLine(existing ? { ...existing } : newRentalLine(unit._id));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (draftLine?.id === id) setDraftLine(null);
  }

  // Commits the draft into `lines` — inserts new, or replaces in place if
  // this unit was already added (editing an existing one).
  function handleAddToQuote() {
    if (!draftLine) return;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === draftLine.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = draftLine;
        return next;
      }
      return [...prev, draftLine];
    });
    setDraftLine(null);
  }

  const canCreate =
    lines.length > 0 && !!rentalDetails.accountId && lines.every((l) => l.unitId && l.startDate && l.endDate);

  async function handleCreate() {
    if (!canCreate) return;
    setCreating(true);
    setResult(null);
    try {
      const account = customers.find((c) => c._id === rentalDetails.accountId);
      const activities = lines.map((line) => {
        const unit = units?.find((u) => u._id === line.unitId);
        const name = `Rental — ${unit?.productFamily || unit?.name || 'Unit'} — ${account?.name || 'TBD'}`.slice(0, 200);
        // CRITICAL: "Rental Fee for Desired Time Length" holds the TOTAL fee
        // for the period, not a per-week rate — push estimateRentalRevenue
        // (rate x weeks), never Number(line.weeklyRate) directly. See the
        // field's description in workspace/rentals_.../fields.ts and
        // rentalLines.ts's estimateRentalRevenue doc comment.
        const rentalFeeTotal = estimateRentalRevenue(line);
        const cleaningDue = cleaningAndCalibrationDue(line);
        const fields: Record<string, ActivityFieldValue> = {
          [rentalsResolver(RENTALS_FIELDS.customer)]: rentalDetails.accountId!,
          [rentalsResolver(RENTALS_FIELDS.rentalUnit)]: line.unitId,
          [rentalsResolver(RENTALS_FIELDS.rentalStartDate)]: line.startDate,
          [rentalsResolver(RENTALS_FIELDS.rentalEndDate)]: line.endDate,
          ...(rentalDetails.shipTo ? { [rentalsResolver(RENTALS_FIELDS.shipTo)]: rentalDetails.shipTo } : {}),
          ...(line.notes ? { [rentalsResolver(RENTALS_FIELDS.notes)]: line.notes } : {}),
          ...(rentalFeeTotal != null ? { [rentalsResolver(RENTALS_FIELDS.rentalFeeTotal)]: rentalFeeTotal } : {}),
          ...(line.startupFee ? { [rentalsResolver(RENTALS_FIELDS.startupFee)]: Number(line.startupFee) } : {}),
          ...(line.freightDelivery ? { [rentalsResolver(RENTALS_FIELDS.freightDelivery)]: Number(line.freightDelivery) } : {}),
          ...(line.freightReturn ? { [rentalsResolver(RENTALS_FIELDS.freightReturn)]: Number(line.freightReturn) } : {}),
          ...(line.cleaningAndCalibration ? { [rentalsResolver(RENTALS_FIELDS.cleaningAndCalibration)]: cleaningDue } : {}),
          ...(rentalDetails.deliveryFreightResponsibility
            ? { [rentalsResolver(RENTALS_FIELDS.deliveryFreightResponsibility)]: rentalDetails.deliveryFreightResponsibility }
            : {}),
          ...(rentalDetails.returnFreightResponsibility
            ? { [rentalsResolver(RENTALS_FIELDS.returnFreightResponsibility)]: rentalDetails.returnFreightResponsibility }
            : {}),
          ...(rentalDetails.insuranceDuringTransportation
            ? { [rentalsResolver(RENTALS_FIELDS.insuranceDuringTransportation)]: rentalDetails.insuranceDuringTransportation }
            : {}),
          ...(rentalDetails.applicableDeliveryTerms
            ? { [rentalsResolver(RENTALS_FIELDS.applicableDeliveryTerms)]: rentalDetails.applicableDeliveryTerms }
            : {}),
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
      setDraftLine(null);
      setRentalDetails(EMPTY_RENTAL_DETAILS);
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
                  variant={l.id === draftLine?.id ? 'solid' : 'subtle'}
                  colorScheme="blue"
                  cursor="pointer"
                  onClick={() => setDraftLine({ ...l })}
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

      <RentalDetailsBox
        customers={customers}
        contacts={contacts}
        details={rentalDetails}
        onChange={setRentalDetails}
      />

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
              activeUnitId={draftLine?.unitId ?? null}
              addedUnitIds={addedUnitIds}
              onSelect={handleSelectUnit}
            />
          </GridItem>
          <GridItem>
            {draftLine ? (
              <RentalLineEditor
                line={draftLine}
                unit={draftUnit}
                isAlreadyAdded={isDraftAlreadyAdded}
                onChange={setDraftLine}
                onAddToQuote={handleAddToQuote}
              />
            ) : (
              <Text color="subtleText" fontSize="sm">
                Click a fleet unit to configure it — fill in dates, see the calculated price, then Add to Quote.
                Account and Contact are shared above.
              </Text>
            )}
          </GridItem>
          <GridItem>
            <RentalSummaryPanel lines={lines} />
          </GridItem>
        </Grid>
      )}

      <HStack justify="flex-end">
        <Box flex={1} />
        <Button
          variant="outline"
          size="sm"
          isDisabled={lines.length === 0}
          onClick={() => setShowPreview((v) => !v)}
        >
          {showPreview ? 'Hide' : 'Preview'} Rental Contract
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
        <RentalQuoteView
          lines={lines}
          units={units}
          customers={customers}
          contacts={contacts}
          rentalDetails={rentalDetails}
        />
      )}
    </VStack>
  );
}
