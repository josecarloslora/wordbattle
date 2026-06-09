const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let _getToken = () => null;
let _setToken = () => {};

export function initApi(getToken, setToken) {
  _getToken = getToken;
  _setToken = setToken;
}

async function request(method, path, body) {
  const token = _getToken();
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    credentials: 'include',
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    const refresh = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refresh.ok) {
      const data = await refresh.json();
      _setToken(data.data.accessToken);
      opts.headers.Authorization = `Bearer ${data.data.accessToken}`;
      res = await fetch(`${BASE}${path}`, opts);
    }
  }

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data;
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  delete: (path) => request('DELETE', path),
};

export default api;
