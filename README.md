# GeneInsight

GeneInsight is a web-based bioinformatics SaaS prototype of an integrated gene investigation dashboard. The platform combines gene summary information, literature search, protein structure visualization, transcript/exon structure, CRISPR guide exploration, and gene comparison into one workflow.

## Project Overview

Bioinformatics information is often spread across many different databases and tools. A student or beginner researcher may need to use separate platforms for gene summaries, papers, protein structures, transcript information, and CRISPR guide design.

GeneInsight solves this by bringing these steps together in one dashboard.

Users can enter a gene symbol such as:

- `TP53`
- `BRCA1`
- `EGFR`
- `CFTR`

The app then generates a report containing gene context, literature evidence, AlphaFold protein structure, transcript/exon structure, and CRISPR guide exploration tools.

## Main Features

### Gene Overview

The dashboard provides a quick summary of the searched gene, including:

- Gene symbol
- Gene name
- Entrez ID
- Gene summary
- Data availability badges
- Number of related papers
- AlphaFold availability
- Gene structure availability

### Literature Explorer

The Literature Explorer retrieves PubMed papers related to the searched gene.

Users can:

- Search papers by topic or keyword
- Choose how many papers to retrieve
- Rank papers by relevance
- Filter or sort papers by year
- View paper title, journal, year, abstract preview, and PubMed link

The relevance score is based on topic matches in the paper title, abstract, and journal.

### Protein Structure Viewer

The Protein Structure module connects a gene to a UniProt accession and displays an AlphaFold 3D protein structure.

It includes:

- UniProt accession
- Protein name
- AlphaFold link
- UniProt link
- Download links for mmCIF and PDB files
- Embedded Mol* 3D viewer
- Model confidence information
- pLDDT color legend
- PAE confidence file link

### Gene Structure Viewer

The Gene Structure Viewer displays transcript and exon organization using Ensembl data.

It includes:

- Transcript isoform selector
- Transcript biotype
- Strand direction
- Exon count
- Transcript length
- Exon map
- Schematic and genomic-style visualization
- Exon detail table

This helps users understand that a single gene can produce multiple transcript isoforms through alternative splicing.

### CRISPR Guide Explorer

The CRISPR Explorer allows users to paste a DNA sequence and identify possible SpCas9 guide RNAs.

It detects:

- NGG PAM sites
- 20-base guide candidates
- Guide position
- PAM position
- Approximate cut site
- Strand direction
- GC content
- Heuristic guide score
- Notes about sequence quality

This feature is for educational exploration only and does not perform full genome-wide off-target analysis or wet-lab validation.

## Tech Stack

### Frontend

- React
- Vite
- Mantine UI
- JavaScript

### Backend

- FastAPI
- Python
- HTTPX
- Uvicorn

### External Data Sources

- MyGene.info
- PubMed / NCBI E-utilities
- UniProt
- AlphaFold DB
- Ensembl REST API
