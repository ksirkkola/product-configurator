import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  HStack,
  Input,
  List,
  ListItem,
  Text,
  VStack,
  useColorModeValue,
} from '@chakra-ui/react';
import { RentalUnitSummary } from '../types';

const STATUS_COLOR: Record<string, string> = {
  Available: 'green',
  'On Rental': 'orange',
  'In Demo': 'blue',
  'In Repair/Inspection': 'red',
  Retired: 'gray',
};

interface Props {
  units: RentalUnitSummary[];
  activeUnitId: string | null;
  addedUnitIds: string[];
  onSelect: (unit: RentalUnitSummary) => void;
}

export default function RentalCatalogPicker({ units, activeUnitId, addedUnitIds, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const selectedBg = useColorModeValue('green.50', 'green.900');
  const addedBg = useColorModeValue('gray.50', 'gray.700');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        (u.productFamily ?? '').toLowerCase().includes(q) ||
        (u.serialNumber ?? '').toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q),
    );
  }, [units, search]);

  return (
    <VStack align="stretch" spacing={3}>
      <Input
        placeholder="Search by product family or serial number…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="sm"
      />
      <Box maxH="480px" overflowY="auto" borderWidth="1px" borderRadius="md">
        <List spacing={0}>
          {filtered.map((u) => {
            const isActive = u._id === activeUnitId;
            const isAdded = addedUnitIds.includes(u._id);
            return (
              <ListItem
                key={u._id}
                px={3}
                py={2}
                cursor="pointer"
                bg={isActive ? selectedBg : isAdded ? addedBg : undefined}
                _hover={{ bg: isActive ? selectedBg : hoverBg }}
                borderBottomWidth="1px"
                onClick={() => onSelect(u)}
              >
                <HStack justify="space-between" align="start">
                  <Box>
                    <Text fontSize="sm" fontWeight="bold">
                      {u.productFamily || u.name}
                    </Text>
                    <Text fontSize="xs" color="subtleText">
                      {u.serialNumber ? `S/N ${u.serialNumber}` : u.name}
                    </Text>
                  </Box>
                  <HStack>
                    {isAdded && <Badge colorScheme="green" fontSize="2xs">Added</Badge>}
                    {u.status && (
                      <Badge colorScheme={STATUS_COLOR[u.status] || 'gray'} fontSize="2xs">
                        {u.status}
                      </Badge>
                    )}
                  </HStack>
                </HStack>
              </ListItem>
            );
          })}
          {filtered.length === 0 && (
            <Box p={4}>
              <Text color="subtleText" fontSize="sm">
                No fleet units match your search.
              </Text>
            </Box>
          )}
        </List>
      </Box>
    </VStack>
  );
}
