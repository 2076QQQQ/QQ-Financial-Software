export const post = async (url: string, body?: any) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
};

export const get = async (url: string) => {
  const res = await fetch(url, { method: 'GET' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, data };
  return data;
};

export const checkEmail = (email: string) => post('/api/auth/check-email', { email });
export const login = (email: string, password: string) => post('/api/auth/login', { email, password });
export const registerCompany = (email: string, name: string, companyName: string, password: string) => post('/api/auth/register-company', { email, name, companyName, password });
export const activateInfo = (token: string) => get(`/api/auth/activate?token=${encodeURIComponent(token)}`);
export const activate = (token: string, name: string, password: string) => post('/api/auth/activate', { token, name, password });
export const resetRequest = (email: string) => post('/api/auth/reset-request', { email });
export const resetVerify = (token: string) => get(`/api/auth/reset-verify?token=${encodeURIComponent(token)}`);
export const resetConfirm = (token: string, newPassword: string) => post('/api/auth/reset-confirm', { token, newPassword });
export const me = () => get('/api/user/me');
export const completeAccountBook = () => post('/api/company/account-book/complete');