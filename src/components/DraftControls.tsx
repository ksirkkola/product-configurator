import { useState } from 'react';
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import { HailerApi } from '@hailer/app-sdk';
import { OPPORTUNITY } from '../constants/schema';
import { listAll } from '../hailer/api-helpers';
import { DraftPayload, parseDraft } from '../draft';
import { formatHailerError } from '../hailerError';

interface DraftRow {
  _id: string;
  name: string;
  updated: number;
  phase: string;
}

interface Props {
  hailer: HailerApi;
  saving: boolean;
  hasDraftActivity: boolean;
  onSave: () => void;
  onResume: (draft: DraftPayload, activityId: string) => void;
}

// Save Draft / Resume Draft — quotes-in-progress are saved as an Opportunity
// holding a JSON blob (see draft.ts). "Save quote to Opportunity" in QuoteView moves that same
// opportunity to Proposal and keeps the blob, so a quote stays resumable from any open phase
// (Discovery, Proposal, Negotiations, Budgetary Review) until it is closed.
export default function DraftControls({ hailer, saving, hasDraftActivity, onSave, onResume }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  async function openPicker() {
    setIsOpen(true);
    setLoading(true);
    setError(null);
    try {
      const perPhase = await Promise.all(
        OPPORTUNITY.openPhases.map(async (p) =>
          (await listAll(hailer, OPPORTUNITY.workflowId, p.id)).map((a) => ({ a, phase: p.label })),
        ),
      );
      const rows = perPhase
        .flat()
        .filter(({ a }) => {
          const raw = a.fields?.[OPPORTUNITY.fields.configuratorDraftJson];
          return typeof raw === 'string' && raw.trim().length > 0;
        })
        .map(({ a, phase }) => ({ _id: a._id, name: a.name, updated: a.updated ?? a.created, phase }))
        .sort((a, b) => b.updated - a.updated);
      setDrafts(rows);
    } catch (err) {
      setError(formatHailerError(err));
    } finally {
      setLoading(false);
    }
  }

  async function selectDraft(id: string) {
    setLoading(true);
    setError(null);
    try {
      const activity = await hailer.activity.get(id);
      const raw = activity?.fields?.[OPPORTUNITY.fields.configuratorDraftJson];
      const parsed = parseDraft(raw);
      if (!parsed) {
        throw new Error('This draft could not be read (corrupted, empty, or from an incompatible version).');
      }
      onResume(parsed, id);
      setIsOpen(false);
    } catch (err) {
      setError(formatHailerError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <HStack spacing={2}>
        <Button size="sm" variant="outline" onClick={openPicker}>
          Resume Draft
        </Button>
        <Button size="sm" colorScheme="blue" onClick={onSave} isLoading={saving}>
          {hasDraftActivity ? 'Update Draft' : 'Save Draft'}
        </Button>
      </HStack>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Resume a saved draft</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {error && (
              <Alert status="error" fontSize="sm" borderRadius="md" mb={3}>
                <AlertIcon />
                {error}
              </Alert>
            )}
            {loading ? (
              <HStack justify="center" py={6}>
                <Spinner size="sm" />
                <Text color="subtleText">Loading…</Text>
              </HStack>
            ) : drafts.length === 0 ? (
              <Text color="subtleText" fontSize="sm" py={4}>
                No saved quotes yet. (Quotes whose opportunity is Closed - Won or Closed - Lost are locked and not listed.)
              </Text>
            ) : (
              <VStack align="stretch" spacing={1} maxH="60vh" overflowY="auto">
                {drafts.map((d) => (
                  <Box
                    key={d._id}
                    p={2}
                    borderWidth="1px"
                    borderRadius="md"
                    cursor="pointer"
                    _hover={{ bg: 'blackAlpha.50' }}
                    onClick={() => selectDraft(d._id)}
                  >
                    <Text fontSize="sm" fontWeight="medium">
                      {d.name}
                    </Text>
                    <Text fontSize="xs" color="subtleText">
                      {d.phase} · Saved {new Date(d.updated).toLocaleString()}
                    </Text>
                  </Box>
                ))}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button size="sm" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
