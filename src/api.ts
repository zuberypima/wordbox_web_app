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

export interface AuthResponse {
  access: string;
  refresh: string;
  email?: string;
}

export async function fetchPuzzle(minLength = 6, maxLength = 9): Promise<PuzzleResponse> {
  const res = await fetch(`${BASE_URL}/puzzle/?min_length=${minLength}&max_length=${maxLength}`);
  if (!res.ok) throw new Error('Failed to fetch puzzle');
  return res.json();
}

export async function validateWord(word: string, token?: string | null): Promise<ValidateResponse> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/validate/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ word }),
  });
  if (!res.ok) throw new Error('Failed to validate word');
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed. Please check your credentials.');
  return res.json();
}

export async function register(email: string, password: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Registration failed.');
  }
  return res.json();
}
