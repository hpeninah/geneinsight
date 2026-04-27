import { Card, Stack, Text, Title } from '@mantine/core';

export function ProteinStructure({ alphafold }) {
  if (!alphafold) {
    return (
      <Card radius="lg" shadow="xs" p="md">
        <Title order={3}>AlphaFold Structure</Title>
        <Text c="dimmed">No AlphaFold entry found for this gene.</Text>
      </Card>
    );
  }

  return (
    <Card radius="xl" shadow="sm" p="lg" withBorder>
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