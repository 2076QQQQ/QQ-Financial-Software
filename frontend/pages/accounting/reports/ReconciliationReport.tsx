import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Decimal from 'decimal.js';
import {
  getFundAccounts,
  getJournalEntries,
  getAllVouchers,
  type FundAccount,
} from '@/lib/mockData';

// 账户科目关联关系
interface AccountSubjectMapping {
  accountId: string;
  accountName: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
}

// 对比数据行
interface ReconciliationRow {
  type: 'account' | 'subject';
  id: string;
  name: string;
  initialBalance: number;
  debit: number; // 收入/借方
  credit: number; // 支出/贷方
  endingBalance: number;
}

export default function ReconciliationReport() {
  // 筛选条件
  const [filters, setFilters] = useState({
    dateFrom: '2025-01-01',
    dateTo: '2025-11-30'
  });
  
  // 数据状态
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [mappings, setMappings] = useState<AccountSubjectMapping[]>([]);
  const [reconciliationData, setReconciliationData] = useState<ReconciliationRow[]>([]);
  
  // 对话框状态
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [selectedMappings, setSelectedMappings] = useState<string[]>([]);
  const [showDifferenceDialog, setShowDifferenceDialog] = useState(false);
  
  // 加载数据
  useEffect(() => {
    const fundAccounts = getFundAccounts();
    setAccounts(fundAccounts);
    
    // BR4：根据UC09中已设置的"关联会计科目"，自动建立映射关系
    const autoMappings: AccountSubjectMapping[] = fundAccounts.map(acc => ({
      accountId: acc.id,
      accountName: acc.accountName,
      subjectId: acc.relatedSubjectId,
      subjectCode: acc.relatedSubjectCode,
      subjectName: acc.relatedSubjectName
    }));
    
    setMappings(autoMappings);
    setSelectedMappings(autoMappings.map(m => m.accountId));
  }, []);
  
  // 打开账户选择对话框
  const handleOpenMappingDialog = () => {
    setShowMappingDialog(true);
  };
  
  // 切换账户选择
  const toggleMapping = (accountId: string) => {
    if (selectedMappings.includes(accountId)) {
      setSelectedMappings(selectedMappings.filter(id => id !== accountId));
    } else {
      setSelectedMappings([...selectedMappings, accountId]);
    }
  };
  
  // 确认账户选择
  const handleConfirmMappings = () => {
    setShowMappingDialog(false);
  };
  
  // 查询核对数据
  const handleQuery = () => {
    const selectedAccounts = mappings.filter(m => selectedMappings.includes(m.accountId));
    
    if (selectedAccounts.length === 0) {
      alert('请先选择要核对的账户');
      return;
    }
    
    const rows: ReconciliationRow[] = [];
    
    selectedAccounts.forEach(mapping => {
      const account = accounts.find(a => a.id === mapping.accountId);
      if (!account) return;
      
      // BR1：账户数据来源于UC11（出纳日记账）
      const beforePeriodEntries = getJournalEntries(
        account.id,
        account.initialDate,
        getPreviousDay(filters.dateFrom)
      );
      
      const beforeIncome = beforePeriodEntries.reduce((sum, e) => 
        new Decimal(sum).plus(e.income).toNumber(), 0
      );
      const beforeExpense = beforePeriodEntries.reduce((sum, e) => 
        new Decimal(sum).plus(e.expense).toNumber(), 0
      );
      
      const accountInitialBalance = new Decimal(account.initialBalance)
        .plus(beforeIncome)
        .minus(beforeExpense)
        .toNumber();
      
      const periodEntries = getJournalEntries(
        account.id,
        filters.dateFrom,
        filters.dateTo
      );
      
      const accountIncome = periodEntries.reduce((sum, e) => 
        new Decimal(sum).plus(e.income).toNumber(), 0
      );
      const accountExpense = periodEntries.reduce((sum, e) => 
        new Decimal(sum).plus(e.expense).toNumber(), 0
      );
      
      const accountEndingBalance = new Decimal(accountInitialBalance)
        .plus(accountIncome)
        .minus(accountExpense)
        .toNumber();
      
      rows.push({
        type: 'account',
        id: mapping.accountId,
        name: mapping.accountName,
        initialBalance: accountInitialBalance,
        debit: accountIncome,
        credit: accountExpense,
        endingBalance: accountEndingBalance
      });
      
      // BR2：科目数据来源于UC08（已审核凭证汇总）
      const allVouchers = getAllVouchers().filter(v => v.status === 'approved');
      
      const beforePeriodVouchers = allVouchers.filter(v => 
        v.voucherDate >= account.initialDate && 
        v.voucherDate < filters.dateFrom
      );
      
      const periodVouchers = allVouchers.filter(v => 
        v.voucherDate >= filters.dateFrom && 
        v.voucherDate <= filters.dateTo
      );
      
      // 计算科目的借方、贷方
      let subjectBeforeDebit = 0;
      let subjectBeforeCredit = 0;
      let subjectPeriodDebit = 0;
      let subjectPeriodCredit = 0;
      
      beforePeriodVouchers.forEach(voucher => {
        voucher.lines.forEach((line: any) => {
          if (line.subjectCode === mapping.subjectCode) {
            if (line.debitAmount) {
              subjectBeforeDebit = new Decimal(subjectBeforeDebit)
                .plus(parseFloat(line.debitAmount) || 0)
                .toNumber();
            }
            if (line.creditAmount) {
              subjectBeforeCredit = new Decimal(subjectBeforeCredit)
                .plus(parseFloat(line.creditAmount) || 0)
                .toNumber();
            }
          }
        });
      });
      
      periodVouchers.forEach(voucher => {
        voucher.lines.forEach((line: any) => {
          if (line.subjectCode === mapping.subjectCode) {
            if (line.debitAmount) {
              subjectPeriodDebit = new Decimal(subjectPeriodDebit)
                .plus(parseFloat(line.debitAmount) || 0)
                .toNumber();
            }
            if (line.creditAmount) {
              subjectPeriodCredit = new Decimal(subjectPeriodCredit)
                .plus(parseFloat(line.creditAmount) || 0)
                .toNumber();
            }
          }
        });
      });
      
      // 科目期初余额 = 账户初始余额 + 期前借方 - 期前贷方
      const subjectInitialBalance = new Decimal(account.initialBalance)
        .plus(subjectBeforeDebit)
        .minus(subjectBeforeCredit)
        .toNumber();
      
      // 科目期末余额 = 期初余额 + 本期借方 - 本期贷方
      const subjectEndingBalance = new Decimal(subjectInitialBalance)
        .plus(subjectPeriodDebit)
        .minus(subjectPeriodCredit)
        .toNumber();
      
      rows.push({
        type: 'subject',
        id: mapping.subjectId,
        name: `${mapping.subjectCode} ${mapping.subjectName}`,
        initialBalance: subjectInitialBalance,
        debit: subjectPeriodDebit,
        credit: subjectPeriodCredit,
        endingBalance: subjectEndingBalance
      });
    });
    
    setReconciliationData(rows);
  };
  
  // 获取前一天的日期
  const getPreviousDay = (dateStr: string): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };
  
  // BR3：计算汇总行
  const accountRows = reconciliationData.filter(r => r.type === 'account');
  const subjectRows = reconciliationData.filter(r => r.type === 'subject');
  
  const accountTotal = {
    initialBalance: accountRows.reduce((sum, r) => new Decimal(sum).plus(r.initialBalance).toNumber(), 0),
    debit: accountRows.reduce((sum, r) => new Decimal(sum).plus(r.debit).toNumber(), 0),
    credit: accountRows.reduce((sum, r) => new Decimal(sum).plus(r.credit).toNumber(), 0),
    endingBalance: accountRows.reduce((sum, r) => new Decimal(sum).plus(r.endingBalance).toNumber(), 0)
  };
  
  const subjectTotal = {
    initialBalance: subjectRows.reduce((sum, r) => new Decimal(sum).plus(r.initialBalance).toNumber(), 0),
    debit: subjectRows.reduce((sum, r) => new Decimal(sum).plus(r.debit).toNumber(), 0),
    credit: subjectRows.reduce((sum, r) => new Decimal(sum).plus(r.credit).toNumber(), 0),
    endingBalance: subjectRows.reduce((sum, r) => new Decimal(sum).plus(r.endingBalance).toNumber(), 0)
  };
  
  const difference = {
    initialBalance: new Decimal(accountTotal.initialBalance).minus(subjectTotal.initialBalance).toNumber(),
    debit: new Decimal(accountTotal.debit).minus(subjectTotal.debit).toNumber(),
    credit: new Decimal(accountTotal.credit).minus(subjectTotal.credit).toNumber(),
    endingBalance: new Decimal(accountTotal.endingBalance).minus(subjectTotal.endingBalance).toNumber()
  };
  
  const hasDifference = Math.abs(difference.initialBalance) > 0.01 || 
                        Math.abs(difference.debit) > 0.01 || 
                        Math.abs(difference.credit) > 0.01 || 
                        Math.abs(difference.endingBalance) > 0.01;
  
  // QR2：钻取查看差异明细
  const handleDrillDownDifference = () => {
    setShowDifferenceDialog(true);
  };
  
  // 获取差异明细数据
  const getDifferenceDetails = () => {
    const onlyInJournal: any[] = []; // 仅存在于出纳日记账的流水
    const onlyInLedger: any[] = []; // 仅存在总账的凭证
    
    // 获取所有日记账流水
    const selectedAccounts = mappings.filter(m => selectedMappings.includes(m.accountId));
    selectedAccounts.forEach(mapping => {
      const account = accounts.find(a => a.id === mapping.accountId);
      if (!account) return;
      
      const periodEntries = getJournalEntries(
        account.id,
        filters.dateFrom,
        filters.dateTo
      );
      
      periodEntries.forEach(entry => {
        // 状态1：未生成凭证
        if (!entry.voucherCode) {
          onlyInJournal.push({
            ...entry,
            accountName: account.accountName,
            status: '未生成凭证'
          });
        } 
        // 状态2：凭证未审核
        else {
          const voucher = getAllVouchers().find(v => v.voucherCode === entry.voucherCode);
          if (voucher && voucher.status !== 'approved') {
            onlyInJournal.push({
              ...entry,
              accountName: account.accountName,
              status: '凭证未审核'
            });
          }
        }
      });
    });
    
    // 获取仅存在总账的凭证（已审核但出纳端没有对应流水）
    const allApprovedVouchers = getAllVouchers().filter(v => 
      v.status === 'approved' &&
      v.voucherDate >= filters.dateFrom &&
      v.voucherDate <= filters.dateTo
    );
    
    const allJournalVoucherCodes = new Set(
      selectedAccounts.flatMap(mapping => {
        const account = accounts.find(a => a.id === mapping.accountId);
        if (!account) return [];
        return getJournalEntries(account.id, filters.dateFrom, filters.dateTo)
          .filter(e => e.voucherCode)
          .map(e => e.voucherCode);
      })
    );
    
    allApprovedVouchers.forEach(voucher => {
      // 如果这个凭证在日记账中找不到，说明出纳端没有登记
      if (!allJournalVoucherCodes.has(voucher.voucherCode)) {
        voucher.lines.forEach((line: any) => {
          // 只显示资金相关科目的分录
          if (['1001', '1002', '100201', '100202'].includes(line.subjectCode)) {
            onlyInLedger.push({
              date: voucher.voucherDate,
              voucherCode: voucher.voucherCode,
              summary: line.summary,
              subjectCode: line.subjectCode,
              subjectName: line.subjectName,
              debitAmount: parseFloat(line.debitAmount) || 0,
              creditAmount: parseFloat(line.creditAmount) || 0
            });
          }
        });
      }
    });
    
    return { onlyInJournal, onlyInLedger };
  };
  
  const diffDetails = getDifferenceDetails();
  const totalDiffAmount = diffDetails.onlyInJournal.reduce((sum, e) => 
    new Decimal(sum).plus(e.income).minus(e.expense).toNumber(), 0
  ) - diffDetails.onlyInLedger.reduce((sum, e) => 
    new Decimal(sum).plus(e.debitAmount).minus(e.creditAmount).toNumber(), 0
  );
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">核对总账与出纳账</h1>
        <p className="text-gray-600">
          对比出纳日记账（UC11）和总账凭证（UC08），发现并高亮差异
        </p>
      </div>
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>日期区间（起） <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>日期区间（止） <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="col-span-8 space-y-2">
            <Label className="invisible">操作</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleOpenMappingDialog}>
                账户 ({selectedMappings.length})
              </Button>
              <Button onClick={handleQuery}>
                <Search className="w-4 h-4 mr-2" />
                查询
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 数据对比列表 */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">类型</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="text-right">期初余额</TableHead>
                <TableHead className="text-right">收入/借方</TableHead>
                <TableHead className="text-right">支出/贷方</TableHead>
                <TableHead className="text-right">期末余额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliationData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    请选择账户并点击"查询"
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {reconciliationData.map((row, index) => (
                    <TableRow 
                      key={`${row.type}-${row.id}-${index}`}
                      className={row.type === 'subject' ? 'bg-blue-50' : ''}
                    >
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.type === 'account' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.type === 'account' ? '账户' : '科目'}
                        </span>
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right">
                        ¥ {row.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        ¥ {row.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        ¥ {row.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        ¥ {row.endingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* 账户合计 */}
                  <TableRow className="bg-green-50">
                    <TableCell colSpan={2} className="text-gray-900">账户合计</TableCell>
                    <TableCell className="text-right text-gray-900">
                      ¥ {accountTotal.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ¥ {accountTotal.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ¥ {accountTotal.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      ¥ {accountTotal.endingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                  
                  {/* 科目合计 */}
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={2} className="text-gray-900">科目合计</TableCell>
                    <TableCell className="text-right text-gray-900">
                      ¥ {subjectTotal.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ¥ {subjectTotal.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ¥ {subjectTotal.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-gray-900">
                      ¥ {subjectTotal.endingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                  
                  {/* 差额 */}
                  <TableRow className={hasDifference ? 'bg-red-50' : 'bg-gray-50'}>
                    <TableCell colSpan={2} className={hasDifference ? 'text-red-700' : 'text-gray-900'}>
                      差额 {hasDifference && '⚠️'}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.abs(difference.initialBalance) > 0.01 ? (
                        <a
                          href="#"
                          className="text-red-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDrillDownDifference();
                          }}
                        >
                          ¥ {difference.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </a>
                      ) : (
                        <span className="text-green-600">¥ 0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.abs(difference.debit) > 0.01 ? (
                        <a
                          href="#"
                          className="text-red-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDrillDownDifference();
                          }}
                        >
                          ¥ {difference.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </a>
                      ) : (
                        <span className="text-green-600">¥ 0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.abs(difference.credit) > 0.01 ? (
                        <a
                          href="#"
                          className="text-red-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDrillDownDifference();
                          }}
                        >
                          ¥ {difference.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </a>
                      ) : (
                        <span className="text-green-600">¥ 0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {Math.abs(difference.endingBalance) > 0.01 ? (
                        <a
                          href="#"
                          className="text-red-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDrillDownDifference();
                          }}
                        >
                          ¥ {difference.endingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </a>
                      ) : (
                        <span className="text-green-600">¥ 0.00</span>
                      )}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* 账户/科目选择对话框 */}
      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>选择要核对的账户</DialogTitle>
            <DialogDescription>
              系统已根据资金账户的关联科目自动勾选，您可以手动调整
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">选择</TableHead>
                  <TableHead>出纳账户（UC09）</TableHead>
                  <TableHead>关联会计科目（UC02）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map(mapping => (
                  <TableRow key={mapping.accountId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedMappings.includes(mapping.accountId)}
                        onCheckedChange={() => toggleMapping(mapping.accountId)}
                      />
                    </TableCell>
                    <TableCell>{mapping.accountName}</TableCell>
                    <TableCell className="text-blue-600">
                      {mapping.subjectCode} {mapping.subjectName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
              取消
            </Button>
            <Button onClick={handleConfirmMappings}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 差异明细对话框 */}
      <Dialog open={showDifferenceDialog} onOpenChange={setShowDifferenceDialog}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>差异明细报表</DialogTitle>
            <DialogDescription>
              差异总额：¥ {totalDiffAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* A. 仅存在于出纳日记账的流水 */}
            <div>
              <h3 className="text-gray-900 mb-2">A. 仅存在于 "出纳日记账" 的流水</h3>
              <p className="text-sm text-gray-600 mb-3">
                提示：以下流水已在出纳端登记，但尚未在总账中生效。
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>资金账户</TableHead>
                    <TableHead className="text-right">收入</TableHead>
                    <TableHead className="text-right">支出</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffDetails.onlyInJournal.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                        无此类差异
                      </TableCell>
                    </TableRow>
                  ) : (
                    diffDetails.onlyInJournal.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.summary}</TableCell>
                        <TableCell>{entry.accountName}</TableCell>
                        <TableCell className="text-right text-green-600">
                          {entry.income > 0 ? `¥ ${entry.income.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {entry.expense > 0 ? `¥ ${entry.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            entry.status === '未生成凭证' 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {entry.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* B. 仅存在总账的凭证 */}
            <div>
              <h3 className="text-gray-900 mb-2">B. 仅存在 "总账" 的凭证</h3>
              <p className="text-sm text-gray-600 mb-3">
                提示：以下凭证已在总账中生效，但出纳端没有对应的资金流水。
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead>凭证字号</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead>会计科目</TableHead>
                    <TableHead className="text-right">借方金额</TableHead>
                    <TableHead className="text-right">贷方金额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diffDetails.onlyInLedger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-4">
                        无此类差异
                      </TableCell>
                    </TableRow>
                  ) : (
                    diffDetails.onlyInLedger.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>
                          <a
                            href="#"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              alert(`跳转到凭证管理（UC06），查看凭证：${entry.voucherCode}`);
                            }}
                          >
                            {entry.voucherCode}
                          </a>
                        </TableCell>
                        <TableCell>{entry.summary}</TableCell>
                        <TableCell className="text-sm">
                          {entry.subjectCode} {entry.subjectName}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {entry.debitAmount > 0 ? `¥ ${entry.debitAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {entry.creditAmount > 0 ? `¥ ${entry.creditAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDifferenceDialog(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 核对逻辑说明</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">账户数据</span>：来源于UC11出纳日记账，绿色标记</li>
            <li><span className="font-medium">科目数据</span>：来源于UC08已审核凭证汇总，蓝色标记</li>
            <li><span className="font-medium">差额高亮</span>：差额不为0时以红色标记并可点击钻取</li>
            <li><span className="font-medium">钻取功能</span>：点击差额数字可查看差异明细（未生成凭证/未审核流水）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}