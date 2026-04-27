import { SimpleGrid, Stack, Tabs } from '@mantine/core';
import { GeneOverview } from './GeneOverview';
import { LiteraturePanel } from './LiteraturePanel';
import { ProteinStructure } from './ProteinStructure';
import { GeneStructureViewer } from './GeneStructureViewer';
import { CrisprExplorer } from './CrisprExplorer';
import { CompareGenes } from './CompareGenes';

export function GeneDashboard({ report }) {
  const geneData = report.gene;
  const papers = report.papers || [];
  const alphafold = report.alphafold;
  const geneStructure = report.gene_structure;

  return (
    <Tabs defaultValue="dashboard" variant="pills" radius="md" color="indigo" fw="bolder" fz="xl"> 
      <Tabs.List>
        <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
        <Tabs.Tab value="literature">Literature</Tabs.Tab>
        <Tabs.Tab value="protein">Protein Structure</Tabs.Tab>
        <Tabs.Tab value="crispr">CRISPR Explorer</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="dashboard" pt="md">
        <Stack gap="md">
          <GeneOverview
            geneData={geneData}
            alphafold={alphafold}
            geneStructure={geneStructure}
            papers={papers}
          />

          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            <GeneStructureViewer geneStructure={geneStructure} />
            <CompareGenes />
          </SimpleGrid>
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="literature" pt="md">
        <LiteraturePanel papers={papers} />
      </Tabs.Panel>

      <Tabs.Panel value="protein" pt="md">
        <ProteinStructure alphafold={alphafold} />
      </Tabs.Panel>

      <Tabs.Panel value="crispr" pt="md">
        <CrisprExplorer />
      </Tabs.Panel>
    </Tabs>
  );
}