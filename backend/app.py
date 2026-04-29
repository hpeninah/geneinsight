from fastapi import FastAPI, HTTPException
# from fastapi.responses import FileResponse
# from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import asyncio
import httpx
import re
import time
import xml.etree.ElementTree as ET


app = FastAPI(title="GeneInsight Lite")


# -----------------------------
# CORS / Static files
# -----------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://geneinsight.vercel.app/",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_index():
    return {"message": "GeneInsight API is running"}

# app.mount("/static", StaticFiles(directory="static"), name="static")


# @app.get("/")
# def read_index():
#     return FileResponse("static/index.html")


# -----------------------------
# Simple built-in cache
# No external packages needed
# -----------------------------

cache = {}


def get_from_cache(key: str):
    item = cache.get(key)

    if item is None:
        return None

    if time.time() > item["expires_at"]:
        del cache[key]
        return None

    return item["value"]


def save_to_cache(key: str, value, ttl_seconds: int):
    cache[key] = {
        "value": value,
        "expires_at": time.time() + ttl_seconds,
    }


# -----------------------------
# Request models
# -----------------------------

class CrisprRequest(BaseModel):
    sequence: str
    pam: str = "NGG"
    guide_length: int = 20


# -----------------------------
# Gene information: MyGene.info
# -----------------------------

async def fetch_gene_data(symbol: str):
    url = "https://mygene.info/v3/query"

    params = {
        "q": f"symbol:{symbol}",
        "species": "human",
        "size": 1,
        "fields": "symbol,name,summary,entrezgene",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
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


# -----------------------------
# Literature: PubMed / NCBI
# -----------------------------

async def fetch_related_papers_pubmed(symbol: str, topic: str = "", limit: int = 10):
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    tool_name = "geneinsight_lite"
    email = "student@example.com"

    limit = max(1, min(int(limit), 100))

    symbol = symbol.strip().upper()
    topic = topic.strip()

    if topic:
        topic_words = [
            word.strip()
            for word in topic.replace(",", " ").split()
            if word.strip()
        ]

        # AND keeps the topic focused.
        # If this feels too strict later, change AND to OR.
        topic_query = " AND ".join(
            [f"{word}[Title/Abstract]" for word in topic_words]
        )

        search_term = (
            f"({topic_query}) AND "
            f"({symbol}[Title/Abstract] OR {symbol}[All Fields])"
        )
    else:
        search_term = f"{symbol}[Title/Abstract] OR {symbol}[All Fields]"

    async with httpx.AsyncClient(timeout=12.0) as client:
        search_params = {
            "db": "pubmed",
            "term": search_term,
            "retmax": limit,
            "sort": "relevance" if topic else "pub date",
            "retmode": "json",
            "tool": tool_name,
            "email": email,
        }

        search_response = await client.get(
            f"{base}/esearch.fcgi",
            params=search_params,
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
            params=fetch_params,
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
            "abstract": abstract[:700],
            "pmid": pmid,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else "",
        })

    return papers


# -----------------------------
# Protein structure: UniProt + AlphaFold
# -----------------------------

def classify_plddt(score):
    if score is None:
        return {
            "label": "Unavailable",
            "color": "gray",
            "description": "No model confidence score was available.",
        }

    if score >= 90:
        return {
            "label": "Very high confidence",
            "color": "blue",
            "description": "Most residues are predicted with very high local confidence.",
        }

    if score >= 70:
        return {
            "label": "Confident",
            "color": "green",
            "description": "The model is generally reliable, but should still be interpreted with biological context.",
        }

    if score >= 50:
        return {
            "label": "Low confidence",
            "color": "yellow",
            "description": "Some regions may be flexible, disordered, or less reliable.",
        }

    return {
        "label": "Very low confidence",
        "color": "red",
        "description": "The model should be interpreted with caution.",
    }


def get_uniprot_protein_name(entry):
    return (
        entry
        .get("proteinDescription", {})
        .get("recommendedName", {})
        .get("fullName", {})
        .get("value")
    )


async def fetch_uniprot_accession(symbol: str):
    """
    Fast protein lookup for the main gene report.

    This gets only the UniProt accession, protein name, and basic AlphaFold viewer links.
    It does NOT fetch AlphaFold confidence here because that slows down the main search.
    """
    url = "https://rest.uniprot.org/uniprotkb/search"

    params = {
        "query": f"gene_exact:{symbol} AND organism_id:9606",
        "fields": "accession,gene_names,protein_name",
        "format": "json",
        "size": 5,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
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

    protein_name = get_uniprot_protein_name(best_entry)

    return {
        "accession": accession,
        "protein_name": protein_name,
        "alphafold_entry_url": f"https://alphafold.ebi.ac.uk/entry/{accession}",
        "molstar_embed_url": f"https://molstar.org/viewer/?afdb={accession}&hide-controls=1",
        "cif_url": f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-model_v6.cif",
        "pdb_url": f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-model_v6.pdb",
        "pae_url": f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-predicted_aligned_error_v6.json",
    }


async def fetch_confidence_summary(confidence_url: str, pdb_url: str = ""):
    """
    Try to fetch AlphaFold confidence JSON first.
    If unavailable, fall back to parsing pLDDT from the PDB B-factor column.
    """
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(confidence_url)

            if response.status_code != 404:
                response.raise_for_status()
                data = response.json()

                scores = extract_confidence_scores_from_json(data)

                if scores:
                    return summarize_plddt_scores(scores)

    except Exception as error:
        print("Confidence JSON unavailable, trying PDB fallback:", error)

    if pdb_url:
        try:
            return await fetch_confidence_summary_from_pdb(pdb_url)
        except Exception as error:
            print("PDB confidence fallback unavailable:", error)

    return {}


def extract_confidence_scores_from_json(data):
    scores = []

    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                score = (
                    item.get("confidenceScore")
                    or item.get("plddt")
                    or item.get("score")
                )
            else:
                score = item

            try:
                score = float(score)
                if 0 <= score <= 100:
                    scores.append(score)
            except (TypeError, ValueError):
                pass

    elif isinstance(data, dict):
        possible_keys = [
            "confidenceScore",
            "confidenceScores",
            "plddt",
            "scores",
        ]

        for key in possible_keys:
            values = data.get(key)

            if isinstance(values, list):
                for value in values:
                    try:
                        value = float(value)
                        if 0 <= value <= 100:
                            scores.append(value)
                    except (TypeError, ValueError):
                        pass

    return scores


async def fetch_confidence_summary_from_pdb(pdb_url: str):
    """
    AlphaFold stores pLDDT in the B-factor/tempFactor column of the PDB file.
    We use CA atoms only so each residue is counted once.
    """
    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(pdb_url)

        if response.status_code == 404:
            return {}

        response.raise_for_status()
        pdb_text = response.text

    scores = []

    for line in pdb_text.splitlines():
        if not line.startswith("ATOM"):
            continue

        atom_name = line[12:16].strip()

        # Count one score per amino acid residue.
        if atom_name != "CA":
            continue

        try:
            b_factor = float(line[60:66].strip())

            if 0 <= b_factor <= 100:
                scores.append(b_factor)
        except ValueError:
            pass

    if not scores:
        return {}

    return summarize_plddt_scores(scores)


def summarize_plddt_scores(scores):
    total = len(scores)

    very_high = sum(1 for score in scores if score > 90)
    high = sum(1 for score in scores if 70 < score <= 90)
    low = sum(1 for score in scores if 50 < score <= 70)
    very_low = sum(1 for score in scores if score <= 50)

    mean_plddt = round(sum(scores) / total, 2)

    return {
        "mean_plddt": mean_plddt,
        "plddt_distribution": {
            "very_high": round((very_high / total) * 100, 1),
            "high": round((high / total) * 100, 1),
            "low": round((low / total) * 100, 1),
            "very_low": round((very_low / total) * 100, 1),
        },
    }


async def fetch_alphafold_metadata(accession: str):
    """
    Slower AlphaFold metadata.
    This is only called through /api/alphafold/{accession}.
    """
    url = f"https://alphafold.ebi.ac.uk/api/prediction/{accession}"

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url)

        if response.status_code == 404:
            return {}

        response.raise_for_status()
        data = response.json()

    if not data:
        return {}

    entry = data[0] if isinstance(data, list) else data

    latest_version = entry.get("latestVersion") or entry.get("version") or 6

    pdb_url = (
        entry.get("pdbUrl")
        or f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-model_v{latest_version}.pdb"
    )

    confidence_url = (
        entry.get("confidenceUrl")
        or f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-confidence_v{latest_version}.json"
    )

    try:
        confidence_summary = await asyncio.wait_for(
            fetch_confidence_summary(confidence_url, pdb_url=pdb_url),
            timeout=6,
        )
    except Exception as error:
        print("AlphaFold confidence summary unavailable:", error)
        confidence_summary = {}

    mean_plddt = (
        confidence_summary.get("mean_plddt")
        or entry.get("globalMetricValue")
        or entry.get("confidenceScore")
        or entry.get("meanPlddt")
    )

    if mean_plddt is not None:
        try:
            mean_plddt = round(float(mean_plddt), 2)
        except (TypeError, ValueError):
            mean_plddt = None

    confidence = classify_plddt(mean_plddt)

    return {
        "entry_id": entry.get("entryId"),
        "protein_name": entry.get("uniprotDescription") or entry.get("proteinDescription"),
        "organism": entry.get("organismScientificName"),
        "tax_id": entry.get("taxId"),
        "sequence_length": entry.get("uniprotEnd"),
        "model_created_date": entry.get("modelCreatedDate"),
        "latest_version": latest_version,

        "mean_plddt": mean_plddt,
        "confidence_label": confidence["label"],
        "confidence_color": confidence["color"],
        "confidence_description": confidence["description"],

        "cif_url": entry.get("cifUrl") or f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-model_v{latest_version}.cif",
        "pdb_url": pdb_url,
        "pae_url": entry.get("paeDocUrl") or f"https://alphafold.ebi.ac.uk/files/AF-{accession}-F1-predicted_aligned_error_v{latest_version}.json",
        "confidence_url": confidence_url,

        **confidence_summary,
    }


# -----------------------------
# Gene structure: Ensembl
# -----------------------------

async def fetch_gene_structure(symbol: str):
    url = f"https://rest.ensembl.org/lookup/symbol/homo_sapiens/{symbol}"

    params = {
        "expand": 1,
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    async with httpx.AsyncClient(timeout=12.0) as client:
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
                "relative_end": exon_end - tx_start,
            })

        return {
            "transcript_id": transcript.get("id"),
            "biotype": transcript.get("biotype"),
            "start": tx_start,
            "end": tx_end,
            "length": tx_length,
            "strand": transcript.get("strand", data.get("strand", 1)),
            "exon_count": len(exon_blocks),
            "exons": exon_blocks,
        }

    transcript_payloads = [
        build_transcript_payload(transcript)
        for transcript in transcripts_with_exons
    ]

    transcript_payloads.sort(
        key=lambda transcript: (
            transcript["biotype"] == "protein_coding",
            transcript["length"],
        ),
        reverse=True,
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
        "transcripts": transcript_payloads[:10],
    }


# -----------------------------
# CRISPR helper functions
# -----------------------------

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
    full_sequence: str,
):
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
        "notes": notes,
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
                    full_sequence=sequence,
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

                original_guide_start = len(sequence) - guide_end
                original_pam_start = len(sequence) - (i + 3)

                add_guide_result(
                    results=results,
                    guide=guide,
                    pam=triplet,
                    guide_start=original_guide_start,
                    pam_start=original_pam_start,
                    strand="-",
                    full_sequence=sequence,
                )

    results.sort(key=lambda result: result["score"], reverse=True)

    return results


# -----------------------------
# API routes
# -----------------------------

@app.get("/api/gene/{symbol}")
async def get_gene_report(symbol: str):
    symbol = symbol.strip().upper()

    if not symbol:
        raise HTTPException(
            status_code=400,
            detail="Gene symbol is required.",
        )

    cache_key = f"gene_report:{symbol}"
    cached_result = get_from_cache(cache_key)

    if cached_result is not None:
        return cached_result

    gene = await fetch_gene_data(symbol)

    if gene is None:
        raise HTTPException(
            status_code=404,
            detail=f"No gene found for symbol '{symbol}'.",
        )

    async def safe_fetch_papers():
        try:
            return await asyncio.wait_for(
                fetch_related_papers_pubmed(symbol, limit=5),
                timeout=8,
            )
        except Exception as error:
            print("PubMed unavailable or timed out:", error)
            return []

    async def safe_fetch_alphafold():
        try:
            return await asyncio.wait_for(
                fetch_uniprot_accession(symbol),
                timeout=8,
            )
        except Exception as error:
            print("UniProt/AlphaFold unavailable or timed out:", error)
            return None

    async def safe_fetch_gene_structure():
        try:
            return await asyncio.wait_for(
                fetch_gene_structure(symbol),
                timeout=10,
            )
        except Exception as error:
            print("Ensembl unavailable or timed out:", error)
            return None

    papers, alphafold, gene_structure = await asyncio.gather(
        safe_fetch_papers(),
        safe_fetch_alphafold(),
        safe_fetch_gene_structure(),
    )

    result = {
        "gene": gene,
        "papers": papers,
        "alphafold": alphafold,
        "gene_structure": gene_structure,
    }

    save_to_cache(cache_key, result, ttl_seconds=60 * 60)

    return result


@app.get("/api/gene-structure/{symbol}")
async def get_gene_structure(symbol: str):
    symbol = symbol.strip().upper()

    if not symbol:
        raise HTTPException(
            status_code=400,
            detail="Gene symbol is required.",
        )

    cache_key = f"gene_structure:{symbol}"
    cached_result = get_from_cache(cache_key)

    if cached_result is not None:
        return cached_result

    try:
        gene_structure = await asyncio.wait_for(
            fetch_gene_structure(symbol),
            timeout=10,
        )

        result = {
            "symbol": symbol,
            "gene_structure": gene_structure,
        }

        save_to_cache(cache_key, result, ttl_seconds=60 * 60)

        return result

    except Exception as error:
        print("Ensembl unavailable or timed out:", error)
        raise HTTPException(
            status_code=503,
            detail="Gene structure is temporarily unavailable.",
        )


@app.get("/api/alphafold/{accession}")
async def get_alphafold_metadata(accession: str):
    accession = accession.strip().upper()

    if not accession:
        raise HTTPException(
            status_code=400,
            detail="Accession is required.",
        )

    cache_key = f"alphafold_metadata:{accession}"
    cached_result = get_from_cache(cache_key)

    if cached_result is not None:
        return cached_result

    try:
        metadata = await asyncio.wait_for(
            fetch_alphafold_metadata(accession),
            timeout=8,
        )

        save_to_cache(cache_key, metadata, ttl_seconds=60 * 60 * 6)

        return metadata

    except Exception as error:
        print("AlphaFold metadata unavailable:", error)
        raise HTTPException(
            status_code=503,
            detail="AlphaFold metadata is temporarily unavailable.",
        )


@app.get("/api/papers/{symbol}")
async def get_papers(symbol: str, topic: str = "", limit: int = 15):
    symbol = symbol.strip().upper()
    topic = topic.strip()
    limit = max(1, min(int(limit), 100))

    if not symbol:
        raise HTTPException(
            status_code=400,
            detail="Gene symbol is required.",
        )

    cache_key = f"papers:{symbol}:{topic}:{limit}"
    cached_result = get_from_cache(cache_key)

    if cached_result is not None:
        return cached_result

    try:
        papers = await fetch_related_papers_pubmed(
            symbol=symbol,
            topic=topic,
            limit=limit,
        )

        result = {
            "symbol": symbol,
            "topic": topic,
            "limit": limit,
            "paper_count": len(papers),
            "papers": papers,
        }

        save_to_cache(cache_key, result, ttl_seconds=60 * 30)

        return result

    except Exception as error:
        print("PubMed paper search failed:", error)
        raise HTTPException(
            status_code=503,
            detail="PubMed search is temporarily unavailable.",
        )


@app.post("/api/crispr/design")
async def design_guides(payload: CrisprRequest):
    sequence = clean_sequence(payload.sequence)

    if len(sequence) < payload.guide_length + 3:
        raise HTTPException(
            status_code=400,
            detail=f"Sequence too short. Please enter at least {payload.guide_length + 3} DNA bases.",
        )

    guides = find_guides(
        sequence=sequence,
        pam=payload.pam,
        guide_length=payload.guide_length,
    )

    return {
        "input_length": len(sequence),
        "pam": payload.pam,
        "guide_length": payload.guide_length,
        "guide_count": len(guides),
        "guides": guides[:20],
    }