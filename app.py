from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
import xml.etree.ElementTree as ET
import re

app = FastAPI(title="GeneInsight Lite")

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def read_index():
    return FileResponse("static/index.html")

# Request models

class CrisprRequest(BaseModel):
    sequence: str
    pam: str = "NGG"
    guide_length: int = 20

# Gene information: MyGene.info

async def fetch_gene_data(symbol: str):
    url = "https://mygene.info/v3/query"

    params = {
        "q": f"symbol:{symbol}",
        "species": "human",
        "size": 1,
        "fields": "symbol,name,summary,entrezgene"
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    hits = data.get("hits", [])

    if not hits:
        return None

    hit = hits[0]

    return {
        "symbol": hit.get("symbol", symbol.upper()),
        "name": hit.get("name", "N/A"),
        "summary": hit.get("summary", "No summary available."),
        "entrezgene": hit.get("entrezgene", "N/A"),
    }

# Literature: PubMed / NCBI E-utilities

async def fetch_related_papers_pubmed(symbol: str):
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    tool_name = "geneinsight_lite"
    email = "student@example.com"

    async with httpx.AsyncClient(timeout=30.0) as client:
        search_params = {
            "db": "pubmed",
            "term": f'{symbol}[Title/Abstract]',
            "retmax": 5,
            "sort": "pub date",
            "retmode": "json",
            "tool": tool_name,
            "email": email,
        }

        search_response = await client.get(
            f"{base}/esearch.fcgi",
            params=search_params
        )
        search_response.raise_for_status()
        search_data = search_response.json()

        id_list = search_data.get("esearchresult", {}).get("idlist", [])

        if not id_list:
            return []

        fetch_params = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "retmode": "xml",
            "tool": tool_name,
            "email": email,
        }

        fetch_response = await client.get(
            f"{base}/efetch.fcgi",
            params=fetch_params
        )
        fetch_response.raise_for_status()

    root = ET.fromstring(fetch_response.text)
    papers = []

    for article in root.findall(".//PubmedArticle"):
        title = article.findtext(".//ArticleTitle", default="Untitled")

        abstract_parts = article.findall(".//Abstract/AbstractText")
        abstract = " ".join(
            "".join(part.itertext()).strip()
            for part in abstract_parts
            if "".join(part.itertext()).strip()
        )

        if not abstract:
            abstract = "No abstract available."

        journal = article.findtext(".//Journal/Title", default="Unknown Journal")

        year = "N/A"
        year_node = article.find(".//PubDate/Year")

        if year_node is not None and year_node.text:
            year = year_node.text
        else:
            medline_date = article.findtext(".//PubDate/MedlineDate")
            if medline_date:
                year = medline_date[:4]

        pmid = article.findtext(".//PMID", default="")

        papers.append({
            "title": title,
            "journal": journal,
            "year": year,
            "abstract": abstract[:500],
            "pmid": pmid,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else ""
        })

    return papers

# Protein structure: UniProt + AlphaFold

async def fetch_uniprot_accession(symbol: str):
    url = "https://rest.uniprot.org/uniprotkb/search"

    params = {
        "query": f'gene:{symbol} AND organism_id:9606',
        "fields": "accession,gene_names,protein_name",
        "format": "json",
        "size": 5
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    results = data.get("results", [])

    if not results:
        return None

    best_entry = None

    for entry in results:
        genes = entry.get("genes", [])

        for gene in genes:
            gene_name = gene.get("geneName", {}).get("value", "")

            if gene_name.upper() == symbol.upper():
                best_entry = entry
                break

        if best_entry:
            break

    if best_entry is None:
        best_entry = results[0]

    accession = best_entry.get("primaryAccession")

    if not accession:
        return None

    return {
        "accession": accession,
        "alphafold_entry_url": f"https://alphafold.ebi.ac.uk/entry/{accession}",
        "molstar_embed_url": f"https://molstar.org/viewer/?afdb={accession}&hide-controls=1"
    }


# Gene structure: Ensembl

async def fetch_gene_structure(symbol: str):
    url = f"https://rest.ensembl.org/lookup/symbol/homo_sapiens/{symbol}"

    params = {
        "expand": 1
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, params=params, headers=headers)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        data = response.json()

    transcripts = data.get("Transcript", [])

    if not transcripts:
        return None

    transcripts_with_exons = [
        transcript
        for transcript in transcripts
        if transcript.get("Exon")
    ]

    if not transcripts_with_exons:
        return None

    def transcript_length(transcript):
        return abs(transcript.get("end", 0) - transcript.get("start", 0)) + 1

    protein_coding = [
        transcript
        for transcript in transcripts_with_exons
        if transcript.get("biotype") == "protein_coding"
    ]

    candidates = protein_coding if protein_coding else transcripts_with_exons
    selected_transcript = max(candidates, key=transcript_length)

    def build_transcript_payload(transcript):
        tx_start = transcript["start"]
        tx_end = transcript["end"]
        tx_length = abs(tx_end - tx_start) + 1

        exons = transcript.get("Exon", [])
        exons_sorted = sorted(exons, key=lambda exon: exon["start"])

        exon_blocks = []

        for index, exon in enumerate(exons_sorted, start=1):
            exon_start = exon["start"]
            exon_end = exon["end"]
            exon_length = abs(exon_end - exon_start) + 1

            exon_blocks.append({
                "number": index,
                "start": exon_start,
                "end": exon_end,
                "length": exon_length,
                "relative_start": exon_start - tx_start,
                "relative_end": exon_end - tx_start
            })

        return {
            "transcript_id": transcript.get("id"),
            "biotype": transcript.get("biotype"),
            "start": tx_start,
            "end": tx_end,
            "length": tx_length,
            "strand": transcript.get("strand", data.get("strand", 1)),
            "exon_count": len(exon_blocks),
            "exons": exon_blocks
        }

    transcript_payloads = [
        build_transcript_payload(transcript)
        for transcript in transcripts_with_exons
    ]

    transcript_payloads.sort(
        key=lambda transcript: (
            transcript["biotype"] == "protein_coding",
            transcript["length"]
        ),
        reverse=True
    )

    selected_payload = build_transcript_payload(selected_transcript)

    return {
        "gene_symbol": symbol,
        "ensembl_gene_id": data.get("id"),
        "gene_start": data.get("start"),
        "gene_end": data.get("end"),
        "gene_strand": data.get("strand", 1),
        "selected_transcript_id": selected_payload["transcript_id"],
        "selected_transcript": selected_payload,
        "transcripts": transcript_payloads[:10]
    }

# CRISPR helper functions

def clean_sequence(sequence: str) -> str:
    sequence = sequence.upper().replace("\n", "").replace(" ", "")
    return re.sub(r"[^ACGT]", "", sequence)


def reverse_complement(sequence: str) -> str:
    complement = str.maketrans("ACGT", "TGCA")
    return sequence.translate(complement)[::-1]


def gc_content(sequence: str) -> float:
    if not sequence:
        return 0.0

    gc = sequence.count("G") + sequence.count("C")
    return round((gc / len(sequence)) * 100, 2)


def has_homopolymer(sequence: str, run_length: int = 5) -> bool:
    return any(base * run_length in sequence for base in "ACGT")


def count_exact_occurrences(guide: str, sequence: str) -> int:
    count = 0
    start = 0

    while True:
        index = sequence.find(guide, start)

        if index == -1:
            break

        count += 1
        start = index + 1

    return count


def pam_matches(triplet: str, pam: str = "NGG") -> bool:
    if len(triplet) != 3:
        return False

    if pam == "NGG":
        return triplet[1:] == "GG"

    return False


def score_guide(guide: str, full_sequence: str):
    score = 10.0
    notes = []

    gc = gc_content(guide)

    if gc < 35 or gc > 65:
        score -= 2
        notes.append("GC content outside ideal range")
    elif 40 <= gc <= 60:
        notes.append("Good GC balance")

    if "TTTT" in guide:
        score -= 2
        notes.append("Contains TTTT motif")

    if has_homopolymer(guide):
        score -= 1.5
        notes.append("Contains homopolymer run")

    occurrences = count_exact_occurrences(guide, full_sequence)

    if occurrences > 1:
        score -= min(3, occurrences - 1)
        notes.append("Repeated target within input sequence")

    score = round(max(score, 0), 2)

    if not notes:
        notes.append("No obvious issues detected")

    return score, "; ".join(notes)


def add_guide_result(
    results: list,
    guide: str,
    pam: str,
    guide_start: int,
    pam_start: int,
    strand: str,
    full_sequence: str
):
    """
    guide_start and pam_start are 0-based positions in the original input sequence.
    cut_site is stored as 1-based approximate position.
    """
    score, notes = score_guide(guide, full_sequence)

    cut_site = pam_start - 3 + 1

    results.append({
        "guide": guide,
        "pam": pam,
        "position": guide_start + 1,
        "pam_position": pam_start + 1,
        "cut_site": cut_site,
        "strand": strand,
        "gc_percent": gc_content(guide),
        "score": score,
        "notes": notes
    })


def find_guides(sequence: str, pam: str = "NGG", guide_length: int = 20):
    results = []

    # Forward strand
    for i in range(len(sequence) - 2):
        triplet = sequence[i:i + 3]

        if pam_matches(triplet, pam):
            guide_start = i - guide_length
            guide_end = i

            if guide_start >= 0:
                guide = sequence[guide_start:guide_end]

                add_guide_result(
                    results=results,
                    guide=guide,
                    pam=triplet,
                    guide_start=guide_start,
                    pam_start=i,
                    strand="+",
                    full_sequence=sequence
                )

    # Reverse strand
    reverse_sequence = reverse_complement(sequence)

    for i in range(len(reverse_sequence) - 2):
        triplet = reverse_sequence[i:i + 3]

        if pam_matches(triplet, pam):
            guide_start = i - guide_length
            guide_end = i

            if guide_start >= 0:
                guide = reverse_sequence[guide_start:guide_end]

                # Convert reverse-complement guide position back to original sequence.
                original_guide_start = len(sequence) - guide_end
                original_pam_start = len(sequence) - (i + 3)

                add_guide_result(
                    results=results,
                    guide=guide,
                    pam=triplet,
                    guide_start=original_guide_start,
                    pam_start=original_pam_start,
                    strand="-",
                    full_sequence=sequence
                )

    results.sort(key=lambda result: result["score"], reverse=True)

    return results

# API routes

@app.get("/api/gene/{symbol}")
async def get_gene_report(symbol: str):
    symbol = symbol.strip().upper()

    if not symbol:
        raise HTTPException(
            status_code=400,
            detail="Gene symbol is required."
        )

    gene = await fetch_gene_data(symbol)

    if gene is None:
        raise HTTPException(
            status_code=404,
            detail=f"No gene found for symbol '{symbol}'."
        )

    try:
        papers = await fetch_related_papers_pubmed(symbol)
    except Exception as error:
        print("PubMed unavailable:", error)
        papers = []

    try:
        alphafold = await fetch_uniprot_accession(symbol)
    except Exception as error:
        print("UniProt/AlphaFold unavailable:", error)
        alphafold = None

    try:
        gene_structure = await fetch_gene_structure(symbol)
    except Exception as error:
        print("Ensembl unavailable:", error)
        gene_structure = None

    return {
        "gene": gene,
        "papers": papers,
        "alphafold": alphafold,
        "gene_structure": gene_structure
    }


@app.post("/api/crispr/design")
async def design_guides(payload: CrisprRequest):
    sequence = clean_sequence(payload.sequence)

    if len(sequence) < payload.guide_length + 3:
        raise HTTPException(
            status_code=400,
            detail=f"Sequence too short. Please enter at least {payload.guide_length + 3} DNA bases."
        )

    guides = find_guides(
        sequence=sequence,
        pam=payload.pam,
        guide_length=payload.guide_length
    )

    return {
        "input_length": len(sequence),
        "pam": payload.pam,
        "guide_length": payload.guide_length,
        "guide_count": len(guides),
        "guides": guides[:20]
    }

## ATGCGTACGATCGTAGGCTAGCTAGGCTAGCTAGGATCGGATCGTAGCTAGGCTAGCTAAGG
