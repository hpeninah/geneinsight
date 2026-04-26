import { useState } from 'react';
import {
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
  Alert,
  Select
} from '@mantine/core';
import { fetchGeneReport, designCrisprGuides } from './api';

function App() {
  const [gene, setGene] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  async function handleSearch(symbolOverride) {
    const searchGene = (symbolOverride || gene).trim();

    if (!searchGene) {
      setStatusError('Please enter a gene symbol.');
      return;
    }

    setGene(searchGene);
    setLoading(true);
    setStatusError('');
    setReport(null);

    try {
      const data = await fetchGeneReport(searchGene);
      setReport(data);
    } catch (error) {
      setStatusError(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell padding="md">
      <Container size="lg">
        <Stack gap="md">
          <div>
            <Title order={1}>GeneInsight Lite</Title>
            <Text c="dimmed">
              A bioinformatics dashboard for gene reports, literature, protein structure,
              gene structure, and CRISPR guide exploration.
            </Text>
          </div>

          <Paper p="md" radius="lg" shadow="xs">
            <Group align="end">
              <TextInput
                label="Gene symbol"
                placeholder="Try TP53, BRCA1, EGFR..."
                value={gene}
                onChange={(event) => setGene(event.currentTarget.value)}
                style={{ flex: 1 }}
              />
              <Button onClick={() => handleSearch()}>Generate Report</Button>
            </Group>

            <Group mt="sm" gap="xs">
              <Text size="sm" c="dimmed">Try:</Text>
              {['TP53', 'BRCA1', 'EGFR', 'CFTR'].map((example) => (
                <Button
                  key={example}
                  size="xs"
                  variant="light"
                  onClick={() => handleSearch(example)}
                >
                  {example}
                </Button>
              ))}
            </Group>
          </Paper>

          {loading && (
            <Card radius="lg" shadow="xs" p="md">
              <Group>
                <Loader size="sm" />
                <Text>Loading GeneInsight report...</Text>
              </Group>
              <Text size="sm" c="dimmed" mt="xs">
                Fetching gene summary, literature, AlphaFold structure, and Ensembl transcript data.
              </Text>
            </Card>
          )}

          {statusError && (
            <Alert color="red" title="Error">
              {statusError}
            </Alert>
          )}

          {report && <GeneDashboard report={report} />}
        </Stack>
      </Container>
    </AppShell>
  );
}

function GeneDashboard({ report }) {
  const geneData = report.gene;
  const papers = report.papers || [];
  const alphafold = report.alphafold;
  const geneStructure = report.gene_structure;

  return (
    <Tabs defaultValue="overview">
      <Tabs.List>
        <Tabs.Tab value="overview">Overview</Tabs.Tab>
        <Tabs.Tab value="literature">Literature</Tabs.Tab>
        <Tabs.Tab value="protein">Protein Structure</Tabs.Tab>
        <Tabs.Tab value="gene-structure">Gene Structure</Tabs.Tab>
        <Tabs.Tab value="crispr">CRISPR Explorer</Tabs.Tab>
        <Tabs.Tab value="compare">Compare Genes</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="overview" pt="md">
        <GeneOverview geneData={geneData} alphafold={alphafold} geneStructure={geneStructure} papers={papers} />
      </Tabs.Panel>

      <Tabs.Panel value="literature" pt="md">
        <LiteraturePanel papers={papers} />
      </Tabs.Panel>

      <Tabs.Panel value="protein" pt="md">
        <ProteinStructure alphafold={alphafold} />
      </Tabs.Panel>

      <Tabs.Panel value="gene-structure" pt="md">
        <GeneStructureViewer geneStructure={geneStructure} />
      </Tabs.Panel>

      <Tabs.Panel value="crispr" pt="md">
        <CrisprExplorer />
      </Tabs.Panel>

      <Tabs.Panel value="compare" pt="md">
        <CompareGenes />
      </Tabs.Panel>
    </Tabs>
  );
}

function GeneOverview({ geneData, alphafold, geneStructure, papers }) {
  return (
    <Card radius="lg" shadow="xs" p="md">
      <Stack>
        <div>
          <Title order={2}>{geneData.symbol}</Title>
          <Text fw={600}>{geneData.name}</Text>
          <Text c="dimmed">Entrez ID: {geneData.entrezgene}</Text>
        </div>

        <Group>
          <Badge color="blue">Papers: {papers.length}</Badge>
          <Badge color={alphafold ? 'green' : 'gray'}>
            {alphafold ? 'AlphaFold found' : 'No AlphaFold'}
          </Badge>
          <Badge color={geneStructure ? 'violet' : 'gray'}>
            {geneStructure?.selected_transcript?.exon_count
              ? `${geneStructure.selected_transcript.exon_count} exons`
              : 'No gene structure'}
          </Badge>
        </Group>

        <Text>{geneData.summary}</Text>
      </Stack>
    </Card>
  );
}

function LiteraturePanel({ papers }) {
  const [keyword, setKeyword] = useState('');

  const scoredPapers = [...papers].sort((a, b) => {
    return scorePaper(b, keyword).score - scorePaper(a, keyword).score;
  });

  return (
    <Card radius="lg" shadow="xs" p="md">
      <Stack>
        <Title order={3}>Recent Related Papers</Title>
        <Text c="dimmed">
          Use the relevance helper to prioritize papers by a topic.
        </Text>

        <TextInput
          label="Relevance keyword"
          placeholder="Try cancer, apoptosis, mutation, therapy..."
          value={keyword}
          onChange={(event) => setKeyword(event.currentTarget.value)}
        />

        {scoredPapers.length === 0 ? (
          <Text c="dimmed">No papers found.</Text>
        ) : (
          scoredPapers.map((paper) => {
            const relevance = keyword ? scorePaper(paper, keyword) : null;

            return (
              <Paper key={paper.pmid || paper.title} p="md" radius="md" withBorder>
                <Stack gap="xs">
                  <Text fw={700}>
                    {paper.url ? (
                      <a href={paper.url} target="_blank" rel="noreferrer">
                        {paper.title}
                      </a>
                    ) : (
                      paper.title
                    )}
                  </Text>

                  <Text size="sm" c="dimmed">
                    {paper.journal} • {paper.year}
                  </Text>

                  {relevance && (
                    <Group>
                      <Badge color={relevance.label === 'High' ? 'green' : relevance.label === 'Medium' ? 'yellow' : 'red'}>
                        {relevance.label} relevance
                      </Badge>
                      <Text size="sm" c="dimmed">
                        Score: {relevance.score}
                      </Text>
                    </Group>
                  )}

                  <Text>{paper.abstract}</Text>
                </Stack>
              </Paper>
            );
          })
        )}
      </Stack>
    </Card>
  );
}

function scorePaper(paper, keywordInput) {
  if (!keywordInput.trim()) {
    return { score: 0, label: 'Low' };
  }

  const keywords = keywordInput
    .toLowerCase()
    .split(',')
    .map((word) => word.trim())
    .filter(Boolean);

  const title = (paper.title || '').toLowerCase();
  const abstract = (paper.abstract || '').toLowerCase();
  const journal = (paper.journal || '').toLowerCase();

  let score = 0;

  keywords.forEach((keyword) => {
    if (title.includes(keyword)) score += 5;
    if (abstract.includes(keyword)) score += 3;
    if (journal.includes(keyword)) score += 1;
  });

  let label = 'Low';
  if (score >= 8) label = 'High';
  else if (score >= 3) label = 'Medium';

  return { score, label };
}

function ProteinStructure({ alphafold }) {
  if (!alphafold) {
    return (
      <Card radius="lg" shadow="xs" p="md">
        <Title order={3}>AlphaFold Structure</Title>
        <Text c="dimmed">No AlphaFold entry found for this gene.</Text>
      </Card>
    );
  }

  return (
    <Card radius="lg" shadow="xs" p="md">
      <Stack>
        <Title order={3}>AlphaFold Structure</Title>
        <Text>
          <strong>UniProt accession:</strong> {alphafold.accession}
        </Text>
        <Text>
          <a href={alphafold.alphafold_entry_url} target="_blank" rel="noreferrer">
            Open AlphaFold page
          </a>
        </Text>

        <iframe
          src={alphafold.molstar_embed_url}
          width="100%"
          height="550"
          style={{ border: '1px solid #e5e7eb', borderRadius: 12 }}
          title="AlphaFold 3D Viewer"
          loading="lazy"
        />
      </Stack>
    </Card>
  );
}

function GeneStructureViewer({ geneStructure }) {
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

function CrisprExplorer() {
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
    <Card radius="lg" shadow="xs" p="md">
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

function Help({ text }) {
  return (
    <Tooltip label={text} multiline w={260}>
      <Badge size="xs" variant="light" style={{ cursor: 'help' }}>
        ?
      </Badge>
    </Tooltip>
  );
}

function CompareGenes() {
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
    {
      label: 'Gene symbol',
      a: geneA.symbol,
      b: geneB.symbol
    },
    {
      label: 'Full name',
      a: geneA.name,
      b: geneB.name
    },
    {
      label: 'Entrez ID',
      a: geneA.entrezgene,
      b: geneB.entrezgene
    },
    {
      label: 'PubMed papers found',
      a: reportA.papers?.length || 0,
      b: reportB.papers?.length || 0
    },
    {
      label: 'AlphaFold accession',
      a: reportA.alphafold?.accession || 'Not found',
      b: reportB.alphafold?.accession || 'Not found'
    },
    {
      label: 'Selected transcript',
      a: structureA?.transcript_id || 'Not found',
      b: structureB?.transcript_id || 'Not found'
    },
    {
      label: 'Transcript biotype',
      a: structureA?.biotype || 'Not found',
      b: structureB?.biotype || 'Not found'
    },
    {
      label: 'Exon count',
      a: structureA?.exon_count ?? 'Not found',
      b: structureB?.exon_count ?? 'Not found'
    },
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

export default App;