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
  Alert
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
          <div>
            <Title order={1}>GeneInsight Lite</Title>
            <Text>
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

export default App;