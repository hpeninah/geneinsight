import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  Tooltip,
  ActionIcon,
  ScrollArea,
} from '@mantine/core';
import { IconQuestionMark } from '@tabler/icons-react';
import { designCrisprGuides } from '../api';
import { Help } from './Help';

const EXAMPLE_SEQUENCE =
  'ATGCGTACGATCGTAGGCTAGCTAGGCTAGCTAGGATCGGATCGTAGCTAGGCTAGCTAAGG';

export function CrisprExplorer() {
  const [sequence, setSequence] = useState('');
  const [crisprResult, setCrisprResult] = useState(null);
  const [selectedGuideIndex, setSelectedGuideIndex] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanedSequence = useMemo(() => cleanSequence(sequence), [sequence]);
  const isTooShort = cleanedSequence.length > 0 && cleanedSequence.length < 23;

  async function handleDesignGuides() {
    if (!sequence.trim()) {
      setError('Please paste a DNA sequence.');
      return;
    }

    if (cleanedSequence.length < 23) {
      setError('Sequence must be at least 23 DNA bases long for a 20-base guide plus a 3-base PAM.');
      return;
    }

    setLoading(true);
    setError('');
    setCrisprResult(null);
    setSelectedGuideIndex(0);

    try {
      const data = await designCrisprGuides(sequence);
      setCrisprResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const guides = crisprResult?.guides || [];
  const selectedGuide = guides[selectedGuideIndex] || guides[0];

  return (
    <Card radius="xl" shadow="sm" p="lg" withBorder>
      <Stack gap="lg">
        <div>
          <Group gap="xs" align="center">
            <Title order={3}>CRISPR Guide Explorer</Title>

            <Tooltip
              multiline
              w={360}
              withArrow
              label="This tool scans a DNA sequence for possible SpCas9 guide RNAs. It looks for NGG PAM sites, extracts nearby 20-base guides, and scores them using simple quality checks."
            >
              <ActionIcon
                variant="light"
                color="brand"
                radius="xl"
                size="sm"
                aria-label="What does the CRISPR Guide Explorer do?"
              >
                <IconQuestionMark size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>

          <Text c="dimmed">
            Paste a DNA sequence to identify possible SpCas9 guide RNAs using NGG PAM detection.
          </Text>
        </div>

        <Alert color="yellow" title="Educational prototype">
          This tool is for learning and exploration only. It does not perform full genome-wide
          off-target analysis, machine-learning guide efficiency prediction, or wet-lab validation.
        </Alert>

        <Stack gap="xs">
          <Textarea
            label="DNA sequence"
            description="Only A, C, G, and T bases are used. Spaces, numbers, and line breaks are removed automatically."
            placeholder="Paste DNA sequence here..."
            value={sequence}
            onChange={(event) => {
              setSequence(event.currentTarget.value);
              setError('');
            }}
            minRows={6}
          />

          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Button onClick={handleDesignGuides} loading={loading}>
                Find Guides
              </Button>

              <Button
                variant="light"
                onClick={() => {
                  setSequence(EXAMPLE_SEQUENCE);
                  setError('');
                  setCrisprResult(null);
                  setSelectedGuideIndex(0);
                }}
              >
                Use example sequence
              </Button>

              <Button
                variant="subtle"
                color="gray"
                onClick={() => {
                  setSequence('');
                  setCrisprResult(null);
                  setSelectedGuideIndex(0);
                  setError('');
                }}
              >
                Clear
              </Button>
            </Group>

            <Badge color={isTooShort ? 'yellow' : cleanedSequence.length ? 'green' : 'gray'} variant="light">
              Clean length: {cleanedSequence.length} bp
            </Badge>
          </Group>

          {isTooShort && (
            <Alert color="yellow">
              Sequence must be at least 23 bases long for a 20-base guide plus a 3-base PAM.
            </Alert>
          )}
        </Stack>

        {error && <Alert color="red" title="CRISPR search error">{error}</Alert>}

        {crisprResult && (
          <Stack gap="lg">
            <CrisprSummary result={crisprResult} />

            {guides.length > 0 ? (
              <>
                <SequenceVisualization
                  sequence={sequence}
                  guide={selectedGuide}
                  selectedGuideIndex={selectedGuideIndex}
                />

                <GuideTable
                  guides={guides}
                  selectedGuideIndex={selectedGuideIndex}
                  onSelectGuide={setSelectedGuideIndex}
                />

                <Alert color="blue" title="How the score works">
                  Each guide starts with 10 points. Points are removed for GC content outside the
                  preferred range, TTTT motifs, homopolymer runs, or repeated targets in the input sequence.
                </Alert>
              </>
            ) : (
              <Alert color="gray" title="No guides found">
                No NGG PAM sites were found with enough upstream sequence to create a 20-base guide.
                Try a longer DNA sequence.
              </Alert>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function CrisprSummary({ result }) {
  const guides = result.guides || [];

  const bestScore = guides.length
    ? Math.max(...guides.map((guide) => guide.score))
    : 0;

  const averageGc = guides.length
    ? guides.reduce((sum, guide) => sum + guide.gc_percent, 0) / guides.length
    : 0;

  const forwardCount = guides.filter((guide) => guide.strand === '+').length;
  const reverseCount = guides.filter((guide) => guide.strand === '-').length;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
      <InfoTile label="Input length" value={`${result.input_length} bp`} />
      <InfoTile label="Guides found" value={result.guide_count} />
      <InfoTile label="Best score" value={guides.length ? bestScore : 'N/A'} />
      <InfoTile
        label="Average GC"
        value={guides.length ? `${averageGc.toFixed(1)}%` : 'N/A'}
        subtext={`${forwardCount} forward / ${reverseCount} reverse`}
      />
    </SimpleGrid>
  );
}

function SequenceVisualization({ sequence, guide, selectedGuideIndex }) {
  const cleanedSequence = cleanSequence(sequence);

  if (!guide || !guide.pam_position || !guide.cut_site) {
    return null;
  }

  const guideStart = guide.position - 1;
  const guideEnd = guideStart + 20;
  const pamStart = guide.pam_position - 1;
  const pamEnd = pamStart + 3;
  const cutIndex = guide.cut_site - 1;

  const pieces = [];

  for (let i = 0; i < cleanedSequence.length; i++) {
    if (i === cutIndex) {
      pieces.push(
        <span
          key={`cut-${i}`}
          style={{
            color: '#dc2626',
            fontWeight: 900,
            padding: '0 2px',
          }}
        >
          |
        </span>
      );
    }

    let style = {
      padding: '2px 1px',
      borderRadius: 3,
    };

    if (i >= guideStart && i < guideEnd) {
      style = {
        ...style,
        background: '#dbeafe',
        color: '#1e3a8a',
        fontWeight: 700,
      };
    } else if (i >= pamStart && i < pamEnd) {
      style = {
        ...style,
        background: '#fde68a',
        color: '#92400e',
        fontWeight: 800,
      };
    }

    pieces.push(
      <span key={`base-${i}`} style={style}>
        {cleanedSequence[i]}
      </span>
    );
  }

  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="xs">
        <Group justify="space-between">
          <div>
            <Text fw={700}>Selected Guide Visualization</Text>
            <Text size="sm" c="dimmed">
              Showing guide #{selectedGuideIndex + 1}. Blue = guide RNA, yellow = PAM,
              red line = approximate Cas9 cut site.
            </Text>
          </div>

          <Group gap="xs">
            <Badge color="blue" variant="light">Guide</Badge>
            <Badge color="yellow" variant="light">PAM</Badge>
            <Badge color="red" variant="light">Cut site</Badge>
          </Group>
        </Group>

        <ScrollArea type="auto">
          <div
            style={{
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              lineHeight: 2,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 12,
            }}
          >
            {pieces}
          </div>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

function GuideTable({ guides, selectedGuideIndex, onSelectGuide }) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <div>
            <Text fw={700}>Guide Candidates</Text>
            <Text size="sm" c="dimmed">
              Click a row to highlight that guide on the sequence above.
            </Text>
          </div>

          <Badge variant="light" color="blue">
            Showing {guides.length} guides
          </Badge>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Guide <Help text="The 20-base guide RNA candidate that directs Cas9 to the target DNA sequence." /></Table.Th>
                <Table.Th>PAM <Help text="The short DNA motif required for Cas9 binding. For SpCas9, this is usually NGG." /></Table.Th>
                <Table.Th>Position <Help text="The starting position of the guide sequence within the input DNA." /></Table.Th>
                <Table.Th>Cut Site <Help text="Approximate location where Cas9 cuts the DNA, usually about 3 bases before the PAM." /></Table.Th>
                <Table.Th>Strand <Help text="Indicates whether the guide was found on the forward (+) or reverse (-) DNA strand." /></Table.Th>
                <Table.Th>GC% <Help text="The percentage of G and C bases in the guide. A moderate range around 40–60% is usually preferred." /></Table.Th>
                <Table.Th>Score <Help text="A simple heuristic score based on guide quality features such as GC content and sequence patterns." /></Table.Th>
                <Table.Th>Notes <Help text="Brief explanation of why the guide received its score or any potential concerns." /></Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {guides.map((guide, index) => {
                const isSelected = index === selectedGuideIndex;

                return (
                  <Table.Tr
                    key={`${guide.guide}-${guide.position}-${guide.strand}`}
                    onClick={() => onSelectGuide(index)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#eef4f8' : undefined,
                    }}
                  >
                    <Table.Td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {guide.guide}
                    </Table.Td>

                    <Table.Td style={{ fontFamily: 'monospace' }}>
                      <Badge color="yellow" variant="light">
                        {guide.pam}
                      </Badge>
                    </Table.Td>

                    <Table.Td>{guide.position}</Table.Td>
                    <Table.Td>{guide.cut_site}</Table.Td>

                    <Table.Td>
                      <Badge color={guide.strand === '+' ? 'violet' : 'orange'} variant="light">
                        {guide.strand}
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Badge
                        color={
                          guide.gc_percent >= 40 && guide.gc_percent <= 60
                            ? 'green'
                            : 'yellow'
                        }
                        variant="light"
                      >
                        {guide.gc_percent}% GC
                      </Badge>
                    </Table.Td>

                    <Table.Td>
                      <Badge color={getScoreColor(guide.score)}>
                        {guide.score}
                      </Badge>
                    </Table.Td>

                    <Table.Td>{guide.notes}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Paper>
  );
}

function InfoTile({ label, value, subtext }) {
  return (
    <Paper p="md" radius="md" withBorder>
      <Text size="sm" c="dimmed" fw={700} tt="uppercase">
        {label}
      </Text>
      <Text fw={800} size="xl">
        {value}
      </Text>
      {subtext && (
        <Text size="sm" c="dimmed">
          {subtext}
        </Text>
      )}
    </Paper>
  );
}

function cleanSequence(sequence) {
  return sequence.toUpperCase().replace(/[^ACGT]/g, '');
}

function getScoreColor(score) {
  if (score >= 8) return 'green';
  if (score >= 5) return 'yellow';
  return 'red';
}