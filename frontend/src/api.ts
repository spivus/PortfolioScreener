import type { PortfolioPosition } from './types';

const API_BASE = 'http://localhost:8000/api';

export async function uploadCSV(file: File): Promise<PortfolioPosition[]> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/portfolio/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || `Upload fehlgeschlagen (Status ${response.status})`);
  }

  return response.json();
}

export async function getPortfolio(): Promise<PortfolioPosition[]> {
  const response = await fetch(`${API_BASE}/portfolio`);

  if (!response.ok) {
    throw new Error(`Portfolio konnte nicht geladen werden (Status ${response.status})`);
  }

  return response.json();
}

export async function deletePortfolio(): Promise<void> {
  const response = await fetch(`${API_BASE}/portfolio`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Portfolio konnte nicht geloescht werden (Status ${response.status})`);
  }
}
