import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Grid,
  GridItem,
  HStack,
  Select,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Activity, HailerApi, Workflow } from '@hailer/app-sdk';
import { listAll, formatMoney } from '../hailer/api-helpers';
import { createFieldResolver } from '../hailer/field-resolver';
import { CALIBRATION } from '../constants/schema';
import { formatHailerError } from '../hailerError';
import EditablePercentCell from './EditablePercentCell';

export interface CalibrationQuoteLine {
  id: string;
  label: string;
  price: number;
  cost: number;
  years: number; // 1-3 — recurring on-site/in-house calibration contract length; drives Qty in the quote
}

interface CountryRate {
  name: string;
  daysTraveling: number;
  airfare: number;
  carPerDay: number;
  hotelPerDay: number;
  foodPerDay: number;
}

interface SystemRate {
  name: string;
  displayName: string;
  inHouseOnly: boolean;
  partsCost: number;
  daysOnSite: number;
}

interface Props {
  hailer: HailerApi;
  workflows: Workflow[];
  onAdd: (lines: CalibrationQuoteLine[]) => void;
}

const NO_TRAVEL = 'NO TRAVEL';
const IN_HOUSE_SUFFIX = /\s*\(in house only\)\s*/i;

export default function CalibrationBox({ hailer, workflows, onAdd }: Props) {
  const [countries, setCountries] = useState<CountryRate[] | null>(null);
  const [systems, setSystems] = useState<SystemRate[]>([]);
  const [constants, setConstants] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const [destination, setDestination] = useState('');
  const [travelers, setTravelers] = useState(1);
  const [years, setYears] = useState(1);
  const [selectedSystems, setSelectedSystems] = useState<Record<string, boolean>>({});
  // Point-of-sale discount — a manual % knocked off this box's own price before
  // it's added to the quote (separate from the Quote tab's per-section
  // discounts, which apply to already-added lines). Cost is untouched, so the
  // discount shows up as reduced margin, same as a section discount does.
  const [posDiscountPct, setPosDiscountPct] = useState(0);

  const calWorkflow = useMemo(
    () => workflows.find((w) => w._id === CALIBRATION.workflowId),
    [workflows],
  );

  useEffect(() => {
    if (!calWorkflow) return;
    const f = createFieldResolver(calWorkflow.fields);
    const num = (a: Activity, key: string) => Number(a.fields?.[f(key)] ?? 0) || 0;
    let cancelled = false;
    listAll(hailer, CALIBRATION.workflowId, CALIBRATION.phaseId)
      .then((activities) => {
        if (cancelled) return;
        const byType = (t: string) =>
          activities.filter((a) => a.fields?.[f(CALIBRATION.fields.rowType)] === t);
        setCountries(
          byType('country').map((a) => ({
            name: a.name,
            daysTraveling: num(a, CALIBRATION.fields.daysTraveling),
            airfare: num(a, CALIBRATION.fields.airfare),
            carPerDay: num(a, CALIBRATION.fields.carPerDay),
            hotelPerDay: num(a, CALIBRATION.fields.hotelPerDay),
            foodPerDay: num(a, CALIBRATION.fields.foodPerDay),
          })),
        );
        setSystems(
          byType('system').map((a) => ({
            name: a.name,
            displayName: a.name.replace(IN_HOUSE_SUFFIX, '').trim(),
            inHouseOnly: IN_HOUSE_SUFFIX.test(a.name),
            partsCost: num(a, CALIBRATION.fields.partsCost),
            daysOnSite: num(a, CALIBRATION.fields.daysOnSite),
          })),
        );
        setConstants(
          Object.fromEntries(
            byType('constant').map((a) => [a.name, num(a, CALIBRATION.fields.value)]),
          ),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(formatHailerError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [hailer, calWorkflow]);

  const isInHouse = destination === NO_TRAVEL;
  const country = useMemo(
    () => (countries || []).find((c) => c.name === destination) || null,
    [countries, destination],
  );
  const picked = useMemo(
    () => systems.filter((s) => selectedSystems[s.name]),
    [systems, selectedSystems],
  );

  const quote = useMemo(() => {
    if (!country || picked.length === 0) return null;
    const laborDay = constants['labor_per_day'] ?? 850;
    const travelLaborDay = constants['travel_labor_per_day'] ?? 850;
    const partsMarkup = constants['parts_markup'] ?? 0.7;

    const onSiteDays = picked.reduce((s, x) => s + x.daysOnSite, 0);
    const partsRaw = picked.reduce((s, x) => s + x.partsCost, 0);

    const travelLabor = country.daysTraveling * travelLaborDay * travelers;
    const airfare = country.airfare * travelers;
    const car = onSiteDays * country.carPerDay;
    const hotel = onSiteDays * country.hotelPerDay * travelers;
    const food = onSiteDays * country.foodPerDay * travelers;
    const onsiteLabor = onSiteDays * laborDay * travelers;
    const partsSell = partsRaw * (1 + partsMarkup);

    const travel = travelLabor + airfare + car + hotel + food;
    // Single Cal price: everything summed, rounded UP to the nearest €100.
    const listPrice = Math.ceil((travel + onsiteLabor + partsSell) / 100) * 100;
    const cost = travel + onsiteLabor + partsRaw;
    const posDiscountAmount = listPrice * (posDiscountPct / 100);
    const price = listPrice - posDiscountAmount;
    return { onSiteDays, travel, onsiteLabor, partsSell, listPrice, posDiscountAmount, price, cost };
  }, [country, picked, travelers, constants, posDiscountPct]);

  function handleAdd() {
    if (!quote || !country) return;
    const laborDay = constants['labor_per_day'] ?? 850;
    const partsMarkup = constants['parts_markup'] ?? 0.7;
    const where = isInHouse
      ? 'In-house'
      : `${country.name}, ${travelers} traveler${travelers > 1 ? 's' : ''}`;
    const mkId = () => `cal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // One quote line per service; travel gets its own line and absorbs the
    // €100 round-up so the lines sum exactly to the sheet's Single Cal price.
    // `years` rides along on every line as the recurring-contract length —
    // App.tsx uses it as the line's Qty, so Total = Single Cal price × years.
    const lines: CalibrationQuoteLine[] = picked.map((s) => ({
      id: mkId(),
      label:
        s.displayName === 'TRAINING'
          ? `Training — ${where}`
          : `Calibration ${s.displayName} — ${where}`,
      price: s.daysOnSite * laborDay * travelers + s.partsCost * (1 + partsMarkup),
      cost: s.daysOnSite * laborDay * travelers + s.partsCost,
      years,
    }));
    const systemsSum = lines.reduce((s, l) => s + l.price, 0);
    // travel + rounding pad, net of the POS discount — can go negative when the
    // discount exceeds travel/rounding, which is fine: it just pulls the
    // adjustment line below zero so the lines still sum to the discounted total.
    const remainder = quote.price - systemsSum;
    if (quote.travel > 0) {
      lines.push({
        id: mkId(),
        label: `Travel & expenses — ${where}`,
        price: remainder,
        cost: quote.travel,
        years,
      });
    } else if (lines.length > 0) {
      // In-house (no travel): put the rounding pad / POS discount on the last service line.
      lines[lines.length - 1].price += remainder;
    }
    onAdd(lines);
    setSelectedSystems({});
    setPosDiscountPct(0);
  }

  if (!calWorkflow || countries === null) {
    return (
      <HStack>
        <Spinner size="sm" />
        <Text fontSize="sm" color="subtleText">
          {loadError ? `Calibration rates failed to load: ${loadError}` : 'Loading calibration rates…'}
        </Text>
      </HStack>
    );
  }

  return (
    <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr 320px' }} gap={4}>
      <GridItem>
        <VStack align="stretch" spacing={3}>
          <Box>
            <Text fontSize="sm" mb={1} color="subtleText">
              Destination
            </Text>
            <Select
              size="sm"
              placeholder="Select destination…"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setSelectedSystems({});
              }}
            >
              {countries.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name === NO_TRAVEL ? 'In-house (no travel)' : c.name}
                </option>
              ))}
            </Select>
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} color="subtleText">
              Travelers
            </Text>
            <Select
              size="sm"
              value={travelers}
              onChange={(e) => setTravelers(Number(e.target.value))}
              isDisabled={isInHouse}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Box>
          <Box>
            <Text fontSize="sm" mb={1} color="subtleText">
              Years
            </Text>
            <Select size="sm" value={years} onChange={(e) => setYears(Number(e.target.value))}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Box>
        </VStack>
      </GridItem>

      <GridItem>
        <Text fontSize="sm" fontWeight="bold" mb={2} color="subtleText">
          SYSTEMS TO CALIBRATE
        </Text>
        <VStack align="stretch" spacing={1}>
          {systems.map((s) => {
            const blocked = s.inHouseOnly && !isInHouse;
            return (
              <Checkbox
                key={s.name}
                size="sm"
                isChecked={!!selectedSystems[s.name]}
                isDisabled={blocked || !destination}
                onChange={(e) =>
                  setSelectedSystems((prev) => ({ ...prev, [s.name]: e.target.checked }))
                }
              >
                <HStack spacing={2}>
                  <Text fontSize="sm">{s.displayName}</Text>
                  <Text fontSize="xs" color="subtleText">
                    {s.daysOnSite}d
                  </Text>
                  {s.inHouseOnly && (
                    <Badge colorScheme="orange" fontSize="2xs">
                      in-house only
                    </Badge>
                  )}
                </HStack>
              </Checkbox>
            );
          })}
        </VStack>
      </GridItem>

      <GridItem>
        <Box borderWidth="1px" borderRadius="md" p={4}>
          <VStack align="stretch" spacing={3}>
            {quote ? (
              <>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="subtleText">
                    Travel & expenses
                  </Text>
                  <Text fontSize="sm">{formatMoney(quote.travel)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="subtleText">
                    On-site labor ({quote.onSiteDays}d)
                  </Text>
                  <Text fontSize="sm">{formatMoney(quote.onsiteLabor)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="subtleText">
                    Parts
                  </Text>
                  <Text fontSize="sm">{formatMoney(quote.partsSell)}</Text>
                </HStack>
                <HStack justify="space-between">
                  <Text fontSize="sm" color="subtleText">
                    POS discount
                  </Text>
                  <EditablePercentCell value={posDiscountPct} onCommit={setPosDiscountPct} />
                </HStack>
                <Stat>
                  <StatLabel>Single Cal price</StatLabel>
                  <StatNumber fontSize="xl" color="green.500">
                    {formatMoney(quote.price)}
                  </StatNumber>
                  {posDiscountPct > 0 && (
                    <Text fontSize="xs" color="subtleText" textDecoration="line-through">
                      {formatMoney(quote.listPrice)}
                    </Text>
                  )}
                </Stat>
                {years > 1 && (
                  <HStack justify="space-between">
                    <Text fontSize="sm" color="subtleText">
                      × {years} years
                    </Text>
                    <Text fontSize="sm" fontWeight="bold">
                      {formatMoney(quote.price * years)}
                    </Text>
                  </HStack>
                )}
                <Button colorScheme="green" size="sm" onClick={handleAdd}>
                  Add to quote
                </Button>
              </>
            ) : (
              <Text fontSize="sm" color="subtleText">
                Pick a destination and at least one system.
              </Text>
            )}
          </VStack>
        </Box>
      </GridItem>
    </Grid>
  );
}
