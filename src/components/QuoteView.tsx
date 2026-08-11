import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from '@chakra-ui/react';
import { useState } from 'react';
import { HailerApi, Workflow } from '@hailer/app-sdk';
import { Totals } from '../pricing';
import { formatMoney } from '../hailer/api-helpers';
import { ITEM_TYPE, OPPORTUNITY } from '../constants/schema';

interface Props {
  totals: Totals;
  commissionPct: number;
  hailer: HailerApi;
  workflows: Workflow[];
}

// Customer-facing: unit prices already include agent commission; the split is
// internal and never shown on the quote.
export default function QuoteView({ totals, commissionPct, hailer, workflows }: Props) {
  const [notice, setNotice] = useState<string | null>(null);

  function saveToOpportunity() {
    setNotice(null);
    const mainLines = totals.lines.filter((p) => p.line.item.itemType === ITEM_TYPE.MAIN);
    const main: (typeof mainLines)[number] | undefined = mainLines[0];

    const sumBy = (type: string) =>
      totals.lines
        .filter((p) => p.line.item.itemType === type)
        .reduce((s, p) => s + p.listTotal, 0);

    const calibrationSum = sumBy(ITEM_TYPE.CALIBRATION);
    if (!main && calibrationSum === 0) return;

    // Product Name is a required dropdown of raw sheet codes ("521-XXX_s30.F - Liz
    // Manikin, …"); match by the description after the first " - ". If no option
    // matches, leave it for the user to pick in the native form.
    const oppWorkflow = workflows.find((w) => w._id === OPPORTUNITY.workflowId);
    const optionsData: string[] =
      (oppWorkflow?.fields as Record<string, { data?: string[] }> | undefined)?.[
        OPPORTUNITY.fields.productName
      ]?.data ?? [];
    const desc = (main?.line.item.description || '').trim().toLowerCase();
    const matchedProductName = desc
      ? optionsData.find(
          (opt) => opt.split(' - ').slice(1).join(' - ').trim().toLowerCase() === desc,
        )
      : undefined;

    const commissionAmount = totals.finalSum - totals.listSum;

    // € parts are pre-commission list prices: Quoted Total Revenue (a function
    // field) sums them server-side, and commission is modeled separately.
    // Multi-product quotes: Base Product carries the sum of all main products;
    // the single-value Product Name field carries the first one.
    const fields: { [fieldId: string]: number | string } = {
      [OPPORTUNITY.fields.baseProduct]: mainLines.reduce((s, p) => s + p.listTotal, 0),
      [OPPORTUNITY.fields.standardOptions]: sumBy(ITEM_TYPE.STANDARD_OPTION),
      [OPPORTUNITY.fields.customOptions]: sumBy(ITEM_TYPE.CUSTOM_OPTION),
    };
    if (calibrationSum > 0) fields[OPPORTUNITY.fields.iso17025] = calibrationSum;
    if (matchedProductName) fields[OPPORTUNITY.fields.productName] = matchedProductName;
    if (commissionPct > 0) {
      fields[OPPORTUNITY.fields.agentCommissionPct] = commissionPct;
      fields[OPPORTUNITY.fields.commissionAmount] = commissionAmount;
    }

    // Opportunity has TWO initial phases (Discovery + Proposal). The form
    // defaults to Discovery and silently drops prefill for fields not in that
    // phase — so target Proposal explicitly; it holds all the quote fields.
    // Never await ui.activity.create directly — the promise NEVER settles if
    // the user cancels the form. React only to the saved case.
    void hailer.ui.activity
      .create(OPPORTUNITY.workflowId, {
        name: `${
          main
            ? `${main.line.item.productCode}${mainLines.length > 1 ? ` +${mainLines.length - 1}` : ''}`
            : 'Calibration'
        } quote — ${new Date().toLocaleDateString()}`,
        phaseId: OPPORTUNITY.proposalPhaseId,
        fields,
      })
      .then((created) => {
        if (created?._id) void hailer.ui.activity.open(created._id);
      })
      .catch((err: unknown) => {
        const e = err as { msg?: string; message?: string };
        setNotice(`Failed to open the opportunity form: ${e?.msg || e?.message || String(err)}`);
      });

    setNotice(
      matchedProductName
        ? 'Opportunity form opened with the quote prefilled — complete the sales fields and save.'
        : 'Opportunity form opened. Product Name had no matching option — pick it manually in the form.',
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={4} className="no-print">
        <Heading size="md">Customer Quote</Heading>
        <Button colorScheme="green" size="sm" onClick={saveToOpportunity}>
          Save quote to Opportunity
        </Button>
      </HStack>

      {notice && (
        <Alert status="info" fontSize="sm" borderRadius="md" mb={4} className="no-print">
          <AlertIcon />
          {notice}
        </Alert>
      )}

      <Box id="quote-print-area" borderWidth="1px" borderRadius="md" p={6}>
        <Heading size="lg" mb={1}>
          Quote
        </Heading>
        <Text fontSize="sm" color="subtleText" mb={4}>
          {new Date().toLocaleDateString()}
        </Text>

        <Table size="sm" variant="simple">
          <Thead>
            <Tr>
              <Th>Description</Th>
              <Th isNumeric>Qty</Th>
              <Th isNumeric>Unit price</Th>
              <Th isNumeric>Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {totals.lines.map((p) => (
              <Tr key={p.line.item._id}>
                <Td>
                  {p.line.item.description || p.line.item.name}
                  {!p.hasPrice && (
                    <Badge ml={2} colorScheme="orange" fontSize="2xs">
                      PRF
                    </Badge>
                  )}
                </Td>
                <Td isNumeric>{p.line.qty}</Td>
                <Td isNumeric>
                  {p.hasPrice
                    ? formatMoney((p.line.item.price as number) * (1 + commissionPct / 100))
                    : 'On request'}
                </Td>
                <Td isNumeric>{p.hasPrice ? formatMoney(p.finalTotal) : '—'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>

        <Box mt={6} textAlign="right">
          <Heading size="md" mt={1}>
            Total: {formatMoney(totals.finalSum)}
          </Heading>
          {totals.prfCount > 0 && (
            <Text fontSize="sm" color="orange.500" mt={2}>
              {totals.prfCount} item{totals.prfCount > 1 ? 's' : ''} priced on request —
              not included in total above.
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
