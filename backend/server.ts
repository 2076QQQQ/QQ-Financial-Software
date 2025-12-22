import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { db, initDb } from './database';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

const app = express();
const PORT = process.env.PORT || 4000;

// 1. 配置中间件
app.use(cors({
  origin: 'http://localhost:3000', 
  credentials: true 
}));

app.use(bodyParser.json());

const secret = 'dev_secret_key';

// --- 辅助函数 ---
const sign = (payload: any) => {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
};

const verify = (token: string) => {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (expected !== sig) return null;
    return JSON.parse(Buffer.from(data, 'base64url').toString());
  } catch { return null; }
};

const requireAuth = (req: any, res: any, next: any) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies: any = {};
  cookieHeader.split(';').forEach((cookie: string) => {
    const parts = cookie.split('=');
    if(parts.length === 2) cookies[parts[0].trim()] = decodeURIComponent(parts[1]);
  });
  
  const token = cookies['session'];
  if (!token) return res.status(401).json({ message: 'unauthorized' });

  const payload = verify(token);
  if (!payload) return res.status(401).json({ message: 'invalid token' });

  req.user = payload;
  next();
};

// ==========================================
// 1. 认证模块 (Auth)
// ==========================================

app.post('/api/auth/check-email', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  const data = db.get();
  const users = data.users || [];
  const user = users.find((u: any) => u.email.toLowerCase() === String(email).toLowerCase());

  if (user) {
    return res.json({ exists: true, name: user.name });
  } else {
    return res.json({ exists: false });
  }
});

app.post('/api/auth/register-company', async (req, res) => {
  const { email, name, companyName, password } = req.body;
  const data = db.get();
  if ((data.users || []).find((u: any) => u.email === email)) {
    return res.status(409).json({ message: 'Email exists' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const companyId = `comp_${Date.now()}`;
  const userId = `user_${Date.now()}`;

  const newCompany = { id: companyId, name: companyName, has_account_book: false };
  const newUser = { id: userId, email, name, passwordHash, companyId, role: 'Owner', status: 'Active' };

  db.update('companies', [...(data.companies || []), newCompany]);
  db.update('users', [...(data.users || []), newUser]);

  const token = sign({ userId, companyId, role: 'Owner' });
  res.setHeader('Set-Cookie', [`session=${token}`, 'Path=/', 'HttpOnly', `Max-Age=${60*60*24*7}`].join('; '));
  
  res.json({ userId, companyId });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const data = db.get();
  
  const users = data.users || [];
  const user = users.find((u: any) => u.email.toLowerCase() === String(email).toLowerCase());
  
  if (!user) return res.status(401).json({ message: 'User not found' });

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Wrong password' });

  const token = sign({ userId: user.id, companyId: user.companyId, role: user.role, iat: Date.now() });
  
  res.setHeader('Set-Cookie', [`session=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${60 * 60 * 24 * 7}`].join('; '));
  
  return res.json({ userId: user.id, companyId: user.companyId });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', [`session=`, 'Path=/', 'HttpOnly', 'Max-Age=0'].join('; '));
  res.json({ ok: true });
});

app.get('/api/user/me', requireAuth, (req: any, res) => {
  const data = db.get();
  const user = (data.users || []).find((u: any) => u.id === req.user.userId);
  const company = (data.companies || []).find((c: any) => c.id === req.user.companyId);
  
  if (!user || !company) return res.status(404).json({ message: 'not_found' });

  const hasSubjectsConfigured = (data.subjects || []).some((s: any) => s.companyId === req.user.companyId);
  const hasFundAccounts = (data.fundAccounts || []).some((a: any) => a.companyId === req.user.companyId);
  const hasInitialBalances = (data.subjects || []).some((s: any) => s.companyId === req.user.companyId && s.hasBalance);
  const accountBooks = (data.accountBooks || []).filter((ab: any) => ab.companyId === req.user.companyId);
  const hasAccountBook = accountBooks.length > 0;

  const companyStatus = { 
    ...company, 
    has_account_book: hasAccountBook,
    has_subjects_configured: hasSubjectsConfigured, 
    has_fund_accounts: hasFundAccounts,
    has_initial_balances: hasInitialBalances 
  };
  
  res.json({ user: { ...user, companyName: company.name }, company: companyStatus });
});

// ==========================================
// 2. 账套设置 (Account Books)
// ==========================================
app.get('/api/settings/account-books', requireAuth, (req: any, res) => {
    const data = db.get();
    const books = (data.accountBooks || []).filter((b: any) => b.companyId === req.user.companyId);
    res.json(books);
});

app.post('/api/settings/account-books', requireAuth, (req: any, res) => {
    const { name, startPeriod, requiresAudit, isActive, fiscalYearStartMonth, taxType, defaultTaxRate } = req.body;
    const data = db.get();
    
    const newBook = {
        id: `ab_${Date.now()}`,
        companyId: req.user.companyId,
        companyName: req.user.companyName,
        name,
        period_start: startPeriod,
        review_enabled: requiresAudit,
        isActive: isActive ?? true,
        fiscalYearStartMonth: fiscalYearStartMonth || 1,
        taxType: taxType || '一般纳税人',
        defaultTaxRate: defaultTaxRate ? Number(defaultTaxRate) : 13,

        // ✅ 修复 1: 显式初始化状态字段 (防止 undefined)
        subjectsConfigured: false,
        auxiliaryConfigured: false,
        fundsConfigured: false, 
        isInitialized: false,

        hadRecords: false,
        createdAt: new Date().toISOString()
    };
    
    db.update('accountBooks', [...(data.accountBooks || []), newBook]);
    res.json(newBook);
});

app.put('/api/settings/account-books', requireAuth, (req: any, res) => {
    const { id, ...updates } = req.body; // 把 id 提取出来，剩下的全是更新内容(包含 fundsConfigured)
    const data = db.get();
    const list = data.accountBooks || [];

    // ✅ 修复 2: 增加调试日志，找出为什么更新失败
    console.log(`[PUT AccountBook] 收到更新请求 ID: ${id}`);
    console.log(`[PUT AccountBook] 更新内容:`, updates);
    console.log(`[PUT AccountBook] 当前用户 CompanyId: ${req.user.companyId}`);

    // 查找目标
    const index = list.findIndex((b: any) => b.id === id && b.companyId === req.user.companyId);
    
    if (index > -1) {
        // 执行更新 (混合旧数据 + 新数据)
        list[index] = { ...list[index], ...updates, updatedAt: new Date().toISOString() };
        db.update('accountBooks', list);
        
        console.log(`[PUT AccountBook] 更新成功! 新状态:`, list[index]);
        res.json(list[index]);
    } else {
        // 如果找不到，打印数据库里现有的 ID 供排查
        console.error(`[PUT AccountBook] 更新失败: 未找到匹配的账套 (ID: ${id})`);
        console.log(`[PUT AccountBook] DB中现有的ID:`, list.map((b:any) => `${b.id} (Company: ${b.companyId})`));
        
        res.status(404).json({ message: 'Not found' });
    }
});

app.delete('/api/settings/account-books', requireAuth, (req: any, res) => {
    const id = req.query.id;
    const companyId = req.user.companyId;
    const data = db.get();

    // 1. 检查账套是否存在
    const bookIndex = (data.accountBooks || []).findIndex((b: any) => b.id === id && b.companyId === companyId);
    if (bookIndex === -1) {
        return res.status(404).json({ message: '账套不存在' });
    }

    // =========================================================
    // 2. 严格校验：检查是否存在业务数据 (Business Data Check)
    // =========================================================
    
    // A. 检查凭证
    const hasVouchers = (data.vouchers || []).some((v: any) => v.accountBookId === id);
    if (hasVouchers) {
        return res.status(403).json({ message: '该账套已录入凭证，禁止删除！请选择“停用”账套。' });
    }

    // B. 检查日记账
    const hasJournal = (data.journalEntries || []).some((j: any) => j.accountBookId === id);
    if (hasJournal) {
        return res.status(403).json({ message: '该账套已有出纳日记账记录，禁止删除！请选择“停用”。' });
    }

    // C. 检查内部转账
    const hasTransfers = (data.internalTransfers || []).some((t: any) => t.accountBookId === id);
    if (hasTransfers) {
        return res.status(403).json({ message: '该账套存在内部转账记录，禁止删除！' });
    }

    // D. 检查期初余额 (只检查是否有金额不为0的记录)
    // 注意：如果是初始化的空记录(0元)，通常可以容忍删除，这里我们只拦截有余额的
    const hasBalance = (data.initialBalances || []).some((b: any) => 
        b.accountBookId === id && (Math.abs(b.initialBalance || 0) > 0)
    );
    if (hasBalance) {
        return res.status(403).json({ message: '该账套已录入期初余额，禁止删除！请先清空余额或选择“停用”。' });
    }

    // =========================================================
    // 3. 执行删除：清理关联的配置数据 (Configuration Cleanup)
    // 能走到这里，说明是空账套，可以安全删除
    // =========================================================
    
    console.log(`[DELETE] 账套 ${id} 校验通过(无业务数据)，开始删除...`);

    const keepFilter = (item: any) => item.accountBookId !== id;

    // 清理科目
    db.update('subjects', (data.subjects || []).filter(keepFilter));
    // 清理资金账户
    db.update('fundAccounts', (data.fundAccounts || []).filter(keepFilter));
    // 清理辅助核算
    db.update('auxiliaryItems', (data.auxiliaryItems || []).filter(keepFilter));
    db.update('auxiliaryCategories', (data.auxiliaryCategories || []).filter(keepFilter));
    // 清理模板
    db.update('voucherTemplates', (data.voucherTemplates || []).filter(keepFilter));
    db.update('closingTemplates', (data.closingTemplates || []).filter(keepFilter));
    // 清理可能存在的0元期初记录
    db.update('initialBalances', (data.initialBalances || []).filter(keepFilter));

    // 删除账套本身
    const newBooks = [...data.accountBooks];
    newBooks.splice(bookIndex, 1);
    db.update('accountBooks', newBooks);

    res.json({ success: true });
});

app.post('/api/company/account-book/complete', requireAuth, (req: any, res) => {
    res.json({ success: true });
});


// ==========================================
// 3. 会计科目 (Subjects) - 完整标准版
// ==========================================

// 定义标准科目库 (符合《小企业会计准则》2013)
const STANDARD_SUBJECTS_LIB = [
    // --- 一、资产类 (1) ---
    { code: '1001', name: '库存现金', category: '资产', direction: '借' },
    { code: '1002', name: '银行存款', category: '资产', direction: '借' },
    { code: '1012', name: '其他货币资金', category: '资产', direction: '借' },
    { code: '1101', name: '短期投资', category: '资产', direction: '借' },
    { code: '1121', name: '应收票据', category: '资产', direction: '借' },
    { code: '1122', name: '应收账款', category: '资产', direction: '借', auxiliaryItems: ['客户'] },
    { code: '1123', name: '预付账款', category: '资产', direction: '借', auxiliaryItems: ['供应商'] },
    { code: '1131', name: '应收股利', category: '资产', direction: '借' },
    { code: '1132', name: '应收利息', category: '资产', direction: '借' },
    { code: '1221', name: '其他应收款', category: '资产', direction: '借', auxiliaryItems: ['人员', '往来单位'] },
    { code: '1401', name: '材料采购', category: '资产', direction: '借' },
    { code: '1402', name: '在途物资', category: '资产', direction: '借' },
    { code: '1403', name: '原材料', category: '资产', direction: '借', auxiliaryItems: ['存货'] }, // ★ 制造业必备
    { code: '1404', name: '材料成本差异', category: '资产', direction: '借' },
    { code: '1405', name: '库存商品', category: '资产', direction: '借', auxiliaryItems: ['存货'] }, // ★ 商业/制造业必备
    { code: '1408', name: '委托加工物资', category: '资产', direction: '借' },
    { code: '1411', name: '周转材料', category: '资产', direction: '借' },
    { code: '1501', name: '长期债券投资', category: '资产', direction: '借' },
    { code: '1511', name: '长期股权投资', category: '资产', direction: '借' },
    { code: '1601', name: '固定资产', category: '资产', direction: '借' },
    { code: '1602', name: '累计折旧', category: '资产', direction: '贷' },
    { code: '1604', name: '在建工程', category: '资产', direction: '借' },
    { code: '1605', name: '工程物资', category: '资产', direction: '借' },
    { code: '1606', name: '固定资产清理', category: '资产', direction: '借' },
    { code: '1701', name: '无形资产', category: '资产', direction: '借' },
    { code: '1702', name: '累计摊销', category: '资产', direction: '贷' },
    { code: '1801', name: '长期待摊费用', category: '资产', direction: '借' },
    { code: '1901', name: '待处理财产损溢', category: '资产', direction: '借' },

    // --- 二、负债类 (2) ---
    { code: '2001', name: '短期借款', category: '负债', direction: '贷' },
    { code: '2201', name: '应付票据', category: '负债', direction: '贷' },
    { code: '2202', name: '应付账款', category: '负债', direction: '贷', auxiliaryItems: ['供应商'] },
    { code: '2203', name: '预收账款', category: '负债', direction: '贷', auxiliaryItems: ['客户'] },
    { code: '2211', name: '应付职工薪酬', category: '负债', direction: '贷' },
        // 职工薪酬通常还有明细，这里先给一级，用户可按需添加
    { code: '2221', name: '应交税费', category: '负债', direction: '贷' }, // 父级，具体子级在下方动态生成
    { code: '2231', name: '应付利息', category: '负债', direction: '贷' },
    { code: '2232', name: '应付利润', category: '负债', direction: '贷' },
    { code: '2241', name: '其他应付款', category: '负债', direction: '贷', auxiliaryItems: ['人员', '往来单位'] },
    { code: '2401', name: '递延收益', category: '负债', direction: '贷' },
    { code: '2501', name: '长期借款', category: '负债', direction: '贷' },
    { code: '2701', name: '长期应付款', category: '负债', direction: '贷' },

    // --- 三、所有者权益类 (3) ---
    { code: '3001', name: '实收资本', category: '所有者权益', direction: '贷', auxiliaryItems: ['股东'] },
    { code: '3002', name: '资本公积', category: '所有者权益', direction: '贷' },
    { code: '3101', name: '盈余公积', category: '所有者权益', direction: '贷' },
    { code: '3103', name: '本年利润', category: '所有者权益', direction: '贷' },
    { code: '3104', name: '利润分配', category: '所有者权益', direction: '贷' },
        { code: '310405', name: '未分配利润', category: '所有者权益', direction: '贷', parentId: '3104' },

    // --- 四、成本类 (5) ---
    { code: '5001', name: '生产成本', category: '成本', direction: '借' },
    { code: '5101', name: '制造费用', category: '成本', direction: '借' },
    { code: '5201', name: '劳务成本', category: '成本', direction: '借' },
    { code: '5301', name: '研发支出', category: '成本', direction: '借' },
    { code: '5401', name: '工程施工', category: '成本', direction: '借' },

    // --- 五、损益类 (6) ---
    { code: '6001', name: '主营业务收入', category: '损益', direction: '贷' },
    { code: '6051', name: '其他业务收入', category: '损益', direction: '贷' },
    { code: '6111', name: '投资收益', category: '损益', direction: '贷' },
    { code: '6301', name: '营业外收入', category: '损益', direction: '贷' },
    { code: '6401', name: '主营业务成本', category: '损益', direction: '借' },
    { code: '6402', name: '其他业务成本', category: '损益', direction: '借' },
    { code: '6403', name: '税金及附加', category: '损益', direction: '借' },
    { code: '6601', name: '销售费用', category: '损益', direction: '借' },
    { code: '6602', name: '管理费用', category: '损益', direction: '借', auxiliaryItems: ['部门'] },
    { code: '6603', name: '财务费用', category: '损益', direction: '借' },
    { code: '6711', name: '营业外支出', category: '损益', direction: '借' },
    { code: '6801', name: '所得税费用', category: '损益', direction: '借' }, // ★ 之前确实漏了，现在补上
    { code: '6901', name: '以前年度损益调整', category: '损益', direction: '借' }, // 实际上借贷均可
];

app.get('/api/settings/subjects', requireAuth, (req: any, res) => {
  const data = db.get();
  const companyId = req.user.companyId;
  const { accountBookId } = req.query;

  // 1. 严格校验账套ID
  if (!accountBookId) {
      return res.status(400).json({ message: '必须指定账套 ID (accountBookId)' });
  }

  // 2. 查询当前账套下的科目
  const bookSubjects = (data.subjects || []).filter((s: any) => 
      s.companyId === companyId && 
      s.accountBookId === accountBookId
  );

  // 3. 如果为空，执行自动初始化 (Auto-Initialization)
  if (bookSubjects.length === 0) {
      console.log(`[Auto Init] 账套 ${accountBookId} 初始化完整科目表...`);

      const activeBook = (data.accountBooks || []).find((b: any) => b.id === accountBookId);
      if (!activeBook) return res.status(404).json({ message: '账套不存在' });
      
      const isGeneralTaxpayer = activeBook.taxType === '一般纳税人';

      // A. 使用标准库 (深拷贝)
      const seed = JSON.parse(JSON.stringify(STANDARD_SUBJECTS_LIB));

      // B. 注入【应交税费】的明细科目
      if (isGeneralTaxpayer) {
          // === 一般纳税人：完整的增值税链条 ===
          seed.push(
              // 222101 应交增值税 (二级)
              { code: '222101', name: '应交增值税', category: '负债', direction: '贷', parentId: '2221' },
              
              // 222101 下的三级明细
              { code: '22210101', name: '进项税额', category: '负债', direction: '借', parentId: '222101' },
              { code: '22210102', name: '销项税额', category: '负债', direction: '贷', parentId: '222101' },
              { code: '22210103', name: '进项税额转出', category: '负债', direction: '贷', parentId: '222101' },
              { code: '22210104', name: '转出未交增值税', category: '负债', direction: '借', parentId: '222101' },
              { code: '22210105', name: '转出多交增值税', category: '负债', direction: '贷', parentId: '222101' },
              { code: '22210109', name: '待抵扣进项税额', category: '资产', direction: '借' }, // 特殊：虽在负债科目下，但通常做借方核算，这里放这里由UI处理

              // 222102 未交增值税 (二级)
              { code: '222102', name: '未交增值税', category: '负债', direction: '贷', parentId: '2221' },

              // 其他税种 (二级)
              { code: '222106', name: '应交企业所得税', category: '负债', direction: '贷', parentId: '2221' },
              { code: '222108', name: '应交城市维护建设税', category: '负债', direction: '贷', parentId: '2221' },
              { code: '222109', name: '应交教育费附加', category: '负债', direction: '贷', parentId: '2221' },
              { code: '222110', name: '应交地方教育附加', category: '负债', direction: '贷', parentId: '2221' },
              { code: '222111', name: '应交个人所得税', category: '负债', direction: '贷', parentId: '2221' }
          );
      } else {
          // === 小规模纳税人：简单结构 ===
          seed.push(
              { code: '222101', name: '应交增值税', category: '负债', direction: '贷', parentId: '2221' },
              { code: '222106', name: '应交企业所得税', category: '负债', direction: '贷', parentId: '2221' },
              { code: '222111', name: '应交个人所得税', category: '负债', direction: '贷', parentId: '2221' }
          );
      }

      // C. 生成数据并保存
      const newSubjects = seed.map((s: any) => ({
          ...s,
          id: `subj_${accountBookId}_${s.code}`,
          companyId,
          accountBookId: accountBookId,
          isActive: true,
          isBuiltIn: true,
          hasBalance: false,
          hasChildren: false,
          // 简单的层级计算：4位=1级, 6位=2级, 8位=3级, 10位=4级
          level: (s.code.length - 2) / 2
      }));

      // D. 处理 parentId (将 code 映射回 id)
      const codeMap = new Map();
      newSubjects.forEach((s: any) => codeMap.set(s.code, s.id));

      newSubjects.forEach((s: any) => {
          // 如果 seed 里写了 parentId (如 '2221')，则使用它
          // 否则根据 code 推断 (去掉最后2位)
          let pCode = s.parentId; 
          if (!pCode && s.code.length > 4) {
              pCode = s.code.substring(0, s.code.length - 2);
          }

          if (pCode && codeMap.has(pCode)) {
              s.parentId = codeMap.get(pCode);
              // 标记父级有子节点
              const p = newSubjects.find((x: any) => x.id === s.parentId);
              if (p) p.hasChildren = true;
          } else {
              s.parentId = null;
          }
      });

      // E. 写入数据库
      db.update('subjects', [...(data.subjects || []), ...newSubjects]);
      
      // F. 标记账套已初始化
      const books = data.accountBooks || [];
      const idx = books.findIndex((b: any) => b.id === accountBookId);
      if (idx > -1) {
          books[idx].subjectsConfigured = true;
          db.update('accountBooks', books);
      }

      return res.json(newSubjects);
  }

  res.json(bookSubjects);
});

app.post('/api/settings/subjects', requireAuth, (req: any, res) => {
    // 1. 必须检查是否传了 accountBookId
    if (!req.body.accountBookId) {
        return res.status(400).json({ message: 'Missing accountBookId' });
    }

    const data = db.get();
    
    // 2. 查重逻辑必须限制在【当前账套】内
    // 不同账套可以有相同的科目代码（例如 1001）
    const exists = (data.subjects || []).some((s: any) => 
        s.companyId === req.user.companyId && 
        s.accountBookId === req.body.accountBookId && // ★ 关键
        s.code === req.body.code
    );

    if (exists) {
        return res.status(400).json({ message: '当前账套下该科目编码已存在' });
    }

    const newSubject = { 
        ...req.body, 
        id: `subj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, 
        companyId: req.user.companyId,
        // req.body 中必须包含 accountBookId
    };
    
    db.update('subjects', [...(data.subjects || []), newSubject]);
    res.json(newSubject);
});

app.put('/api/settings/subjects', requireAuth, (req: any, res) => {
    const { id, ...updates } = req.body;
    const data = db.get();
    const list = data.subjects || [];
    const idx = list.findIndex((s: any) => s.id === id && s.companyId === req.user.companyId);
    if (idx > -1) {
        list[idx] = { ...list[idx], ...updates };
        db.update('subjects', list);
        res.json({ success: true });
    } else {
        res.status(404).json({ message: 'Not found' });
    }
});

app.delete('/api/settings/subjects', requireAuth, (req: any, res) => {
    const id = req.query.id;
    const data = db.get();
    const list = (data.subjects || []).filter((s: any) => s.id !== id);
    db.update('subjects', list);
    res.json({ success: true });
});

// ==========================================
// 4. 资金账户 (Fund Accounts)
// ==========================================

app.get('/api/settings/fund-accounts', requireAuth, (req: any, res) => {
  const data = db.get();
  const { accountBookId } = req.query; // 获取参数
  
  let accounts = (data.fundAccounts || []).filter((a: any) => a.companyId === req.user.companyId);

  // 如果你的业务逻辑是“资金账户跟着账套走”，则加上这行；
  // 如果“资金账户是公司层面的，所有账套共享”，则不需要加这行。
  // 考虑到你的前端 mockData 传了参数，建议加上兼容：
  if (accountBookId) {
      // 注意：这要求你在创建账户时(POST)也存入了 accountBookId
      //accounts = accounts.filter((a: any) => a.accountBookId === accountBookId);
  }
  
  res.json(accounts);
});

app.post('/api/settings/fund-accounts', requireAuth, (req: any, res) => {
  const data = db.get();
  const companyId = req.user.companyId;
  
  const newAccount = {
    ...req.body,
    id: req.body.id || `fa_${Date.now()}`,
    companyId: companyId
  };

  // 保存资金账户
  const updatedAccounts = [...(data.fundAccounts || []), newAccount];
  db.update('fundAccounts', updatedAccounts);

  // ★★★ 立即同步到科目余额 ★★★
  if (newAccount.relatedSubjectId && newAccount.accountBookId) {
    syncFundAccountsToSubject(data, newAccount.relatedSubjectId, newAccount.accountBookId, companyId);
  }

  res.status(201).json(newAccount);
});

// 3. 修改更新接口
app.put('/api/settings/fund-accounts', requireAuth, (req: any, res) => {
  const data = db.get();
  const { id, ...updates } = req.body;
  const list = data.fundAccounts || [];
  const companyId = req.user.companyId;
  
  const index = list.findIndex((a: any) => a.id === id && a.companyId === companyId);
  
  if (index !== -1) {
    const oldAccount = list[index];
    list[index] = { ...list[index], ...updates };
    
    db.update('fundAccounts', list);

    const updatedAccount = list[index];
    
    // 检查是否需要同步
    const balanceChanged = oldAccount.initialBalance !== updatedAccount.initialBalance;
    const subjectChanged = oldAccount.relatedSubjectId !== updatedAccount.relatedSubjectId;
    
    if (balanceChanged || subjectChanged) {
      console.log(`[资金账户] 检测到余额或科目变化，开始同步...`);
      
      // 清理旧科目（如果科目改变了）
      if (subjectChanged && oldAccount.relatedSubjectId && oldAccount.accountBookId) {
        syncFundAccountsToSubject(data, oldAccount.relatedSubjectId, oldAccount.accountBookId, companyId);
      }
      
      // 更新新科目
      if (updatedAccount.relatedSubjectId && updatedAccount.accountBookId) {
        syncFundAccountsToSubject(data, updatedAccount.relatedSubjectId, updatedAccount.accountBookId, companyId);
      }
    }

    res.json({ success: true });
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

// 4. 修改删除接口
app.delete('/api/settings/fund-accounts/:id', requireAuth, (req: any, res) => {
  const { id } = req.params; 
  const data = db.get();
  const companyId = req.user.companyId;
  
  // 找到要删除的账户
  const target = (data.fundAccounts || []).find((a: any) => a.id === id && a.companyId === companyId);
  
  if (target) {
    // 删除账户
    const list = (data.fundAccounts || []).filter((a: any) => !(a.id === id && a.companyId === companyId));
    db.update('fundAccounts', list);
    
    // 同步更新关联科目（重新计算该科目的余额）
    if (target.relatedSubjectId && target.accountBookId) {
      syncFundAccountsToSubject(data, target.relatedSubjectId, target.accountBookId, companyId);
    }
  }
  
  res.json({ success: true });
});

// ==========================================
// 核心同步函数：将资金账户余额同步到科目
// ==========================================
function syncFundAccountsToSubject(data: any, subjectId: string, accountBookId: string, companyId: string) {
  console.log(`\n[同步开始] 科目ID: ${subjectId}, 账套: ${accountBookId}`);
  
  const subjects = data.subjects || [];
  let initialBalances = data.initialBalances || [];
  const fundAccounts = data.fundAccounts || [];

  // 1. 查找该科目下的所有资金账户
  const relatedAccounts = fundAccounts.filter((a: any) => 
    a.relatedSubjectId === subjectId && 
    a.accountBookId === accountBookId &&
    a.companyId === companyId
  );

  console.log(`[同步] 找到 ${relatedAccounts.length} 个关联资金账户`);

  // 2. 计算总余额
  const totalBalance = relatedAccounts.reduce((sum: number, acc: any) => {
    const balance = Number(acc.initialBalance || 0);
    console.log(`  - ${acc.accountName}: ${balance}`);
    return sum + balance;
  }, 0);

  console.log(`[同步] 计算总余额: ${totalBalance}`);

  // 3. 更新 subjects 表
  const subjectIndex = subjects.findIndex((s: any) => s.id === subjectId);
  if (subjectIndex > -1) {
    subjects[subjectIndex].initialBalance = totalBalance;
    subjects[subjectIndex].hasBalance = totalBalance !== 0;
    db.update('subjects', subjects);
    console.log(`[同步] subjects 表已更新`);
  } else {
    console.warn(`[同步] 警告：未找到科目 ${subjectId}`);
  }

  // 4. 更新 initialBalances 表
  // 先删除该科目的旧记录（只删除标准记录，不删除辅助核算）
  const oldCount = initialBalances.length;
  initialBalances = initialBalances.filter((b: any) => 
    !(b.companyId === companyId && 
      b.accountBookId === accountBookId && 
      b.subjectId === subjectId &&
      !b.auxiliaryItemId) // 只删除非辅助核算的记录
  );
  console.log(`[同步] 清理了 ${oldCount - initialBalances.length} 条旧记录`);

  // 如果有余额，插入新记录
  if (totalBalance !== 0) {
    initialBalances.push({
      id: `ib_fa_${subjectId}_${Date.now()}`,
      companyId,
      accountBookId,
      subjectId,
      auxiliaryItemId: null, // 标记为标准科目余额
      initialBalance: totalBalance,
      debitAccumulated: 0,
      creditAccumulated: 0
    });
    console.log(`[同步] initialBalances 表已插入新记录`);
  }

  db.update('initialBalances', initialBalances);
  console.log(`[同步完成] 科目 ${subjectId} 余额 = ${totalBalance}\n`);
}

// ==========================================
// 5. 辅助核算 (Auxiliary Items)
// ==========================================

app.get('/api/settings/auxiliary-items', requireAuth, (req: any, res) => {
  const data = db.get();
  const { accountBookId, categoryId } = req.query; // 获取前端传来的参数

  let items = (data.auxiliaryItems || []).filter((i: any) => i.companyId === req.user.companyId);

  // 增加账套过滤
  if (accountBookId) {
      items = items.filter((i: any) => i.accountBookId === accountBookId);
  }

  // 增加维度过滤
  if (categoryId) {
      items = items.filter((i: any) => i.categoryId === categoryId);
  }

  res.json(items);
});

app.post('/api/settings/auxiliary-items', requireAuth, (req: any, res) => {
  const data = db.get();
  const newItem = { ...req.body, id: req.body.id || `aux_${Date.now()}`, companyId: req.user.companyId };
  db.update('auxiliaryItems', [...(data.auxiliaryItems || []), newItem]);
  res.status(201).json(newItem);
});

app.put('/api/settings/auxiliary-items', requireAuth, (req: any, res) => {
  const data = db.get();
  const { id, ...updates } = req.body;
  const list = data.auxiliaryItems || [];
  const index = list.findIndex((i: any) => i.id === id && i.companyId === req.user.companyId);
  if (index !== -1) {
    list[index] = { ...list[index], ...updates };
    db.update('auxiliaryItems', list);
    res.json({ success: true });
  } else { res.status(404).json({ message: 'Not found' }); }
});

app.delete('/api/settings/auxiliary-items', requireAuth, (req: any, res) => {
  const id = req.query.id;
  const data = db.get();
  const list = (data.auxiliaryItems || []).filter((i: any) => !(i.id === id && i.companyId === req.user.companyId));
  db.update('auxiliaryItems', list);
  res.json({ success: true });
});
// ==========================================
// 5.1 辅助核算维度 (Auxiliary Categories) - 新增
// ==========================================

app.get('/api/settings/auxiliary-categories', requireAuth, (req: any, res) => {
  const data = db.get();
  // 你的前端传了 accountBookId，我们优先用它
  const { accountBookId } = req.query;

  let list = (data.auxiliaryCategories || []).filter((c: any) => c.companyId === req.user.companyId);
  
  if (accountBookId) {
      // 按照账套隔离维度
      list = list.filter((c: any) => c.accountBookId === accountBookId);
  }

  res.json(list);
});

app.post('/api/settings/auxiliary-categories', requireAuth, (req: any, res) => {
  const data = db.get();
  const { name, accountBookId, isBuiltIn } = req.body;

  // 查重：同账套下不能有重名的维度
  const existing = (data.auxiliaryCategories || []).find((c: any) => 
      c.companyId === req.user.companyId && 
      c.accountBookId === accountBookId &&
      c.name === name
  );

  if (existing) {
      return res.json(existing); // 幂等处理
  }

  const newCategory = {
    id: `ac_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    companyId: req.user.companyId,
    accountBookId,
    name,
    isBuiltIn: isBuiltIn || false,
    createdAt: new Date().toISOString()
  };

  const currentList = data.auxiliaryCategories || [];
  db.update('auxiliaryCategories', [...currentList, newCategory]);
  
  res.status(201).json(newCategory);
});

app.put('/api/settings/auxiliary-categories/:id', requireAuth, (req: any, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const data = db.get();
    const list = data.auxiliaryCategories || [];
    const index = list.findIndex((c: any) => c.id === id && c.companyId === req.user.companyId);

    if (index > -1) {
        list[index] = { ...list[index], name };
        db.update('auxiliaryCategories', list);
        res.json(list[index]);
    } else {
        res.status(404).json({ message: 'Not found' });
    }
});
app.delete('/api/settings/auxiliary-categories/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;
  const data = db.get();

  // 1. 找到目标维度
  const categoryList = data.auxiliaryCategories || [];
  const category = categoryList.find((c: any) => c.id === id && c.companyId === companyId);

  if (!category) {
      return res.status(404).json({ message: '未找到该维度' });
  }

  // 2. 校验：内置维度不可删除
  if (category.isBuiltIn) {
      return res.status(403).json({ message: '系统内置维度无法删除' });
  }

  // 3. 校验：是否有具体档案引用 (检查 auxiliaryItems 表)
  const hasItems = (data.auxiliaryItems || []).some((item: any) => 
      item.companyId === companyId && item.categoryId === id
  );
  if (hasItems) {
      return res.status(403).json({ message: '该维度下存在具体档案，请先清空档案后再删除维度' });
  }

  // 4. 校验：是否有科目引用 (检查 subjects 表)
  // 注意：subjects 表目前存储的是维度的名称 (string[])
  const isUsedBySubject = (data.subjects || []).some((s: any) => 
      s.companyId === companyId && 
      Array.isArray(s.auxiliaryItems) && 
      s.auxiliaryItems.includes(category.name)
  );
  if (isUsedBySubject) {
      return res.status(403).json({ message: '已有科目启用了该辅助核算，请先在科目设置中取消引用' });
  }

  // 5. 执行删除
  const newList = categoryList.filter((c: any) => c.id !== id);
  db.update('auxiliaryCategories', newList);

  res.json({ success: true });
});

// ==========================================
// 6. 期初数据 & 试算平衡
// ==========================================

app.get('/api/initial-balances', requireAuth, (req: any, res) => {
  const { accountBookId } = req.query;
  const companyId = req.user.companyId;
  
  if (!accountBookId) {
    return res.status(400).json({ message: 'Missing accountBookId' });
  }

  const data = db.get();
  const records = (data.initialBalances || []).filter((b: any) => 
    b.companyId === companyId && b.accountBookId === accountBookId
  );

  res.json(records);
});

app.post('/api/initial-balances/batch', requireAuth, (req: any, res) => {
  const balances = req.body; 
  const data = db.get();
  const companyId = req.user.companyId;

  console.log(`[POST Initial] 收到保存请求，共 ${balances.length} 条数据`);
  
  const subjects = data.subjects || [];
  let initialBalances = data.initialBalances || []; 
  
  // ★★★ 关键修复 1：彻底清理当前账套的所有期初数据（包括标准科目和辅助核算） ★★★
  const currentBookId = balances[0]?.accountBookId; // 获取当前账套ID
  if (currentBookId) {
    console.log(`[清理数据] 清理账套 ${currentBookId} 的所有旧期初记录...`);
    
    // 提取本次涉及的所有科目ID（包括标准科目和辅助核算科目）
    const affectedSubjectIds = [...new Set(balances.map((b: any) => b.subjectId))];
    
    // 清理 initialBalances 表中这些科目的所有旧记录
    initialBalances = initialBalances.filter((b: any) => 
      !(b.companyId === companyId && 
        b.accountBookId === currentBookId &&
        affectedSubjectIds.includes(b.subjectId))
    );
    
    console.log(`[清理完成] 已清理 ${affectedSubjectIds.length} 个科目的旧数据`);
  }

  let updatedCount = 0;
  let auxCount = 0;

  balances.forEach((item: any) => {
    // ===== 情况 A: 辅助核算明细 (写入 initialBalances 表) =====
    if (item.auxiliaryItemId) {
      auxCount++;
      const newRecord = {
        id: item.id && !item.id.startsWith('new-') ? item.id : `ib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        companyId,
        accountBookId: item.accountBookId,
        subjectId: item.subjectId,
        auxiliaryItemId: item.auxiliaryItemId,
        initialBalance: Number(item.initialBalance || 0),
        debitAccumulated: Number(item.debitAccumulated || 0),
        creditAccumulated: Number(item.creditAccumulated || 0)
      };
      
      initialBalances.push(newRecord);
    } 
    // ===== 情况 B: 标准科目余额 (更新 subjects 表 + 同步写入 initialBalances 表) =====
    else {
      const subject = subjects.find((s: any) => s.id === item.subjectId && s.companyId === companyId);
      
      if (subject) {
        updatedCount++;
        
        // 更新 subjects 表
        subject.initialBalance = Number(item.initialBalance || 0);
        subject.debitAccumulated = Number(item.debitAccumulated || 0);
        subject.creditAccumulated = Number(item.creditAccumulated || 0);
        subject.hasBalance = true;
        
        // ★★★ 关键修复 2：同步写入 initialBalances 表（保证数据一致性） ★★★
        const syncRecord = {
          id: `ib_sync_${item.subjectId}`,
          companyId,
          accountBookId: item.accountBookId,
          subjectId: item.subjectId,
          auxiliaryItemId: null, // 标记为标准科目
          initialBalance: Number(item.initialBalance || 0),
          debitAccumulated: Number(item.debitAccumulated || 0),
          creditAccumulated: Number(item.creditAccumulated || 0)
        };
        
        initialBalances.push(syncRecord);
        
        // 确保科目绑定到正确的账套
        if (!subject.accountBookId && item.accountBookId) {
          console.log(`[绑定账套] 科目 ${subject.code} -> 账套 ${item.accountBookId}`);
          subject.accountBookId = item.accountBookId;
        }
      } else {
        console.warn(`[Warning] 未找到科目 ID: ${item.subjectId}`);
      }
    }
  });
  
  console.log(`[保存完成] 标准科目: ${updatedCount} 条, 辅助明细: ${auxCount} 条`);

  // 原子性更新
  db.update('subjects', subjects);
  db.update('initialBalances', initialBalances);
  
  res.json({ success: true, updated: updatedCount, auxiliary: auxCount });
});

app.post('/api/settings/initialization/complete', requireAuth, (req: any, res) => {
  // 前端会传 { accountBookId: "..." }
  const { accountBookId } = req.body; 
  const companyId = req.user.companyId;

  if (!accountBookId) {
    return res.status(400).json({ message: 'Missing accountBookId' });
  }

  const data = db.get();
  const list = data.accountBooks || [];
  
  // 查找匹配的账套
  const index = list.findIndex((b: any) => b.id === accountBookId && b.companyId === companyId);

  if (index === -1) {
    return res.status(404).json({ message: 'Account book not found' });
  }

  // ✅ 核心修改：更新状态
  list[index] = {
    ...list[index],
    isInitialized: true,            // 标记为已启用
    initializedAt: new Date().toISOString() // 记录启用时间
  };

  db.update('accountBooks', list);

  console.log(`[Server] 账套 ${accountBookId} 已正式启用`);
  res.json({ success: true });
});
app.delete('/api/initial-balances/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  // 物理删除
  const list = (data.initialBalances || []).filter((b: any) => b.id !== id);
  db.update('initialBalances', list);
  res.json({ success: true });
});
// ==========================================
// 7. 凭证管理 (Vouchers) 
// ==========================================

app.get('/api/vouchers', requireAuth, (req: any, res) => {
  const data = db.get();
  const companyId = req.user.companyId;
  const { accountBookId } = req.query; // 获取前端传来的账套ID
  
  let list = (data.vouchers || []).filter((v: any) => v.companyId === companyId);

  // ★★★ 核心修复：增加账套隔离 ★★★
  if (accountBookId) {
    list = list.filter((v: any) => v.accountBookId === accountBookId);
  }
  
  list.sort((a: any, b: any) => new Date(b.voucherDate).getTime() - new Date(a.voucherDate).getTime());
  
  res.json(list);
});

// 修改凭证接口
app.put('/api/vouchers', requireAuth, (req: any, res) => {
  const { id, ...updates } = req.body;
  const data = db.get();
  const list = data.vouchers || [];
  const companyId = req.user.companyId;

  // 1. 查找凭证
  const index = list.findIndex((v: any) => v.id === id && v.companyId === companyId);
  
  if (index === -1) {
      return res.status(404).json({ message: 'Voucher not found' });
  }

  // 定义 oldVoucher (必须在函数内部)
  const oldVoucher = list[index];

  // 2. 检查账套配置 (是否免审核)
  const currentBook = (data.accountBooks || []).find((b: any) => b.id === oldVoucher.accountBookId);
  const requiresAudit = currentBook ? (currentBook.review_enabled !== false) : true;

  // --- 权限校验逻辑 ---
  
  // 规则 A: 系统自动生成的凭证，禁止修改关键信息
  if (oldVoucher.maker === '系统自动') {
      return res.status(403).json({ message: '系统自动生成的凭证禁止手工修改，请删除后重新生成。' });
  }

  // 规则 B: 如果账套开启了审核，且凭证已审核，则禁止修改
  if (requiresAudit && oldVoucher.status === 'approved') {
    return res.status(403).json({ message: '已审核凭证不可修改，请先反审核。' });
  }

  // 3. 执行更新
  const updatedVoucher = {
    ...oldVoucher,     // 这里就能正确找到 oldVoucher 了
    ...updates,
    // 保护关键字段不被篡改
    voucherNumber: oldVoucher.voucherNumber, 
    voucherCode: oldVoucher.voucherCode,
    closingType: oldVoucher.closingType,
    maker: oldVoucher.maker, 
    updatedAt: new Date().toLocaleString('zh-CN')
  };

  list[index] = updatedVoucher;
  db.update('vouchers', list);
  
  res.json(updatedVoucher);
});

app.post('/api/vouchers/batch', requireAuth, (req: any, res) => {
  const vouchersToUpdate = req.body; 
  if (!Array.isArray(vouchersToUpdate)) return res.status(400).json({ message: 'Invalid data' });

  const data = db.get();
  let list = data.vouchers || [];
  const companyId = req.user.companyId;

  vouchersToUpdate.forEach((newV: any) => {
     const idx = list.findIndex((v: any) => v.id === newV.id && v.companyId === companyId);
     if (idx > -1) {
       list[idx] = { ...list[idx], ...newV };
     }
  });

  db.update('vouchers', list);
  res.json({ success: true });
});

// 审核凭证
app.post('/api/vouchers/:id/audit', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const { auditorName } = req.body; 
  const data = db.get();
  const list = data.vouchers || [];
  
  const index = list.findIndex((v: any) => v.id === id && v.companyId === req.user.companyId);
  if (index === -1) return res.status(404).json({ message: '未找到凭证' });

  list[index] = {
    ...list[index],
    status: 'approved',
    auditedBy: auditorName || 'Admin', 
    auditedAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN')
  };

  db.update('vouchers', list);
  res.json({ success: true, voucher: list[index] });
});

// 反审核凭证
app.post('/api/vouchers/:id/unaudit', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  const list = data.vouchers || [];
  
  const index = list.findIndex((v: any) => v.id === id && v.companyId === req.user.companyId);
  if (index === -1) return res.status(404).json({ message: '未找到凭证' });

  if (list[index].status !== 'approved') {
    return res.status(400).json({ message: '凭证未审核，无需反审核' });
  }

  list[index] = {
    ...list[index],
    status: 'draft', 
    auditedBy: null,
    auditedAt: null,
    updatedAt: new Date().toLocaleString('zh-CN')
  };

  db.update('vouchers', list);
  res.json({ success: true, voucher: list[index] });
});

app.delete('/api/vouchers/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const companyId = req.user.companyId;
  const data = db.get();
  
  const voucherList = data.vouchers || [];
  const voucherIndex = voucherList.findIndex((v: any) => v.id === id && v.companyId === companyId);

  if (voucherIndex === -1) {
    return res.status(404).json({ error: '未找到该凭证' });
  }

  const voucher = voucherList[voucherIndex];

  // ★★★ 核心修复：检查账套审核配置 ★★★
  const accountBook = (data.accountBooks || []).find((b: any) => b.id === voucher.accountBookId);
  const requiresAudit = accountBook ? (accountBook.review_enabled !== false) : true;

  // 只有在“开启了审核”且“凭证已审核”的情况下，才禁止删除
  if (requiresAudit && voucher.status === 'approved') {
    return res.status(403).json({ error: '已审核凭证不可删除，请先反审核' });
  }

  // 调用 db 类中的删除方法（自动解锁流水）
  const success = db.deleteVoucher(id);
  
  if (success) {
    res.json({ success: true, message: '凭证已删除' });
  } else {
    res.status(500).json({ error: '删除失败' });
  }
});

// ==========================================
// 8. 凭证模板 (Voucher Templates)
// ==========================================

app.get('/api/voucher-templates', requireAuth, (req: any, res) => {
  const data = db.get();
  const list = (data.voucherTemplates || []).filter((t: any) => t.companyId === req.user.companyId);
  res.json(list);
});

app.post('/api/voucher-templates', requireAuth, (req: any, res) => {
  const data = db.get();
  const newTemplate = {
    ...req.body,
    id: `tpl_${Date.now()}`,
    companyId: req.user.companyId
  };
  db.update('voucherTemplates', [...(data.voucherTemplates || []), newTemplate]);
  res.status(201).json(newTemplate);
});

app.put('/api/voucher-templates/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const updates = req.body;
  const data = db.get();
  const list = data.voucherTemplates || [];
  const index = list.findIndex((t: any) => t.id === id && t.companyId === req.user.companyId);
  
  if (index > -1) {
    list[index] = { ...list[index], ...updates };
    db.update('voucherTemplates', list);
    res.json(list[index]);
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

app.delete('/api/voucher-templates/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  const list = (data.voucherTemplates || []).filter((t: any) => !(t.id === id && t.companyId === req.user.companyId));
  db.update('voucherTemplates', list);
  res.json({ success: true });
});

// ==========================================
// 9. 收支类别管理 (Expense Categories)
// ==========================================

app.get('/api/expense-categories', requireAuth, (req: any, res) => {
  const data = db.get();
  const list = (data.expenseCategories || []).filter((c: any) => c.companyId === req.user.companyId);
  res.json(list);
});

app.post('/api/expense-categories', requireAuth, (req: any, res) => {
  const data = db.get();
  const list = data.expenseCategories || [];
  
  const exists = list.find((c: any) => 
    c.companyId === req.user.companyId && 
    c.code === req.body.code && 
    c.type === req.body.type 
  );
  
  if (exists) {
    return res.status(400).json({ message: '编码已存在' });
  }

  const newCategory = {
    ...req.body,
    id: `cat_${Date.now()}`,
    companyId: req.user.companyId,
    createdAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN')
  };

  db.update('expenseCategories', [...list, newCategory]);
  res.status(201).json(newCategory);
});

app.put('/api/expense-categories', requireAuth, (req: any, res) => {
  const { id, ...updates } = req.body;
  const data = db.get();
  const list = data.expenseCategories || [];
  const index = list.findIndex((c: any) => c.id === id && c.companyId === req.user.companyId);

  if (index === -1) return res.status(404).json({ message: 'Category not found' });

  if (updates.code) {
    const exists = list.find((c: any) => 
      c.companyId === req.user.companyId && 
      c.code === updates.code && 
      c.type === list[index].type && 
      c.id !== id
    );
    if (exists) return res.status(400).json({ message: '编码已存在' });
  }

  list[index] = { 
    ...list[index], 
    ...updates, 
    updatedAt: new Date().toLocaleString('zh-CN') 
  };
  
  db.update('expenseCategories', list);
  res.json(list[index]);
});

app.delete('/api/expense-categories/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  const list = data.expenseCategories || [];
  
  const isReferenced = (data.journalEntries || []).some((j: any) => 
    j.companyId === req.user.companyId && j.categoryId === id
  );

  if (isReferenced) {
    return res.status(403).json({ message: '该类别已被日记账引用，无法删除，请尝试停用' });
  }

  const hasChildren = list.some((c: any) => c.parentId === id);
  if (hasChildren) {
    return res.status(403).json({ message: '请先删除该类别下的子类别' });
  }

  const newList = list.filter((c: any) => c.id !== id);
  db.update('expenseCategories', newList);
  res.json({ success: true });
});

// ==========================================
// 10. 出纳日记账 (Journal Entries)
// ==========================================

app.get('/api/journal-entries', requireAuth, (req: any, res) => {
  // 1. 这里解构出 accountBookId
  const { accountId, startDate, endDate, accountBookId } = req.query;
  console.log('🔍 [Debug API] Journal Query:', { accountBookId, accountId, startDate, endDate });
  const data = db.get();
  
  // 2. 增加过滤条件：j.accountBookId === accountBookId
  let list = (data.journalEntries || []).filter((j: any) => 
    j.companyId === req.user.companyId && 
    j.accountBookId === accountBookId // <--- 关键修复：必须匹配账套ID
  );

  if (accountId) {
    list = list.filter((j: any) => j.accountId === accountId);
  }
  if (startDate) {
    list = list.filter((j: any) => j.date >= startDate);
  }
  if (endDate) {
    list = list.filter((j: any) => j.date <= endDate);
  }

  list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(list);
});

app.post('/api/journal-entries', requireAuth, (req: any, res) => {
  const data = db.get();
  const newEntry = {
    ...req.body,
    id: `je_${Date.now()}`,
    companyId: req.user.companyId,
    createdAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN')
  };
  
  db.update('journalEntries', [...(data.journalEntries || []), newEntry]);
  res.status(201).json(newEntry);
});

app.put('/api/journal-entries/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const updates = req.body;
  const data = db.get();
  const list = data.journalEntries || [];
  
  const index = list.findIndex((j: any) => j.id === id && j.companyId === req.user.companyId);
  
  if (index === -1) return res.status(404).json({ message: 'Entry not found' });
  
  list[index] = { 
    ...list[index], 
    ...updates, 
    updatedAt: new Date().toLocaleString('zh-CN') 
  };
  
  db.update('journalEntries', list);
  res.json(list[index]);
});

app.delete('/api/journal-entries/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  const list = data.journalEntries || [];
  
  const target = list.find((j: any) => j.id === id && j.companyId === req.user.companyId);
  if (!target) return res.status(404).json({ message: 'Not found' });
  
  if (target.voucherCode) {
    return res.status(403).json({ message: '已生成凭证，无法删除' });
  }

  const newList = list.filter((j: any) => j.id !== id);
  db.update('journalEntries', newList);
  res.json({ success: true });
});

app.post('/api/journal-entries/batch-update', requireAuth, (req: any, res) => {
  const { ids, updates } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids must be array' });

  const data = db.get();
  const list = data.journalEntries || [];
  const companyId = req.user.companyId;

  ids.forEach(id => {
    const index = list.findIndex((j: any) => j.id === id && j.companyId === companyId);
    if (index > -1) {
      if (!list[index].voucherCode) {
        list[index] = { ...list[index], ...updates, updatedAt: new Date().toLocaleString('zh-CN') };
      }
    }
  });

  db.update('journalEntries', list);
  res.json({ success: true });
});

// ==========================================
// 11. 往来单位 (Partners)
// ==========================================

app.get('/api/settings/partners', requireAuth, (req: any, res) => {
  const data = db.get();
  const items = (data.auxiliaryItems || []).filter((i: any) => i.companyId === req.user.companyId);
  res.json(items);
});

// ==========================================
// 12. 内部转账 (Internal Transfers)
// ==========================================

app.get('/api/internal-transfers', requireAuth, (req: any, res) => {
  // 1. 获取 accountBookId 参数
  const { startDate, endDate, summary, accountBookId } = req.query;
  const data = db.get();
  
  // 2. 增加筛选条件：必须同时匹配 companyId 和 accountBookId
  let list = (data.internalTransfers || []).filter((t: any) => 
      t.companyId === req.user.companyId && 
      t.accountBookId === accountBookId // 👈 核心修复：必须匹配账套ID
  );

  if (startDate) list = list.filter((t: any) => t.date >= startDate);
  if (endDate) list = list.filter((t: any) => t.date <= endDate);
  if (summary) list = list.filter((t: any) => t.remark.includes(summary));

  list.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  res.json(list);
});
app.post('/api/internal-transfers', requireAuth, (req: any, res) => {
  const { date, amount, fromAccountId, fromAccountName, toAccountId, toAccountName, remark, accountBookId } = req.body;
  const companyId = req.user.companyId;

  if (!fromAccountId || !toAccountId || !amount || !accountBookId) {
      return res.status(400).json({ message: 'Missing required fields' });
  }

  const data = db.get();

  // 1. 准备 ID
  const transferId = `tr_${Date.now()}`;
  const outEntryId = `je_tr_out_${Date.now()}`;
  const inEntryId = `je_tr_in_${Date.now()}`;

  // 2. 创建两条日记账 (Journal Entries)
  // 流水 A: 转出账户 (支出)
  const entryOut = {
      id: outEntryId,
      companyId,
      accountBookId, // 绑定账套
      date,
      accountId: fromAccountId,
      accountName: fromAccountName,
      summary: `[内部转账] 转至 ${toAccountName}: ${remark}`,
      income: 0,
      expense: Number(amount), // 记支出
      balance: 0, // 后续由前端或报表动态计算
      sourceType: 'internal_transfer', // 标记来源
      sourceId: transferId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
  };

  // 流水 B: 转入账户 (收入)
  const entryIn = {
      id: inEntryId,
      companyId,
      accountBookId, // 绑定账套
      date,
      accountId: toAccountId,
      accountName: toAccountName,
      summary: `[内部转账] 来自 ${fromAccountName}: ${remark}`,
      income: Number(amount), // 记收入
      expense: 0,
      balance: 0,
      sourceType: 'internal_transfer',
      sourceId: transferId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
  };

  // 3. 创建转账单记录
  const newTransfer = {
      id: transferId,
      companyId,
      accountBookId,
      date,
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
      amount: Number(amount),
      remark,
      withdrawalEntryId: outEntryId, // 关联流水ID
      depositEntryId: inEntryId,     // 关联流水ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
  };

  // 4. 保存到数据库
  // 必须同时更新 internalTransfers 和 journalEntries
  db.update('internalTransfers', [...(data.internalTransfers || []), newTransfer]);
  db.update('journalEntries', [...(data.journalEntries || []), entryOut, entryIn]);

  res.status(201).json(newTransfer);
});

// 修改 backend/server.ts 中的 POST /api/vouchers 接口

// server.ts

app.post('/api/vouchers', requireAuth, (req: any, res) => {
  const data = db.get();
  const list = data.vouchers || [];
  const companyId = req.user.companyId;
  const userId = req.user.userId; // 获取当前登录用户ID
  const { accountBookId } = req.body;

  // 1. 获取当前操作用户的真实姓名
  const currentUser = (data.users || []).find((u: any) => u.id === userId);
  const realUserName = currentUser ? currentUser.name : 'Unknown User';
  
  // 解构数据
  const { voucherDate, voucherType, lines, status, auditor, auditedDate, poster, postedDate, ...restBody } = req.body;

  const period = voucherDate.substring(0, 7); 
  
  // 2. 检查账套审核配置
  const currentBook = (data.accountBooks || []).find((b: any) => b.id === accountBookId);
  // 默认为 true (需要审核)，只有显式为 false 才跳过
  const requiresAudit = currentBook ? (currentBook.review_enabled !== false) : true;

  // 3. 自动补全辅助核算 (保持原有逻辑)
  const fundAccounts = (data.fundAccounts || []).filter((a: any) => a.companyId === companyId);
  const processedLines = (lines || []).map((line: any) => {
      if (line.auxiliary) return line;
      const matchAccount = fundAccounts.find((fa: any) => fa.relatedSubjectCode === line.subjectCode);
      if (matchAccount && matchAccount.relatedAuxiliaryName) {
          return { ...line, auxiliary: matchAccount.relatedAuxiliaryName };
      }
      return line;
  });

  // 4. 计算凭证号 (保持原有逻辑)
  const existingInPeriod = list.filter((v: any) => 
    v.companyId === companyId && 
    v.voucherDate.startsWith(period) && 
    v.voucherType === voucherType
  );

  let maxNum = 0;
  existingInPeriod.forEach((v: any) => {
    const num = parseInt(v.voucherNumber, 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  });
  const nextNumStr = String(maxNum + 1).padStart(3, '0'); 

  // 5. 确定最终状态
  let finalStatus = status || 'draft';
  let auditInfo = {};

  if (!requiresAudit) {
      // 分支 A: 账套免审核 -> 自动通过
      finalStatus = 'approved';
      console.log(`[自动审核] 账套 ${accountBookId} 设置为免审核，凭证自动通过`);
      
      // 自动审核时，审核人通常记为"系统自动"或者"制单人本人"
      // 这里为了区分，如果是自动通过，我们标记为 'System (Auto-Pass)' 
      // 或者如果你希望显示没有任何人审核，可以留空。这里为了流程完整，设为系统。
      auditInfo = {
          auditedBy: 'System (Auto)', 
          auditedAt: new Date().toISOString(),
          postedBy: 'System (Auto)',
          postedAt: new Date().toISOString()
      };
  } else if (finalStatus === 'approved') {
      // 分支 B: 前端强制传了 approved (比如期末结转) -> 使用传入信息或当前用户
      auditInfo = {
          auditedBy: auditor || 'System', // 这里保留灵活性
          auditedAt: auditedDate || new Date().toISOString(),
          postedBy: poster || 'System',
          postedAt: postedDate || new Date().toISOString()
      };
  }
  // 分支 C: 需要审核且未通过 -> 保持 draft，无审核信息

  // 6. 创建凭证对象
  const newVoucher = {
    ...restBody,
    voucherDate,
    voucherType,
    lines: processedLines, 
    id: `v_${Date.now()}`,
    companyId,
    voucherNumber: nextNumStr, 
    voucherCode: `${voucherType}-${nextNumStr}`,
    
    status: finalStatus,
    maker: realUserName, // ★ 关键修改：使用数据库查到的真实姓名
    ...auditInfo,        // 展开审核信息
    
    period: period,
    createdAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN')
  };

  db.update('vouchers', [...list, newVoucher]);
  res.status(201).json(newVoucher);
});

app.put('/api/internal-transfers/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const updates = req.body;
  const data = db.get();
  
  const transfers = data.internalTransfers || [];
  const entries = data.journalEntries || [];
  
  const trIndex = transfers.findIndex((t: any) => t.id === id && t.companyId === req.user.companyId);
  if (trIndex === -1) return res.status(404).json({ message: 'Transfer not found' });

  const oldTransfer = transfers[trIndex];

  // 1. 权限校验
  if (oldTransfer.voucherCode && (updates.amount || updates.fromAccountId || updates.toAccountId)) {
    // 如果已经在前端生成了凭证，只有在 updates 里同时也清空 voucherCode (反审核/删除凭证) 时才允许修改
    if (updates.voucherCode !== null && updates.voucherCode !== '') {
       return res.status(403).json({ message: '已生成凭证，禁止修改关键信息' });
    }
  }

  // 2. 更新转账单本身
  const updatedTransfer = { ...oldTransfer, ...updates, updatedAt: new Date().toLocaleString('zh-CN') };
  transfers[trIndex] = updatedTransfer;

  // 3. 同步更新日记账 (Journal Entries)
  const outIndex = entries.findIndex((e: any) => e.id === oldTransfer.withdrawalEntryId);
  const inIndex = entries.findIndex((e: any) => e.id === oldTransfer.depositEntryId);

  // ✅ 新增逻辑 A：如果本次更新带来了 voucherCode (说明生成了凭证)，则同步给日记账
  if (updates.voucherCode) {
      if (outIndex > -1) entries[outIndex].voucherCode = updates.voucherCode;
      if (inIndex > -1) entries[inIndex].voucherCode = updates.voucherCode;
  }
  
  // ✅ 新增逻辑 B：如果本次更新清空了 voucherCode (说明删除了凭证)，则同步清空日记账
  if (updates.voucherCode === null || updates.voucherCode === '') {
      if (outIndex > -1) entries[outIndex].voucherCode = null;
      if (inIndex > -1) entries[inIndex].voucherCode = null;
  }

  // ✅ 原有逻辑：如果是修改金额/日期/摘要 (且未生成凭证时)，同步修改日记账内容
  if (!oldTransfer.voucherCode && !updates.voucherCode) {
    if (outIndex > -1) {
      entries[outIndex] = {
        ...entries[outIndex],
        date: updates.date || oldTransfer.date,
        accountId: updates.fromAccountId || oldTransfer.fromAccountId,
        accountName: updates.fromAccountName || oldTransfer.fromAccountName,
        summary: `[内部转账] ${updates.remark || oldTransfer.remark}`,
        expense: Number(updates.amount || oldTransfer.amount),
        updatedAt: new Date().toLocaleString('zh-CN')
      };
    }
    if (inIndex > -1) {
      entries[inIndex] = {
        ...entries[inIndex],
        date: updates.date || oldTransfer.date,
        accountId: updates.toAccountId || oldTransfer.toAccountId,
        accountName: updates.toAccountName || oldTransfer.toAccountName,
        summary: `[内部转账] ${updates.remark || oldTransfer.remark}`,
        income: Number(updates.amount || oldTransfer.amount),
        updatedAt: new Date().toLocaleString('zh-CN')
      };
    }
  }

  db.update('internalTransfers', transfers);
  db.update('journalEntries', entries);
  
  res.json(updatedTransfer);
});

app.delete('/api/internal-transfers/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  
  const transfers = data.internalTransfers || [];
  const entries = data.journalEntries || [];

  const target = transfers.find((t: any) => t.id === id && t.companyId === req.user.companyId);
  if (!target) return res.status(404).json({ message: 'Not found' });

  if (target.voucherCode) return res.status(403).json({ message: '已生成凭证，无法删除' });

  const newTransfers = transfers.filter((t: any) => t.id !== id);
  const newEntries = entries.filter((e: any) => e.id !== target.withdrawalEntryId && e.id !== target.depositEntryId);

  db.update('internalTransfers', newTransfers);
  db.update('journalEntries', newEntries);

  res.json({ success: true });
});

// ==========================================
// 13. 资金汇总表 (Fund Summary Report) - 修复版：严格账套隔离
// ==========================================
app.get('/api/reports/fund-summary', requireAuth, (req: any, res) => {
  const { startDate, endDate, accountBookId } = req.query;
  const companyId = req.user.companyId;

  const start = startDate || req.query.dateFrom;
  const end = endDate || req.query.dateTo;

  if (!start || !end || !accountBookId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const data = db.get();
  
  // 1. 获取当前账套的资金账户
  const accounts = (data.fundAccounts || []).filter((a: any) => 
      a.companyId === companyId && 
      a.accountBookId === accountBookId
  );

  // 2. 获取当前账套的所有流水
  const allEntries = (data.journalEntries || []).filter((e: any) => 
      e.companyId === companyId && 
      e.accountBookId === accountBookId
  );
  
  // 3. 获取初始余额配置 (Initial Balances)
  // 注意：initialBalances 表通常存储的是科目余额
  const initialBalances = (data.initialBalances || []).filter((b: any) => b.companyId === companyId);

  // 4. 计算逻辑
  const accountSummaries = accounts.map((acc: any) => {
    // --- Step A: 确定基准期初 (Setup Balance) ---
    // 优先取资金账户设置里的 initialBalance
    let setupBalance = Number(acc.initialBalance || 0); 
    let setupDate = acc.initialDate || '2020-01-01'; // 建账日期

    // 尝试从科目期初余额表修正 (如果有绑定科目)
    // 逻辑：如果科目期初余额表里有数据，说明用户在"期初数据"页面改过，以那个为准
    if (acc.relatedSubjectId) {
        const subjectInit = initialBalances.find((b: any) => b.subjectId === acc.relatedSubjectId);
        if (subjectInit) {
            setupBalance = Number(subjectInit.initialBalance || 0);
            // 注意：科目期初余额通常隐含日期是账套启用日
        }
    }

    // --- Step B: 计算报表期初 (Report Opening Balance) ---
    // 报表期初 = 基准期初 + (基准日 ~ 报表开始日之前的净流水)
    // 简化逻辑：假设 setupBalance 就是在该账户建立之初的余额。
    // 我们只需要累加 date < start 的所有流水即可。
    
    // 过滤出该账户在查询开始日期之前的所有流水
    const historyEntries = allEntries.filter((e: any) => e.accountId === acc.id && e.date < start);
    
    const historyIncome = historyEntries.reduce((sum: number, e: any) => sum + Number(e.income || 0), 0);
    const historyExpense = historyEntries.reduce((sum: number, e: any) => sum + Number(e.expense || 0), 0);
    
    const reportOpeningBalance = setupBalance + historyIncome - historyExpense;

    // --- Step C: 计算本期发生额 ---
    const periodEntries = allEntries.filter((e: any) => e.accountId === acc.id && e.date >= start && e.date <= end);
    const periodIncome = periodEntries.reduce((sum: number, e: any) => sum + Number(e.income || 0), 0);
    const periodExpense = periodEntries.reduce((sum: number, e: any) => sum + Number(e.expense || 0), 0);

    return {
      accountId: acc.id,
      accountName: acc.accountName,
      initialBalance: Number(reportOpeningBalance.toFixed(2)), // 报表期初
      periodIncome: Number(periodIncome.toFixed(2)),
      periodExpense: Number(periodExpense.toFixed(2)),
      endingBalance: Number((reportOpeningBalance + periodIncome - periodExpense).toFixed(2))
    };
  });

  // 5. 类别汇总 (逻辑不变)
  const categoryMap = new Map();
  const periodEntriesAll = allEntries.filter((e: any) => e.date >= start && e.date <= end);

  categoryMap.set('uncategorized', {
    type: 'uncategorized',
    categoryName: '未分类',
    incomeAmount: 0,
    expenseAmount: 0,
    count: 0
  });

  periodEntriesAll.forEach((e: any) => {
    if (e.sourceType === 'internal_transfer') return;
    const key = e.categoryId || 'uncategorized';
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        type: Number(e.income) > 0 ? 'income' : 'expense',
        categoryName: e.categoryName || '未分类',
        incomeAmount: 0,
        expenseAmount: 0,
        count: 0
      });
    }
    const item = categoryMap.get(key);
    item.incomeAmount += Number(e.income || 0);
    item.expenseAmount += Number(e.expense || 0);
    item.count += 1;
  });

  const subjectSummaries = Array.from(categoryMap.values()).filter((i: any) => 
      i.type !== 'uncategorized' || (i.incomeAmount > 0 || i.expenseAmount > 0)
  );

  res.json({ accountSummaries, subjectSummaries });
});


// ==========================================
// 15. 报表：明细分类账 (修复版：严格账套隔离)
// ==========================================
app.get('/api/reports/detailed-ledger', requireAuth, (req: any, res) => {
  const { subjectCode, subjectToCode, periodFrom, periodTo, accountBookId } = req.query;
  const companyId = req.user.companyId;

  if (!subjectCode || !periodFrom || !periodTo || !accountBookId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const data = db.get();

  // ★★★ 核心修复 1：严格筛选属于当前账套的科目 ★★★
  // 之前只筛选了 companyId，导致不同账套的同名科目被混在一起
  const allSubjects = (data.subjects || []).filter((s: any) => 
      s.companyId === companyId && 
      s.accountBookId === accountBookId 
  );

  // ★★★ 核心修复 2：凭证也要严格筛选 ★★★
  const allVouchers = (data.vouchers || []).filter((v: any) => 
      v.companyId === companyId && 
      v.accountBookId === accountBookId && 
      v.status === 'approved' 
  );

  // 2. 确定目标科目范围 (仅末级)
  const allLeafSubjects = allSubjects.filter((s: any) => {
      // 只有当前账套内的科目才参与“是否为父级”的判断
      const isParent = allSubjects.some((other: any) => 
         other.code !== s.code && String(other.code).startsWith(String(s.code))
      );
      return !isParent;
  }).sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));

  const startCode = String(subjectCode);
  const endCode = subjectToCode ? String(subjectToCode) : startCode; 

  const targetSubjects = allLeafSubjects.filter((s: any) => 
    String(s.code) >= startCode && String(s.code) <= endCode
  );

  // 日期处理
  const startDate = `${periodFrom}-01`;
  const [endYear, endMonth] = String(periodTo).split('-');
  const endDateObj = new Date(Number(endYear), Number(endMonth), 0);
  const endDate = `${endYear}-${endMonth}-${String(endDateObj.getDate()).padStart(2, '0')}`;
  const yearStart = `${periodFrom.split('-')[0]}-01-01`;

  // 3. 构建结果数组
  const reportResult = targetSubjects.map((subject: any) => {
      const subjCode = String(subject.code).trim();
      const setupBalance = Number(subject.initialBalance || 0);
      
      // --- A. 计算期初余额 ---
      const preVouchers = allVouchers.filter((v: any) => v.voucherDate < startDate);
      let preDebit = 0;
      let preCredit = 0;

      preVouchers.forEach((v: any) => {
         (v.lines || []).forEach((line: any) => {
            if (String(line.subjectCode).trim() === subjCode) { 
               preDebit += Number(line.debitAmount || 0);
               preCredit += Number(line.creditAmount || 0);
            }
         });
      });

      let currentInitialBalance = 0;
      if (subject.direction === '借') {
         currentInitialBalance = setupBalance + preDebit - preCredit;
      } else {
         currentInitialBalance = setupBalance + preCredit - preDebit;
      }

      // --- B. 计算本期流水 ---
      const periodVouchers = allVouchers.filter((v: any) => v.voucherDate >= startDate && v.voucherDate <= endDate);
      
      periodVouchers.sort((a: any, b: any) => {
         const dateDiff = new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime();
         if (dateDiff !== 0) return dateDiff;
         return String(a.voucherCode).localeCompare(String(b.voucherCode));
      });

      let runningBalance = currentInitialBalance;
      let periodDebit = 0;
      let periodCredit = 0;
      const rows: any[] = [];

      periodVouchers.forEach((v: any) => {
         (v.lines || []).forEach((line: any) => {
            if (String(line.subjectCode).trim() === subjCode) {
               const d = Number(line.debitAmount || 0);
               const c = Number(line.creditAmount || 0);
               
               periodDebit += d;
               periodCredit += c;

               if (subject.direction === '借') {
                  runningBalance = runningBalance + d - c;
               } else {
                  runningBalance = runningBalance + c - d;
               }

               rows.push({
                  date: v.voucherDate,
                  voucherCode: v.voucherCode,
                  voucherId: v.id,
                  summary: line.summary,
                  debit: d,
                  credit: c,
                  direction: subject.direction, 
                  balance: Number(runningBalance.toFixed(2)) 
               });
            }
         });
      });

      // --- C. 计算本年累计 ---
      let yearDebit = 0;
      let yearCredit = 0;
      const yearVouchers = allVouchers.filter((v: any) => v.voucherDate >= yearStart && v.voucherDate <= endDate);
      yearVouchers.forEach((v: any) => {
         (v.lines || []).forEach((line: any) => {
            if (String(line.subjectCode).trim() === subjCode) {
               yearDebit += Number(line.debitAmount || 0);
               yearCredit += Number(line.creditAmount || 0);
            }
         });
      });

      return {
          subjectCode: subject.code,
          subjectName: subject.name,
          direction: subject.direction,
          initialBalance: Number(currentInitialBalance.toFixed(2)),
          rows: rows,
          periodTotalDebit: Number(periodDebit.toFixed(2)),
          periodTotalCredit: Number(periodCredit.toFixed(2)),
          yearTotalDebit: Number(yearDebit.toFixed(2)),
          yearTotalCredit: Number(yearCredit.toFixed(2))
      };
  });

  res.json(reportResult);
});

// server.ts

// ...

// ==========================================
// 16. 报表：总分类账/科目余额表 (修复版：修复期初余额读取)
// ==========================================

const getFiscalYearStartDate = (queryDateStr: string, startMonth: number) => {
  const queryDate = new Date(`${queryDateStr}-01`);
  const qYear = queryDate.getFullYear();
  const qMonth = queryDate.getMonth() + 1; 

  let startYear = qYear;
  if (qMonth < startMonth) {
    startYear = qYear - 1;
  }

  const mStr = String(startMonth).padStart(2, '0');
  return `${startYear}-${mStr}-01`;
};

// server.ts

// server.ts

app.get('/api/reports/general-ledger', requireAuth, (req: any, res) => {
  const { periodFrom, periodTo, subjectFrom, subjectTo, levelFrom, levelTo, accountBookId } = req.query;
  const companyId = req.user.companyId;

  console.log(`[Report GL] 查询余额表 BookId: ${accountBookId}, Period: ${periodFrom}~${periodTo}`);

  if (!periodFrom || !periodTo || !accountBookId) {
    return res.status(400).json({ message: 'Missing required parameters' });
  }

  const data = db.get();
  
  // 1. 获取账套信息
  const activeBook = (data.accountBooks || []).find((b: any) => b.id === accountBookId);
  const fiscalStartMonth = activeBook?.fiscalYearStartMonth ? parseInt(activeBook.fiscalYearStartMonth) : 1;

  // 2. 获取科目（严格账套过滤）
  const allSubjects = (data.subjects || []).filter((s: any) => 
    s.companyId === companyId && s.accountBookId === accountBookId
  );
  
  console.log(`[Report GL] 匹配到科目数量: ${allSubjects.length}`);

  // ★★★ 关键修复：从 initialBalances 表读取期初数据 ★★★
  const allInitials = (data.initialBalances || []).filter((b: any) => 
    b.companyId === companyId && b.accountBookId === accountBookId
  );

  console.log(`[Report GL] initialBalances 表中的记录数: ${allInitials.length}`);

  // 3. 构建期初数据 Map（按 subjectId 汇总）
  const initialMap = new Map<string, { init: number, debit: number, credit: number }>();
  
  allInitials.forEach((b: any) => {
    const prev = initialMap.get(b.subjectId) || { init: 0, debit: 0, credit: 0 };
    initialMap.set(b.subjectId, {
      init: prev.init + Number(b.initialBalance || 0),
      debit: prev.debit + Number(b.debitAccumulated || 0),
      credit: prev.credit + Number(b.creditAccumulated || 0)
    });
  });

  console.log(`[Report GL] initialMap 中的科目数: ${initialMap.size}`);

  // 4. 获取已审核凭证
  const allVouchers = (data.vouchers || []).filter((v: any) => 
    v.companyId === companyId && 
    v.accountBookId === accountBookId && 
    v.status === 'approved'
  );

  // 5. 筛选目标科目
  const targetSubjects = allSubjects.filter((s: any) => {
    const code = String(s.code);
    const level = s.level || (code.length === 4 ? 1 : code.length === 6 ? 2 : 3);
    const inCodeRange = (!subjectFrom || code >= subjectFrom) && (!subjectTo || code <= subjectTo);
    const inLevelRange = (!levelFrom || !levelTo) || (level >= Number(levelFrom) && level <= Number(levelTo));
    return inCodeRange && inLevelRange;
  }).sort((a: any, b: any) => a.code.localeCompare(b.code));

  // 6. 计算日期范围
  const queryStartDate = `${periodFrom}-01`;
  const [endYear, endMonth] = String(periodTo).split('-');
  const endDateObj = new Date(Number(endYear), Number(endMonth), 0);
  const queryEndDate = `${endYear}-${endMonth}-${String(endDateObj.getDate()).padStart(2, '0')}`;
  const fiscalYearStartDate = getFiscalYearStartDate(periodFrom, fiscalStartMonth);

  // 7. 计算每个科目的余额
  const summaries = targetSubjects.map((subject: any) => {
    // ★★★ 修复：优先从 initialMap 读取（这是最新数据） ★★★
    let setupData = initialMap.get(subject.id);
    
    // ⚠️ 调试日志（可选，帮助排查问题）
    if (subject.code === '1001' || subject.code === '1002') {
      console.log(`[调试] 科目 ${subject.code} 的期初数据:`, setupData);
    }

    // 如果 initialMap 中没有，说明该科目没有录入期初（默认为0）
    if (!setupData) {
      setupData = { init: 0, debit: 0, credit: 0 };
    }

    const setupBalance = setupData.init;
    const setupDebitAcc = setupData.debit;
    const setupCreditAcc = setupData.credit;

    // 8. 汇总凭证发生额
    let preDebit = 0, preCredit = 0;   
    let periodDebit = 0, periodCredit = 0;
    let yearVoucherDebit = 0, yearVoucherCredit = 0;

    const isRelated = (voucherCode: string) => 
      voucherCode === subject.code || String(voucherCode).startsWith(subject.code);

    allVouchers.forEach((v: any) => {
      const vDate = v.voucherDate;
      const isPre = vDate < queryStartDate; 
      const isPeriod = vDate >= queryStartDate && vDate <= queryEndDate; 
      const isYear = vDate >= fiscalYearStartDate && vDate <= queryEndDate; 

      if (!isPre && !isPeriod && !isYear) return;

      (v.lines || []).forEach((line: any) => {
        if (isRelated(line.subjectCode)) {
          const d = Number(line.debitAmount || 0);
          const c = Number(line.creditAmount || 0);
          if (isPre) { preDebit += d; preCredit += c; }
          if (isPeriod) { periodDebit += d; periodCredit += c; }
          if (isYear) { yearVoucherDebit += d; yearVoucherCredit += c; }
        }
      });
    });

    // 9. 计算报表期初余额
    let initialBalance = 0;
    if (subject.direction === '借') {
      initialBalance = setupBalance + preDebit - preCredit;
    } else {
      initialBalance = setupBalance + preCredit - preDebit;
    }

    // 10. 计算期末余额
    let periodBalance = 0;
    if (subject.direction === '借') {
      periodBalance = initialBalance + periodDebit - periodCredit;
    } else {
      periodBalance = initialBalance + periodCredit - periodDebit;
    }

    // 11. 计算本年累计
    const yearTotalDebit = setupDebitAcc + yearVoucherDebit;
    const yearTotalCredit = setupCreditAcc + yearVoucherCredit;

    return {
      code: subject.code,
      name: subject.name,
      level: subject.level,
      direction: subject.direction,
      initialBalance: Number(initialBalance.toFixed(2)),
      periodDebit: Number(periodDebit.toFixed(2)),
      periodCredit: Number(periodCredit.toFixed(2)),
      yearDebit: Number(yearTotalDebit.toFixed(2)), 
      yearCredit: Number(yearTotalCredit.toFixed(2)),
      periodBalance: Number(periodBalance.toFixed(2)), 
      yearBalance: Number(periodBalance.toFixed(2)) 
    };
  });

  res.json(summaries);
});

// ==========================================
// 17. 团队与权限管理 (Team & Permissions)
// ==========================================

// --- A. 邮件发送配置 ---

// --- B. 获取团队成员列表 (包含正式成员 + 邀请中) ---
app.get('/api/team/members', requireAuth, (req: any, res) => {
  const data = db.get();
  const companyId = req.user.companyId;
  
  // 1. 获取已加入的正式成员 (从 users 表)
  const activeMembers = (data.users || [])
    .filter((u: any) => u.companyId === companyId)
    .map((u: any) => ({ 
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isAdmin: u.isAdmin || false, // 确保有这个字段
      isOwner: u.role === 'Owner',
      status: 'active',
      joinedAt: u.created_at || new Date().toISOString()
    }));

  // 2. 获取待接受的邀请 (从 invitations 表)
  const pendingInvites = (data.invitations || [])
    .filter((i: any) => i.companyId === companyId && i.status === 'pending')
    .map((i: any) => ({
       id: i.id,
       name: i.name ? i.name : i.email,
       email: i.email,
       role: i.role,
       isAdmin: false,
       status: 'invited', // 标记为邀请中
       joinedAt: i.createdAt
    }));

  // 3. 合并返回
  res.json([...activeMembers, ...pendingInvites]);
});

// --- C. 发送邀请邮件 ---
app.post('/api/team/invite', requireAuth, async (req: any, res) => {
  const { email, role,name } = req.body;
  const companyId = req.user.companyId;
  const companyName = req.user.companyName || '我们公司';
  
  const data = db.get();

  // 1. 检查是否已经是成员
  const existingUser = (data.users || []).find((u: any) => u.email === email && u.companyId === companyId);
  if (existingUser) {
    return res.status(400).json({ message: '该用户已经是团队成员' });
  }

  // 2. 检查是否已经邀请过
  const existingInvite = (data.invitations || []).find((i: any) => i.email === email && i.companyId === companyId && i.status === 'pending');
  if (existingInvite) {
    return res.status(400).json({ message: '已向该邮箱发送过邀请，请勿重复发送' });
  }

  // 3. 创建邀请记录
  const token = crypto.randomBytes(16).toString('hex');
  const newInvitation = {
    id: `inv_${Date.now()}`,
    email,
    role,
    name: name || '',
    companyId,
    companyName,
    inviterId: req.user.userId,
    token,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  // 4. 准备邮件内容
  const inviteLink = `http://localhost:3000/join?token=${token}`; // 前端接受邀请页面的地址
  const mailOptions = {
    from: '"财务系统" <3153520738@qq.com>', // 记得改成和你配置一样的邮箱
    to: email,
    subject: `【邀请】加入 ${companyName} 的财务团队`,
    html: `
    <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
      <h2 style="color: #2563EB;">诚挚邀请</h2>
      <p>你好！</p>
      <p><b>${req.user.name || '管理员'}</b> 邀请您加入 <b>${companyName}</b> 的财务管理系统。</p>
      <p>分配角色：<b>${role}</b></p>
      <br/>
      
      <!-- 按钮 -->
      <a href="${inviteLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">立即接受邀请</a>
      
      <br/><br/>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      
      <!-- ✅ 新增：显式显示链接，防止QQ邮箱拦截按钮 -->
      <p style="font-size: 14px; color: #666;">
        如果上方按钮点击无效（出现 -5002 错误），请直接复制下方链接到浏览器地址栏访问：
      </p>
      <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; color: #333;">
        ${inviteLink}
      </p>
    </div>
  `
};

  try {
    // ★ 真实发送邮件 (取消注释以启用)
     await transporter.sendMail(mailOptions);
    
    // 模拟发送成功 (在控制台打印)
    console.log("📨 [MOCK MAIL SENT] To:", email, "Link:", inviteLink);

    // 5. 保存到数据库
    db.update('invitations', [...(data.invitations || []), newInvitation]);
    res.json({ success: true, message: '邀请已发送' });

  } catch (error) {
    console.error("邮件发送失败:", error);
    res.status(500).json({ message: '邮件服务配置错误或网络不通' });
  }
});

// --- D. 撤销邀请 ---
app.post('/api/team/revoke-invite', requireAuth, (req: any, res) => {
    const { id } = req.body;
    const data = db.get();
    // 物理删除邀请记录
    const newList = (data.invitations || []).filter((i: any) => i.id !== id);
    db.update('invitations', newList);
    res.json({ success: true });
});

// --- E. 更新成员信息 (角色/权限) ---
// ★★★ 这是配合 EditMemberModal 必须加的接口 ★★★
app.put('/api/team/member', requireAuth, (req: any, res) => {
  const { id, role, isAdmin } = req.body;
  const companyId = req.user.companyId;
  const currentUserId = req.user.userId;
  const currentUserRole = req.user.role; // 登录时的角色，注意：最好实时查库更安全，这里简化处理

  const data = db.get();
  const users = data.users || [];
  
  // 1. 查找目标用户
  const index = users.findIndex((u: any) => u.id === id && u.companyId === companyId);
  if (index === -1) return res.status(404).json({ message: '未找到该成员' });

  const targetUser = users[index];

  // 2. ★★★ 安全校验核心 ★★★
  
  // 规则 A: 只有 Owner 或 Admin 可以修改别人
  // (假设 req.user 里存了 role，或者你需要先查一下操作者的最新权限)
  const operator = users.find((u: any) => u.id === currentUserId);
  if (!operator?.isAdmin && operator?.role !== 'Owner') {
      return res.status(403).json({ message: '无权操作：需要管理员权限' });
  }

  // 规则 B: 禁止修改自己 (防止把自己提权为 Owner，或者误把自己降级)
  if (id === currentUserId) {
      return res.status(403).json({ message: '禁止修改自己的权限' });
  }

  // 规则 C: 不能修改 Owner
  if (targetUser.role === 'Owner') {
     return res.status(403).json({ message: '无法修改超级管理员的权限' });
  }

  // 执行更新
  users[index] = { 
    ...users[index], 
    role: role, 
    isAdmin: isAdmin 
  };

  db.update('users', users);
  res.json({ success: true, member: users[index] });
});
// --- F. 移除成员 (或撤销邀请) ---
app.delete('/api/team/member/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const currentUserId = req.user.userId;
  const companyId = req.user.companyId;
  const data = db.get();
  if (id === currentUserId) {
      return res.status(403).json({ message: '无法将自己移出团队，请联系团队拥有者。' });
  }

  // 2. 权限校验
  const operator = (data.users || []).find((u: any) => u.id === currentUserId);
  if (!operator?.isAdmin && operator?.role !== 'Owner') {
      return res.status(403).json({ message: '无权操作' });
  }

  // 1. 尝试从用户表中删除
  const userIndex = (data.users || []).findIndex((u: any) => u.id === id && u.companyId === companyId);
  if (userIndex > -1) {
    // 保护：不能删除 Owner
    if (data.users[userIndex].role === 'Owner') {
        return res.status(403).json({ message: '无法删除超级管理员' });
    }
    data.users.splice(userIndex, 1);
    db.update('users', data.users);
    return res.json({ success: true, message: '成员已移除' });
  }

  // 2. 尝试从邀请表中删除 (撤销邀请)
  const inviteIndex = (data.invitations || []).findIndex((i: any) => i.id === id && i.companyId === companyId);
  if (inviteIndex > -1) {
    data.invitations.splice(inviteIndex, 1);
    db.update('invitations', data.invitations);
    return res.json({ success: true, message: '邀请已撤销' });
  }

  res.status(404).json({ message: '未找到该成员或邀请' });
});

// --- G. 重新发送邀请 ---
app.post('/api/team/resend-invite', requireAuth, async (req: any, res) => {
  const { id } = req.body;
  const data = db.get();
  
  const invite = (data.invitations || []).find((i: any) => i.id === id && i.companyId === req.user.companyId);
  if (!invite) return res.status(404).json({ message: '邀请记录不存在' });

  // 重新生成链接
  const inviteLink = `http://localhost:3000/join?token=${invite.token}`;
  
  // 邮件配置
  const mailOptions = {
    from: '"小微财务团队" <3153520738@qq.com>', // 记得改成你的邮箱配置
    to: invite.email,
    subject: `【提醒】请接受加入财务团队的邀请`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2563EB;">邀请提醒</h2>
        <p>你好！</p>
        <p>管理员提醒您尽快加入团队。</p>
        <br/>
        
        <a href="${inviteLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">立即接受邀请</a>
        
        <br/><br/>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        
        <p style="font-size: 14px; color: #666;">
          如果上方按钮点击无效，请复制下方链接到浏览器地址栏访问：
        </p>
        <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace; font-size: 12px; color: #333;">
          ${inviteLink}
        </p>
      </div>
    `
  };

  try {
    // ✅ 确保这一行没有被注释！！
    await transporter.sendMail(mailOptions); 
    
    console.log("📨 [RESEND MAIL SENT] To:", invite.email);
    res.json({ success: true });
  } catch (e) {
    console.error("Resend failed:", e);
    // 返回 500 才能让前端 toast 捕获到错误
    res.status(500).json({ message: '邮件发送失败，请检查服务器配置' });
  }
});

// --- H. 转让超级管理员 (Transfer Owner) ---
app.post('/api/team/transfer-owner', requireAuth, (req: any, res) => {
  const { newOwnerId } = req.body;
  const currentUserId = req.user.userId;
  const data = db.get();

  const users = data.users || [];
  
  // 1. 找到当前 Owner (必须是操作者自己)
  const currentUserIdx = users.findIndex((u: any) => u.id === currentUserId);
  if (currentUserIdx === -1 || users[currentUserIdx].role !== 'Owner') {
      return res.status(403).json({ message: '只有超级管理员可以转让权限' });
  }

  // 2. 找到目标成员
  const targetUserIdx = users.findIndex((u: any) => u.id === newOwnerId && u.companyId === req.user.companyId);
  if (targetUserIdx === -1) {
      return res.status(404).json({ message: '目标成员不存在' });
  }

  // 3. 交换角色
  // 原 Owner 降级为 Admin (管理员)
  users[currentUserIdx].role = '管理员'; 
  users[currentUserIdx].isAdmin = true;
  
  // 新 Owner 升级
  users[targetUserIdx].role = 'Owner';
  users[targetUserIdx].isAdmin = true;

  db.update('users', users);
  res.json({ success: true });
});
// ==========================================
// 14. 结转模板 API (Closing Templates) - 修复版
// ==========================================

app.get('/api/closing-templates', requireAuth, (req: any, res) => {
  const data = db.get();
  // ★★★ 修复：必须获取 accountBookId 参数 ★★★
  const { accountBookId } = req.query; 

  let list = (data.closingTemplates || []).filter((t: any) => t.companyId === req.user.companyId);
  
  // ★★★ 修复：严格按账套隔离 ★★★
  if (accountBookId) {
      list = list.filter((t: any) => t.accountBookId === accountBookId);
  }

  res.json(list);
});

app.post('/api/closing-templates', requireAuth, (req: any, res) => {
  const data = db.get();
  // ★★★ 修复：保存时必须带上 accountBookId ★★★
  const newTemplate = {
    ...req.body,
    id: `ct_${Date.now()}`,
    companyId: req.user.companyId,
    // 前端传来 accountBookId，后端存入
    accountBookId: req.body.accountBookId, 
    createdAt: new Date().toISOString()
  };
  
  const currentList = data.closingTemplates || [];
  db.update('closingTemplates', [...currentList, newTemplate]);
  res.status(201).json(newTemplate);
});

app.delete('/api/closing-templates/:id', requireAuth, (req: any, res) => {
  const { id } = req.params;
  const data = db.get();
  // 物理删除
  const list = (data.closingTemplates || []).filter((t: any) => !(t.id === id && t.companyId === req.user.companyId));
  db.update('closingTemplates', list);
  res.json({ success: true });
});
// ==========================================
// 0. 邮件发送配置 (QQ邮箱)
// ==========================================
const transporter = nodemailer.createTransport({
  service: 'qq',
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

// ==========================================
// 18. 账户激活流程接口 (Account Activation)
// ==========================================

// A. 获取激活信息 (校验 Token 有效性)
app.get('/api/auth/activate-info', (req: any, res: any) => {
  const { token } = req.query;
  
  if (!token) return res.status(400).json({ message: 'Token is required' });

  const data = db.get();
  
  // 1. 在邀请表中查找
  const invite = (data.invitations || []).find((i: any) => i.token === token && i.status === 'pending');
  
  if (!invite) {
    return res.status(404).json({ message: '邀请链接无效或已过期' });
  }

  // 2. 获取邀请人姓名
  const inviter = (data.users || []).find((u: any) => u.id === invite.inviterId);
  const inviterName = inviter ? inviter.name : '管理员';

  // 3. 返回信息
  res.json({
    email: invite.email,
    role: invite.role,
    companyName: invite.companyName,
    inviterName: inviterName
  });
});

// B. 执行激活 (创建新用户)
app.post('/api/auth/activate', async (req: any, res: any) => {
  const { token, name, password } = req.body;
  const data = db.get();

  // 1. 再次校验邀请记录
  const inviteIndex = (data.invitations || []).findIndex((i: any) => i.token === token && i.status === 'pending');
  if (inviteIndex === -1) {
    return res.status(400).json({ message: '邀请无效' });
  }
  
  const invite = data.invitations[inviteIndex];

  // 2. 检查邮箱是否已被注册
  const userExists = (data.users || []).some((u: any) => u.email === invite.email);
  if (userExists) {
    return res.status(409).json({ message: '该邮箱已注册，请直接登录' });
  }

  // 3. 密码加密
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 4. 创建新用户对象
  const newUser = {
    id: `user_${Date.now()}`,
    email: invite.email,
    name: name,
    passwordHash: passwordHash,
    companyId: invite.companyId,
    role: invite.role,
    isAdmin: false,
    status: 'Active',
    created_at: new Date().toISOString()
  };

  // 5. 更新数据库
  db.update('users', [...(data.users || []), newUser]);
  
  const newInvitations = [...data.invitations];
  newInvitations[inviteIndex] = { ...invite, status: 'accepted', acceptedAt: new Date().toISOString() };
  db.update('invitations', newInvitations);

  // 6. 返回成功
  res.json({ success: true, userId: newUser.id });
});

// ==========================================
// 19. 密码重置流程 (Password Reset) - 真实发送版
// ==========================================

app.post('/api/auth/reset-request', async (req: any, res: any) => {
  const { email } = req.body;
  const data = db.get();
  
  // 1. 查找用户
  const user = (data.users || []).find((u: any) => u.email === email);
  
  // 安全策略：即使邮箱不存在，也假装发送成功，防止恶意扫描
  if (!user) {
    setTimeout(() => res.json({ success: true }), 800); 
    return;
  }

  // 2. 生成重置 Token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 3600000; // 1小时后过期

  // 3. 存入数据库
  const resetRecord = {
    id: `pr_${Date.now()}`,
    userId: user.id,
    email: user.email,
    token,
    expiresAt,
    used: false
  };
  
  const resets = data.passwordResets || [];
  db.update('passwordResets', [...resets, resetRecord]);

  // 4. 发送真实邮件
  // 注意：确保 localhost:3000 是你前端运行的地址
  const resetLink = `http://localhost:3000/auth/SetNewPassword?token=${token}`;
  
  const mailOptions = {
    from: '"财务系统管理员" <3153520738@qq.com>', // 必须与上方 auth.user 一致
    to: email, 
    subject: '【财务系统】请重置您的密码',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
        <h2 style="color: #2563EB;">重置密码请求</h2>
        <p>您好！我们收到了您账号 <b>${email}</b> 的密码重置申请。</p>
        <p>请点击下方按钮设置新密码：</p>
        
        <div style="margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">重置密码</a>
        </div>
        
        <p style="font-size: 14px; color: #666;">链接有效期为 1 小时。</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #999;">
          如果按钮无法点击，请复制下方链接到浏览器打开：<br/>
          ${resetLink}
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ [MAIL SENT] 密码重置邮件已发送至: ${email}`);
    res.json({ success: true });
  } catch (error) {
    console.error("❌ [MAIL ERROR] 发送失败:", error);
    // 返回 500 状态码让前端知道出错了
    res.status(500).json({ message: '邮件服务配置错误或网络不通' });
  }
});

// ==========================================
// 21. 密码重置确认接口
// ==========================================

// A. 校验 Token
app.get('/api/auth/reset-verify', (req: any, res: any) => {
  const { token } = req.query;
  const data = db.get();
  
  // 查找有效的重置记录
  const record = (data.passwordResets || []).find((r: any) => 
    r.token === token && 
    r.used === false && 
    r.expiresAt > Date.now()
  );

  if (!record) {
    return res.status(404).json({ message: '无效或过期的链接' });
  }

  res.json({ email: record.email, valid: true });
});

// B. 执行重置
app.post('/api/auth/reset-confirm', async (req: any, res: any) => {
  const { token, password } = req.body;
  const data = db.get();

  // 1. 再次校验
  const resetIndex = (data.passwordResets || []).findIndex((r: any) => 
    r.token === token && 
    r.used === false && 
    r.expiresAt > Date.now()
  );

  if (resetIndex === -1) {
    return res.status(400).json({ message: '链接无效' });
  }

  const record = data.passwordResets[resetIndex];

  // 2. 找到用户
  const userIndex = (data.users || []).findIndex((u: any) => u.id === record.userId);
  if (userIndex === -1) return res.status(404).json({ message: '用户不存在' });

  // 3. 更新密码
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  
  data.users[userIndex].passwordHash = passwordHash;

  // 4. 标记 Token 已用
  data.passwordResets[resetIndex].used = true;

  db.update('users', data.users);
  db.update('passwordResets', data.passwordResets);

  res.json({ success: true });
});


// ==========================================
// 22. 现金流量表引擎 (增强版)
// ==========================================

const CASH_SUBJECT_PREFIXES = ['1001', '1002', '1012'];

// 定义科目归属的活动类别
// 1=经营, 2=投资, 3=筹资
const SUBJECT_ACTIVITY_TYPE: Record<string, number> = {
    // 经营相关
    '6001': 1, '6051': 1, '1121': 1, '1122': 1, '2203': 1, // 收入/收款
    '14': 1, '64': 1, '2202': 1, '1123': 1, '2241': 1, '1221': 1, // 成本/付款/往来
    '2211': 1, // 薪酬
    '2221': 1, // 税费
    '66': 1,   // 期间费用

    // 投资相关
    '15': 2, '1101': 2, '6111': 2, // 投资/理财
    '16': 2, '17': 2, '18': 2,     // 长期资产

    // 筹资相关
    '2001': 3, '2501': 3, // 借款
    '3001': 3, '3002': 3, // 资本
    '2232': 3, '2231': 3  // 股利/利息
};

app.get('/api/reports/cash-flow-statement', requireAuth, (req: any, res) => {
    const { period, accountBookId } = req.query;
    const companyId = req.user.companyId;

    if (!period || !accountBookId) return res.status(400).json({ message: 'Missing parameters' });

    const data = db.get();
    
    // 日期处理
    const [y, m] = period.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const startDate = `${period}-01`;
    const endDate = `${period}-${lastDay}`;
    const yearStart = `${y}-01-01`;

    // 筛选凭证：必须是已审核的
    const allVouchers = (data.vouchers || []).filter((v: any) => 
        v.companyId === companyId && 
        v.accountBookId === accountBookId &&
        v.status === 'approved' 
    );

    const resultMap = new Map<number, { period: number, year: number }>();

    // 辅助函数：根据非现金科目 + 净现金流方向 -> 确定行号
    const determineRowNumber = (subjectCode: string, netCashFlow: number) => {
        const isInflow = netCashFlow > 0;
        
        // 1. 尝试匹配前缀
        let matchedPrefix = '';
        for (const prefix of Object.keys(SUBJECT_ACTIVITY_TYPE)) {
            if (subjectCode.startsWith(prefix)) {
                matchedPrefix = prefix;
                break; // 找到即停，注意字典顺序，越长越精确的前缀应越早匹配(这里简化处理)
            }
        }

        if (!matchedPrefix) {
            // 兜底：未识别科目，默认归入经营活动的其他
            return isInflow ? 4 : 9;
        }

        const activityType = SUBJECT_ACTIVITY_TYPE[matchedPrefix];

        // 2. 根据活动类型 + 方向 分配具体行次
        if (activityType === 1) { // 经营
            if (isInflow) {
                if (['6001', '6051', '1121', '1122', '2203'].includes(matchedPrefix)) return 2; // 销售商品收到
                if (matchedPrefix === '2221') return 3; // 税费返还
                return 4; // 其他经营流入
            } else { // 流出 (netCashFlow < 0)
                if (['14', '64', '2202', '1123'].some(p => subjectCode.startsWith(p))) return 6; // 购买商品支付
                if (subjectCode.startsWith('2211')) return 7; // 支付职工
                if (subjectCode.startsWith('2221')) return 8; // 支付税费
                return 9; // 其他经营流出 (费用等)
            }
        }
        else if (activityType === 2) { // 投资
            if (isInflow) {
                if (['15', '1101'].some(p => subjectCode.startsWith(p))) return 13; // 收回投资
                if (subjectCode.startsWith('6111')) return 14; // 投资收益
                return 13; 
            } else {
                if (['16', '17', '18'].some(p => subjectCode.startsWith(p))) return 16; // 购建资产
                return 17; // 投资支付
            }
        }
        else if (activityType === 3) { // 筹资
            if (isInflow) {
                if (['3001', '3002'].some(p => subjectCode.startsWith(p))) return 21; // 吸收投资
                return 22; // 借款收到
            } else {
                if (['2001', '2501'].some(p => subjectCode.startsWith(p))) return 24; // 偿还债务
                if (['2232', '2231'].some(p => subjectCode.startsWith(p))) return 25; // 分配股利
                return 25;
            }
        }
        return 0;
    };

    // 核心处理逻辑
    const processVoucher = (v: any, isCurrentPeriod: boolean) => {
        const lines = v.lines || [];
        const cashLines = lines.filter((l: any) => CASH_SUBJECT_PREFIXES.some(p => l.subjectCode.startsWith(p)));
        const nonCashLines = lines.filter((l: any) => !CASH_SUBJECT_PREFIXES.some(p => l.subjectCode.startsWith(p)));

        // 过滤规则：必须是 现金 <-> 非现金 的凭证
        if (cashLines.length === 0 || nonCashLines.length === 0) return;

        // 计算该凭证的【净现金流】
        let netCashFlow = 0;
        cashLines.forEach((l: any) => {
            netCashFlow += (Number(l.debitAmount) || 0) - (Number(l.creditAmount) || 0);
        });

        if (Math.abs(netCashFlow) < 0.001) return;

        // 寻找主导非现金科目 (金额最大的那一行)
        const dominantLine = nonCashLines.reduce((prev: any, curr: any) => {
            const pAmt = Math.max(Number(prev.debitAmount), Number(prev.creditAmount));
            const cAmt = Math.max(Number(curr.debitAmount), Number(curr.creditAmount));
            return cAmt > pAmt ? curr : prev;
        }, nonCashLines[0]);

        const rowNum = determineRowNumber(dominantLine.subjectCode, netCashFlow);

        if (rowNum > 0) {
            if (!resultMap.has(rowNum)) resultMap.set(rowNum, { period: 0, year: 0 });
            const item = resultMap.get(rowNum)!;
            // 报表填列通常填正数（即使是流出项，在流出栏目里也填正数）
            const absAmount = Math.abs(netCashFlow);
            
            if (isCurrentPeriod) item.period += absAmount;
            item.year += absAmount;
        }
    };

    allVouchers.forEach((v: any) => {
        if (v.voucherDate < yearStart || v.voucherDate > endDate) return;
        const isCurrentPeriod = v.voucherDate >= startDate && v.voucherDate <= endDate;
        processVoucher(v, isCurrentPeriod);
    });

    const resultObj: any = {};
    resultMap.forEach((val, key) => {
        resultObj[key] = {
            currentPeriod: Number(val.period.toFixed(2)),
            currentYear: Number(val.year.toFixed(2))
        };
    });

    res.json(resultObj);
});
const startServer = async () => {
  await initDb();
  app.listen(PORT, () => {
    console.log(`🚀 Backend (Express) running on http://localhost:${PORT}`);
  });
};

startServer();