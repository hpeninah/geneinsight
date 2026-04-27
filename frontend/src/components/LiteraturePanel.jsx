import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  LoadingOverlay,
  Paper,
  NumberInput,
  Stack,
  Text,
  TextInput,
  Title,
  SegmentedControl
} from '@mantine/core';
import { fetchPapers } from '../api';
import { Help } from './Help';

export function LiteraturePanel({ geneSymbol, initialPapers }) {
  const [papers, setPapers] = useState(initialPapers || []);
  const [topic, setTopic] = useState('');
  const [limit, setLimit] = useState(5);
  const [activeTopic, setActiveTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');

  async function handleFetchPapers() {
    setLoading(true);
    setError('');

    try {
      const data = await fetchPapers(geneSymbol, topic, Number(limit));
      setPapers(data.papers || []);
      setActiveTopic(topic.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const scoredPapers = [...papers].sort((a, b) => {
    return scorePaper(b, activeTopic).score - scorePaper(a, activeTopic).score;
  });

  return (
    <Card radius="xl" shadow="sm" p="lg" withBorder pos="relative">
      <LoadingOverlay visible={loading} />

      <Stack>
        <div>
          <Title order={3}>Literature Explorer</Title>
          <Text c="dimmed">
            Search PubMed papers for {geneSymbol} by topic. Results are automatically ranked by relevance.
          </Text>
        </div>

        <Group align="end">
          <TextInput
            label={`Search papers about ${geneSymbol} and...`}
            description="Enter one topic or multiple comma-separated topics."
            placeholder="Try cancer therapy, mutation, apoptosis..."
            value={topic}
            onChange={(event) => setTopic(event.currentTarget.value)}
            style={{ flex: 1 }}
          />

          <NumberInput
            label="Results"
            description="Choose how many papers to retrieve."
            value={limit}
            onChange={(value) => setLimit(value || 5)}
            min={1}
            max={100}
            step={5}
            w={190}
          />

          <Button onClick={handleFetchPapers}>
            Search Papers
          </Button>
        </Group>

        {error && (
          <Alert color="red" title="Literature search error">
            {error}
          </Alert>
        )}

        <Group>
          <Badge color="blue" variant="light">
            Showing {papers.length} papers
          </Badge>

          {activeTopic ? (
            <Badge color="violet" variant="light">
              Ranked by: {activeTopic}
            </Badge>
          ) : (
            <Badge color="gray" variant="light">
              Recent papers preview
            </Badge>
          )}
        </Group>

        {scoredPapers.length === 0 ? (
          <Alert color="gray">
            No papers found. Try a broader topic or increase the result count.
          </Alert>
        ) : (
          scoredPapers.map((paper) => {
            const relevance = activeTopic ? scorePaper(paper, activeTopic) : null;

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

                  <Text size="sm" fw="bold">
                    {paper.journal} • {paper.year}
                  </Text>

                  {relevance && (
                    <Group>
                      <Badge
                        color={
                          relevance.label === 'High'
                            ? 'green'
                            : relevance.label === 'Medium'
                              ? 'yellow'
                              : 'red'
                        }
                      >
                        {relevance.label} relevance
                      </Badge>

                      <Text size="sm" c="dimmed">
                        Score: {relevance.score}
                      </Text>
                      <Help 
                        text="Relevance score: 
                          exact topic phrase in title = +10, 
                          exact phrase in abstract = +6, 
                          each topic keyword in title = +5, 
                          abstract = +3, 
                          journal = +1. 
                          Higher scores mean the paper is more closely related to your topic." />

                      {relevance.matches.length > 0 && (
                        <Text size="sm" c="dimmed">
                          Matched: {relevance.matches.join(', ')}
                        </Text>
                      )}
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

function scorePaper(paper, topicInput) {
  if (!topicInput.trim()) {
    return {
      score: 0,
      label: 'Low',
      matches: []
    };
  }

  const topic = topicInput.toLowerCase().trim();

  const keywords = topic
    .replace(",", " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  const title = (paper.title || '').toLowerCase();
  const abstract = (paper.abstract || '').toLowerCase();
  const journal = (paper.journal || '').toLowerCase();

  let score = 0;
  const matches = [];

  // Exact phrase bonus
  if (title.includes(topic)) {
    score += 10;
    matches.push(topic);
  } else if (abstract.includes(topic)) {
    score += 6;
    matches.push(topic);
  }

  // Individual keyword scoring
  keywords.forEach((keyword) => {
    let matched = false;

    if (title.includes(keyword)) {
      score += 5;
      matched = true;
    }

    if (abstract.includes(keyword)) {
      score += 3;
      matched = true;
    }

    if (journal.includes(keyword)) {
      score += 1;
      matched = true;
    }

    if (matched && !matches.includes(keyword)) {
      matches.push(keyword);
    }
  });

  let label = 'Low';

  if (score >= 12) {
    label = 'High';
  } else if (score >= 5) {
    label = 'Medium';
  }

  return {
    score,
    label,
    matches
  };
}

{/**
  TP53 = cancer, mutation, apoptosis, tumor suppresor
  BRCA1 = breast cancer, DNA repair, ovarian cancer
  EGFR = lung cancer, drug resistance, targeted therapy
  APOE = Alzheimer, lipid metabolism
  */}