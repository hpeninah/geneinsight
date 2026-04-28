import { Card, Stack, Text, Title, Grid, Anchor, Button, Group, Badge, Progress, Alert, Paper, Box } from '@mantine/core';

export function ProteinStructure({ alphafold }) {
  if (!alphafold) {
    return (
      <Card radius="xl" shadow="sm" p="lg" withBorder>
        <Title order={3}>AlphaFold Structure</Title>
        <Text c="dimmed">No AlphaFold entry found for this gene.</Text>
      </Card>
    );
  }
  const accession = alphafold.accession;
  const uniprotUrl = `https://www.uniprot.org/uniprotkb/${accession}/entry`;
  const cifUrl = `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.cif`;
  const pdbUrl = alphafold.pdb_url || `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.pdb`;
  const paeUrl =
    alphafold.pae_url ||
    `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-predicted_aligned_error_v6.json`;
  const meanPlddt = alphafold.mean_plddt;
  const confidenceColor = alphafold.confidence_color || 'gray';

  return (
    <Grid columns={12}>
      <Grid.Col span={8}>
        <Card radius="xl" shadow="sm" p="lg" withBorder>
          <Stack>
            <Title order={3}>AlphaFold 3D Protein Structure</Title>
            <Text>
              <strong>UniProt accession:</strong>{' '}<Anchor href={uniprotUrl} target="_blank" rel='noreferrer' variant='subtle'>{accession}</Anchor>
            </Text>
                <Group>
                  <Button
                    component="a"
                    href={alphafold.alphafold_entry_url}
                    target="_blank"
                    rel="noreferrer"
                    variant="filled"
                  >
                    Open AlphaFold
                  </Button>
                  <Button
                    component="a"
                    href={cifUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="outline"
                  >
                    Download mmCIF
                  </Button>
                  <Button
                    component="a"
                    href={pdbUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="outline"
                  >
                    Download PDB
                  </Button>
                </Group>

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
      </Grid.Col>

      <Grid.Col span={4}>
        <Stack>
          <Card radius="xl" shadow="sm" p="lg" withBorder>
            <Stack>
              <Title order={3}>Model Confidence</Title>

              {meanPlddt !== null && meanPlddt !== undefined ? (
                <>
                  <Group justify="space-between">
                    <Text>
                      <strong>Mean pLDDT:</strong> {meanPlddt}
                    </Text>

                    <Badge color={confidenceColor} variant="light">
                      {alphafold.confidence_label}
                    </Badge>
                  </Group>

                  <Progress
                    value={meanPlddt}
                    color={confidenceColor}
                    size="lg"
                    radius="xl"
                  />

                  <Text c="dimmed" fz="sm">
                    {alphafold.confidence_description}
                  </Text>
                </>
              ) : (
                <Alert color="gray" title="Confidence score unavailable">
                  The AlphaFold API did not return a mean pLDDT value for this entry.
                </Alert>
              )}

              <AlphaFoldColorLegend distribution={alphafold.plddt_distribution} />

              <Alert color="blue" title="How to interpret pLDDT">
                pLDDT is a 0–100 local confidence score. Higher values usually mean the
                predicted local structure is more reliable. Lower-confidence regions may be
                flexible, disordered, or less reliable.
              </Alert>

              <Button
                component="a"
                href={paeUrl}
                target="_blank"
                rel="noreferrer"
                variant="light"
              >
                Open PAE confidence file
              </Button>

              <Text size="sm" c="dimmed">
                PAE estimates confidence in relative residue or domain positions, so it is useful
                when interpreting whether different regions of a protein are confidently positioned
                relative to each other.
              </Text>
            </Stack>
          </Card>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

  function AlphaFoldColorLegend({ distribution }) {
    const rows = [
      {
        label: 'Very high',
        range: 'pLDDT > 90',
        value: distribution?.very_high,
        color: '#0053D6',
      },
      {
        label: 'High',
        range: '70 < pLDDT ≤ 90',
        value: distribution?.high,
        color: '#65CBF3',
      },
      {
        label: 'Low',
        range: '50 < pLDDT ≤ 70',
        value: distribution?.low,
        color: '#FFDB13',
      },
      {
        label: 'Very low',
        range: 'pLDDT ≤ 50',
        value: distribution?.very_low,
        color: '#FF7D45',
      },
    ];

    return (
      <Paper p="md" radius="md" withBorder>
        <Stack gap="xs">
          <Text fw={700}>Structure Color Legend</Text>

          <Text size="sm" c="dimmed">
            The 3D viewer is colored by AlphaFold model confidence.
          </Text>

          {rows.map((row) => (
            <Group key={row.label} justify="space-between" wrap="nowrap">
              <Group gap="xs">
                <Box
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: row.color,
                  }}
                />

                <Text size="sm">
                  <strong>{row.label}</strong> ({row.range})
                </Text>
              </Group>

              {row.value !== undefined && row.value !== null && (
                <Text size="sm" c="dimmed">
                  {row.value}%
                </Text>
              )}
            </Group>
          ))}
        </Stack>
      </Paper>
    );
  };