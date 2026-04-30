const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/game';

export interface PuzzleResponse {
  puzzle_id: number;
  word: string;
  scrambled: string[];
  length: number;
  difficulty: string;
  language: string;
}

export interface ValidateResponse {
  valid: boolean;
  score: number;
  message: string;
  meaning?: string | null;
}

export async function fetchPuzzle(minLength = 6, maxLength = 9): Promise<PuzzleResponse> {
  const res = await fetch(`${BASE_URL}/puzzle/?min_length=${minLength}&max_length=${maxLength}`);
  if (!res.ok) throw new Error('Failed to fetch puzzle');
  return res.json();
}

export async function validateWord(word: string): Promise<ValidateResponse> {
  const res = await fetch(`${BASE_URL}/validate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) throw new Error('Failed to validate word');
  return res.json();
}
