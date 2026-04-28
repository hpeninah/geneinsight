import { useState } from 'react';
import {
  AppShell,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  TextInput,
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
    <AppShell>
      <AppShell.Header
        withBorder
        style={{
          backgroundColor: '#ffffff',
        }}
      >
        <Container size="xl" h={72}>
          <Group h="100%" justify="space-between">
            <Group gap="sm">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #3F7CAC, #E2F89C)',
                }}
              />

              <div>
                <Text fw={900} size="lg" lh={1.1} c="#3F7CAC">
                  GeneInsight
                </Text>
                <Text size="xs" c="dimmed">
                  Integrated gene investigation platform
                </Text>
              </div>
            </Group>
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
            <Paper
              p="xl"
              radius="xl"
              shadow="sm"
              withBorder
              style={{
                background:
                  'linear-gradient(135deg, rgba(63,124,172,0.98), rgba(149,175,186,0.92))',
                color: 'black',
                overflow: 'hidden',
              }}
            >
              <Paper p="md" radius="lg" bg="rgba(255,255,255,0.95)">
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
                      style={{
                        backgroundColor: '#3F7CAC',
                      }}
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
                        color="blue"
                        onClick={() => handleSearch(example)}
                      >
                        {example}
                      </Button>
                    ))}
                  </Group>
                </Stack>
              </Paper>
            </Paper>

            {loading && (
              <Card radius="xl" shadow="sm" p="lg" withBorder>
                <Group>
                  <Loader size="sm" />
                  <div>
                    <Text fw={700}>Loading GeneInsight report...</Text>
                    <Text size="sm" c="dimmed">
                      Fetching gene summary, preview literature, AlphaFold
                      structure, and Ensembl transcript data.
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

export default App;
