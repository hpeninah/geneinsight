import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';

export function GeneOverview({ geneData, alphafold, geneStructure, papers}) {
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
          <Badge color="teal">Guide explorer ready</Badge>
        </Group>

        <Text fz={"lg"}>{geneData.summary}</Text>
      </Stack>
    </Card>
  );
}