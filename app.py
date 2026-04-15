from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx
import xml.etree.ElementTree as ET

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
    email = "student@example.com"  # replace with someone's email if you want

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Step 1: Search PubMed
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
    """
    find reviewed UniProt accession for gene symbol
    """
    url = "https://rest.uniprot.org/uniprotkb/search"
    params = {
        "query": f'gene_exact:{symbol} AND organism_id:9606',
        "fields": "accession,gene_names,protein_name,reviewed",
        "format": "json",
        "size": 1
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    results = data.get("results", [])
    if not results:
        return None
    
    entry = results[0]
    accession = entry.get("primaryAccession")

    if not accession:
        return None
    
    return {
        "accession": accession,
        "alphafold_entry_url": f"https://alphafold.com/entry/AF-{accession}-F1"
    }


@app.get("/api/gene/{symbol}")
async def get_gene_report(symbol: str):
    symbol = symbol.strip().upper()

    if not symbol:
        raise HTTPException(status_code=400, detail="Gene symbol is required.")

    gene = await fetch_gene_data(symbol)
    if gene is None:
        raise HTTPException(status_code=404, detail=f"No gene found for symbol '{symbol}'.")

    papers = await fetch_related_papers_pubmed(symbol)

    return {
        "gene": gene,
        "papers": papers
    }
