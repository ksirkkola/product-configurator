import { useMemo, useState } from 'react';
import {
  Box,
  Input,
  List,
  ListItem,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { PriceListItem } from '../types';

interface Props {
  mains: PriceListItem[];
  selectedId: string | null;
  onSelect: (item: PriceListItem) => void;
}

export default function CatalogPicker({ mains, selectedId, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const selectedBg = useColorModeValue('green.50', 'green.900');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mains;
    return mains.filter(
      (m) =>
        m.productCode.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q),
    );
  }, [mains, search]);

  return (
    <VStack align="stretch" spacing={3}>
      <Input
        placeholder="Search by product code or description…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="sm"
      />
      <Box maxH="480px" overflowY="auto" borderWidth="1px" borderRadius="md">
        <List spacing={0}>
          {filtered.map((m) => (
            <ListItem
              key={m._id}
              px={3}
              py={2}
              cursor="pointer"
              bg={m._id === selectedId ? selectedBg : undefined}
              _hover={{ bg: m._id === selectedId ? selectedBg : hoverBg }}
              borderBottomWidth="1px"
              onClick={() => onSelect(m)}
            >
              <Text fontSize="sm" fontWeight="bold">
                {m.productCode}
              </Text>
              <Text fontSize="sm" color="subtleText" noOfLines={1}>
                {m.description || m.name}
              </Text>
            </ListItem>
          ))}
          {filtered.length === 0 && (
            <Box p={4}>
              <Text color="subtleText" fontSize="sm">
                No products match your search.
              </Text>
            </Box>
          )}
        </List>
      </Box>
    </VStack>
  );
}
