let csrfToken;
let restoring;
export async function restoreSession() {
  restoring ??= request('/auth/session').then(data => { csrfToken = data.csrfToken; return data; }).finally(() => { restoring = null; });
  return restoring;
}
export async function request(path, { method = 'GET', body, retry = true } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: {
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? { 'X-CSRF-Token': csrfToken || '' } : {}),
    }, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  } catch { throw { code: 'NETWORK_ERROR' }; }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({ error: { code: 'INTERNAL_ERROR' } }));
  if (!response.ok) {
    if (data.error?.code === 'CSRF_INVALID' && retry) { await restoreSession(); return request(path, { method, body, retry: false }); }
    throw data.error || { code: 'INTERNAL_ERROR' };
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}
