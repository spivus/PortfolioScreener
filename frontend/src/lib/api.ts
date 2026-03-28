const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function setToken(token: string) {
  localStorage.setItem("access_token", token);
}

export function clearToken() {
  localStorage.removeItem("access_token");
}

export async function authFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Content-Type nicht setzen bei FormData (Browser setzt boundary automatisch)
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    localStorage.removeItem("user");
    window.location.href = "/login";
  }
  return res;
}

export async function login(
  email: string,
  password: string,
): Promise<{ access_token: string; user: { id: string; email: string; name: string } }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Login fehlgeschlagen");
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Registrierung fehlgeschlagen");
  }
}

export async function uploadMusterportfolio(
  file: File,
): Promise<Record<string, unknown>> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch("/musterportfolio/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload fehlgeschlagen");
  }
  return res.json();
}

export async function uploadPortfolio(
  file: File,
  kundeName: string,
): Promise<{
  portfolio_id: string;
  kunde_name: string;
  positionen_count: number;
  positionen: Record<string, unknown>[];
}> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("kunde_name", kundeName);
  const res = await authFetch("/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Upload fehlgeschlagen");
  }
  return res.json();
}
