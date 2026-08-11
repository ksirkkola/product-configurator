import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  HStack,
  Input,
  List,
  ListItem,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { HailerApi, Workflow } from '@hailer/app-sdk';
import { fetchAllPhases, readLinkName } from '../hailer/api-helpers';
import { createFieldResolver } from '../hailer/field-resolver';
import {
  WORKFLOWS,
  WORK_ORDER_PHASES,
  WORK_ORDER_PHASE_NAMES,
  WORK_ORDER_LINE_ITEM_INITIAL_PHASE,
  WORK_ORDER_FIELDS,
  WORK_ORDER_LINE_ITEM_FIELDS,
} from '../constants/schema';
import { ConfigLine, WorkOrderSummary } from '../types';

interface Props {
  hailer: HailerApi;
  workflows: Workflow[];
  lines: ConfigLine[];
}

export default function WorkOrderPush({ hailer, workflows, lines }: Props) {
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[] | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const woWorkflow = useMemo(
    () => workflows.find((w) => w._id === WORKFLOWS.workOrder),
    [workflows],
  );
  const liWorkflow = useMemo(
    () => workflows.find((w) => w._id === WORKFLOWS.workOrderLineItem),
    [workflows],
  );
  const woResolver = useMemo(() => createFieldResolver(woWorkflow?.fields), [woWorkflow]);
  const liResolver = useMemo(() => createFieldResolver(liWorkflow?.fields), [liWorkflow]);

  useEffect(() => {
    let cancelled = false;
    fetchAllPhases(hailer, WORKFLOWS.workOrder, WORK_ORDER_PHASES).then((activities) => {
      if (cancelled) return;
      const summaries: WorkOrderSummary[] = activities.map((a) => ({
        _id: a._id,
        name: a.name,
        workOrderNumber: a.fields?.[woResolver(WORK_ORDER_FIELDS.workOrderNumber)] as
          | string
          | undefined,
        customerName: readLinkName(a.fields?.[woResolver(WORK_ORDER_FIELDS.customer)]),
        buildType: a.fields?.[woResolver(WORK_ORDER_FIELDS.buildType)] as string | undefined,
        phaseId: a.currentPhase || '',
      }));
      setWorkOrders(summaries);
    });
    return () => {
      cancelled = true;
    };
  }, [hailer, woResolver]);

  const filtered = useMemo(() => {
    if (!workOrders) return [];
    const q = search.trim().toLowerCase();
    if (!q) return workOrders;
    return workOrders.filter((wo) =>
      [wo.name, wo.workOrderNumber, wo.customerName, wo.buildType]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [workOrders, search]);

  async function handlePush() {
    if (!selectedId || lines.length === 0) return;
    setPushing(true);
    setResult(null);
    try {
      const activities = lines.map((l) => ({
        name: `${l.item.productCode} — ${l.item.description || l.item.name}`.slice(0, 200),
        fields: {
          [liResolver(WORK_ORDER_LINE_ITEM_FIELDS.workOrder)]: selectedId,
          [liResolver(WORK_ORDER_LINE_ITEM_FIELDS.partNumber)]: l.item.itemId,
          [liResolver(WORK_ORDER_LINE_ITEM_FIELDS.description)]: l.item.description || l.item.name,
          [liResolver(WORK_ORDER_LINE_ITEM_FIELDS.quantityRequired)]: l.qty,
          ...(l.item.cost != null
            ? { [liResolver(WORK_ORDER_LINE_ITEM_FIELDS.unitCost)]: l.item.cost }
            : {}),
        },
      }));

      const created = await hailer.activity.create(WORKFLOWS.workOrderLineItem, activities, {
        phaseId: WORK_ORDER_LINE_ITEM_INITIAL_PHASE,
      });

      if (!created || created.length !== activities.length) {
        throw new Error(
          `Expected ${activities.length} line item(s) to be created, got ${created?.length ?? 0}. Nothing was confirmed — check Hailer before retrying.`,
        );
      }

      setResult({
        ok: true,
        message: `Created ${created.length} line item(s) on the selected work order.`,
      });
    } catch (err) {
      setResult({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to create work order line items — nothing was saved.',
      });
    } finally {
      setPushing(false);
    }
  }

  if (workOrders === null) {
    return (
      <HStack>
        <Spinner size="sm" />
        <Text fontSize="sm" color="subtleText">
          Loading work orders…
        </Text>
      </HStack>
    );
  }

  return (
    <VStack align="stretch" spacing={3}>
      <Input
        placeholder="Search work orders by number, customer, name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="sm"
      />

      {workOrders.length === 0 ? (
        <Alert status="info" fontSize="sm" borderRadius="md">
          <AlertIcon />
          No work orders exist yet. Create one in Hailer first, then come back here.
        </Alert>
      ) : (
        <Box maxH="320px" overflowY="auto" borderWidth="1px" borderRadius="md">
          <List spacing={0}>
            {filtered.map((wo) => (
              <ListItem
                key={wo._id}
                px={3}
                py={2}
                cursor="pointer"
                bg={wo._id === selectedId ? 'green.50' : undefined}
                _dark={{ bg: wo._id === selectedId ? 'green.900' : undefined }}
                borderBottomWidth="1px"
                onClick={() => {
                  setSelectedId(wo._id);
                  void hailer.ui.activity.open(wo._id);
                }}
              >
                <HStack justify="space-between">
                  <Box>
                    <Text fontSize="sm" fontWeight="bold">
                      {wo.workOrderNumber || wo.name}
                    </Text>
                    <Text fontSize="xs" color="subtleText">
                      {[wo.customerName, wo.buildType].filter(Boolean).join(' · ')}
                    </Text>
                  </Box>
                  <Badge colorScheme="gray">{WORK_ORDER_PHASE_NAMES[wo.phaseId] || '—'}</Badge>
                </HStack>
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      <Button
        colorScheme="green"
        size="sm"
        isDisabled={!selectedId || lines.length === 0}
        isLoading={pushing}
        loadingText="Creating line items…"
        onClick={handlePush}
        alignSelf="flex-end"
      >
        Push {lines.length} line item{lines.length === 1 ? '' : 's'} to work order
      </Button>

      {result && (
        <Alert status={result.ok ? 'success' : 'error'} fontSize="sm" borderRadius="md">
          <AlertIcon />
          {result.message}
        </Alert>
      )}
    </VStack>
  );
}
