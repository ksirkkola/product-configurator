import {
  Badge,
  Box,
  HStack,
  Link,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  Wrap,
  WrapItem,
  VStack,
} from '@chakra-ui/react';
import { PriceListItem } from '../types';
import { formatMoney } from '../hailer/api-helpers';
import { ITEM_TYPE } from '../constants/schema';

interface Props {
  main: PriceListItem;
  mainQty: number;
  onMainQtyChange: (qty: number) => void;
  options: PriceListItem[];
  qtys: Record<string, number>;
  onQtyChange: (itemId: string, qty: number) => void;
  specSheetFileId?: string;
  standardsSupported?: string;
}

export default function OptionsPicker({
  main,
  mainQty,
  onMainQtyChange,
  options,
  qtys,
  onQtyChange,
  specSheetFileId,
  standardsSupported,
}: Props) {
  const standardsList = standardsSupported
    ? standardsSupported.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return (
    <VStack align="stretch" spacing={4}>
      <Box borderWidth="1px" borderRadius="md" p={3}>
        <HStack justify="space-between" align="start">
          <Box>
            <Text fontWeight="bold">{main.productCode}</Text>
            <Text fontSize="sm" color="subtleText">
              {main.description || main.name}
            </Text>
            <Text fontSize="sm" mt={1}>
              {main.price != null ? formatMoney(main.price) : (
                <Badge colorScheme="orange">PRF / price on request</Badge>
              )}
            </Text>
            {specSheetFileId && (
              <Link
                href={`https://api.hailer.com/file/${specSheetFileId}`}
                isExternal
                fontSize="sm"
                color="blue.400"
                mt={1}
                display="inline-block"
              >
                📄 View Spec Sheet
              </Link>
            )}
            {standardsList.length > 0 && (
              <Wrap spacing={1} mt={2}>
                {standardsList.map((s) => (
                  <WrapItem key={s}>
                    <Badge colorScheme="teal" fontSize="2xs">{s}</Badge>
                  </WrapItem>
                ))}
              </Wrap>
            )}
          </Box>
          <NumberInput
            size="sm"
            min={1}
            maxW="90px"
            value={mainQty}
            onChange={(_, n) => onMainQtyChange(Number.isNaN(n) ? 1 : n)}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </HStack>
      </Box>

      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={2} color="subtleText">
          OPTIONS
        </Text>
        {options.length === 0 && (
          <Text fontSize="sm" color="subtleText">
            This product has no options.
          </Text>
        )}
        <VStack align="stretch" spacing={2}>
          {options.map((opt) => (
            <HStack
              key={opt._id}
              justify="space-between"
              borderWidth="1px"
              borderRadius="md"
              p={2}
            >
              <Box flex={1}>
                <HStack>
                  <Badge colorScheme={opt.itemType === ITEM_TYPE.STANDARD_OPTION ? 'blue' : 'purple'}>
                    {opt.itemType === ITEM_TYPE.STANDARD_OPTION ? 'Standard' : 'Custom'}
                  </Badge>
                  <Text fontSize="sm" fontWeight="semibold">
                    {opt.productCode}
                  </Text>
                </HStack>
                <Text fontSize="sm" color="subtleText" noOfLines={1}>
                  {opt.description || opt.name}
                </Text>
                <Text fontSize="sm">
                  {opt.price != null ? formatMoney(opt.price) : (
                    <Badge colorScheme="orange" fontSize="2xs">
                      PRF / price on request
                    </Badge>
                  )}
                </Text>
              </Box>
              <NumberInput
                size="sm"
                min={0}
                maxW="90px"
                value={qtys[opt._id] ?? 0}
                onChange={(_, n) => onQtyChange(opt._id, Number.isNaN(n) ? 0 : n)}
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </HStack>
          ))}
        </VStack>
      </Box>
    </VStack>
  );
}
