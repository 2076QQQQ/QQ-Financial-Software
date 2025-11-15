import http from 'http';
import { parse as parseUrl } from 'url';
import { StringDecoder } from 'string_decoder';
import crypto from 'crypto';
import db, { initDb } from './database';
import bcrypt from 'bcryptjs';
import { checkEmailHandler } from './Api/auth/check-email';

const secret = 'dev_secret_key';

const json = (res: http.ServerResponse, status: number, body: any, headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
};

const readBody = (req: http.IncomingMessage): Promise<any> => new Promise((resolve) => {
  const decoder = new StringDecoder('utf-8');
  let buffer = '';
  req.on('data', (data) => { buffer += decoder.write(data); });
  req.on('end', () => {
    buffer += decoder.end();
    try { resolve(buffer ? JSON.parse(buffer) : {}); } catch { resolve({}); }
  });
});

const setCookie = (res: http.ServerResponse, name: string, value: string, options: { maxAge?: number } = {}) => {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
  res.setHeader('Set-Cookie', parts.join('; '));
};

const parseCookies = (req: http.IncomingMessage): Record<string, string> => {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > -1) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1));
    return acc;
  }, {} as Record<string, string>);
};

const sign = (payload: any) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
};

const verify = (token: string) => {
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (expected !== sig) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
};

const getUserFromSession = (req: http.IncomingMessage) => {
  const cookies = parseCookies(req);
  const tok = cookies['session'] || '';
  const payload = tok ? verify(tok) : null;
  return payload && payload.userId ? payload : null;
};

const server = http.createServer(async (req, res) => {
  await initDb();
  const url = parseUrl(req.url || '', true);
  const path = url.pathname || '/';
  if (req.method === 'POST' && path === '/api/auth/check-email') {
    const body = await readBody(req);
    const mockReq = { body } as any;
    const mockRes = {
      status: (code: number) => ({ json: (obj: any) => json(res, code, obj) }),
    } as any;
    return checkEmailHandler(mockReq, mockRes);
  }
  if (req.method === 'POST' && path === '/api/auth/register-company') {
    const body = await readBody(req);
    const { email, name, companyName, password } = body || {};
    if (!email || !name || !companyName || !password) return json(res, 400, { message: 'invalid' });
    await db.read();
    const exists = db.data.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) return json(res, 409, { message: 'exists' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const companyId = `comp_${Date.now()}`;
    const userId = `user_${Date.now()}`;
    db.data.companies.push({ id: companyId, name: String(companyName), has_account_book: false });
    db.data.users.push({ id: userId, email: String(email).toLowerCase(), name: String(name), passwordHash, companyId, role: 'Owner', status: 'Active', failedAttempts: 0, lockedUntil: null });
    await db.write();
    const token = sign({ userId, companyId, role: 'Owner', iat: Date.now() });
    setCookie(res, 'session', token, { maxAge: 60 * 60 * 24 * 7 });
    return json(res, 200, { userId, companyId });
  }
  if (req.method === 'POST' && path === '/api/auth/login') {
    const body = await readBody(req);
    const { email, password } = body || {};
    if (!email || !password) return json(res, 400, { message: 'invalid' });
    await db.read();
    const user = db.data.users.find(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (!user) return json(res, 401, { message: 'unauthorized' });
    const now = Date.now();
    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > now) {
      return json(res, 401, { locked: true, lockedUntil: user.lockedUntil });
    }
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      const attempts = (user.failedAttempts || 0) + 1;
      user.failedAttempts = attempts;
      if (attempts >= 5) user.lockedUntil = new Date(now + 15 * 60 * 1000).toISOString();
      await db.write();
      const locked = !!user.lockedUntil && new Date(user.lockedUntil).getTime() > now;
      return json(res, 401, locked ? { locked: true, lockedUntil: user.lockedUntil } : { message: 'unauthorized' });
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    await db.write();
    const token = sign({ userId: user.id, companyId: user.companyId, role: user.role, iat: Date.now() });
    setCookie(res, 'session', token, { maxAge: 60 * 60 * 24 * 7 });
    return json(res, 200, { userId: user.id, companyId: user.companyId });
  }
  if (req.method === 'POST' && path === '/api/auth/logout') {
    setCookie(res, 'session', '', { maxAge: 0 });
    return json(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/user/me') {
    const payload = getUserFromSession(req);
    if (!payload) return json(res, 401, { message: 'unauthorized' });
    await db.read();
    const user = db.data.users.find(u => u.id === payload.userId);
    const company = db.data.companies.find(c => c.id === payload.companyId);
    if (!user || !company) return json(res, 404, { message: 'not_found' });
    return json(res, 200, { user, company, has_account_book: company.has_account_book });
  }
  if (req.method === 'POST' && path === '/api/company/account-book/complete') {
    const payload = getUserFromSession(req);
    if (!payload) return json(res, 401, { message: 'unauthorized' });
    await db.read();
    const company = db.data.companies.find(c => c.id === payload.companyId);
    if (!company) return json(res, 404, { message: 'not_found' });
    company.has_account_book = true;
    await db.write();
    return json(res, 200, { ok: true });
  }
  if (req.method === 'POST' && path === '/api/invitations/send') {
    const body = await readBody(req);
    const { email, role, companyId, isAdmin, invitedBy } = body || {};
    if (!email || !role || !companyId || !invitedBy) return json(res, 400, { message: 'invalid' });
    await db.read();
    const token = crypto.randomBytes(16).toString('hex');
    const now = new Date();
    const inv = { id: `inv_${Date.now()}`, token, email: String(email).toLowerCase(), companyId: String(companyId), role, isAdmin: !!isAdmin, invitedBy: String(invitedBy), status: 'pending' as const, expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now.toISOString() };
    db.data.invitations.push(inv as any);
    await db.write();
    return json(res, 200, { token });
  }
  if (req.method === 'GET' && path === '/api/auth/activate') {
    const token = url.query.token as string;
    if (!token) return json(res, 400, { message: 'invalid' });
    await db.read();
    const inv = db.data.invitations.find(i => i.token === token);
    if (!inv) return json(res, 404, { message: 'not_found' });
    const exp = new Date(inv.expiresAt).getTime();
    if (Date.now() > exp || inv.status !== 'pending') return json(res, 410, { message: 'expired' });
    const company = db.data.companies.find(c => c.id === inv.companyId);
    return json(res, 200, { email: inv.email, companyName: company ? company.name : '', role: inv.role, isAdmin: inv.isAdmin });
  }
  if (req.method === 'POST' && path === '/api/auth/activate') {
    const body = await readBody(req);
    const { token, name, password } = body || {};
    if (!token || !name || !password) return json(res, 400, { message: 'invalid' });
    await db.read();
    const inv = db.data.invitations.find(i => i.token === token);
    if (!inv) return json(res, 404, { message: 'not_found' });
    const exp = new Date(inv.expiresAt).getTime();
    if (Date.now() > exp || inv.status !== 'pending') return json(res, 410, { message: 'expired' });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = `user_${Date.now()}`;
    db.data.users.push({ id, email: inv.email, name: String(name), passwordHash, companyId: inv.companyId, role: inv.role, status: 'Active', failedAttempts: 0, lockedUntil: null });
    inv.status = 'activated';
    await db.write();
    const tokenSigned = sign({ userId: id, companyId: inv.companyId, role: inv.role, iat: Date.now() });
    setCookie(res, 'session', tokenSigned, { maxAge: 60 * 60 * 24 * 7 });
    return json(res, 200, { userId: id, companyId: inv.companyId });
  }
  if (req.method === 'POST' && path === '/api/auth/reset-request') {
    const body = await readBody(req);
    const { email } = body || {};
    await db.read();
    const user = email ? db.data.users.find(u => u.email.toLowerCase() === String(email).toLowerCase()) : null;
    if (user) {
      const token = crypto.randomBytes(16).toString('hex');
      const now = new Date();
      db.data.passwordResets.push({ id: `pr_${Date.now()}`, token, userId: user.id, expiresAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(), consumed: false, createdAt: now.toISOString() });
      await db.write();
    }
    return json(res, 200, { ok: true });
  }
  if (req.method === 'GET' && path === '/api/auth/reset-verify') {
    const token = url.query.token as string;
    if (!token) return json(res, 400, { message: 'invalid' });
    await db.read();
    const pr = db.data.passwordResets.find(r => r.token === token);
    if (!pr) return json(res, 404, { message: 'not_found' });
    if (pr.consumed || Date.now() > new Date(pr.expiresAt).getTime()) return json(res, 410, { message: 'expired' });
    const user = db.data.users.find(u => u.id === pr.userId);
    return json(res, 200, { email: user ? user.email : '' });
  }
  if (req.method === 'POST' && path === '/api/auth/reset-confirm') {
    const body = await readBody(req);
    const { token, newPassword } = body || {};
    if (!token || !newPassword) return json(res, 400, { message: 'invalid' });
    await db.read();
    const pr = db.data.passwordResets.find(r => r.token === token);
    if (!pr) return json(res, 404, { message: 'not_found' });
    if (pr.consumed || Date.now() > new Date(pr.expiresAt).getTime()) return json(res, 410, { message: 'expired' });
    const user = db.data.users.find(u => u.id === pr.userId);
    if (!user) return json(res, 404, { message: 'not_found' });
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(String(newPassword), salt);
    user.failedAttempts = 0;
    user.lockedUntil = null;
    pr.consumed = true;
    await db.write();
    return json(res, 200, { ok: true });
  }
  json(res, 404, { message: 'not_found' });
});

export default server;

if (require.main === module) {
  server.listen(3000);
}