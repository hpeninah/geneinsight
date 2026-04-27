import { useState } from 'react';
import { Alert, Badge, Card, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core';

export function LiteraturePanel({ papers }) {
  const [keyword, setKeyword] = useState('');

  const scoredPapers = [...papers].sort((a, b) => {
    return scorePaper(b, keyword).score - scorePaper(a, keyword).score;
  });

  return (
    <Card radius="xl" shadow="sm" p="lg" withBorder>
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

        {papers.length === 0 && (
          <Alert color="gray">
            No papers found, or PubMed may have timed out.
          </Alert>
        )}

        {scoredPapers.map((paper) => {
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
        })}
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