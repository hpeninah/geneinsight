import { useState } from 'react';
import {
  Badge,
  Card,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  SegmentedControl,
  ActionIcon,
  ScrollArea, 
  Table
} from '@mantine/core';
import { IconQuestionMark } from '@tabler/icons-react';

export function GeneStructureViewer({ geneStructure }) {
  const transcripts = geneStructure?.transcripts || [];
  const defaultTranscript = geneStructure?.selected_transcript || null;

  const [selectedTranscriptId, setSelectedTranscriptId] = useState(
    defaultTranscript?.transcript_id || ''
  );

  if (!geneStructure || !defaultTranscript) {
    return (
      <Card radius="xl" shadow="sm" p="lg" withBorder>
        <Title order={3}>Gene Structure Viewer</Title>
        <Text c="dimmed">No gene structure data found.</Text>
      </Card>
    );
  }

  const selectedTranscript =
    transcripts.find(
      (transcript) => transcript.transcript_id === selectedTranscriptId
    ) || defaultTranscript;

  return (
    <Card radius="xl" shadow="sm" p="lg" withBorder>
      <Stack gap="md">
        <Title order={3}>Gene Structure Viewer</Title>
      <Stack gap={4}>
        <Group gap="xs" align="center">
          <Text fw={800} size="md">
            Choose transcript isoform
          </Text>

          <Tooltip
            multiline
            w={320}
            withArrow
            position="right"
            label="A gene can produce different transcript isoforms through alternative splicing. Each transcript may include a different combination of exons, which can affect the final RNA or protein product."
          >
            <ActionIcon
              variant="light"
              color="brand"
              radius="xl"
              size="sm"
              aria-label="What is a transcript isoform?"
            >
              <IconQuestionMark size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text size="sm" c="dimmed">
          Each option is a different transcript version of the same gene.
        </Text>

        <Select
          value={selectedTranscriptId}
          onChange={(value) => setSelectedTranscriptId(value || '')}
          data={transcripts.map((transcript) => ({
            value: transcript.transcript_id,
            label: `${transcript.transcript_id} • ${transcript.biotype} • ${transcript.exon_count} exons`,
          }))}
        />
        </Stack>

        <TranscriptViewer transcript={selectedTranscript} />
      </Stack>
    </Card>
  );
}

function TranscriptViewer({ transcript }) {
  const [viewMode, setViewMode] = useState('schematic');

  if (!transcript) return null;

  const strandLabel = transcript.strand === -1 ? 'Reverse (-)' : 'Forward (+)';
  const directionArrow = transcript.strand === -1 ? '←' : '→';

  const exonLengths = transcript.exons.map((exon) => exon.length);
  const longestExon = Math.max(...exonLengths);
  const shortestExon = Math.min(...exonLengths);
  const totalExonBases = exonLengths.reduce((sum, length) => sum + length, 0);

  const percentCodingOrExonic = transcript.length
    ? ((totalExonBases / transcript.length) * 100).toFixed(1)
    : '0.0';

  return (
    <Stack gap="lg">      
      <Paper p="md" radius="md" withBorder>
        <Stack gap="xs">
          <Group justify="space-between" align="end">
            <div>
              <Title order={4}>Exon Map</Title>
              <Text size="sm" c="dimmed">
                {viewMode === 'genomic'
                  ? 'Genomic scale view: exon spacing reflects real transcript coordinates, so nearby exons may appear crowded.'
                  : 'Schematic view: exons are spaced more evenly to make the structure easier to read.'}
              </Text>
            </div>

            <Group gap="sm">
              <SegmentedControl
                value={viewMode}
                onChange={setViewMode}
                data={[
                  { label: 'Schematic', value: 'schematic' },
                  { label: 'Genomic', value: 'genomic' },
                ]}
                size="sm"
              />

              <Badge color={directionArrow === '←' ? 'orange' : 'violet'}>
                Direction {directionArrow}
              </Badge>
            </Group>
          </Group>

          {viewMode === 'schematic' ? (
            <SchematicExonMap transcript={transcript} />
          ) : (
            <GenomicExonMap transcript={transcript} />
          )}

          <Group>
            <Badge color="blue">Exons</Badge>
            <Badge color="gray">Introns / spacing</Badge>
            <Badge color={directionArrow === '←' ? 'orange' : 'violet'}>
              Direction {directionArrow}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="xs">
          <Text fw={700}>Structure Summary</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <InfoTile label="Transcript ID" value={transcript.transcript_id} />
            <InfoTile label="Biotype" value={transcript.biotype} />
            <InfoTile label="Strand" value={`${strandLabel} ${directionArrow}`} />
            <InfoTile label="Exons" value={transcript.exon_count} />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            <InfoTile label="Transcript length" value={`${transcript.length} bp`} />
            <InfoTile label="Total exon bases" value={`${totalExonBases} bp`} />
            <InfoTile label="Longest exon" value={`${longestExon} bp`} />
            <InfoTile label="Shortest exon" value={`${shortestExon} bp`} />
          </SimpleGrid>

          <Text size="sm" c="dimmed">
            Exons make up about {percentCodingOrExonic}% of this transcript’s
            genomic span in this viewer.
          </Text>
        </Stack>
      </Paper>

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <Group justify="space-between">
            <div>
              <Text fw={700}>Exon Details</Text>
              <Text size="sm" c="dimmed">
                Exact exon coordinates and lengths for the selected transcript.
              </Text>
            </div>

            <Badge variant="light" color="blue">
              {transcript.exon_count} exons
            </Badge>
          </Group>

          <ScrollArea h={260} type="auto">
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Exon</Table.Th>
                  <Table.Th>Start</Table.Th>
                  <Table.Th>End</Table.Th>
                  <Table.Th>Length</Table.Th>
                  <Table.Th>Relative position</Table.Th>
                </Table.Tr>
              </Table.Thead>

              <Table.Tbody>
                {transcript.exons.map((exon) => {
                  const relativePercent = transcript.length
                    ? ((exon.relative_start / transcript.length) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <Table.Tr key={`${exon.start}-${exon.end}`}>
                      <Table.Td>
                        <Badge color="blue" variant="light">
                          {exon.number}
                        </Badge>
                      </Table.Td>

                      <Table.Td>{exon.start.toLocaleString()}</Table.Td>
                      <Table.Td>{exon.end.toLocaleString()}</Table.Td>
                      <Table.Td>{exon.length.toLocaleString()} bp</Table.Td>
                      <Table.Td>{relativePercent}%</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Paper>
    </Stack>
  );
}

function SchematicExonMap({ transcript }) {
  const exons = transcript.exons;
  const exonCount = exons.length;
  const slotWidth = 100 / exonCount;

  return (
    <div
      style={{
        position: 'relative',
        height: 88,
        background: '#eef4f8',
        borderRadius: 12,
        border: '1px solid #dce9f1',
        padding: '10px 8px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 42,
          left: 12,
          right: 12,
          height: 4,
          background: '#95afba',
          borderRadius: 999,
        }}
      />

      {exons.map((exon, index) => {
        const left = index * slotWidth + slotWidth * 0.15;
        const widthFromLength = Math.min(Math.max(exon.length / 40, 6), slotWidth * 0.7);

        return (
          <Tooltip
            key={`${exon.start}-${exon.end}`}
            label={`Exon ${exon.number}: ${exon.start}-${exon.end}, ${exon.length} bp`}
          >
            <div
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${widthFromLength}%`,
                top: index % 2 === 0 ? 18 : 34,
                height: 24,
                background: '#3f7cac',
                borderRadius: 7,
                color: 'white',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
              }}
            >
              {exon.number}
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

function GenomicExonMap({ transcript }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 88,
        background: '#eef4f8',
        borderRadius: 12,
        border: '1px solid #dce9f1',
        padding: '10px 8px',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 42,
          left: 12,
          right: 12,
          height: 4,
          background: '#95afba',
          borderRadius: 999,
        }}
      />

      {transcript.exons.map((exon, index) => {
        const left = (exon.relative_start / transcript.length) * 100;
        const width =
          ((exon.relative_end - exon.relative_start + 1) / transcript.length) * 100;

        return (
          <Tooltip
            key={`${exon.start}-${exon.end}`}
            label={`Exon ${exon.number}: ${exon.start}-${exon.end}, ${exon.length} bp`}
          >
            <div
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${Math.max(width, 1.1)}%`,
                top: index % 2 === 0 ? 18 : 34,
                height: 24,
                background: '#3f7cac',
                borderRadius: 7,
                color: 'white',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
              }}
            >
              {exon.number}
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <Paper p="sm" radius="md" withBorder>
      <Text size="xs" c="dimmed" fw={700} tt="uppercase">
        {label}
      </Text>
      <Text fw={700}>{value || 'N/A'}</Text>
    </Paper>
  );
}