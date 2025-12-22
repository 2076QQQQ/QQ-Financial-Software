// ------------------------------------------------------------------
// 文件路径: frontend/lib/mockData.ts (建议重命名为 api.ts)
// 说明：这是真实的 API Client，连接 http://localhost:4000/api
// 修改说明：已全面支持多账套隔离，核心接口强制要求传入 bookId
// ------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api';

interface CustomRequestInit extends Omit<RequestInit, 'body'> {
  body?: any;
}

// 核心请求函数
const client = async (endpoint: string, { body, ...customConfig }: CustomRequestInit = {}) => {
  const headers = { 'Content-Type': 'application/json' };

  const config: RequestInit = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
    credentials: 'include', 
    cache: 'no-store',
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const url = `${API_BASE}${endpoint}`;
    console.log('📡 Requesting:', url); // 调试用
    
    const response = await fetch(url, config);

    if (!response.ok) {
      // ✅ 关键修复：先定义 errorText 变量，再使用它
      const errorText = await response.text();
      
      // 创建自定义错误对象，附加状态码
      const error: any = new Error(errorText || `API Request failed: ${response.status}`);
      error.status = response.status; // 把 404/401 等状态码挂载上去
      throw error;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    // console.error(`请求失败 [${endpoint}]:`, error); 
    throw error;
  }
};

// ==========================================
// 0. 通用类型定义 (Types)
// ==========================================

export type FundAccount = any;
export type Partner = any;
export type JournalEntry = any;
export type VoucherTemplate = any; 

// ==========================================
// 1.5. 账套设置 API (Account Books)
// 说明：这是入口，不需要传 bookId
// ==========================================

export const getAccountBooks = async () => {
  return client('/settings/account-books');
};

export const addAccountBook = async (data: any) => {
  return client('/settings/account-books', { body: data });
};

export const updateAccountBook = async (data: any) => {
  return client('/settings/account-books', { 
    method: 'PUT', 
    body: data 
  });
};

export const deleteAccountBook = async (id: string) => {
  return client(`/settings/account-books?id=${id}`, { method: 'DELETE' });
};

// ==========================================
// 1. 资金账户 API (Fund Accounts)
// 修改：增加 bookId 参数
// ==========================================

export const getAllFundAccounts = async (bookId: string) => {
  if (!bookId) return [];
  return client(`/settings/fund-accounts?accountBookId=${bookId}`);
};

// 【兼容旧引用】注意：调用处需要修改，传入 bookId
export const getFundAccounts = getAllFundAccounts;

export const addFundAccount = async (account: any, bookId: string) => {
  return client('/settings/fund-accounts', { 
    body: { ...account, accountBookId: bookId } 
  });
};

export const updateFundAccount = async (id: string, account: any) => {
  return client('/settings/fund-accounts', {
    method: 'PUT',
    body: { id, ...account }
  });
};

export const deleteFundAccount = async (id: string) => {
  return client(`/settings/fund-accounts/${id}`, { method: 'DELETE' });
};

// ==========================================
// 2. 往来单位/辅助核算 API (Auxiliary Items)
// 修改说明：已修正 URL 格式以匹配 server.ts
// ==========================================

export const getPartners = async (bookId: string) => {
  return client(`/settings/auxiliary-items?accountBookId=${bookId}`);
};

export const getAuxiliaryCategories = async (bookId: string) => {
  if (!bookId) return [];
  return client(`/settings/auxiliary-categories?accountBookId=${bookId}`);
};

export const createAuxiliaryCategory = async (data: { name: string; bookId: string; isBuiltIn?: boolean }) => {
  return client('/settings/auxiliary-categories', { 
    body: { 
        name: data.name, 
        accountBookId: data.bookId,
        isBuiltIn: data.isBuiltIn || false
    } 
  });
};

export const updateAuxiliaryCategory = async (id: string, data: any) => {
  return client(`/settings/auxiliary-categories/${id}`, { method: 'PUT', body: data });
};

// --- 具体的辅助核算档案 (如：客户A、供应商B) ---

export const getAllAuxiliaryItems = async (bookId: string, categoryId?: string) => {
  if (!bookId) return [];
  let url = `/settings/auxiliary-items?accountBookId=${bookId}`;
  if (categoryId) {
      url += `&categoryId=${categoryId}`;
  }
  return client(url);
};

export const addAuxiliaryItem = async (item: any, bookId: string) => {
  return client('/settings/auxiliary-items', { 
    body: { ...item, accountBookId: bookId } 
  });
};

// ❌ 之前的错误：client(`/settings/auxiliary-items/${id}`...
// ✅ 修正如下：server.ts 中 PUT 接口没有 /:id，ID 在 body 里
export const updateAuxiliaryItem = async (item: any) => {
  return client('/settings/auxiliary-items', { 
    method: 'PUT', 
    body: item 
  });
};

// ❌ 之前的错误：client(`/settings/auxiliary-items/${id}`...
// ✅ 修正如下：server.ts 中 DELETE 接口用的是 req.query.id
export const deleteAuxiliaryItem = async (id: string) => {
  return client(`/settings/auxiliary-items?id=${id}`, { method: 'DELETE' });
};
export const deleteAuxiliaryCategory = async (id: string) => {
  return client(`/settings/auxiliary-categories/${id}`, { method: 'DELETE' });
};

// ==========================================
// 3. 出纳日记账 API (Cash Journal)
// 修改：增加 bookId 参数
// ==========================================

export const getJournalEntries = async (bookId: string, accountId?: string, startDate?: string, endDate?: string) => {
  const params = new URLSearchParams();
  params.append('accountBookId', bookId); // 核心：增加账套ID
  if (accountId) params.append('accountId', accountId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  return client(`/journal-entries?${params.toString()}`);
};

export const addJournalEntry = async (entry: any, bookId: string) => {
  return client('/journal-entries', { 
    body: { ...entry, accountBookId: bookId } 
  });
};

export const updateJournalEntry = async (entry: any) => {
  const id = entry.id; 
  return client(`/journal-entries/${id}`, {
    method: 'PUT',
    body: entry
  });
};

export const deleteJournalEntry = async (id: string) => {
  return client(`/journal-entries/${id}`, { method: 'DELETE' });
};

export const batchUpdateJournalEntries = async (ids: string[], updates: any) => {
  return client('/journal-entries/batch-update', {
    body: { ids, updates }
  });
};

// ==========================================
// 4. 凭证管理 API (Vouchers)
// 修改：增加 bookId 参数
// ==========================================

export const getAllVouchers = async (bookId: string) => {
  if (!bookId) {
    console.warn("API警告: getAllVouchers 未传入 bookId，返回空数组以防止数据混淆");
    return [];
  }
  return client(`/vouchers?accountBookId=${bookId}`);
};

export const addVoucher = async (voucher: any, bookId: string) => {
  return client('/vouchers', { 
    body: { ...voucher, accountBookId: bookId } 
  });
};

export const updateVoucher = async (id: string, voucher: any) => {
  return client('/vouchers', { method: 'PUT', body: { id, ...voucher } });
};

export const deleteVoucher = async (id: string) => {
  return client(`/vouchers/${id}`, { method: 'DELETE' });
};

export const batchUpdateVouchers = async (vouchers: any[]) => {
  return client('/vouchers/batch', { body: vouchers });
};

// 专用审核接口
export const auditVoucher = async (id: string, auditorName?: string) => {
  return client(`/vouchers/${id}/audit`, { method: 'POST', body: { auditorName } });
};

// 专用反审核接口
export const unauditVoucher = async (id: string) => {
  return client(`/vouchers/${id}/unaudit`, { method: 'POST', body: {} });
};
export const createVoucher = addVoucher;
// ==========================================
// 5. 凭证模板 API (Templates)
// 修改：增加 bookId 参数
// ==========================================

export const getAllTemplates = async (bookId: string) => {
  if (!bookId) return [];
  return client(`/voucher-templates?accountBookId=${bookId}`);
};

// 【重要】VoucherEntry.tsx 需要这个接口
export const getEnabledTemplates = async (bookId: string) => {
  const all = await client(`/voucher-templates?accountBookId=${bookId}`);
  if (Array.isArray(all)) {
    return all.filter((t: any) => t.status === '已启用');
  }
  return [];
};

export const addVoucherTemplate = async (template: any, bookId: string) => {
  return client('/voucher-templates', { 
    body: { ...template, accountBookId: bookId } 
  });
};

export const updateVoucherTemplate = async (idOrTemplate: any, templateData?: any) => {
  const data = templateData || idOrTemplate;
  const id = typeof idOrTemplate === 'string' ? idOrTemplate : idOrTemplate.id;
  return client(`/voucher-templates/${id}`, {
    method: 'PUT',
    body: data
  });
};

export const deleteVoucherTemplate = async (id: string | { id: string }) => {
  const realId = typeof id === 'object' ? id.id : id;
  return client(`/voucher-templates/${realId}`, { method: 'DELETE' });
};

// ==========================================
// 6. 其他设置 (Subjects / Initial Balances)
// 修改：增加 bookId 参数
// ==========================================

export const getAllSubjects = async (bookId: string) => {
  if (!bookId) return [];
  return client(`/settings/subjects?accountBookId=${bookId}`);
};
// 【新增】创建科目
export const createSubject = async (subject: any) => {
  // 注意：subject 对象里必须包含 accountBookId
  return client('/settings/subjects', { 
    body: subject 
  });
};

// 【新增】更新科目
export const updateSubject = async (subject: any) => {
  return client(`/settings/subjects`, {  // 👈 注意这里不要加 /${subject.id}
    method: 'PUT',
    body: subject
  });
};

// 【新增】删除科目
export const deleteSubject = async (id: string) => {
  return client(`/settings/subjects?id=${id}`, { method: 'DELETE' });
};

// 【兼容旧名称】为了防止组件报错，可以导出别名
export const getSubjects = getAllSubjects;
export const batchUpdateInitialBalances = async (data: any[]) => {
  // data 是一个数组，包含 subjectId, initialBalance 等
  // 这里直接调用后端
  return client('/initial-balances/batch', { 
    body: data 
  });
};
// ==========================================
// 在 frontend/lib/mockData.ts 中添加以下代码
// ==========================================

export const completeInitialization = async (bookId: string) => {
  // 注意：URL 必须和 server.ts 里的路由完全一致
  return client('/settings/initialization/complete', { 
    body: { accountBookId: bookId } 
  });
};

// 兼容函数：获取特定科目期初余额
export const getSubjectInitialBalance = async (bookId: string, subjectCode: string,auxiliaryItemId?: string) => {
  const subjects: any[] = await getAllSubjects(bookId);
  const subject = subjects.find(s => s.code === subjectCode);
  
  if (!subject) return { debitBalance: 0, creditBalance: 0 };
  if (auxiliaryItemId) {
      // 你可能需要增加一个 API: getInitialBalance(bookId, subjectId, auxId)
      // 暂时返回 0 或模拟数据，防止崩溃
      return { debitBalance: 0, creditBalance: 0 }; 
  }
  return {
    debitBalance: subject.direction === '借' ? (parseFloat(subject.initialBalance) || 0) : 0,
    creditBalance: subject.direction === '贷' ? (parseFloat(subject.initialBalance) || 0) : 0
  };
};
export const deleteInitialBalanceEntry = async (id: string) => {
  // 发送 DELETE 请求到后端
  return client(`/initial-balances/${id}`, { method: 'DELETE' });
};


// ==========================================
// 7. 内部转账 API (Internal Transfers)
// 修改：增加 bookId 参数
// ==========================================

export interface InternalTransfer {
  id: string;
  date: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  remark: string;
  voucherCode?: string;
  withdrawalEntryId?: string;
  depositEntryId?: string;
}

export const getInternalTransfers = async (bookId: string, startDate?: string, endDate?: string, summary?: string) => {
  const params = new URLSearchParams();
  params.append('accountBookId', bookId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (summary) params.append('summary', summary);
  
  return client(`/internal-transfers?${params.toString()}`);
};

export const addInternalTransfer = async (transfer: any, bookId: string) => {
  return client('/internal-transfers', { 
    body: { ...transfer, accountBookId: bookId } 
  });
};

export const updateInternalTransfer = async (idOrData: any, data?: any) => {
  const id = typeof idOrData === 'string' ? idOrData : idOrData.id;
  const body = data || idOrData;
  return client(`/internal-transfers/${id}`, {
    method: 'PUT',
    body: body
  });
};

export const deleteInternalTransfer = async (id: string) => {
  return client(`/internal-transfers/${id}`, { method: 'DELETE' });
};

// ==========================================
// 8. ★★★ 报表中心 API (Reports) ★★★
// 修改：全部增加 bookId 参数
// ==========================================

// 1. 定义账户汇总类型
export interface AccountSummary {
  accountId: string;
  accountName: string;
  accountType: string;
  initialBalance: number;
  periodIncome: number;
  periodExpense: number;
  endingBalance: number;
}

// 2. 定义科目汇总类型
export interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  type: 'income' | 'expense' | 'uncategorized';
  incomeAmount: number;
  expenseAmount: number;
  incomeCount: number;
  expenseCount: number;
}

// 3. 定义接口响应结构
export interface FundSummaryResponse {
  accountSummaries: AccountSummary[];
  subjectSummaries: SubjectSummary[];
}

// 4. 获取资金汇总报表函数
export interface AccountSummary {
  accountId: string;
  accountName: string;
  initialBalance: number;
  periodIncome: number;
  periodExpense: number;
  endingBalance: number;
}

export interface SubjectSummary {
  type: 'income' | 'expense' | 'uncategorized';
  categoryName: string;
  incomeAmount: number;
  expenseAmount: number;
  count: number;
}

export interface FundSummaryResponse {
  accountSummaries: AccountSummary[];
  subjectSummaries: SubjectSummary[];
}

export const getFundSummaryReport = async (bookId: string, startDate: string, endDate: string): Promise<FundSummaryResponse> => {
  const params = new URLSearchParams();
  // ✅ 核心：前端在这里把 accountBookId 传给后端
  params.append('accountBookId', bookId);
  params.append('startDate', startDate);
  params.append('endDate', endDate);
  
  // client 是 mockData.ts 里封装的 fetch
  return client(`/reports/fund-summary?${params.toString()}`);
};
// 明细分类账 (UC15)
export const getDetailedLedgerReport = (
  bookId: string, // <--- 关键修复：这里新增了第一个参数 bookId
  subjectCode: string, 
  periodTo: string, 
  periodFrom?: string, 
  subjectToCode?: string
) => {
  const params = new URLSearchParams();
  
  // 1. 传给后端的参数名必须叫 accountBookId (对应 server.ts 的 req.query.accountBookId)
  params.append('accountBookId', bookId); 
  
  params.append('subjectCode', subjectCode);
  params.append('periodTo', periodTo);
  
  // periodFrom 如果没传，就默认用 periodTo
  params.append('periodFrom', periodFrom || periodTo); 
  
  if (subjectToCode) {
    params.append('subjectToCode', subjectToCode);
  }

  return client(`/reports/detailed-ledger?${params.toString()}`);
};

// 总分类账 (General Ledger) 接口
export const getGeneralLedgerReport = (bookId: string, params: {
  periodFrom: string;
  periodTo: string;
  subjectFrom: string;
  subjectTo: string;
  levelFrom: number;
  levelTo: number;
}) => {
  const q = new URLSearchParams();
  q.append('accountBookId', bookId);
  q.append('periodFrom', params.periodFrom);
  q.append('periodTo', params.periodTo);
  q.append('subjectFrom', params.subjectFrom);
  q.append('subjectTo', params.subjectTo);
  q.append('levelFrom', String(params.levelFrom));
  q.append('levelTo', String(params.levelTo));

  return client(`/reports/general-ledger?${q.toString()}`);
};

// ==========================================
// 9. 报表辅助函数 (前端计算类)
// 修改：传递 bookId 到基础 API
// ==========================================

// 辅助：判断科目余额方向
const getDirectionForIncomeStatement = (code: string) => {
  if (code.startsWith('60') || code.startsWith('61') || code.startsWith('63')) {
    return '贷'; // 收入类：贷 - 借
  }
  return '借'; // 费用类：借 - 贷
};

/**
 * 获取某科目在特定期间的发生额 (本期金额)
 * @param bookId 账套ID (必填)
 */
export const getSubjectPeriodAmount = async (bookId: string, code: string, period: string) => {
  const vouchers: any[] = await getAllVouchers(bookId);
  
  // 1. 确定日期范围
  const startDate = `${period}-01`;
  const [y, m] = period.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const endDate = `${period}-${lastDay}`;

  // 2. 筛选凭证
  const targetVouchers = vouchers.filter(v => 
    v.status === 'approved' && 
    v.voucherDate >= startDate && 
    v.voucherDate <= endDate
  );

  let debit = 0;
  let credit = 0;

  targetVouchers.forEach(v => {
    (v.lines || []).forEach((line: any) => {
      // 匹配科目 (包含下级)
      if (line.subjectCode === code || line.subjectCode.startsWith(code)) {
        debit += parseFloat(line.debitAmount) || 0;
        credit += parseFloat(line.creditAmount) || 0;
      }
    });
  });

  // 3. 根据方向返回净额
  const direction = getDirectionForIncomeStatement(code);
  return direction === '贷' ? (credit - debit) : (debit - credit);
};

/**
 * 获取某科目在本年的累计发生额 (本年累计金额)
 * @param bookId 账套ID (必填)
 */
export const getSubjectYearTotal = async (bookId: string, code: string, period: string) => {
  const vouchers: any[] = await getAllVouchers(bookId);

  // 1. 确定日期范围
  const year = period.split('-')[0];
  const startDate = `${year}-01-01`; // 年初
  
  const [y, m] = period.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const endDate = `${period}-${lastDay}`; // 本期末

  // 2. 筛选凭证
  const targetVouchers = vouchers.filter(v => 
    v.status === 'approved' && 
    v.voucherDate >= startDate && 
    v.voucherDate <= endDate
  );

  let debit = 0;
  let credit = 0;

  targetVouchers.forEach(v => {
    (v.lines || []).forEach((line: any) => {
      if (line.subjectCode === code || line.subjectCode.startsWith(code)) {
        debit += parseFloat(line.debitAmount) || 0;
        credit += parseFloat(line.creditAmount) || 0;
      }
    });
  });

  // 3. 根据方向返回净额
  const direction = getDirectionForIncomeStatement(code);
  return direction === '贷' ? (credit - debit) : (debit - credit);
};

// ==========================================
// 10. 期末结转专用 API (Period Closing)
// 修改：增加 bookId
// ==========================================

export const getClosingVoucherByType = async (bookId: string, period: string, closingType: string) => {
  const vouchers: any[] = await getAllVouchers(bookId);
  return vouchers.find(v => 
    v.period === period && 
    v.closingType === closingType && 
    v.status !== 'void'
  );
};

// 获取科目余额（异步版）
export const getSubjectBalanceAsync = async (bookId: string, subjectCode: string, period: string) => {
  const vouchers: any[] = await getAllVouchers(bookId);
  
  // 1. 确定日期范围
  const [y, m] = period.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const endDate = `${period}-${lastDay}`;

  // 2. 筛选凭证
  const targetVouchers = vouchers.filter(v => 
    v.status === 'approved' && 
    v.voucherDate <= endDate
  );

  let debitTotal = 0;
  let creditTotal = 0;

  targetVouchers.forEach(v => {
    (v.lines || []).forEach((line: any) => {
      if (line.subjectCode === subjectCode || line.subjectCode.startsWith(subjectCode)) {
        debitTotal += parseFloat(line.debitAmount) || 0;
        creditTotal += parseFloat(line.creditAmount) || 0;
      }
    });
  });

  const isDebitDir = subjectCode.startsWith('1') || subjectCode.startsWith('5');
  const balance = isDebitDir ? (debitTotal - creditTotal) : (creditTotal - debitTotal);

  return { debitTotal, creditTotal, balance };
};

// 获取本期损益类科目发生额
export const getProfitLossSubjectsAsync = async (bookId: string, period: string) => {
  const allSubjects = await getAllSubjects(bookId);
  const plSubjects = allSubjects.filter((s: any) => s.code.startsWith('6') && !s.hasChildren);
  
  const results = [];
  
  const startDate = `${period}-01`;
  const [y, m] = period.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const endDate = `${period}-${lastDay}`;

  const allVouchers = await getAllVouchers(bookId);
  const periodVouchers = allVouchers.filter((v: any) => 
    v.status === 'approved' && v.voucherDate >= startDate && v.voucherDate <= endDate
  );

  for (const sub of plSubjects) {
    let debit = 0;
    let credit = 0;
    
    periodVouchers.forEach((v: any) => {
        (v.lines || []).forEach((line: any) => {
            if (line.subjectCode === sub.code) {
                debit += parseFloat(line.debitAmount) || 0;
                credit += parseFloat(line.creditAmount) || 0;
            }
        });
    });

    if (Math.abs(debit - credit) > 0.01) {
        results.push({
            ...sub,
            periodDebit: debit,
            periodCredit: credit,
            netBalance: credit - debit 
        });
    }
  }
  
  return results;
};

// ==========================================
// 11. 余额计算 (Subject Balance Aggregation)
// 修改：增加 bookId
// ==========================================

/* 获取科目在指定日期的余额 (包含期初 + 凭证发生额)
 * @param bookId 账套ID (必填)
 * @param codePrefix 科目编码前缀
 * @param dateStr 截止日期
 */
export const getSubjectAggregatedBalance = async (bookId: string, codePrefix: string, dateStr: string) => {
  const [allSubjects, allVouchers] = await Promise.all([
    getAllSubjects(bookId),
    getAllVouchers(bookId)
  ]);

  // 1. 筛选目标科目（且必须是末级科目，防止父子重复累加）
  // 逻辑：如果不存在另一个科目的代码以当前代码开头，则当前科目为末级
  const targetSubjects = (allSubjects || []).filter((s: any) => {
    const isMatch = s && s.code && (String(s.code) === codePrefix || String(s.code).startsWith(codePrefix));
    if (!isMatch) return false;

    // 检查是否为末级 (Leaf Node)
    const isParent = allSubjects.some((other: any) => 
      other.code !== s.code && String(other.code).startsWith(String(s.code))
    );
    return !isParent; 
  });

  const firstDigit = codePrefix.charAt(0);
  const isDebitDirection = firstDigit === '1' || firstDigit === '5'; // 资产/成本一般借方增加

  let initialBase = 0;
  targetSubjects.forEach((s: any) => {
    const initVal = parseFloat(s.initialBalance || 0);
    // 根据科目方向加减
    if (s.direction === '借') {
      initialBase += initVal;
    } else {
      initialBase -= initVal; 
    }
  });

  let voucherDebit = 0;
  let voucherCredit = 0;

  // 2. 统计凭证 (兼容 'approved', 'audited', '已审核')
  const validVouchers = (allVouchers || []).filter((v: any) => {
    const status = v.status || '';
    const isApproved = status === 'approved' || status === 'audited' || status === '已审核';
    return isApproved && v.voucherDate <= dateStr;
  });

  validVouchers.forEach((v: any) => {
    (v.lines || []).forEach((line: any) => {
      const lineCode = String(line.subjectCode || '');
      if (lineCode === codePrefix || lineCode.startsWith(codePrefix)) {
        voucherDebit += parseFloat(line.debitAmount) || 0;
        voucherCredit += parseFloat(line.creditAmount) || 0;
      }
    });
  });

  const netDebitBalance = initialBase + voucherDebit - voucherCredit;

  return isDebitDirection ? netDebitBalance : -netDebitBalance;
};

// ==========================================
// 12. 现金流量表辅助函数
// 修改：增加 bookId
// ==========================================

export const getCashFlowAmount = async (bookId: string, counterpartyCodes: string[], period: string, type: 'in' | 'out') => {
  const vouchers: any[] = await getAllVouchers(bookId);
  
  const startDate = `${period}-01`;
  const [y, m] = period.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  const endDate = `${period}-${lastDay}`;

  const targetVouchers = vouchers.filter(v => 
    v.status === 'approved' && 
    v.voucherDate >= startDate && 
    v.voucherDate <= endDate
  );

  let total = 0;

  targetVouchers.forEach(v => {
    const cashLines = (v.lines || []).filter((l: any) => 
      l.subjectCode.startsWith('1001') || l.subjectCode.startsWith('1002')
    );

    if (cashLines.length === 0) return; 

    const isCashIn = cashLines.some((l: any) => Number(l.debitAmount) > 0);
    
    if (type === 'in' && !isCashIn) return;
    if (type === 'out' && isCashIn) return;

    const otherLines = (v.lines || []).filter((l: any) => 
      !l.subjectCode.startsWith('1001') && !l.subjectCode.startsWith('1002')
    );

    otherLines.forEach((l: any) => {
      if (counterpartyCodes.some(code => l.subjectCode.startsWith(code))) {
        const amount = Number(l.debitAmount) || Number(l.creditAmount) || 0;
        total += amount;
      }
    });
  });

  return total;
};

// ==========================================
// 13. 团队管理 API (Team Management)
// 说明：团队通常是全局的，暂不需要 bookId
// ==========================================

export const getTeamMembers = async () => {
  return client('/team/members');
};

export const inviteMember = async (email: string, role: string, name?: string) => {
  return client('/team/invite', { body: { email, role,name } });
};

export const revokeInvitation = async (id: string) => {
  return client('/team/revoke-invite', { body: { id } });
};

export const updateTeamMember = async (id: string, updates: { role: string, isAdmin: boolean }) => {
  return client('/team/member', { 
    method: 'PUT', 
    body: { id, ...updates } 
  });
};

export const removeTeamMember = async (id: string) => {
  return client(`/team/member/${id}`, { method: 'DELETE' });
};

export const resendInvitation = async (id: string) => {
  return client('/team/resend-invite', { body: { id } });
};

export const transferOwner = async (newOwnerId: string) => {
  return client('/team/transfer-owner', { body: { newOwnerId } });
};
// ==========================================
// 14. 结转模板 API (Closing Templates) - 新增
// ==========================================

export interface ClosingTemplateLine {
  id: string;
  subjectCode: string;
  subjectName: string;
  source: string; // 取值来源
  direction: 'debit' | 'credit';
}

export interface ClosingTemplate {
  id: string;
  name: string;
  isEnabled: boolean;
  lines: ClosingTemplateLine[];
}

export const getAllClosingTemplates = async (bookId: string) => {
  if (!bookId) return [];
  return client(`/closing-templates?accountBookId=${bookId}`);
};

export const addClosingTemplate = async (template: any, bookId: string) => {
  return client('/closing-templates', { 
    body: { ...template, accountBookId: bookId } 
  });
};

export const updateClosingTemplate = async (id: string, template: any) => {
  return client(`/closing-templates/${id}`, {
    method: 'PUT',
    body: template
  });
};

export const deleteClosingTemplate = async (id: string) => {
  return client(`/closing-templates/${id}`, { method: 'DELETE' });
};

export const toggleClosingTemplateEnabled = async (id: string, isEnabled: boolean) => {
  return client(`/closing-templates/${id}/toggle`, { 
    method: 'POST',
    body: { isEnabled }
  });
};
export const me = async () => {
    try {
        const response = await client('/user/me');
        return response; 
    } catch (error: any) {
        // ✅ 升级版修复：
        // 1. 检查状态码 (401/404)
        // 2. 检查错误信息文本 (包含 'not_found' 或 'NotFound')
        if (
            error.status === 401 || 
            error.status === 404 || 
            (error.message && error.message.includes('not_found')) ||
            (error.message && error.message.includes('NotFound'))
        ) {
            console.warn("用户校验失败，视为未登录 (自动跳转登录页)");
            return null; // 返回 null，让 RouteGuard 知道“未登录”，而不是崩馈
        }
        
        // 如果是其他严重错误（如网络断了），继续抛出
        throw error;
    }
};
// ==========================================
// 16. 账户激活 API (Activation)
// ==========================================

// 1. 获取邀请信息 (校验 token 并回显邀请人信息)
export const activateInfo = async (token: string) => {
  // 调用后端 GET /api/auth/activate-info
  return client(`/auth/activate-info?token=${token}`);
};

// 2. 提交激活 (创建用户)
export const activate = async (token: string, name: string, password: string) => {
  // 调用后端 POST /api/auth/activate
  return client('/auth/activate', { 
    body: { token, name, password } 
  });
};
// ==========================================
// 17. 登录 API (Login) - 补全
// ==========================================

export const login = async (email: string, password: string) => {
  // 调用后端 POST /api/auth/login
  return client('/auth/login', { 
    body: { email, password } 
  });
};
// ==========================================
// 19. 密码重置 API
// ==========================================

export const resetRequest = async (email: string) => {
  // 调用后端 POST /api/auth/reset-request
  return client('/auth/reset-request', { 
    body: { email } 
  });
};
// ==========================================
// 21. 密码重置确认流程 (Verify & Confirm)
// ==========================================

// 1. 校验重置 Token (页面加载时调用)
export const resetVerify = async (token: string) => {
  // GET /api/auth/reset-verify?token=...
  return client(`/auth/reset-verify?token=${token}`);
};

// 2. 提交新密码
export const resetConfirm = async (token: string, password: string) => {
  // POST /api/auth/reset-confirm
  return client('/auth/reset-confirm', { 
    body: { token, password } 
  });
};
// ==========================================
// 18. 公司注册 API
// ==========================================

export const registerCompany = async (formData: any) => {
  // ✅ 修复：使用 client 函数，自动适配环境变量地址 (Render/Vercel)
  return client('/auth/register-company', {
      body: formData,
  });
};
// ==========================================
// 20. 现金流量表 API (新增)
// ==========================================

export const getCashFlowStatementReport = async (bookId: string, period: string) => {
  if (!bookId) return {};
  // 调用后端引擎
  return client(`/reports/cash-flow-statement?accountBookId=${bookId}&period=${period}`);
};