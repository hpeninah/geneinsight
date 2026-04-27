import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title
} from '@mantine/core';
import { fetchGeneReport } from '../api';

export function CompareGenes() {
  const [geneA, setGeneA] = useState('TP53');
  const [geneB, setGeneB] = useState('BRCA1');
  const [reportA, setReportA] = useState(null);
  const [reportB, setReportB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCompare() {
    if (!geneA.trim() || !geneB.trim()) {
      setError('Please enter two gene symbols.');
      return;
    }

    setLoading(true);
    setError('');
    setReportA(null);
    setReportB(null);

    try {
      const [dataA, dataB] = await Promise.all([
        fetchGeneReport(geneA.trim()),
        fetchGeneReport(geneB.trim())
      ]);

      setReportA(dataA);
      setReportB(dataB);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card radius="lg" shadow="xs" p="md">
      <Stack>
        <Title order={3}>Compare Genes</Title>

        <Text c="dimmed">
          Compare two genes side-by-side using gene summaries, literature count,
          AlphaFold availability, and transcript structure data.
        </Text>

        <Group align="end">
          <TextInput
            label="Gene A"
            placeholder="TP53"
            value={geneA}
            onChange={(event) => setGeneA(event.currentTarget.value)}
            style={{ flex: 1 }}
          />

          <TextInput
            label="Gene B"
            placeholder="BRCA1"
            value={geneB}
            onChange={(event) => setGeneB(event.currentTarget.value)}
            style={{ flex: 1 }}
          />

          <Button onClick={handleCompare} loading={loading}>
            Compare
          </Button>
        </Group>

        {error && (
          <Alert color="red" title="Comparison Error">
            {error}
          </Alert>
        )}

        {reportA && reportB && (
          <GeneComparisonTable reportA={reportA} reportB={reportB} />
        )}
      </Stack>
    </Card>
  );
}

function GeneComparisonTable({ reportA, reportB }) {
  const geneA = reportA.gene;
  const geneB = reportB.gene;

  const structureA = reportA.gene_structure?.selected_transcript;
  const structureB = reportB.gene_structure?.selected_transcript;

  const rows = [
    { label: 'Gene symbol', a: geneA.symbol, b: geneB.symbol },
    { label: 'Full name', a: geneA.name, b: geneB.name },
    { label: 'Entrez ID', a: geneA.entrezgene, b: geneB.entrezgene },
    { label: 'PubMed papers found', a: reportA.papers?.length || 0, b: reportB.papers?.length || 0 },
    { label: 'AlphaFold accession', a: reportA.alphafold?.accession || 'Not found', b: reportB.alphafold?.accession || 'Not found' },
    { label: 'Selected transcript', a: structureA?.transcript_id || 'Not found', b: structureB?.transcript_id || 'Not found' },
    { label: 'Transcript biotype', a: structureA?.biotype || 'Not found', b: structureB?.biotype || 'Not found' },
    { label: 'Exon count', a: structureA?.exon_count ?? 'Not found', b: structureB?.exon_count ?? 'Not found' },
    {
      label: 'Transcript length',
      a: structureA?.length ? `${structureA.length} bp` : 'Not found',
      b: structureB?.length ? `${structureB.length} bp` : 'Not found'
    }
  ];

  return (
    <Table striped highlightOnHover withTableBorder>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Feature</Table.Th>
          <Table.Th>{geneA.symbol}</Table.Th>
          <Table.Th>{geneB.symbol}</Table.Th>
        </Table.Tr>
      </Table.Thead>

      <Table.Tbody>
        {rows.map((row) => (
          <Table.Tr key={row.label}>
            <Table.Td fw={700}>{row.label}</Table.Td>
            <Table.Td>{row.a}</Table.Td>
            <Table.Td>{row.b}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}