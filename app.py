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


async def fetch_related_papers_pubmed(symbol: str):
    """
    Search PubMed with NCBI E-utilities:
    1) esearch -> get PMIDs
    2) efetch -> get article metadata/abstracts in XML
    """
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    tool_name = "geneinsight_lite"
    email = "student@example.com"

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Search PubMed
        search_params = {
            "db": "pubmed",
            "term": f'{symbol}[Title/Abstract]',
            "retmax": 5,
            "sort": "pub date",
            "retmode": "json",
            "tool": tool_name,
            "email": email,
        }

        search_response = await client.get(f"{base}/esearch.fcgi", params=search_params)
        search_response.raise_for_status()
        search_data = search_response.json()

        id_list = search_data.get("esearchresult", {}).get("idlist", [])
        if not id_list:
            return []

        # Step 2: Fetch article details
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "retmode": "xml",
            "tool": tool_name,
            "email": email,
        }

        fetch_response = await client.get(f"{base}/efetch.fcgi", params=fetch_params)
        fetch_response.raise_for_status()

    root = ET.fromstring(fetch_response.text)
    papers = []

    for article in root.findall(".//PubmedArticle"):
        title = article.findtext(".//ArticleTitle", default="Untitled")
        abstract_parts = article.findall(".//Abstract/AbstractText")
        abstract = " ".join(
            "".join(part.itertext()).strip() for part in abstract_parts if "".join(part.itertext()).strip()
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

    # Prefer protein-coding transcripts, then choose the longest
    protein_coding = [
        t for t in transcripts
        if t.get("biotype") == "protein_coding" and t.get("Exon")
    ]

    candidates = protein_coding if protein_coding else [t for t in transcripts if t.get("Exon")]

    if not candidates:
        return None

    def transcript_length(t):
        return abs(t.get("end", 0) - t.get("start", 0))

    transcript = max(candidates, key=transcript_length)

    exons = transcript.get("Exon", [])
    exons_sorted = sorted(exons, key=lambda e: e["start"])

    tx_start = transcript["start"]
    tx_end = transcript["end"]
    strand = transcript.get("strand", 1)

    # Normalize exon positions to transcript relative positions
    exon_blocks = []
    for exon in exons_sorted:
        exon_blocks.append({
            "start": exon["start"],
            "end": exon["end"],
            "relative_start": exon["start"] - tx_start,
            "relative_end": exon["end"] - tx_start
        })

    return {
        "gene_symbol": symbol,
        "ensembl_gene_id": data.get("id"),
        "gene_start": data.get("start"),
        "gene_end": data.get("end"),
        "selected_transcript_id": transcript.get("id"),
        "selected_transcript_biotype": transcript.get("biotype"),
        "transcript_start": tx_start,
        "transcript_end": tx_end,
        "transcript_length": abs(tx_end - tx_start) + 1,
        "strand": strand,
        "exon_count": len(exon_blocks),
        "exons": exon_blocks
    }

class CrisprRequest(BaseModel):
    sequence: str
    pam: str = "NGG"
    guide_length: int = 20

def clean_sequence(seq: str):
    seq = seq.upper().replace("\n","").replace(" ","")
    return re.sub(r"[^ACGT]", "", seq)


def reverse_complement(seq):
    complement = str.maketrans("ACGT","TGCA")
    return seq.translate(complement)[::-1]


def gc_content(seq):
    gc = seq.count("G")+seq.count("C")
    return round(gc/len(seq)*100,2)


def has_homopolymer(seq):
    for b in "ACGT":
        if b*5 in seq:
            return True
    return False


def pam_matches(triplet):
    return len(triplet)==3 and triplet[1:]=="GG"


def score_guide(guide, full_sequence):
    score = 10
    notes=[]

    gc=gc_content(guide)

    if gc <35 or gc>65:
        score -=2
        notes.append("GC out of range")

    if "TTTT" in guide:
        score -=2
        notes.append("TTTT motif")

    if has_homopolymer(guide):
        score -=1
        notes.append("homopolymer")

    return max(score,0), "; ".join(notes)


def find_guides(sequence):
    results=[]

    for i in range(len(sequence)-2):

        pam=sequence[i:i+3]

        if pam_matches(pam):

            start=i-20
            end=i

            if start>=0:
                guide=sequence[start:end]

                score,notes=score_guide(
                    guide,
                    sequence
                )

                cut_site = i - 3 + 1 #1-based position, about 3 bases before PAM
                results.append({
                    "guide":guide,
                    "pam":pam,
                    "position":start+1,
                    "pam_position":i+1,
                    "cut_site": cut_site,
                    "strand":"+",
                    "gc_percent":gc_content(guide),
                    "score":score,
                    "notes":notes
                })

    results.sort(
        key=lambda x:x["score"],
        reverse=True
    )

    return results

@app.get("/api/gene/{symbol}")
async def get_gene_report(symbol: str):
    symbol = symbol.strip().upper()

    if not symbol:
        raise HTTPException(status_code=400, detail="Gene symbol is required.")

    gene = await fetch_gene_data(symbol)
    if gene is None:
        raise HTTPException(status_code=404, detail=f"No gene found for symbol '{symbol}'.")

    papers = await fetch_related_papers_pubmed(symbol)
    alphafold = await fetch_uniprot_accession(symbol)
    gene_structure = await fetch_gene_structure(symbol)
    
    return {
        "gene": gene,
        "papers": papers,
        "alphafold": alphafold,
        "gene_structure": gene_structure
    }

@app.post("/api/crispr/design")
async def design_guides(payload: CrisprRequest):

    sequence = clean_sequence(
        payload.sequence
    )

    print("Raw sequence:", payload.sequence)
    print("Cleaned sequence:", sequence)
    print("Cleaned length:", len(sequence))

    if len(sequence)<23:
        raise HTTPException(
            status_code=400,
            detail="Sequence too short. Please enter at least 23 DNA bases."
        )

    guides=find_guides(sequence)

    return {
        "input_length":len(sequence),
        "guide_count":len(guides),
        "guides":guides[:20]
    }