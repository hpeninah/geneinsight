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
  Title,
  Alert,
  Badge,
} from '@mantine/core';
import { fetchGeneReport } from './api';
import { GeneDashboard } from './components/GeneDashboard';

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

          {/*header*/}
          <Paper
            p="xl"
            radius="xl"
            shadow="md"
            withBorder
            style={{
              background: 'linear-gradient(135deg, rgba(79,79,229,0.95), rgba(14,165,233,0.9))',
              color: 'white',
            }}
            >
              <Stack gap="xs">
                <Badge color="white" variant="filled" c="indigo" w="fit-content">
                  Bioinformatics Saas Prototype
                </Badge>

                <Title order={1} style={{color: 'white'}}>
                  GeneInsight
                </Title>

                <Text size="lg" maw={760} style={{color: 'rgba(255,255,255,0.9)'}}>
                Turn a gene symbol into an integrated dashboard for literature, protein structure, transcript structure, CRISPR guide exploration, and gene comparison.
                </Text>
              </Stack>
            </Paper>

          {/*Search Card on Initial Entry*/}
          <Paper p="lg" radius="xl" shadow="sm" withBorder>
            <Stack gap="sm">

              {/*Search bar*/}
              <Group align="end">
                  <TextInput
                    label="Search a gene"
                    description="Enter a gene symbol to generate a full GeneInsight report."
                    placeholder="Try TP53, BRCA1, EGFR..."
                    value={gene}
                    onChange={(e) => setGene(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    size="md"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                  />
                  <Button size="md" onClick={() => handleSearch()}>Generate Report</Button>
                </Group>
                
                {/*Suggested gene searches*/}
                <Group gap="xs">
                <Text size="sm" c="dimmed">Popular Examples:</Text>
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
            </Stack>
          </Paper>

          {/*loading gene report*/}
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

          {/*error if no gene exists or gene search is wrong*/}
          {statusError && (
            <Alert color="red" title="Error">
              {statusError}
            </Alert>
          )}

          {/*dashboard*/}
          {report && <GeneDashboard report={report} />}
        </Stack>
      </Container>
    </AppShell>
  );
}

export default App;