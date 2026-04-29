const API_BASE =
  import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';

export async function fetchGeneReport(symbol) {
  const response = await fetch(
    `${API_BASE}/api/gene/${encodeURIComponent(symbol)}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch gene report.');
  }

  return response.json();
}

export async function fetchAlphaFoldMetadata(accession) {
  const response = await fetch(
    `${API_BASE}/api/alphafold/${encodeURIComponent(accession)}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch AlphaFold metadata.');
  }

  return response.json();
}

export async function designCrisprGuides(sequence) {
  const response = await fetch(`${API_BASE}/api/crispr/design`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sequence }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to design CRISPR guides.');
  }

  return response.json();
}

export async function fetchPapers(symbol, topic = '', limit = 15) {
  const params = new URLSearchParams({
    topic,
    limit: String(limit),
  });

  const response = await fetch(
    `${API_BASE}/api/papers/${encodeURIComponent(symbol)}?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch papers.');
  }

  return response.json();
}