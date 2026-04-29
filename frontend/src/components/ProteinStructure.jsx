import { useEffect, useState } from 'react';
import {
  Card,
  Stack,
  Text,
  Title,
  Grid,
  Anchor,
  Button,
  Group,
  Badge,
  Progress,
  Alert,
  Paper,
  Box,
  Loader,
  Divider
} from '@mantine/core';
import { fetchAlphaFoldMetadata } from '../api';

export function ProteinStructure({ alphafold }) {
  const [metadata, setMetadata] = useState(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState('');

  useEffect(() => {
    async function loadMetadata() {
      if (!alphafold?.accession) return;

      setLoadingMetadata(true);
      setMetadataError('');

      try {
        const data = await fetchAlphaFoldMetadata(alphafold.accession);
        setMetadata(data);
      } catch (error) {
        setMetadataError(error.message);
      } finally {
        setLoadingMetadata(false);
      }
    }

    loadMetadata();
  }, [alphafold?.accession]);

  if (!alphafold) {
    return (
      <Card radius="xl" shadow="sm" p="lg" withBorder>
        <Title order={3}>AlphaFold Structure</Title>
        <Text c="dimmed">No AlphaFold entry found for this gene.</Text>
      </Card>
    );
  }

  const mergedAlphaFold = {
    ...alphafold,
    ...removeEmptyValues(metadata || {}),
  };

  const accession = mergedAlphaFold.accession;
  const uniprotUrl = `https://www.uniprot.org/uniprotkb/${accession}/entry`;

  const cifUrl =
    mergedAlphaFold.cif_url ||
    `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.cif`;

  const pdbUrl =
    mergedAlphaFold.pdb_url ||
    `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-model_v6.pdb`;

  const paeUrl =
    mergedAlphaFold.pae_url ||
    `https://alphafold.ebi.ac.uk/files/AF-${accession}-F1-predicted_aligned_error_v6.json`;

  const meanPlddt = mergedAlphaFold.mean_plddt;
  const confidenceColor = mergedAlphaFold.confidence_color || 'gray';

  return (
    <Grid columns={12}>
      <Grid.Col span={{ base: 12, lg: 8 }}>
        <Card radius="xl" shadow="sm" p="lg" withBorder>
          <Stack>
            <Group>
              <Title order={3}>AlphaFold 3D Protein Structure</Title>
        
              <Button
                component="a"
                href={mergedAlphaFold.alphafold_entry_url}
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
            
            <Title order={5}>{mergedAlphaFold.protein_name || 'Not available'}</Title>

            <iframe
              src={mergedAlphaFold.molstar_embed_url}
              width="100%"
              height="550"
              style={{ border: '1px solid #e5e7eb', borderRadius: 12 }}
              title="AlphaFold 3D Viewer"
              loading="lazy"
            />
          </Stack>
        </Card>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 4 }}>
        <Stack>
          <Card radius="xl" shadow="sm" p="lg" withBorder>
            <Stack>
              <Title order={3}>Protein Details</Title>

              <Text>
                <strong>UniProt accession:</strong>{' '}
                <Anchor href={uniprotUrl} target="_blank" rel="noreferrer">
                  {accession}
                </Anchor>
              </Text>

              <Text>
                <strong>Organism:</strong>{' '}
                {mergedAlphaFold.organism || 'Not available'}
              </Text>

              <Text>
                <strong>Sequence length:</strong>{' '}
                {mergedAlphaFold.sequence_length
                  ? `${mergedAlphaFold.sequence_length} aa`
                  : 'Not available'}
              </Text>

              <Text>
                <strong>Model date:</strong>{' '}
                {mergedAlphaFold.model_created_date || 'Not available'}
              </Text>

              <Text>
                <strong>AlphaFold version:</strong>{' '}
                {mergedAlphaFold.latest_version
                  ? `v${mergedAlphaFold.latest_version}`
                  : 'Not available'}
              </Text>

              {loadingMetadata && (
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="sm" c="dimmed">
                    Loading AlphaFold metadata...
                  </Text>
                </Group>
              )}

              {metadataError && (
                <Alert color="yellow" title="Metadata unavailable">
                  {metadataError}
                </Alert>
              )}
            </Stack>

            <Divider my="md" />
            
            <Stack>
              <Title order={3}>Model Confidence</Title>

              {meanPlddt !== null && meanPlddt !== undefined ? (
                <>
                  <Group justify="space-between">
                    <Text>
                      <strong>Mean pLDDT:</strong> {meanPlddt}
                    </Text>

                    <Badge color={confidenceColor} variant="light">
                      {mergedAlphaFold.confidence_label || 'Confidence'}
                    </Badge>
                  </Group>

                  <Progress
                    value={meanPlddt}
                    color={confidenceColor}
                    size="lg"
                    radius="xl"
                  />

                  <Text c="dimmed" fz="sm">
                    {mergedAlphaFold.confidence_description}
                  </Text>
                </>
              ) : (
                <Alert color="gray" title="Confidence score unavailable">
                  {loadingMetadata
                    ? 'Loading AlphaFold confidence metadata...'
                    : 'The AlphaFold metadata endpoint did not return a mean pLDDT value for this entry.'}
                </Alert>
              )}

              <AlphaFoldColorLegend
                distribution={mergedAlphaFold.plddt_distribution}
              />

              <Alert color="blue" title="How to interpret pLDDT">
                pLDDT is a 0–100 local confidence score. Higher values usually mean
                the predicted local structure is more reliable. Lower-confidence
                regions may be flexible, disordered, or less reliable.
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
                PAE estimates confidence in relative residue or domain positions, so
                it is useful when interpreting whether different regions of a protein
                are confidently positioned relative to each other.
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
            <Group gap="xs" wrap="nowrap">
              <Box
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: row.color,
                  flexShrink: 0,
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
}

function removeEmptyValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== null && value !== undefined
    )
  );
}