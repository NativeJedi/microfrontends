// Static for dev; becomes runtime environment config in iteration 13.
const API_BASE_URL = 'http://localhost:4000';

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status}`);
  // Our own API: response bodies are trusted like typed imports (no runtime schema yet).
  return (await response.json()) as T;
}
