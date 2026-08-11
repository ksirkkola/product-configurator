import { useEffect, useMemo, useState } from 'react';
import {
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
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { Activity } from '@hailer/app-sdk';
import { useApp } from './hailer/use-app';
import { createFieldResolver } from './hailer/field-resolver';
import { listAll, readLinkId } from './hailer/api-helpers';
import { WORKFLOWS, PRICE_LIST_PHASE, PRICE_LIST_FIELDS, ITEM_TYPE } from './constants/schema';
import { computeTotals } from './pricing';
import { PriceListItem } from './types';
import CalibrationBox, { CalibrationQuoteLine } from './components/CalibrationBox';
import CatalogPicker from './components/CatalogPicker';
import OptionsPicker from './components/OptionsPicker';
import PricingPanel from './components/PricingPanel';
import QuoteView from './components/QuoteView';
import WorkOrderPush from './components/WorkOrderPush';

declare const __APP_VERSION__: string;

interface QuoteEntry {
  mainId: string;
  qty: number;
  optionQtys: Record<string, number>;
}

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
  const [commissionPct, setCommissionPct] = useState(0);

  useEffect(() => {
    void api.init();
  }, [api]);

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
        const e = err as { msg?: string; message?: string };
        setLoadError(e?.msg || e?.message || String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [inside, hailer, priceListWorkflow, f]);

  const mains = useMemo(
    () => (items || []).filter((i) => i.itemType === ITEM_TYPE.MAIN),
    [items],
  );
  const activeMain = useMemo(
    () => mains.find((m) => m._id === activeMainId) || null,
    [mains, activeMainId],
  );
  const activeEntry = useMemo(
    () => entries.find((e) => e.mainId === activeMainId) || null,
    [entries, activeMainId],
  );
  // Options are shared across variants of the same product code (e.g. Liz Dry
  // and Liz Sweating), not tied to the one variant row they sat under in the sheet.
  const options = useMemo(
    () =>
      (items || []).filter(
        (i) =>
          i.itemType !== ITEM_TYPE.MAIN &&
          activeMain != null &&
          i.productCode === activeMain.productCode,
      ),
    [items, activeMain],
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
      qty: 1,
    }));
    return [...productLines, ...calibrationLines];
  }, [entries, mains, items, calLines]);

  const totals = useMemo(() => computeTotals(lines, commissionPct), [lines, commissionPct]);

  function handleSelectMain(item: PriceListItem) {
    setEntries((prev) =>
      prev.some((e) => e.mainId === item._id)
        ? prev
        : [...prev, { mainId: item._id, qty: 1, optionQtys: {} }],
    );
    setActiveMainId(item._id);
  }

  function removeEntry(mainId: string) {
    setEntries((prev) => {
      const next = prev.filter((e) => e.mainId !== mainId);
      if (activeMainId === mainId) setActiveMainId(next.length ? next[next.length - 1].mainId : null);
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
      <Heading
        fontSize="xl"
        bgGradient="linear(to-r, blue.400, purple.400)"
        bgClip="text"
        fontWeight="extrabold"
        mb={6}
      >
        Product Configurator
      </Heading>

      {/* lazyBehavior="unmount" so the Work Order tab refetches on every visit */}
      <Tabs variant="soft-rounded" colorScheme="blue" isLazy lazyBehavior="unmount">
        <TabList overflowX="auto" overflowY="hidden" sx={{ scrollbarWidth: 'none' }} pb={2}>
          <Tab>Configure</Tab>
          <Tab isDisabled={entries.length === 0 && calLines.length === 0}>Quote</Tab>
          <Tab isDisabled={entries.length === 0 && calLines.length === 0}>Work Order</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0} pt={4}>
            {(entries.length > 0 || calLines.length > 0) && (
              <Wrap mb={4} spacing={2}>
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
              </Wrap>
            )}
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 320px' }} gap={4}>
              <GridItem>
                <Text fontSize="sm" fontWeight="bold" mb={2} color="subtleText">
                  PRODUCTS ({mains.length})
                </Text>
                <CatalogPicker mains={mains} selectedId={activeMainId} onSelect={handleSelectMain} />
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
                  />
                ) : (
                  <Text color="subtleText" fontSize="sm">
                    Click products to add them to the quote — options show for the highlighted one.
                  </Text>
                )}
              </GridItem>
              <GridItem>
                <PricingPanel totals={totals} commissionPct={commissionPct} onCommissionChange={setCommissionPct} />
              </GridItem>
            </Grid>

            <Box mt={6} borderWidth="1px" borderRadius="md" p={4}>
              <Text fontSize="sm" fontWeight="bold" mb={3} color="subtleText">
                CALIBRATION
              </Text>
              <CalibrationBox
                hailer={hailer}
                workflows={app.workflows}
                onAdd={(newLines) => setCalLines((prev) => [...prev, ...newLines])}
              />
            </Box>
          </TabPanel>

          <TabPanel px={0} pt={4}>
            <QuoteView
              totals={totals}
              commissionPct={commissionPct}
              hailer={hailer}
              workflows={app.workflows}
            />
          </TabPanel>

          <TabPanel px={0} pt={4}>
            <WorkOrderPush hailer={hailer} workflows={app.workflows} lines={lines} />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Text fontSize="xs" color="gray.400" position="fixed" bottom={1} right={2} className="no-print">
        v{__APP_VERSION__}
      </Text>
    </Container>
  );
}
