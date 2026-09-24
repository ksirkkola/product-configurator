import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  Box,
  Container,
  Grid,
  GridItem,
  Heading,
  HStack,
  Link,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  useColorMode,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { Activity } from '@hailer/app-sdk';
import { useApp } from './hailer/use-app';
import { createFieldResolver } from './hailer/field-resolver';
import { listAll, readLinkId, firstFileId } from './hailer/api-helpers';
import {
  WORKFLOWS,
  PRICE_LIST_PHASE,
  PRICE_LIST_FIELDS,
  ITEM_TYPE,
  MANUAL_PRICE_TYPES,
  CUSTOMERS,
  CONTACTS,
  OPPORTUNITY,
  MANDATORY_OPTIONS,
} from './constants/schema';
import { computeTotals, PriceOverrides } from './pricing';
import { SectionDiscounts } from './quoteSections';
import { PriceListItem, QuoteEntry } from './types';
import { DraftPayload, draftName, serializeDraft } from './draft';
import CalibrationBox, { CalibrationQuoteLine } from './components/CalibrationBox';
import CatalogPicker from './components/CatalogPicker';
import DraftControls from './components/DraftControls';
import ExtrasBox, { ExtraQuoteLine } from './components/ExtrasBox';
import OptionsPicker from './components/OptionsPicker';
import PricingPanel from './components/PricingPanel';
import QuoteDetailsBox, { EMPTY_QUOTE_DETAILS, QuoteDetails } from './components/QuoteDetailsBox';
import QuoteView from './components/QuoteView';
import RentalPush from './components/RentalPush';
import WorkOrderPush from './components/WorkOrderPush';
import { formatHailerError } from './hailerError';

declare const __APP_VERSION__: string;

function mapPriceListItem(a: Activity, f: (key: string) => string): PriceListItem {
  return {
    _id: a._id,
    name: a.name,
    itemId: (a.fields?.[f(PRICE_LIST_FIELDS.itemId)] as string) || '',
    productCode: (a.fields?.[f(PRICE_LIST_FIELDS.productCode)] as string) || '',
    description: (a.fields?.[f(PRICE_LIST_FIELDS.description)] as string) || '',
    itemType: ((a.fields?.[f(PRICE_LIST_FIELDS.itemType)] as string) ||
      ITEM_TYPE.MAIN) as PriceListItem['itemType'],
    parentId: readLinkId(a.fields?.[f(PRICE_LIST_FIELDS.parentItem)]),
    cost: (a.fields?.[f(PRICE_LIST_FIELDS.cost2025)] as number | undefined) ?? undefined,
    price: (a.fields?.[f(PRICE_LIST_FIELDS.price2025)] as number | undefined) ?? undefined,
    specSheetFileId: firstFileId(a.fields?.[f(PRICE_LIST_FIELDS.specSheet)]),
    standardsSupported: (a.fields?.[f(PRICE_LIST_FIELDS.standardsSupported)] as string) || undefined,
    // Checkbox fields store 1/0, not boolean.
    includedInPrice: Number(a.fields?.[f(PRICE_LIST_FIELDS.includedInPrice)] ?? 0) === 1,
  };
}

export default function App() {
  const { hailer, api, inside, settings, app, ready } = useApp();
  const { setColorMode } = useColorMode();

  const [items, setItems] = useState<PriceListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // A quote holds any number of products; clicking a product in the catalog
  // adds it. The active one is the one whose options are being edited.
  const [entries, setEntries] = useState<QuoteEntry[]>([]);
  const [activeMainId, setActiveMainId] = useState<string | null>(null);
  const [calLines, setCalLines] = useState<CalibrationQuoteLine[]>([]);
  const [extraLines, setExtraLines] = useState<ExtraQuoteLine[]>([]);
  const [commissionPct, setCommissionPct] = useState(0);
  // Rare manual price adjustments (discounts, or pricing a PRF item) made in
  // the Quote tab — keyed by Price List item _id. See pricing.ts.
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrides>({});
  // Per-section discount %, matching the FECSA-style quote template's
  // "Discount (%)" / "Discount ($)" rows — keyed by ITEM_TYPE. See quoteSections.ts.
  const [sectionDiscounts, setSectionDiscounts] = useState<SectionDiscounts>({});
  const [quoteDetails, setQuoteDetails] = useState<QuoteDetails>(EMPTY_QUOTE_DETAILS);
  const [customers, setCustomers] = useState<Activity[]>([]);
  const [contacts, setContacts] = useState<Activity[]>([]);
  // Save Draft / Resume Draft — see draft.ts. Once a draft is saved or
  // resumed, further saves update the same Opportunity instead of piling up
  // duplicates.
  const [draftActivityId, setDraftActivityId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftNotice, setDraftNotice] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    void api.init();
  }, [api]);

  useEffect(() => {
    if (!inside || !hailer) return;
    let cancelled = false;
    listAll(hailer, CUSTOMERS.workflowId, CUSTOMERS.phaseId)
      .then((rows) => { if (!cancelled) setCustomers(rows); })
      .catch(() => undefined);
    listAll(hailer, CONTACTS.workflowId, CONTACTS.phaseId)
      .then((rows) => { if (!cancelled) setContacts(rows); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [inside, hailer]);

  useEffect(() => {
    if (settings) setColorMode(settings.theme === 'dark' ? 'dark' : 'light');
  }, [settings, setColorMode]);

  const priceListWorkflow = useMemo(
    () => app.workflows.find((w) => w._id === WORKFLOWS.priceList),
    [app.workflows],
  );
  const f = useMemo(() => createFieldResolver(priceListWorkflow?.fields), [priceListWorkflow]);

  useEffect(() => {
    if (!inside || !priceListWorkflow || !hailer) return;
    let cancelled = false;
    listAll(hailer, WORKFLOWS.priceList, PRICE_LIST_PHASE)
      .then((activities) => {
        if (cancelled) return;
        setItems(activities.map((a) => mapPriceListItem(a, f)));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(formatHailerError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [inside, hailer, priceListWorkflow, f]);

  // Sorted by the leading number in the product code (e.g. "306-GHP" before
  // "501-Newton"), not insertion/creation order — matches how the catalog is
  // organized on paper. Same-number variants (e.g. "306-GHP"/"306-SDHP") are
  // tie-broken alphabetically for a stable, predictable order.
  const mains = useMemo(() => {
    const list = (items || []).filter((i) => i.itemType === ITEM_TYPE.MAIN);
    return [...list].sort((a, b) => {
      const na = parseInt(a.productCode, 10);
      const nb = parseInt(b.productCode, 10);
      const aValid = !Number.isNaN(na);
      const bValid = !Number.isNaN(nb);
      if (aValid && bValid) {
        return na !== nb ? na - nb : a.productCode.localeCompare(b.productCode);
      }
      if (aValid) return -1;
      if (bValid) return 1;
      return a.productCode.localeCompare(b.productCode);
    });
  }, [items]);
  // Standards Supported is set once per product family (on any one variant
  // row) — back-fill it onto every variant so search works regardless of
  // which specific row (e.g. Liz Dry vs Liz Sweating) the user is searching.
  const mainsSearchable = useMemo(() => {
    const standardsByCode = new Map<string, string>();
    for (const m of mains) {
      if (m.standardsSupported && !standardsByCode.has(m.productCode)) {
        standardsByCode.set(m.productCode, m.standardsSupported);
      }
    }
    return mains.map((m) => ({
      ...m,
      standardsSupported: m.standardsSupported ?? standardsByCode.get(m.productCode),
    }));
  }, [mains]);
  const activeMain = useMemo(
    () => mains.find((m) => m._id === activeMainId) || null,
    [mains, activeMainId],
  );
  const activeEntry = useMemo(
    () => entries.find((e) => e.mainId === activeMainId) || null,
    [entries, activeMainId],
  );
  // Spec Sheet / Standards Supported are set once per product family (on any
  // one 'main' row for that product code) — look across all variant rows.
  const activeSpecInfo = useMemo(() => {
    if (!activeMain) return { specSheetFileId: undefined, standardsSupported: undefined };
    const family = mains.filter((m) => m.productCode === activeMain.productCode);
    return {
      specSheetFileId: family.find((m) => m.specSheetFileId)?.specSheetFileId,
      standardsSupported: family.find((m) => m.standardsSupported)?.standardsSupported,
    };
  }, [mains, activeMain]);
  // Options are shared across variants of the same product code (e.g. Liz Dry
  // and Liz Sweating), not tied to the one variant row they sat under in the sheet.
  // An option scoped to one specific main variant (e.g. a "10.5" accessory
  // under a product code that also has an "8.2" main) sets Parent Item to
  // that exact row and should ONLY show for it. An option with no Parent
  // Item is shared across every variant of the product code (e.g. Liz Dry
  // vs Sweating sharing the same accessories).
  const options = useMemo(
    () =>
      (items || []).filter(
        (i) =>
          i.itemType !== ITEM_TYPE.MAIN &&
          activeMain != null &&
          i.productCode === activeMain.productCode &&
          (i.parentId == null || i.parentId === activeMain._id),
      ),
    [items, activeMain],
  );
  // Catalog rows for ISO Certification / Startup / Customization / Shipping —
  // used only to prefill ExtrasBox's default description per category.
  const manualItems = useMemo(
    () => (items || []).filter((i) => MANUAL_PRICE_TYPES.includes(i.itemType)),
    [items],
  );

  const lines = useMemo(() => {
    const productLines = entries.flatMap((e) => {
      const main = mains.find((m) => m._id === e.mainId);
      if (!main) return [];
      const optionLines = (items || [])
        .filter(
          (i) =>
            i.itemType !== ITEM_TYPE.MAIN &&
            i.productCode === main.productCode &&
            (e.optionQtys[i._id] ?? 0) > 0,
        )
        .map((o) => ({ item: o, qty: e.optionQtys[o._id] }));
      return [{ item: main, qty: e.qty }, ...optionLines];
    });
    // Calibration lines ride the same pipeline as synthetic price-list items;
    // itemType 'calibration' makes them commission-exempt in computeTotals.
    // years rides through as Qty — a 3-year contract's Total = Single Cal
    // price × 3, matching the sheet's SERVICE / YEARS / TOTAL columns.
    const calibrationLines = calLines.map((c) => ({
      item: {
        _id: c.id,
        name: c.label,
        itemId: 'CAL',
        productCode: 'CALIBRATION',
        description: c.label,
        itemType: ITEM_TYPE.CALIBRATION,
        cost: c.cost,
        price: c.price,
      } as PriceListItem,
      qty: c.years ?? 1,
    }));
    // ISO Certification / Startup / Customization / Shipping — manually priced
    // per quote via ExtrasBox, same synthetic-line pattern as calibration.
    const extraQuoteLines = extraLines.map((x) => ({
      item: {
        _id: x.id,
        name: x.label,
        itemId: '',
        productCode: '',
        description: x.label,
        itemType: x.itemType,
        cost: undefined,
        price: x.price,
      } as PriceListItem,
      qty: 1,
    }));
    return [...productLines, ...calibrationLines, ...extraQuoteLines];
  }, [entries, mains, items, calLines, extraLines]);

  const totals = useMemo(
    () => computeTotals(lines, commissionPct, priceOverrides),
    [lines, commissionPct, priceOverrides],
  );

  function handlePriceOverride(itemId: string, price: number) {
    setPriceOverrides((prev) => ({ ...prev, [itemId]: price }));
  }

  function handleResetOverride(itemId: string) {
    setPriceOverrides((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  }

  function handleSectionDiscountChange(sectionType: string, pct: number) {
    setSectionDiscounts((prev) => ({ ...prev, [sectionType]: pct }));
  }

  function handleSelectMain(item: PriceListItem) {
    setEntries((prev) => {
      if (prev.some((e) => e.mainId === item._id)) return prev;
      // Auto-select any option this product always requires (see
      // MANDATORY_OPTIONS) — the rep can still remove it, this just
      // prevents forgetting a required add-on like ACE's ManikinPC license.
      const mandatoryDesc = MANDATORY_OPTIONS[item.productCode];
      const optionQtys: Record<string, number> = {};
      if (mandatoryDesc) {
        const mandatoryItem = (items || []).find(
          (i) => i.productCode === item.productCode && i.description === mandatoryDesc,
        );
        if (mandatoryItem) optionQtys[mandatoryItem._id] = 1;
      }
      return [...prev, { mainId: item._id, qty: 1, optionQtys }];
    });
    setActiveMainId(item._id);
  }

  function removeEntry(mainId: string) {
    setEntries((prev) => {
      const removed = prev.find((e) => e.mainId === mainId);
      const next = prev.filter((e) => e.mainId !== mainId);
      if (activeMainId === mainId) setActiveMainId(next.length ? next[next.length - 1].mainId : null);
      // Drop any price overrides tied to the removed product/options so a
      // later re-add of the same catalog item doesn't resurrect a stale discount.
      if (removed) {
        const staleIds = [mainId, ...Object.keys(removed.optionQtys)];
        setPriceOverrides((prevOverrides) => {
          const nextOverrides = { ...prevOverrides };
          staleIds.forEach((id) => delete nextOverrides[id]);
          return nextOverrides;
        });
      }
      return next;
    });
  }

  function handleMainQtyChange(qty: number) {
    setEntries((prev) => prev.map((e) => (e.mainId === activeMainId ? { ...e, qty } : e)));
  }

  function handleOptionQtyChange(itemId: string, qty: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.mainId === activeMainId ? { ...e, optionQtys: { ...e.optionQtys, [itemId]: qty } } : e,
      ),
    );
  }

  async function handleSaveDraft() {
    if (!hailer) return;
    setDraftSaving(true);
    setDraftNotice(null);
    try {
      const firstMain = entries.length > 0 ? mains.find((m) => m._id === entries[0].mainId) : undefined;
      const name = draftName(firstMain?.productCode, entries.length);
      const json = serializeDraft({
        entries,
        calLines,
        extraLines,
        commissionPct,
        quoteDetails,
        priceOverrides,
        sectionDiscounts,
      });
      const fields = { [OPPORTUNITY.fields.configuratorDraftJson]: json };

      if (draftActivityId) {
        const updated = await hailer.activity.update([{ _id: draftActivityId, name, fields }]);
        if (!updated) throw new Error('Draft update was not confirmed — check Hailer before retrying.');
      } else {
        const created = await hailer.activity.create(OPPORTUNITY.workflowId, [
          { name, phaseId: OPPORTUNITY.discoveryPhaseId, fields },
        ]);
        if (!created?.[0]?._id) throw new Error('Draft was not created — check Hailer before retrying.');
        setDraftActivityId(created[0]._id);
      }
      setDraftNotice({ ok: true, message: 'Draft saved.' });
    } catch (err) {
      setDraftNotice({ ok: false, message: `Failed to save draft: ${formatHailerError(err)}` });
    } finally {
      setDraftSaving(false);
    }
  }

  function handleResumeDraft(draft: DraftPayload, activityId: string) {
    setEntries(draft.entries);
    setCalLines(draft.calLines);
    setExtraLines(draft.extraLines);
    setCommissionPct(draft.commissionPct);
    setQuoteDetails(draft.quoteDetails ?? EMPTY_QUOTE_DETAILS);
    setPriceOverrides(draft.priceOverrides ?? {});
    setSectionDiscounts(draft.sectionDiscounts ?? {});
    setDraftActivityId(activityId);
    setActiveMainId(draft.entries[0]?.mainId ?? null);
    setDraftNotice({ ok: true, message: 'Draft resumed — pick up where you left off.' });
  }

  if (inside === null) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="subtleText">
          Connecting to Hailer…
        </Heading>
      </Box>
    );
  }

  if (inside === false) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="subtleText" mb={2}>
          You are outside of Hailer
        </Heading>
        <Text>
          This app must be loaded inside Hailer — see{' '}
          <Link href="https://www.npmjs.com/package/@hailer/create-app">
            @hailer/create-app
          </Link>{' '}
          for details.
        </Text>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="red.400" mb={2}>
          Failed to load the Price List
        </Heading>
        <Text>{loadError}</Text>
      </Box>
    );
  }

  if (ready && !priceListWorkflow) {
    return (
      <Box margin="2em">
        <Heading fontSize="lg" color="red.400" mb={2}>
          Price List workflow not available
        </Heading>
        <Text>
          This app connection cannot see the Price List workflow ({WORKFLOWS.priceList}).
          Check the app&apos;s workflow access in Hailer.
        </Text>
      </Box>
    );
  }

  if (!hailer || items === null) {
    return (
      <HStack margin="2em">
        <Spinner size="sm" />
        <Text color="subtleText">Loading catalog…</Text>
      </HStack>
    );
  }

  return (
    <Container maxW="container.xl" py={6}>
      <HStack justify="space-between" align="flex-start" mb={4} className="no-print">
        <Heading
          fontSize="xl"
          bgGradient="linear(to-r, blue.400, purple.400)"
          bgClip="text"
          fontWeight="extrabold"
        >
          Product Configurator
        </Heading>
        <DraftControls
          hailer={hailer}
          saving={draftSaving}
          hasDraftActivity={draftActivityId != null}
          onSave={handleSaveDraft}
          onResume={handleResumeDraft}
        />
      </HStack>

      {draftNotice && (
        <Alert status={draftNotice.ok ? 'success' : 'error'} fontSize="sm" borderRadius="md" mb={4} className="no-print">
          <AlertIcon />
          {draftNotice.message}
        </Alert>
      )}

      {/* lazyBehavior="unmount" so the Work Order tab refetches on every visit */}
      <Tabs variant="soft-rounded" colorScheme="blue" isLazy lazyBehavior="unmount">
        <TabList overflowX="auto" overflowY="hidden" sx={{ scrollbarWidth: 'none' }} pb={2}>
          <Tab>Configure</Tab>
          <Tab isDisabled={entries.length === 0 && calLines.length === 0 && extraLines.length === 0}>
            Quote
          </Tab>
          <Tab isDisabled={entries.length === 0 && calLines.length === 0 && extraLines.length === 0}>
            Work Order
          </Tab>
          {/* Not gated on quote content — a rental can stand on its own, with
              no system sale attached (e.g. a pure rental deal). */}
          <Tab>Rental</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0} pt={4}>
            <VStack align="stretch" spacing={4}>
              {(entries.length > 0 || calLines.length > 0 || extraLines.length > 0) && (
                <Wrap spacing={2}>
                  {entries.map((e) => {
                    const main = mains.find((m) => m._id === e.mainId);
                    if (!main) return null;
                    return (
                      <WrapItem key={e.mainId}>
                        <Tag
                          size="md"
                          borderRadius="full"
                          variant={e.mainId === activeMainId ? 'solid' : 'subtle'}
                          colorScheme="blue"
                          cursor="pointer"
                          onClick={() => setActiveMainId(e.mainId)}
                        >
                          <TagLabel>
                            {main.productCode}
                            {e.qty > 1 ? ` ×${e.qty}` : ''}
                          </TagLabel>
                          <TagCloseButton
                            onClick={(ev) => {
                              ev.stopPropagation();
                              removeEntry(e.mainId);
                            }}
                          />
                        </Tag>
                      </WrapItem>
                    );
                  })}
                  {extraLines.map((x) => (
                    <WrapItem key={x.id}>
                      <Tag size="md" borderRadius="full" variant="subtle" colorScheme="pink">
                        <TagLabel>{x.label}</TagLabel>
                        <TagCloseButton
                          onClick={() => setExtraLines((prev) => prev.filter((y) => y.id !== x.id))}
                        />
                      </Tag>
                    </WrapItem>
                  ))}
                  {calLines.map((c) => (
                    <WrapItem key={c.id}>
                      <Tag size="md" borderRadius="full" variant="subtle" colorScheme="purple">
                        <TagLabel>{c.label}</TagLabel>
                        <TagCloseButton
                          onClick={() => setCalLines((prev) => prev.filter((x) => x.id !== c.id))}
                        />
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}

              {/* 1. Base Product & Options — the core task, always open */}
              <Box>
                <Text fontSize="sm" fontWeight="bold" mb={2} color="subtleText">
                  1. BASE PRODUCT &amp; OPTIONS
                </Text>
                <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 320px' }} gap={4}>
                  <GridItem>
                    <Text fontSize="xs" fontWeight="bold" mb={2} color="subtleText">
                      PRODUCTS ({mains.length})
                    </Text>
                    <CatalogPicker mains={mainsSearchable} selectedId={activeMainId} onSelect={handleSelectMain} />
                  </GridItem>
                  <GridItem>
                    {activeMain && activeEntry ? (
                      <OptionsPicker
                        main={activeMain}
                        mainQty={activeEntry.qty}
                        onMainQtyChange={handleMainQtyChange}
                        options={options}
                        qtys={activeEntry.optionQtys}
                        onQtyChange={handleOptionQtyChange}
                        specSheetFileId={activeSpecInfo.specSheetFileId}
                        standardsSupported={activeSpecInfo.standardsSupported}
                      />
                    ) : (
                      <Text color="subtleText" fontSize="sm">
                        Click products to add them to the quote — standard &amp; custom
                        options show for the highlighted one.
                      </Text>
                    )}
                  </GridItem>
                  <GridItem>
                    <PricingPanel totals={totals} commissionPct={commissionPct} onCommissionChange={setCommissionPct} />
                  </GridItem>
                </Grid>
              </Box>

              {/* 2–4. Less-frequently-touched sections, collapsed by default to
                  keep the primary task above uncluttered. */}
              <Accordion allowMultiple>
                <AccordionItem>
                  <AccordionButton>
                    <Text flex="1" textAlign="left" fontSize="sm" fontWeight="bold" color="subtleText">
                      2. QUOTE DETAILS — customer, agent &amp; shipping
                    </Text>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4}>
                    <QuoteDetailsBox
                      customers={customers}
                      contacts={contacts}
                      details={quoteDetails}
                      onChange={setQuoteDetails}
                    />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem>
                  <AccordionButton>
                    <Text flex="1" textAlign="left" fontSize="sm" fontWeight="bold" color="subtleText">
                      3. ADDITIONAL CHARGES — ISO 17025, Startup, Customization, Shipping
                    </Text>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4}>
                    <ExtrasBox
                      items={manualItems}
                      onAdd={(line) => setExtraLines((prev) => [...prev, line])}
                    />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem>
                  <AccordionButton>
                    <Text flex="1" textAlign="left" fontSize="sm" fontWeight="bold" color="subtleText">
                      4. CALIBRATION OPTIONS — on-site / in-house calibration service
                    </Text>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4}>
                    <CalibrationBox
                      hailer={hailer}
                      workflows={app.workflows}
                      onAdd={(newLines) => setCalLines((prev) => [...prev, ...newLines])}
                    />
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </VStack>
          </TabPanel>

          <TabPanel px={0} pt={4}>
            <QuoteView
              totals={totals}
              commissionPct={commissionPct}
              hailer={hailer}
              workflows={app.workflows}
              customers={customers}
              contacts={contacts}
              details={quoteDetails}
              onPriceOverride={handlePriceOverride}
              onResetOverride={handleResetOverride}
              sectionDiscounts={sectionDiscounts}
              onSectionDiscountChange={handleSectionDiscountChange}
            />
          </TabPanel>

          <TabPanel px={0} pt={4}>
            <WorkOrderPush hailer={hailer} workflows={app.workflows} lines={lines} />
          </TabPanel>

          <TabPanel px={0} pt={4}>
            <RentalPush
              hailer={hailer}
              workflows={app.workflows}
              customers={customers}
              contacts={contacts}
              activeProductCode={activeMain?.productCode}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Text fontSize="xs" color="gray.400" position="fixed" bottom={1} right={2} className="no-print">
        v{__APP_VERSION__}
      </Text>
    </Container>
  );
}
