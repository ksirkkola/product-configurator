import {
  Alert,
  AlertIcon,
  Box,
  Select,
  Stat,
  StatGroup,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Totals } from '../pricing';
import { formatMoney } from '../hailer/api-helpers';
import { COMMISSION_TIERS, COMMISSION_TIER_LABELS } from '../constants/schema';

interface Props {
  totals: Totals;
  commissionPct: number;
  onCommissionChange: (pct: number) => void;
}

export default function PricingPanel({ totals, commissionPct, onCommissionChange }: Props) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={4} position="sticky" top={4}>
      <VStack align="stretch" spacing={4}>
        <Box>
          <Text fontSize="sm" mb={1} color="subtleText">
            Agent commission
          </Text>
          <Select
            size="sm"
            value={commissionPct}
            onChange={(e) => onCommissionChange(Number(e.target.value))}
          >
            {COMMISSION_TIERS.map((t) => (
              <option key={t} value={t}>
                {t === 0 ? 'No commission' : COMMISSION_TIER_LABELS[t] ?? `${t}%`}
              </option>
            ))}
          </Select>
        </Box>

        <StatGroup>
          <Stat>
            <StatLabel>List price</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totals.listSum)}</StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Total incl. commission</StatLabel>
            <StatNumber fontSize="xl" color="green.500">
              {formatMoney(totals.finalSum)}
            </StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Cost (base product)</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totals.baseCostSum)}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Gross margin (base product)</StatLabel>
            <StatNumber fontSize="lg">{totals.marginPct.toFixed(1)}%</StatNumber>
          </Stat>
        </StatGroup>

        <StatGroup>
          <Stat>
            <StatLabel>Cost (total)</StatLabel>
            <StatNumber fontSize="lg">{formatMoney(totals.totalCostSum)}</StatNumber>
          </Stat>
          <Stat>
            <StatLabel>Gross margin (total)</StatLabel>
            <StatNumber fontSize="lg">{totals.totalMarginPct.toFixed(1)}%</StatNumber>
          </Stat>
        </StatGroup>

        {totals.prfCount > 0 && (
          <Alert status="warning" fontSize="sm" borderRadius="md">
            <AlertIcon />
            {totals.prfCount} selected item{totals.prfCount > 1 ? 's have' : ' has'} no
            list price (PRF) — excluded from totals above.
          </Alert>
        )}
      </VStack>
    </Box>
  );
}
