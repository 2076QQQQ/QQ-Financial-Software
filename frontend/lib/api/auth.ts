// ============================================================================
// 核心 HTTP 请求封装
// ============================================================================

const API_BASE = '/api';
// 处理 HTTP 响应的通用逻辑
const handleResponse = async (res: Response) => {
  const data = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    // 如果是 401 未授权，可能需要重定向到登录页，或者抛出特定错误
    const error = new Error(data.message || 'Request failed');
    (error as any).status = res.status;
    (error as any).data = data;
    throw error;
  }
  return data;
};

// ★★★ 修复点：添加 credentials: 'include' ★★★

// GET 请求
export const get = async (url: string) => {
  const res = await fetch(`${API_BASE}${url}`, { 
    method: 'GET',
    credentials: 'include' // 必须加这一行，允许携带 Cookie
  });
  return handleResponse(res);
};

// POST 请求
export const post = async (url: string, body?: any) => {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // 必须加这一行
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
};

// PUT 请求
export const put = async (url: string, body?: any) => {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // 必须加这一行
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse(res);
};

// DELETE 请求
export const del = async (url: string) => {
  const res = await fetch(`${API_BASE}${url}`, { 
    method: 'DELETE',
    credentials: 'include' // 必须加这一行
  });
  return handleResponse(res);
};

// ============================================================================
// 业务 API 定义 (保持不变)
// ============================================================================

export const checkEmail = (email: string) => post('/api/auth/check-email', { email });
export const login = (email: string, password: string) => post('/api/auth/login', { email, password });
export const logout = () => post('/api/auth/logout');
export const registerCompany = (email: string, name: string, companyName: string, password: string) => post('/api/auth/register-company', { email, name, companyName, password });
export const me = () => get('/user/me');
export const activateInfo = (token: string) => get(`/api/auth/activate?token=${encodeURIComponent(token)}`);
export const activate = (token: string, name: string, password: string) => post('/api/auth/activate', { token, name, password });
export const resetRequest = (email: string) => post('/api/auth/reset-request', { email });
export const resetVerify = (token: string) => get(`/api/auth/reset-verify?token=${encodeURIComponent(token)}`);
export const resetConfirm = (token: string, newPassword: string) => post('/api/auth/reset-confirm', { token, newPassword });

// Settings
export const getSubjects = () => get('/api/settings/subjects');
export const createSubject = (payload: any) => post('/api/settings/subjects', payload);
export const updateSubject = (payload: any) => put('/api/settings/subjects', payload);
export const deleteSubject = (id: string) => del(`/api/settings/subjects?id=${encodeURIComponent(id)}`);

export const getFundAccounts = () => get('/api/settings/fund-accounts');
export const createFundAccount = (payload: any) => post('/api/settings/fund-accounts', payload);
export const updateFundAccountApi = (payload: any) => put('/api/settings/fund-accounts', payload);
export const deleteFundAccountApi = (id: string) => del(`/api/settings/fund-accounts?id=${encodeURIComponent(id)}`);

export const getAuxiliaryTypes = () => get('/api/settings/auxiliary-types');
export const getAuxiliaryItems = (typeId?: string) => {
  const query = typeId ? `?typeId=${encodeURIComponent(typeId)}` : '';
  return get('/api/settings/auxiliary-items' + query);
};
export const createAuxiliaryItem = (payload: any) => post('/api/settings/auxiliary-items', payload);
export const updateAuxiliaryItemApi = (id: string, payload: any) => put('/api/settings/auxiliary-items', { ...payload, id });
export const deleteAuxiliaryItemApi = (id: string) => del(`/api/settings/auxiliary-items?id=${encodeURIComponent(id)}`);

export const trialBalance = (items: any[]) => post('/api/settings/initial-data/trial-balance', { items });
export const saveInitialBalances = (items: any[]) => post('/api/initial-balances/batch', items);
export const completeInitialization = () => post('/api/settings/initialization/complete');
export const getAccountBooks = () => get('/api/settings/account-books');
export const createAccountBook = (payload: any) => post('/api/settings/account-books', payload);
export const updateAccountBook = (payload: { id: string; [key: string]: any }) => put('/api/settings/account-books', payload);
export const deleteAccountBook = (id: string) => del(`/api/settings/account-books?id=${encodeURIComponent(id)}`);

// 标记账套设置完成
export const completeAccountBook = () => post('/api/company/account-book/complete');