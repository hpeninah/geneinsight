import { useState } from 'react';
import { Badge, Card, Group, Paper, Select, Stack, Text, Title, Tooltip } from '@mantine/core';

export function GeneStructureViewer({ geneStructure }) {
  const transcripts = geneStructure?.transcripts || [];
  const defaultTranscript = geneStructure?.selected_transcript || null;
  const [selectedTranscriptId, setSelectedTranscriptId] = useState(defaultTranscript?.transcript_id || '');

  if (!geneStructure || !defaultTranscript) {
    return (
      <Card radius="lg" shadow="xs" p="md">
        <Title order={3}>Gene Structure Viewer</Title>
        <Text c="dimmed">No gene structure data found.</Text>
      </Card>
    );
  }

  const selectedTranscript =
    transcripts.find((transcript) => transcript.transcript_id === selectedTranscriptId) ||
    defaultTranscript;

  return (
    <Card radius="lg" shadow="xs" p="md">
      <Stack>
        <Title order={3}>Gene Structure Viewer</Title>
        <Text c="dimmed">
          Exons are shown as blue blocks. Introns are represented by the gray connecting line.
        </Text>

        <Select
          label="Choose transcript"
          value={selectedTranscriptId}
          onChange={setSelectedTranscriptId}
          data={transcripts.map((transcript) => ({
            value: transcript.transcript_id,
            label: `${transcript.transcript_id} • ${transcript.biotype} • ${transcript.exon_count} exons`
          }))}
        />

        <TranscriptViewer transcript={selectedTranscript} />
      </Stack>
    </Card>
  );
}

function TranscriptViewer({ transcript }) {
  if (!transcript) return null;

  const strandLabel = transcript.strand === -1 ? 'Reverse (-)' : 'Forward (+)';
  const directionArrow = transcript.strand === -1 ? '←' : '→';
  const exonLengths = transcript.exons.map((exon) => exon.length);
  const longestExon = Math.max(...exonLengths);
  const shortestExon = Math.min(...exonLengths);

  return (
    <Stack>
      <div>
        <Text><strong>Transcript ID:</strong> {transcript.transcript_id}</Text>
        <Text><strong>Biotype:</strong> {transcript.biotype}</Text>
        <Text><strong>Strand:</strong> {strandLabel} {directionArrow}</Text>
        <Text><strong>Exons:</strong> {transcript.exon_count}</Text>
        <Text><strong>Transcript length:</strong> {transcript.length} bp</Text>
      </div>

      <div style={{ position: 'relative', height: 48, background: '#e5e7eb', borderRadius: 10 }}>
        <div
          style={{
            position: 'absolute',
            top: 22,
            left: 0,
            width: '100%',
            height: 4,
            background: '#9ca3af'
          }}
        />

        {transcript.exons.map((exon) => {
          const left = (exon.relative_start / transcript.length) * 100;
          const width = ((exon.relative_end - exon.relative_start + 1) / transcript.length) * 100;

          return (
            <Tooltip
              key={`${exon.start}-${exon.end}`}
              label={`Exon ${exon.number}: ${exon.start}-${exon.end}, ${exon.length} bp`}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${Math.max(width, 0.8)}%`,
                  top: 8,
                  height: 28,
                  background: '#2563eb',
                  borderRadius: 6,
                  color: 'white',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}
              >
                {exon.number}
              </div>
            </Tooltip>
          );
        })}
      </div>

      <Group>
        <Badge color="blue">Exons</Badge>
        <Badge color="gray">Introns</Badge>
        <Badge color="violet">Direction {directionArrow}</Badge>
      </Group>

      <Paper p="md" radius="md" withBorder>
        <Text fw={700}>Structure Summary</Text>
        <Text c="dimmed">Longest exon: {longestExon} bp</Text>
        <Text c="dimmed">Shortest exon: {shortestExon} bp</Text>
      </Paper>
    </Stack>
  );
}