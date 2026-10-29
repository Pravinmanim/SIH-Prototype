const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

// In-memory cache for fast GET responses (Vercel-grade responsiveness)
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const getCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 25000; // 25 seconds cache for read responses

function invalidateCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    getCache.clear();
    return;
  }
  for (const key of getCache.keys()) {
    if (key.startsWith(endpointPrefix)) {
      getCache.delete(key);
    }
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, useCache = false): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Check GET cache
  if (useCache && options.method === 'GET') {
    const cached = getCache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }
  }

  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensure HttpOnly cookies are transmitted
  });

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData = null;
    try {
      errorData = await response.json();
      if (errorData.detail) {
        errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // Non-JSON response
    }
    throw new ApiError(errorMessage, response.status, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();

  // Cache successful GET responses
  if (useCache && options.method === 'GET') {
    getCache.set(url, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, { useCache = true }: { useCache?: boolean } = {}) => 
    request<T>(endpoint, { method: 'GET' }, useCache),
  post: async <T>(endpoint: string, body?: any) => {
    invalidateCache(); // Invalidate on write mutations
    return request<T>(endpoint, { 
      method: 'POST', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    });
  },
  put: async <T>(endpoint: string, body?: any) => {
    invalidateCache(); // Invalidate on write mutations
    return request<T>(endpoint, { 
      method: 'PUT', 
      body: body instanceof FormData ? body : JSON.stringify(body) 
    });
  },
  del: async <T>(endpoint: string) => {
    invalidateCache(); // Invalidate on write mutations
    return request<T>(endpoint, { method: 'DELETE' });
  },
  clearCache: () => invalidateCache(),
};
