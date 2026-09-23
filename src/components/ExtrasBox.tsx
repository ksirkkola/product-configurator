import { useState } from 'react';
import {
  Box,
  Button,
  Grid,
  GridItem,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ItemType, PriceListItem } from '../types';
import { SECTIONS, MANUAL_PRICE_TYPES } from '../constants/schema';

export interface ExtraQuoteLine {
  id: string;
  itemType: ItemType;
  label: string;
  price: number;
}

interface Props {
  items: PriceListItem[]; // Price List rows whose itemType is in MANUAL_PRICE_TYPES
  onAdd: (line: ExtraQuoteLine) => void;
}

const manualSections = SECTIONS.filter((s) => MANUAL_PRICE_TYPES.includes(s.type));

export default function ExtrasBox({ items, onAdd }: Props) {
  const [descByType, setDescByType] = useState<Record<string, string>>({});
  const [priceByType, setPriceByType] = useState<Record<string, number>>({});

  function defaultDescription(type: string): string {
    const catalogItem = items.find((i) => i.itemType === type);
    return catalogItem?.description || catalogItem?.name || '';
  }

  function handleAdd(type: ItemType) {
    const price = priceByType[type];
    if (!price || price <= 0) return;
    const label = (descByType[type] ?? defaultDescription(type)).trim() || defaultDescription(type);
    onAdd({
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      itemType: type,
      label,
      price,
    });
    setPriceByType((prev) => ({ ...prev, [type]: 0 }));
  }

  return (
    <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap={4}>
      {manualSections.map((section) => (
        <GridItem key={section.type}>
          <Box borderWidth="1px" borderRadius="md" p={3}>
            <Text fontSize="sm" fontWeight="bold" mb={2} color="subtleText">
              {section.label.toUpperCase()}
            </Text>
            <VStack align="stretch" spacing={2}>
              <Input
                size="sm"
                placeholder="Description"
                value={descByType[section.type] ?? defaultDescription(section.type)}
                onChange={(e) =>
                  setDescByType((prev) => ({ ...prev, [section.type]: e.target.value }))
                }
              />
              <NumberInput
                size="sm"
                min={0}
                value={priceByType[section.type] ?? ''}
                onChange={(_, n) =>
                  setPriceByType((prev) => ({ ...prev, [section.type]: Number.isNaN(n) ? 0 : n }))
                }
              >
                <NumberInputField placeholder="Price (€)" />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Button
                size="sm"
                colorScheme="green"
                isDisabled={!priceByType[section.type]}
                onClick={() => handleAdd(section.type as ItemType)}
              >
                Add to quote
              </Button>
            </VStack>
          </Box>
        </GridItem>
      ))}
    </Grid>
  );
}
