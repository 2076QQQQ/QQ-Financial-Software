// 全局模拟数据存储
// 用于在组件之间共享数据

// 期初余额数据（从UC04期初数据录入获取）- 按科目代码存储
export interface SubjectInitialBalance {
  subjectCode: string;
  subjectName: string;
  debitBalance: number;  // 借方余额
  creditBalance: number; // 贷方余额
}

export let subjectInitialBalances: SubjectInitialBalance[] = [];

// 更新科目期初余额
export function updateSubjectInitialBalance(subjectCode: string, subjectName: string, debitBalance: number, creditBalance: number) {
  const index = subjectInitialBalances.findIndex(s => s.subjectCode === subjectCode);
  if (index >= 0) {
    subjectInitialBalances[index] = { subjectCode, subjectName, debitBalance, creditBalance };
  } else {
    subjectInitialBalances.push({ subjectCode, subjectName, debitBalance, creditBalance });
  }
}

// 获取科目期初余额
export function getSubjectInitialBalance(subjectCode: string) {
  const balance = subjectInitialBalances.find(s => s.subjectCode === subjectCode);
  return balance || { subjectCode, subjectName: '', debitBalance: 0, creditBalance: 0 };
}

// 批量更新期初余额（从InitialDataEntry调用）
export function batchUpdateInitialBalances(balances: SubjectInitialBalance[]) {
  subjectInitialBalances = balances;
}

// 兼容旧的期初余额接口（保持向后兼容）
export let initialBalances = {
  cash: 0,          // 1001 库存现金期初余额
  bankDeposit: 0,  // 1002 银行存款期初余额
  total: 0         // 资金账户期初余额合计
};

// 更新期初余额（兼容旧接口）
export function updateInitialBalances(data: { cash: number; bankDeposit: number }) {
  initialBalances = {
    cash: data.cash,
    bankDeposit: data.bankDeposit,
    total: data.cash + data.bankDeposit
  };
  
  // 同时更新新的科目期初余额结构
  updateSubjectInitialBalance('1001', '库存现金', data.cash, 0);
  updateSubjectInitialBalance('1002', '银行存款', data.bankDeposit, 0);
}

// 出纳日记账流水（从UC11获取）
export let journalEntries = {
  totalInflow: 0,   // 本期流入总额
  totalOutflow: 0,  // 本期流出总额
};

// 更新日记账统计
export function updateJournalStats(data: { totalInflow: number; totalOutflow: number }) {
  journalEntries = data;
}

// 计算当前资金余额
export function getCurrentBalance() {
  // 从资金账户获取期初余额总额
  const fundAccounts = getAllFundAccounts();
  const initialTotal = fundAccounts.reduce((sum, account) => sum + account.initialBalance, 0);
  
  return {
    totalBalance: initialTotal + journalEntries.totalInflow - journalEntries.totalOutflow,
    totalInflow: journalEntries.totalInflow,
    totalOutflow: journalEntries.totalOutflow,
    initialTotal: initialTotal
  };
}

// 凭证模板数据（从UC05获取）
export interface VoucherTemplate {
  id: string;
  name: string;
  voucherType: string;
  status: '待审核' | '已启用' | '已驳回';
  lines: Array<{
    id: string;
    summary: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    debitAmount: string;
    creditAmount: string;
  }>;
  createdAt: string;
}

export let voucherTemplates: VoucherTemplate[] = [];

// 添加凭证模板
export function addVoucherTemplate(template: VoucherTemplate) {
  voucherTemplates = [...voucherTemplates, template];
}

// 获取所有模板
export function getAllTemplates() {
  return voucherTemplates;
}

// 更新凭证模板
export function updateVoucherTemplate(id: string, updates: Partial<VoucherTemplate>) {
  voucherTemplates = voucherTemplates.map(t => 
    t.id === id ? { ...t, ...updates } : t
  );
}

// 删除凭证模板
export function deleteVoucherTemplate(id: string) {
  voucherTemplates = voucherTemplates.filter(t => t.id !== id);
}

// 获取已启用的模板
export function getEnabledTemplates() {
  return voucherTemplates.filter(t => t.status === '已启用');
}

// 结转模板管理
interface ClosingTemplateLine {
  id: string;
  subjectCode: string;
  subjectName: string;
  source: string;
  direction: 'debit' | 'credit';
}

export interface ClosingTemplate {
  id: string;
  name: string;
  isEnabled: boolean;
  lines: ClosingTemplateLine[];
}

export let closingTemplates: ClosingTemplate[] = [
  {
    id: 't1',
    name: '结转制造费用',
    isEnabled: true,
    lines: [
      {
        id: 'l1',
        subjectCode: '4001',
        subjectName: '生产成本',
        source: '4101制造费用',
        direction: 'debit'
      },
      {
        id: 'l2',
        subjectCode: '4101',
        subjectName: '制造费用',
        source: '4101制造费用',
        direction: 'credit'
      }
    ]
  }
];

// 获取所有结转模板
export function getAllClosingTemplates() {
  return closingTemplates;
}

// 获取已启用的结转模板
export function getEnabledClosingTemplates() {
  return closingTemplates.filter(t => t.isEnabled);
}

// 添加结转模板
export function addClosingTemplate(template: ClosingTemplate) {
  closingTemplates = [...closingTemplates, template];
}

// 更新结转模板
export function updateClosingTemplate(id: string, updates: Partial<ClosingTemplate>) {
  closingTemplates = closingTemplates.map(t =>
    t.id === id ? { ...t, ...updates } : t
  );
}

// 删除结转模板
export function deleteClosingTemplate(id: string) {
  closingTemplates = closingTemplates.filter(t => t.id !== id);
}

// 切换结转模板启用状态
export function toggleClosingTemplateEnabled(id: string) {
  closingTemplates = closingTemplates.map(t =>
    t.id === id ? { ...t, isEnabled: !t.isEnabled } : t
  );
}

// 凭证管理函数
export function getAllVouchers() {
  return vouchers;
}

export function addVoucher(voucher: any) {
  vouchers = [...vouchers, voucher];
}

export function updateVoucher(id: string, updates: any) {
  vouchers = vouchers.map(v => 
    v.id === id ? { ...v, ...updates } : v
  );
}

export function deleteVoucher(id: string) {
  vouchers = vouchers.filter(v => v.id !== id);
}

export function batchUpdateVouchers(updatedVouchers: any[]) {
  vouchers = updatedVouchers;
}

// 获取待审核凭证数量
export function getPendingVoucherCount() {
  return vouchers.filter(v => v.status === 'draft').length;
}

export function getPendingVouchersCount() {
  return getPendingVoucherCount();
}

// 凭证数据（从UC06获取）
export let vouchers: any[] = [];

// 资金账户数据（从UC09获取）
export interface FundAccount {
  id: string;
  accountType: '银行存款' | '现金';
  accountCode: string;
  accountName: string;
  bankCardNumber?: string;
  initialDate: string;
  initialBalance: number;
  relatedSubjectId: string;
  relatedSubjectCode: string;
  relatedSubjectName: string;
  status: '启用' | '停用';
}

export let fundAccounts: FundAccount[] = [];

// 资金账户管理函数
export function getAllFundAccounts() {
  return fundAccounts;
}

export function addFundAccount(account: FundAccount) {
  fundAccounts = [...fundAccounts, account];
  
  // 同步到科目期初余额表 - 汇总该科目下所有资金账户的期初余额
  syncFundAccountsToSubject(account.relatedSubjectCode);
}

export function updateFundAccount(id: string, updates: Partial<FundAccount>) {
  const oldAccount = fundAccounts.find(a => a.id === id);
  fundAccounts = fundAccounts.map(a => 
    a.id === id ? { ...a, ...updates } : a
  );
  
  // 如果期初余额或关联科目变化，同步到科目期初余额
  const newAccount = fundAccounts.find(a => a.id === id);
  if (newAccount && (oldAccount?.initialBalance !== newAccount.initialBalance || 
      oldAccount?.relatedSubjectCode !== newAccount.relatedSubjectCode)) {
    // 同步新科目
    syncFundAccountsToSubject(newAccount.relatedSubjectCode);
    // 如果关联科目变化了，也要同步旧科目
    if (oldAccount?.relatedSubjectCode !== newAccount.relatedSubjectCode && oldAccount?.relatedSubjectCode) {
      syncFundAccountsToSubject(oldAccount.relatedSubjectCode);
    }
  }
}

export function deleteFundAccount(id: string) {
  const deletedAccount = fundAccounts.find(a => a.id === id);
  fundAccounts = fundAccounts.filter(a => a.id !== id);
  
  // 删除后重新同步该科目的期初余额
  if (deletedAccount) {
    syncFundAccountsToSubject(deletedAccount.relatedSubjectCode);
  }
}

// 汇总资金账户期初余额到科目期初余额表
function syncFundAccountsToSubject(subjectCode: string) {
  // 找到所有关联该科目的资金账户
  const relatedAccounts = fundAccounts.filter(a => a.relatedSubjectCode === subjectCode);
  
  // 汇总期初余额
  const totalInitialBalance = relatedAccounts.reduce((sum, account) => sum + account.initialBalance, 0);
  
  // 获取科目名称
  const subjectName = relatedAccounts.length > 0 
    ? relatedAccounts[0].relatedSubjectName 
    : (subjectCode === '1001' ? '库存现金' : subjectCode === '1002' ? '银行存款' : '');
  
  // 更新科目期初余额（资产类科目余额在借方）
  updateSubjectInitialBalance(
    subjectCode,
    subjectName,
    totalInitialBalance,
    0
  );
}

export function getFundAccountsByType(accountType: '银行存款' | '现金') {
  return fundAccounts.filter(a => a.accountType === accountType && a.status === '启用');
}

// 收支类别数据（从UC10获取）
export interface ExpenseCategory {
  id: string;
  code: string;
  name: string;
  type: 'expense' | 'income'; // 支出/收入
  relatedSubjectCode: string;
  relatedSubjectName: string;
  cashFlowName?: string; // 关联现金流项目（用于UC20现金流量表）
  status: '启用' | '停用';
}

export let expenseCategories: ExpenseCategory[] = [
  // ========== 支出类别 ==========
  {
    id: 'exp-mgmt-salary',
    code: 'EXP-001-01',
    name: '工资社保',
    type: 'expense',
    relatedSubjectCode: '2211',
    relatedSubjectName: '应付职工薪酬',
    cashFlowName: '支付给职工以及为职工支付的现金',
    status: '启用'
  },
  {
    id: 'exp-mgmt-travel',
    code: 'EXP-001-02',
    name: '差旅费',
    type: 'expense',
    relatedSubjectCode: '6602',
    relatedSubjectName: '管理费用',
    cashFlowName: '支付其他与经营活动有关的现金',
    status: '启用'
  },
  {
    id: 'exp-mgmt-office',
    code: 'EXP-001-03',
    name: '办公用品',
    type: 'expense',
    relatedSubjectCode: '6602',
    relatedSubjectName: '管理费用',
    cashFlowName: '支付其他与经营活动有关的现金',
    status: '启用'
  },
  {
    id: 'exp-mgmt-entertain',
    code: 'EXP-001-04',
    name: '招待费',
    type: 'expense',
    relatedSubjectCode: '6602',
    relatedSubjectName: '管理费用',
    cashFlowName: '支付其他与经营活动有关的现金',
    status: '启用'
  },
  {
    id: 'exp-finance-fee',
    code: 'EXP-003-01',
    name: '手续费',
    type: 'expense',
    relatedSubjectCode: '6603',
    relatedSubjectName: '财务费用',
    cashFlowName: '支付其他与经营活动有关的现金',
    status: '启用'
  },
  {
    id: 'exp-sales',
    code: 'EXP-002',
    name: '销售费用',
    type: 'expense',
    relatedSubjectCode: '6601',
    relatedSubjectName: '销售费用',
    cashFlowName: '支付其他与经营活动有关的现金',
    status: '启用'
  },
  {
    id: 'exp-purchase',
    code: 'EXP-004',
    name: '采购成本',
    type: 'expense',
    relatedSubjectCode: '5001',
    relatedSubjectName: '主营业务成本',
    cashFlowName: '购买商品、接受劳务支付的现金',
    status: '启用'
  },
  {
    id: 'exp-internal-out',
    code: 'EXP-999-01',
    name: '内部转账-转出',
    type: 'expense',
    relatedSubjectCode: '1002',
    relatedSubjectName: '银行存款',
    status: '启用'
  },
  
  // ========== 收入类别 ==========
  {
    id: 'inc-main',
    code: 'INC-001',
    name: '主营业务收入',
    type: 'income',
    relatedSubjectCode: '6001',
    relatedSubjectName: '主营业务收入',
    status: '启用'
  },
  {
    id: 'inc-other',
    code: 'INC-002',
    name: '其他业务收入',
    type: 'income',
    relatedSubjectCode: '6051',
    relatedSubjectName: '其他业务收入',
    status: '启用'
  },
  {
    id: 'inc-nonop',
    code: 'INC-003',
    name: '营业外收入',
    type: 'income',
    relatedSubjectCode: '6901',
    relatedSubjectName: '营业外收入',
    status: '启用'
  },
  {
    id: 'inc-internal-in',
    code: 'INC-999-01',
    name: '内部转账-转入',
    type: 'income',
    relatedSubjectCode: '1002',
    relatedSubjectName: '银行存款',
    status: '启用'
  }
];

// 往来单位数据（从UC03获取）
export interface Partner {
  id: string;
  type: '客户' | '供应商' | '职员';
  code: string;
  name: string;
  status: '启用' | '停用';
}

export let partners: Partner[] = [];

// 日记账流水数据（从UC11获取）
export interface JournalEntry {
  id: string;
  accountId: string; // 关联资金账户
  accountType: '银行存款' | '现金';
  date: string; // 记账日期
  summary: string; // 摘要
  categoryId?: string; // 收支类别ID
  categoryName?: string; // 收支类别名称
  partnerId?: string; // 往来单位ID
  partnerName?: string; // 往来单位名称
  income: number; // 收入
  expense: number; // 支出
  balance: number; // 余额（自动计算）
  voucherCode?: string; // 记账凭证号（如"记-001"）
  createdAt: string;
  updatedAt: string;
}

let journalEntriesData: JournalEntry[] = [];

// 获取资金账户列表
export function getFundAccounts(type?: '银行存款' | '现金') {
  if (type) {
    return fundAccounts.filter(acc => acc.accountType === type && acc.status === '启用');
  }
  return fundAccounts.filter(acc => acc.status === '启用');
}

// 获取收支类别列表
export function getExpenseCategories() {
  return expenseCategories.filter(cat => cat.status === '启用');
}

// 获取往来单位列表
export function getPartners() {
  return partners.filter(p => p.status === '启用');
}

// 获取日记账流水
export function getJournalEntries(accountId?: string, dateFrom?: string, dateTo?: string) {
  let entries = [...journalEntriesData];
  
  if (accountId) {
    entries = entries.filter(e => e.accountId === accountId);
  }
  
  if (dateFrom) {
    entries = entries.filter(e => e.date >= dateFrom);
  }
  
  if (dateTo) {
    entries = entries.filter(e => e.date <= dateTo);
  }
  
  // 按日期排序
  entries.sort((a, b) => a.date.localeCompare(b.date));
  
  return entries;
}

// 添加日记账流水
export function addJournalEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>) {
  const newEntry: JournalEntry = {
    ...entry,
    id: `je${Date.now()}`,
    createdAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN')
  };
  journalEntriesData = [...journalEntriesData, newEntry];
  return newEntry;
}

// 更新日记账流水
export function updateJournalEntry(id: string, updates: Partial<JournalEntry>) {
  journalEntriesData = journalEntriesData.map(e =>
    e.id === id ? { ...e, ...updates, updatedAt: new Date().toLocaleString('zh-CN') } : e
  );
}

// 删除日记账流水
export function deleteJournalEntry(id: string) {
  journalEntriesData = journalEntriesData.filter(e => e.id !== id);
}

// 批量更新日记账流水
export function batchUpdateJournalEntries(ids: string[], updates: Partial<JournalEntry>) {
  journalEntriesData = journalEntriesData.map(e =>
    ids.includes(e.id) ? { ...e, ...updates, updatedAt: new Date().toLocaleString('zh-CN') } : e
  );
}

// 批量删除日记账流水
export function batchDeleteJournalEntries(ids: string[]) {
  journalEntriesData = journalEntriesData.filter(e => !ids.includes(e.id));
}

// 内部转账数据（UC13）
export interface InternalTransfer {
  id: string;
  transferNumber: string; // 转账单号
  date: string; // 记账日期
  fromAccountId: string; // 转出账户ID
  fromAccountName: string; // 转出账户名称
  toAccountId: string; // 转入账户ID
  toAccountName: string; // 转入账户名称
  amount: number; // 金额
  remark?: string; // 备注
  voucherCode?: string; // 记账凭证号
  createdAt: string;
  updatedAt: string;
}

let internalTransfers: InternalTransfer[] = [];

// 获取内部转账列表
export function getInternalTransfers(dateFrom?: string, dateTo?: string, summary?: string) {
  let transfers = [...internalTransfers];
  
  if (dateFrom) {
    transfers = transfers.filter(t => t.date >= dateFrom);
  }
  
  if (dateTo) {
    transfers = transfers.filter(t => t.date <= dateTo);
  }
  
  if (summary) {
    transfers = transfers.filter(t => t.remark?.includes(summary));
  }
  
  // 按日期降序排序
  transfers.sort((a, b) => b.date.localeCompare(a.date));
  
  return transfers;
}

// 生成转账单号
function generateTransferNumber() {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  const maxNumber = internalTransfers
    .filter(t => t.transferNumber.startsWith(`TF-${dateStr}`))
    .map(t => parseInt(t.transferNumber.split('-')[2] || '0'))
    .reduce((max, num) => Math.max(max, num), 0);
  
  return `TF-${dateStr}-${String(maxNumber + 1).padStart(3, '0')}`;
}

// 添加内部转账（BR2, BR3：自动在UC11创建两条流水）
export function addInternalTransfer(transfer: Omit<InternalTransfer, 'id' | 'transferNumber' | 'createdAt' | 'updatedAt'>) {
  const newTransfer: InternalTransfer = {
    ...transfer,
    id: `it${Date.now()}`,
    transferNumber: generateTransferNumber(),
    createdAt: new Date().toLocaleString('zh-CN'),
    updatedAt: new Date().toLocaleString('zh-CN')
  };
  
  internalTransfers = [...internalTransfers, newTransfer];
  
  // BR2 & BR3：自动在UC11创建两条流水
  const fromAccount = fundAccounts.find(a => a.id === transfer.fromAccountId);
  const toAccount = fundAccounts.find(a => a.id === transfer.toAccountId);
  
  if (fromAccount && toAccount) {
    // 1. 转出账户：支出流水
    addJournalEntry({
      accountId: transfer.fromAccountId,
      accountType: fromAccount.accountType,
      date: transfer.date,
      summary: `内部转账至${transfer.toAccountName}`,
      categoryId: 'exp-internal-out',
      categoryName: '内部转账-转出',
      income: 0,
      expense: transfer.amount,
      balance: 0 // 将被重新计算
    });
    
    // 2. 转入账户：收入流水
    addJournalEntry({
      accountId: transfer.toAccountId,
      accountType: toAccount.accountType,
      date: transfer.date,
      summary: `内部转账自${transfer.fromAccountName}`,
      categoryId: 'inc-internal-in',
      categoryName: '内部转账-转入',
      income: transfer.amount,
      expense: 0,
      balance: 0 // 将被重新计算
    });
  }
  
  return newTransfer;
}

// 更新内部转账
export function updateInternalTransfer(id: string, updates: Partial<InternalTransfer>) {
  internalTransfers = internalTransfers.map(t =>
    t.id === id ? { ...t, ...updates, updatedAt: new Date().toLocaleString('zh-CN') } : t
  );
}

// 删除内部转账
export function deleteInternalTransfer(id: string) {
  internalTransfers = internalTransfers.filter(t => t.id !== id);
}

// ========== 期末结转相关数据 ==========

// 期间锁定状态
export interface PeriodLock {
  period: string; // 会计期间，格式：2025-11
  isLocked: boolean; // 是否已结账锁定
  lockedAt?: string; // 锁定时间
  lockedBy?: string; // 锁定人
}

let periodLocks: PeriodLock[] = [];

// 检查期间是否已锁定
export function isPeriodLocked(period: string): boolean {
  const lock = periodLocks.find(l => l.period === period);
  return lock ? lock.isLocked : false;
}

// 锁定期间（结账）
export function lockPeriod(period: string, userName: string) {
  const existingLock = periodLocks.find(l => l.period === period);
  
  if (existingLock) {
    existingLock.isLocked = true;
    existingLock.lockedAt = new Date().toLocaleString('zh-CN');
    existingLock.lockedBy = userName;
  } else {
    periodLocks.push({
      period,
      isLocked: true,
      lockedAt: new Date().toLocaleString('zh-CN'),
      lockedBy: userName
    });
  }
}

// 解锁期间（反结账）
export function unlockPeriod(period: string) {
  const lock = periodLocks.find(l => l.period === period);
  if (lock) {
    lock.isLocked = false;
  }
}

// 获取所有已锁定期间
export function getLockedPeriods() {
  return periodLocks.filter(l => l.isLocked);
}

// 从总分类账获取科目数据（用于期末结转）
export function getSubjectBalance(subjectCode: string, period: string) {
  // 获取期初余额
  const initialBalance = getSubjectInitialBalance(subjectCode);
  let periodDebitTotal = 0;
  let periodCreditTotal = 0;
  
  // 获取该科目在指定期间的所有已审核凭证
  const periodVouchers = vouchers.filter(v => 
    v.status === 'approved' && 
    v.voucherDate.startsWith(period)
  );
  
  periodVouchers.forEach(voucher => {
    voucher.lines.forEach((line: any) => {
      if (line.subjectCode === subjectCode || line.subjectCode?.startsWith(subjectCode)) {
        periodDebitTotal += parseFloat(line.debitAmount || 0);
        periodCreditTotal += parseFloat(line.creditAmount || 0);
      }
    });
  });
  
  // 计算期末余额 = 期初余额 + 本期借方 - 本期贷方（对于资产类）
  // 对于损益类，通常期初余额为0，主要看本期发生额
  const debitTotal = initialBalance.debitBalance + periodDebitTotal;
  const creditTotal = initialBalance.creditBalance + periodCreditTotal;
  
  return {
    initialDebit: initialBalance.debitBalance,
    initialCredit: initialBalance.creditBalance,
    periodDebit: periodDebitTotal,
    periodCredit: periodCreditTotal,
    debitTotal,
    creditTotal,
    balance: debitTotal - creditTotal
  };
}

// 获取损益类科目列表
export function getProfitLossSubjects() {
  // 简化版：返回常见的损益类科目
  return [
    { code: '6001', name: '主营业务收入', category: '损益类' },
    { code: '6051', name: '其他业务收入', category: '损益类' },
    { code: '6901', name: '营业外收入', category: '损益类' },
    { code: '5001', name: '主营业务成本', category: '损益类' },
    { code: '5051', name: '其他业务成本', category: '损益类' },
    { code: '6602', name: '管理费用', category: '损益类' },
    { code: '6601', name: '销售费用', category: '损益类' },
    { code: '6603', name: '财务费用', category: '损益类' },
    { code: '5401', name: '税金及附加', category: '���益类' },
    { code: '5801', name: '所得税费用', category: '损益类' },
    { code: '6711', name: '营业外支出', category: '损益类' }
  ];
}

// 检查凭证断号
export function checkVoucherNumberGaps(period: string) {
  const periodVouchers = vouchers
    .filter(v => v.voucherDate.startsWith(period))
    .sort((a, b) => {
      if (a.voucherType !== b.voucherType) {
        return a.voucherType.localeCompare(b.voucherType);
      }
      return parseInt(a.voucherNumber) - parseInt(b.voucherNumber);
    });
  
  const gaps: string[] = [];
  
  // 按凭证字分组检查
  const typeGroups: { [key: string]: any[] } = {};
  periodVouchers.forEach(v => {
    if (!typeGroups[v.voucherType]) {
      typeGroups[v.voucherType] = [];
    }
    typeGroups[v.voucherType].push(v);
  });
  
  Object.keys(typeGroups).forEach(type => {
    const vouchersOfType = typeGroups[type];
    for (let i = 0; i < vouchersOfType.length - 1; i++) {
      const current = parseInt(vouchersOfType[i].voucherNumber);
      const next = parseInt(vouchersOfType[i + 1].voucherNumber);
      if (next - current > 1) {
        gaps.push(`${type}-${String(current + 1).padStart(3, '0')}`);
      }
    }
  });
  
  return gaps;
}

// 检查是否有未审核凭证
export function hasUnapprovedVouchers(period: string): boolean {
  return vouchers.some(v => 
    v.voucherDate.startsWith(period) && 
    v.status === 'draft'
  );
}

// 根据期间和结转类型查找结转凭证
export function getClosingVoucherByType(period: string, closingType: string): any | null {
  // 优先使用新的标识字段查询
  const voucherWithFlags = vouchers.find(v => 
    v.period === period && 
    v.closingType === closingType &&
    v.isClosingVoucher === true
  );
  
  if (voucherWithFlags) {
    return voucherWithFlags;
  }
  
  // 兼容旧数据：使用摘要关键词查找
  const keywords: { [key: string]: string } = {
    'cost': '结转本月销售成本',
    'tax': '计提本月税金',
    'income-tax': '计提所得税',
    'vat': '结转未交增值税',
    'profit': '结转本期损益',
    'retained-earnings': '结转本年利润'
  };
  
  const keyword = keywords[closingType];
  if (!keyword) return null;
  
  return vouchers.find(v => 
    v.voucherDate.startsWith(period) &&
    v.status === 'approved' &&
    v.lines.some((line: any) => line.summary.includes(keyword))
  );
}

// 获取未分类流水（没有生成凭证的日记账流水）
export function getUnclassifiedEntries() {
  return journalEntriesData.filter(entry => !entry.voucherCode);
}

// 获取未分类流水数量
export function getUnclassifiedCount() {
  return getUnclassifiedEntries().length;
}

// ========== 会计科目管理 ==========
export interface Subject {
  id: string;
  code: string;
  name: string;
  category: '资产' | '负债' | '所有者权益' | '成本' | '损益';
  direction: '借' | '贷';
  mnemonic?: string;
  quantityUnit?: string;
  auxiliaryItems?: string[];
  isActive: boolean;
  isBuiltIn: boolean;
  hasBalance: boolean;
  hasChildren: boolean;
  parentId?: string;
  level: number;
}

export let subjects: Subject[] = [];

// 获取所有科目
export function getAllSubjects() {
  return subjects;
}

// 获取活动科目
export function getActiveSubjects() {
  return subjects.filter(s => s.isActive);
}

// 添加科目
export function addSubject(subject: Subject) {
  subjects = [...subjects, subject];
}

// 更新科目
export function updateSubject(id: string, updates: Partial<Subject>) {
  subjects = subjects.map(s =>
    s.id === id ? { ...s, ...updates } : s
  );
}

// 删除科目
export function deleteSubject(id: string) {
  subjects = subjects.filter(s => s.id !== id);
}

// 批量设置科目
export function setSubjects(newSubjects: Subject[]) {
  subjects = newSubjects;
}

// 获取资金类科目（库存现金1001和银行存款1002的末级科目）
export function getFundSubjects() {
  return subjects.filter(s => 
    s.isActive && 
    !s.hasChildren &&
    (s.code.startsWith('1001') || s.code.startsWith('1002'))
  );
}

// 激活所有内置科目（从UC02会计科目设置调用）
export function activateAllBuiltInSubjects() {
  subjects = subjects.map(s => 
    s.isBuiltIn ? { ...s, isActive: true } : s
  );
}

// ========== 期初数据余额管理 ==========
export interface InitialBalance {
  subjectCode: string;
  subjectName: string;
  debitAmount: number;
  creditAmount: number;
}

export let initialBalanceData: InitialBalance[] = [];

// 获取期初余额
export function getInitialBalances() {
  return initialBalanceData;
}

// 设置期初余额
export function setInitialBalances(balances: InitialBalance[]) {
  initialBalanceData = balances;
}

// 获取某个科目的期初余额净额（从InitialBalance数据结构）
export function getSubjectInitialBalanceAmount(subjectCode: string): number {
  const balance = initialBalanceData.find(b => b.subjectCode === subjectCode);
  if (!balance) return 0;
  return balance.debitAmount - balance.creditAmount;
}

// ========== 财务报表数据函数 (UC18, UC19, UC20) ==========

// 获取科目当期余额（来自UC16总分类账）
export function getSubjectPeriodBalance(subjectCode: string, period: string) {
  const balance = getSubjectBalance(subjectCode, period);
  return {
    debitBalance: balance.debitTotal || 0,
    creditBalance: balance.creditTotal || 0,
    balance: balance.balance || 0
  };
}

// 获取科目本年累计发生额（来自UC16总分类账）
export function getSubjectYearTotal(subjectCode: string, year: string) {
  // 获取该年所有已审核凭证
  const yearVouchers = getAllVouchers().filter(v => 
    v.status === 'approved' && 
    v.voucherDate.startsWith(year)
  );
  
  let debitTotal = 0;
  let creditTotal = 0;
  
  yearVouchers.forEach(voucher => {
    voucher.lines.forEach((line: any) => {
      if (line.subjectCode === subjectCode) {
        debitTotal += parseFloat(line.debitAmount) || 0;
        creditTotal += parseFloat(line.creditAmount) || 0;
      }
    });
  });
  
  return { debitTotal, creditTotal };
}

// 获取科目本期发生额（来自UC08凭证汇总）
export function getSubjectPeriodAmount(subjectCode: string, period: string) {
  // 获取该期间所有已审核凭证
  const dateFrom = `${period}-01`;
  const dateTo = `${period}-31`;
  
  const periodVouchers = getAllVouchers().filter(v => 
    v.status === 'approved' && 
    v.voucherDate >= dateFrom && 
    v.voucherDate <= dateTo
  );
  
  let debitTotal = 0;
  let creditTotal = 0;
  
  periodVouchers.forEach(voucher => {
    voucher.lines.forEach((line: any) => {
      if (line.subjectCode === subjectCode) {
        debitTotal += parseFloat(line.debitAmount) || 0;
        creditTotal += parseFloat(line.creditAmount) || 0;
      }
    });
  });
  
  return { debitTotal, creditTotal };
}

// 获取所有货币资金科目余额（用于UC20现金流量表）
export function getMoneyFundBalance(period: string) {
  const moneyFundSubjects = subjects.filter(s => 
    s.isActive && 
    (s.code.startsWith('1001') || s.code.startsWith('1002'))
  );
  
  let totalInitial = 0;
  let totalPeriodEnd = 0;
  
  moneyFundSubjects.forEach(subject => {
    // 期初余额
    const initial = getSubjectInitialBalance(subject.code);
    totalInitial += (initial.debitBalance - initial.creditBalance);
    
    // 期末余额
    const periodBalance = getSubjectPeriodBalance(subject.code, period);
    totalPeriodEnd += periodBalance.balance;
  });
  
  return { totalInitial, totalPeriodEnd };
}

// 按现金流类型汇总出纳日记账（用于UC20现金流量表）
export function getCashFlowByCategory(period: string) {
  const dateFrom = `${period}-01`;
  const dateTo = `${period}-31`;
  
  // 筛选期间内的流水
  const periodEntries = journalEntriesData.filter(e => 
    e.date >= dateFrom && e.date <= dateTo
  );
  
  // 按收支类别分组
  const categoryMap = new Map<string, { income: number; expense: number }>();
  
  periodEntries.forEach(entry => {
    const key = entry.categoryName || '未分类';
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { income: 0, expense: 0 });
    }
    const current = categoryMap.get(key)!;
    current.income += entry.income;
    current.expense += entry.expense;
  });
  
  return categoryMap;
}

// 获取本年所有出纳日记账流水（用于UC20年累计）
export function getYearCashFlow(year: string) {
  const yearEntries = journalEntriesData.filter(e => 
    e.date.startsWith(year)
  );
  
  // 按收支类别分组
  const categoryMap = new Map<string, { income: number; expense: number }>();
  
  yearEntries.forEach(entry => {
    const key = entry.categoryName || '未分类';
    if (!categoryMap.has(key)) {
      categoryMap.set(key, { income: 0, expense: 0 });
    }
    const current = categoryMap.get(key)!;
    current.income += entry.income;
    current.expense += entry.expense;
  });
  
  return categoryMap;
}

// ========== 账套状态管理 ==========
export interface AccountBookStatus {
  isActivated: boolean; // 是否已启用账套
  hasClosedPeriod: boolean; // 是否已完成首次结账
  activatedAt?: string; // 启用时间
  firstClosedAt?: string; // 首次结账时间
}

export let accountBookStatus: AccountBookStatus = {
  isActivated: false,
  hasClosedPeriod: false
};

// 启用账套
export function activateAccountBook() {
  accountBookStatus.isActivated = true;
  accountBookStatus.activatedAt = new Date().toLocaleString('zh-CN');
}

// 标记首次结账
export function markFirstPeriodClosed() {
  accountBookStatus.hasClosedPeriod = true;
  if (!accountBookStatus.firstClosedAt) {
    accountBookStatus.firstClosedAt = new Date().toLocaleString('zh-CN');
  }
}

// 检查期初数据是否可编辑
export function canEditInitialData(): { canEdit: boolean; reason?: string } {
  // 规则1：未启用账套 - 可自由修改
  if (!accountBookStatus.isActivated) {
    return { canEdit: true };
  }
  
  // 规则3：已完成首次结账 - 禁止修改
  if (accountBookStatus.hasClosedPeriod) {
    return { 
      canEdit: false, 
      reason: '账套已完成首次结账，期初数据已锁定。需先反初始化并取消结账才能修改。' 
    };
  }
  
  // 规则2：已启用但未结账 - 管理员可修改
  return { 
    canEdit: true,
    reason: '账套已启用但未结账，管理员可修改期初数据。' 
  };
}
