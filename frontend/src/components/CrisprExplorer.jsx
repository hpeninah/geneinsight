import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Textarea,
  Title
} from '@mantine/core';
import { designCrisprGuides } from '../api';
import { Help } from './Help';

export function CrisprExplorer() {
  const [sequence, setSequence] = useState('');
  const [crisprResult, setCrisprResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDesignGuides() {
    if (!sequence.trim()) {
      setError('Please paste a DNA sequence.');
      return;
    }

    setLoading(true);
    setError('');
    setCrisprResult(null);

    try {
      const data = await designCrisprGuides(sequence);
      setCrisprResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card radius="xl" shadow="sm" p="lg" withBorder>
      <Stack>
        <Title order={3}>CRISPR Guide Explorer</Title>
        <Text c="dimmed">
          Paste a DNA sequence to identify possible SpCas9 guide RNAs using NGG PAM detection.
        </Text>

        <Textarea
          label="DNA sequence"
          placeholder="Paste DNA sequence here..."
          value={sequence}
          onChange={(event) => setSequence(event.currentTarget.value)}
          minRows={6}
        />

        <Group>
          <Button onClick={handleDesignGuides} loading={loading}>
            Find Guides
          </Button>
        </Group>

        {error && <Alert color="red">{error}</Alert>}

        {crisprResult && (
          <Stack>
            <Text><strong>Input length:</strong> {crisprResult.input_length} bp</Text>
            <Text><strong>Guides found:</strong> {crisprResult.guide_count}</Text>

            {crisprResult.guides.length > 0 && (
              <>
                <SequenceVisualization sequence={sequence} guide={crisprResult.guides[0]} />
                <GuideTable guides={crisprResult.guides} />
              </>
            )}

            <Text size="sm" c="dimmed">
              Scores are heuristic and based on GC content, repeat detection, and simple sequence quality checks.
            </Text>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

function SequenceVisualization({ sequence, guide }) {
  const cleanedSequence = sequence.toUpperCase().replace(/[^ACGT]/g, '');

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
        <span key={`cut-${i}`} style={{ color: '#dc2626', fontWeight: 'bold' }}>
          |
        </span>
      );
    }

    let style = {};

    if (i >= guideStart && i < guideEnd) {
      style = { background: '#dbeafe' };
    } else if (i >= pamStart && i < pamEnd) {
      style = { background: '#fde68a', fontWeight: 'bold' };
    }

    pieces.push(
      <span key={`base-${i}`} style={style}>
        {cleanedSequence[i]}
      </span>
    );
  }

  return (
    <Paper p="md" radius="md" withBorder>
      <Text fw={700}>Top Guide Visualization</Text>
      <Text size="sm" c="dimmed">
        Blue = guide RNA, Yellow = PAM, Red line = approximate Cas9 cut site.
      </Text>
      <div style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflowX: 'auto', lineHeight: 1.8 }}>
        {pieces}
      </div>
    </Paper>
  );
}

function GuideTable({ guides }) {
  return (
    <Table striped highlightOnHover withTableBorder>
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
        {guides.map((guide) => (
          <Table.Tr key={`${guide.guide}-${guide.position}-${guide.strand}`}>
            <Table.Td style={{ fontFamily: 'monospace' }}>{guide.guide}</Table.Td>
            <Table.Td style={{ fontFamily: 'monospace' }}>{guide.pam}</Table.Td>
            <Table.Td>{guide.position}</Table.Td>
            <Table.Td>{guide.cut_site}</Table.Td>
            <Table.Td>{guide.strand}</Table.Td>
            <Table.Td>{guide.gc_percent}</Table.Td>
            <Table.Td>{guide.score}</Table.Td>
            <Table.Td>{guide.notes}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}