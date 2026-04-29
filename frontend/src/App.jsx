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
  Text,
  TextInput,
  Title,
  Alert,
} from '@mantine/core';
import { fetchGeneReport } from './api';
import { GeneDashboard } from './components/GeneDashboard';

const exampleGenes = ['TP53', 'BRCA1', 'EGFR', 'CFTR'];

function App() {
  const [gene, setGene] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState('');

  const hasReport = Boolean(report);

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

  function handleGoHome() {
    setReport(null);
    setStatusError('');
    setLoading(false);
    setGene('');
  }

  return (
    <AppShell>
      <AppShell.Header
        withBorder
        style={{
          backgroundColor: '#ffffff',
        }}
      >
        <Container size="xl" h={72}>
          <Group h="100%" justify="space-between" wrap="nowrap">
            <Group
              gap="sm"
              onClick={handleGoHome}
              style={{ cursor: 'pointer' }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #3F7CAC, #E2F89C)',
                }}
              />

              <div>
                <Text fw={900} size="lg" lh={1.1} c="brand.6">
                  GeneInsight
                </Text>
                <Text size="xs" c="dimmed">
                  Integrated gene investigation platform
                </Text>
              </div>
            </Group>

            {hasReport && (
              <Group gap="xs" wrap="nowrap" visibleFrom="sm">
                <TextInput
                  placeholder="Search another gene..."
                  value={gene}
                  onChange={(e) => setGene(e.currentTarget.value)}
                  size="sm"
                  w={260}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />

                <Button
                  size="sm"
                  onClick={() => handleSearch()}
                  loading={loading}
                >
                  Search
                </Button>
              </Group>
            )}
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top left, rgba(63,124,172,0.16), transparent 28rem), radial-gradient(circle at top right, rgba(226,248,156,0.35), transparent 26rem), #f8fafb',
        }}
      >
        <Container size="xl" pt={96} pb="xl">
          <Stack gap="lg">
            {!hasReport && (
              <LandingSearch
                gene={gene}
                setGene={setGene}
                loading={loading}
                handleSearch={handleSearch}
              />
            )}

            {loading && (
              <Card radius="xl" shadow="sm" p="lg" withBorder>
                <Group>
                  <Loader size="sm" />
                  <div>
                    <Text fw={700}>Loading GeneInsight report...</Text>
                    <Text size="sm" c="dimmed">
                      Fetching gene summary, preview literature, AlphaFold structure,
                      and Ensembl transcript data.
                    </Text>
                  </div>
                </Group>
              </Card>
            )}

            {statusError && (
              <Alert color="red" title="Error" radius="lg">
                {statusError}
              </Alert>
            )}

            {report && <GeneDashboard report={report} />}
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

function LandingSearch({ gene, setGene, loading, handleSearch }) {
  return (
    <Paper
      p="xl"
      radius="xl"
      shadow="md"
      withBorder
      style={{
        background: 'linear-gradient(135deg, #3F7CAC, #95AFBA)',
        color: 'white',
      }}
    >
      <Stack gap="lg">
        <Stack gap="xs">
          <Badge color="lime" variant="filled" c="black" w="fit-content">
            Bioinformatics SaaS Prototype
          </Badge>

          <Title
            order={1}
            style={{
              color: '#E2F89C',
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
              lineHeight: 1,
            }}
          >
            GeneInsight
          </Title>

          <Text size="lg" maw={820} style={{ color: 'rgba(255,255,255,0.92)' }}>
            Turn a gene symbol into an integrated workflow for literature evidence,
            protein structure, transcript structure, CRISPR guide exploration, and
            gene comparison.
          </Text>
        </Stack>

        <Paper p="lg" radius="xl" bg="rgba(255,255,255,0.96)">
          <Stack gap="sm">
            <Group align="end">
              <TextInput
                label="Search a gene"
                description="Enter a human gene symbol to generate a GeneInsight report."
                placeholder="Try TP53, BRCA1, EGFR..."
                value={gene}
                onChange={(e) => setGene(e.currentTarget.value)}
                style={{ flex: 1 }}
                size="md"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
              />

              <Button
                size="md"
                onClick={() => handleSearch()}
                loading={loading}
              >
                Generate Report
              </Button>
            </Group>

            <Group gap="xs">
              <Text size="sm" c="dimmed">
                Popular examples:
              </Text>

              {exampleGenes.map((example) => (
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
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}

export default App;