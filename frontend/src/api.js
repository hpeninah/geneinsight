const API_BASE = 'http://127.0.0.1:8000';

export async function fetchGeneReport(symbol) {
  const response = await fetch(`${API_BASE}/api/gene/${encodeURIComponent(symbol)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch gene report.');
  }

  return response.json();
}

export async function designCrisprGuides(sequence) {
  const response = await fetch(`${API_BASE}/api/crispr/design`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sequence,
      pam: 'NGG',
      guide_length: 20
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to design guides.');
  }

  return response.json();
}