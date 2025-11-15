import { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  getExpenseCategories,
  type FundAccount,
  type JournalEntry,
  type ExpenseCategory,
} from '@/lib/mockData';

// 按账户汇总的数据结构
interface AccountSummary {
  accountId: string;
  accountName: string;
  accountType: '银行存款' | '现金';
  initialBalance: number; // 期初余额（计算值）
  periodIncome: number; // 本期收入
  periodExpense: number; // 本期支出
  endingBalance: number; // 期末余额（计算值）
}

// 按收支类别汇总的数据结构
interface CategorySummary {
  categoryId: string;
  categoryName: string;
  type: 'income' | 'expense' | 'uncategorized';
  incomeAmount: number;
  expenseAmount: number;
  incomeCount: number;
  expenseCount: number;
}

export default function FundSummaryReport() {
  // 当前Tab
  const [currentTab, setCurrentTab] = useState<'account' | 'category'>('account');
  
  // 筛选条件
  const [filters, setFilters] = useState({
    dateFrom: '2025-01-01',
    dateTo: '2025-11-30'
  });
  
  // 数据状态
  const [accountSummaries, setAccountSummaries] = useState<AccountSummary[]>([]);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  
  // 查询数据
  const handleQuery = () => {
    // UC12 3a：验证日期
    if (filters.dateTo < filters.dateFrom) {
      alert('结束日期不能早于开始日期');
      return;
    }
    
    // 获取所有账户
    const accounts = getFundAccounts();
    const categories = getExpenseCategories();
    
    // 表一：按资金账户汇总
    const accountData: AccountSummary[] = accounts.map(account => {
      // BR2：计算期初余额
      // 期初余额 = UC09.期初余额 + [从启用日到查询开始日-1的UC11累计收支]
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
      
      const initialBalance = new Decimal(account.initialBalance)
        .plus(beforeIncome)
        .minus(beforeExpense)
        .toNumber();
      
      // 本期收支
      const periodEntries = getJournalEntries(
        account.id,
        filters.dateFrom,
        filters.dateTo
      );
      
      const periodIncome = periodEntries.reduce((sum, e) => 
        new Decimal(sum).plus(e.income).toNumber(), 0
      );
      const periodExpense = periodEntries.reduce((sum, e) => 
        new Decimal(sum).plus(e.expense).toNumber(), 0
      );
      
      // QR2：期末余额 = 期初余额 + 本期收入 - 本期支出
      const endingBalance = new Decimal(initialBalance)
        .plus(periodIncome)
        .minus(periodExpense)
        .toNumber();
      
      return {
        accountId: account.id,
        accountName: account.accountName,
        accountType: account.accountType,
        initialBalance,
        periodIncome,
        periodExpense,
        endingBalance
      };
    });
    
    setAccountSummaries(accountData);
    
    // 表二：按收支类别汇总
    const allPeriodEntries = getJournalEntries(undefined, filters.dateFrom, filters.dateTo);
    
    // 按类别分组统计
    const categoryMap = new Map<string, CategorySummary>();
    
    // BR5：未分类流水统计
    let uncategorizedIncome = 0;
    let uncategorizedExpense = 0;
    let uncategorizedIncomeCount = 0;
    let uncategorizedExpenseCount = 0;
    
    allPeriodEntries.forEach(entry => {
      if (!entry.categoryId) {
        // 未分类
        if (entry.income > 0) {
          uncategorizedIncome = new Decimal(uncategorizedIncome).plus(entry.income).toNumber();
          uncategorizedIncomeCount++;
        } else if (entry.expense > 0) {
          uncategorizedExpense = new Decimal(uncategorizedExpense).plus(entry.expense).toNumber();
          uncategorizedExpenseCount++;
        }
      } else {
        // 已分类
        const key = entry.categoryId;
        const existing = categoryMap.get(key);
        
        if (existing) {
          if (entry.income > 0) {
            existing.incomeAmount = new Decimal(existing.incomeAmount).plus(entry.income).toNumber();
            existing.incomeCount++;
          } else if (entry.expense > 0) {
            existing.expenseAmount = new Decimal(existing.expenseAmount).plus(entry.expense).toNumber();
            existing.expenseCount++;
          }
        } else {
          const category = categories.find(c => c.id === entry.categoryId);
          categoryMap.set(key, {
            categoryId: entry.categoryId,
            categoryName: entry.categoryName || '未知类别',
            type: category?.type === 'income' ? 'income' : 'expense',
            incomeAmount: entry.income,
            expenseAmount: entry.expense,
            incomeCount: entry.income > 0 ? 1 : 0,
            expenseCount: entry.expense > 0 ? 1 : 0
          });
        }
      }
    });
    
    const categoryData = Array.from(categoryMap.values());
    
    // BR5：添加"未分类"行
    if (uncategorizedIncome > 0 || uncategorizedExpense > 0) {
      categoryData.push({
        categoryId: 'uncategorized',
        categoryName: '未分类',
        type: 'uncategorized',
        incomeAmount: uncategorizedIncome,
        expenseAmount: uncategorizedExpense,
        incomeCount: uncategorizedIncomeCount,
        expenseCount: uncategorizedExpenseCount
      });
    }
    
    setCategorySummaries(categoryData);
  };
  
  // 获取前一天的日期
  const getPreviousDay = (dateStr: string): string => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };
  
  // QR3：钻取到UC11明细
  const handleDrillDown = (params: {
    accountId?: string;
    categoryId?: string;
    type?: 'income' | 'expense';
  }) => {
    const { accountId, categoryId, type } = params;
    
    let message = `跳转到出纳日记账，筛选条件：\n`;
    message += `日期区间：${filters.dateFrom} 至 ${filters.dateTo}\n`;
    
    if (accountId) {
      const account = getFundAccounts().find(a => a.id === accountId);
      message += `账户：${account?.accountName}\n`;
    }
    
    if (categoryId) {
      if (categoryId === 'uncategorized') {
        message += `收支类别：未分类\n`;
      } else {
        const entries = getJournalEntries(undefined, filters.dateFrom, filters.dateTo);
        const entry = entries.find(e => e.categoryId === categoryId);
        message += `收支类别：${entry?.categoryName}\n`;
      }
    }
    
    if (type) {
      message += `类型：${type === 'income' ? '收入' : '支出'}`;
    }
    
    alert(message);
  };
  
  // 导出报表
  const handleExport = () => {
    if (accountSummaries.length === 0) {
      alert('请先查询数据');
      return;
    }
    
    // 按类型分组收支类别
    const incomeCategories = categorySummaries.filter(c => c.type === 'income');
    const expenseCategories = categorySummaries.filter(c => c.type === 'expense');
    const uncategorized = categorySummaries.filter(c => c.type === 'uncategorized');
    
    // 创建HTML表格
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:excel' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>资金汇总表</title>
          <style>
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid black; padding: 5px; }
            th { background-color: #E0E0E0; font-weight: bold; text-align: center; }
            .number { text-align: right; }
            .center { text-align: center; }
            .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px 0; }
            .sub-title { font-size: 14px; font-weight: bold; margin: 10px 0 5px 0; color: #333; }
          </style>
        </head>
        <body>
          <h2>资金汇总表</h2>
          <p>统计期间：${filters.dateFrom} 至 ${filters.dateTo}</p>
          
          <div class="section-title">一、按资金账户汇总</div>
          <table>
            <thead>
              <tr>
                <th>账户名称</th>
                <th>期初余额</th>
                <th>本期收入总额</th>
                <th>本期支出总额</th>
                <th>期末余额</th>
              </tr>
            </thead>
            <tbody>
              ${accountSummaries.map(acc => `
                <tr>
                  <td>${acc.accountName}</td>
                  <td class="number">${acc.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="number">${acc.periodIncome.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="number">${acc.periodExpense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="number">${acc.endingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                </tr>
              `).join('')}
              <tr style="font-weight: bold; background-color: #F0F0F0;">
                <td>合计</td>
                <td class="number">${accountSummaries.reduce((sum, acc) => sum + acc.initialBalance, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td class="number">${accountSummaries.reduce((sum, acc) => sum + acc.periodIncome, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td class="number">${accountSummaries.reduce((sum, acc) => sum + acc.periodExpense, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td class="number">${accountSummaries.reduce((sum, acc) => sum + acc.endingBalance, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="section-title">二、收支类别汇总</div>
          
          <div class="sub-title">收入类别</div>
          <table>
            <thead>
              <tr>
                <th>收支类别</th>
                <th>收入总额</th>
                <th>收入笔数</th>
              </tr>
            </thead>
            <tbody>
              ${incomeCategories.map(cat => `
                <tr>
                  <td>${cat.categoryName}</td>
                  <td class="number">${cat.incomeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${cat.incomeCount}</td>
                </tr>
              `).join('')}
              ${incomeCategories.length > 0 ? `
                <tr style="font-weight: bold; background-color: #F0F0F0;">
                  <td>收入小计</td>
                  <td class="number">${incomeCategories.reduce((sum, cat) => sum + cat.incomeAmount, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${incomeCategories.reduce((sum, cat) => sum + cat.incomeCount, 0)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
          
          <div class="sub-title">支出类别</div>
          <table>
            <thead>
              <tr>
                <th>收支类别</th>
                <th>支出总额</th>
                <th>支出笔数</th>
              </tr>
            </thead>
            <tbody>
              ${expenseCategories.map(cat => `
                <tr>
                  <td>${cat.categoryName}</td>
                  <td class="number">${cat.expenseAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${cat.expenseCount}</td>
                </tr>
              `).join('')}
              ${expenseCategories.length > 0 ? `
                <tr style="font-weight: bold; background-color: #F0F0F0;">
                  <td>支出小计</td>
                  <td class="number">${expenseCategories.reduce((sum, cat) => sum + cat.expenseAmount, 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td class="center">${expenseCategories.reduce((sum, cat) => sum + cat.expenseCount, 0)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>
          
          ${uncategorized.length > 0 ? `
            <div class="sub-title">未分类</div>
            <table>
              <thead>
                <tr>
                  <th>收支类别</th>
                  <th>收入总额</th>
                  <th>支出总额</th>
                  <th>收入笔数</th>
                  <th>支出笔数</th>
                </tr>
              </thead>
              <tbody>
                ${uncategorized.map(cat => `
                  <tr style="background-color: #FFF9E6;">
                    <td>${cat.categoryName}</td>
                    <td class="number">${cat.incomeAmount > 0 ? cat.incomeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td class="number">${cat.expenseAmount > 0 ? cat.expenseAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}</td>
                    <td class="center">${cat.incomeCount || '-'}</td>
                    <td class="center">${cat.expenseCount || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/vnd.ms-excel'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `资金汇总表_${filters.dateFrom}_${filters.dateTo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  // 按类型分组收支类别
  const incomeCategories = categorySummaries.filter(c => c.type === 'income');
  const expenseCategories = categorySummaries.filter(c => c.type === 'expense');
  const uncategorized = categorySummaries.filter(c => c.type === 'uncategorized');
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">资金汇总表</h1>
        <p className="text-gray-600">
          实时统计资金状况，数据来源于出纳日记账，与会计凭证无关
        </p>
      </div>
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>开始日期 <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>结束日期 <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="col-span-8 space-y-2">
            <Label className="invisible">操作</Label>
            <div className="flex items-center gap-2">
              <Button onClick={handleQuery}>
                <Search className="w-4 h-4 mr-2" />
                查询
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                导出报表
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab切换 */}
      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'account' | 'category')}>
        <TabsList className="mb-4">
          <TabsTrigger value="account">按账户汇总</TabsTrigger>
          <TabsTrigger value="category">收支类别</TabsTrigger>
        </TabsList>
        
        {/* Tab内容：按资金账户汇总 */}
        <TabsContent value="account">
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="text-gray-900">按资金账户汇总</h3>
              <p className="text-sm text-gray-600">回答"我每个账户里还有多少钱？"</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>账户名称</TableHead>
                    <TableHead className="text-right">期初余额</TableHead>
                    <TableHead className="text-right">本期收入总额</TableHead>
                    <TableHead className="text-right">本期支出总额</TableHead>
                    <TableHead className="text-right">期末余额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        请点击"查询"按钮加载数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {accountSummaries.map(acc => (
                        <TableRow key={acc.accountId}>
                          <TableCell>
                            {acc.accountName}
                            <span className="ml-2 text-xs text-gray-500">
                              ({acc.accountType})
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href="#"
                              className="text-blue-600 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDrillDown({ accountId: acc.accountId });
                              }}
                            >
                              ¥ {acc.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </a>
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href="#"
                              className="text-green-600 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDrillDown({ accountId: acc.accountId, type: 'income' });
                              }}
                            >
                              ¥ {acc.periodIncome.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </a>
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href="#"
                              className="text-red-600 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDrillDown({ accountId: acc.accountId, type: 'expense' });
                              }}
                            >
                              ¥ {acc.periodExpense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </a>
                          </TableCell>
                          <TableCell className="text-right">
                            <a
                              href="#"
                              className="text-blue-600 hover:underline"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDrillDown({ accountId: acc.accountId });
                              }}
                            >
                              ¥ {acc.endingBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-gray-50">
                        <TableCell className="text-gray-900">合计</TableCell>
                        <TableCell className="text-right text-gray-900">
                          ¥ {accountSummaries.reduce((sum, acc) => 
                            new Decimal(sum).plus(acc.initialBalance).toNumber(), 0
                          ).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          ¥ {accountSummaries.reduce((sum, acc) => 
                            new Decimal(sum).plus(acc.periodIncome).toNumber(), 0
                          ).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          ¥ {accountSummaries.reduce((sum, acc) => 
                            new Decimal(sum).plus(acc.periodExpense).toNumber(), 0
                          ).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-gray-900">
                          ¥ {accountSummaries.reduce((sum, acc) => 
                            new Decimal(sum).plus(acc.endingBalance).toNumber(), 0
                          ).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
        
        {/* Tab内容：收支类别汇总 */}
        <TabsContent value="category">
          <div className="space-y-4">
            {/* 收入类别 */}
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b bg-green-50">
                <h3 className="text-gray-900">收入类别</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>收支类别</TableHead>
                      <TableHead className="text-right">收入总额</TableHead>
                      <TableHead className="text-center">收入笔数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                          暂无收入类别数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {incomeCategories.map(cat => (
                          <TableRow key={cat.categoryId}>
                            <TableCell>{cat.categoryName}</TableCell>
                            <TableCell className="text-right">
                              <a
                                href="#"
                                className="text-green-600 hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDrillDown({ categoryId: cat.categoryId, type: 'income' });
                                }}
                              >
                                ¥ {cat.incomeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                              </a>
                            </TableCell>
                            <TableCell className="text-center text-gray-600">
                              {cat.incomeCount}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-green-50">
                          <TableCell className="text-gray-900">收入小计</TableCell>
                          <TableCell className="text-right text-green-600">
                            ¥ {incomeCategories.reduce((sum, cat) => 
                              new Decimal(sum).plus(cat.incomeAmount).toNumber(), 0
                            ).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center text-gray-900">
                            {incomeCategories.reduce((sum, cat) => sum + cat.incomeCount, 0)}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* 支出类别 */}
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b bg-red-50">
                <h3 className="text-gray-900">支出类别</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>收支类别</TableHead>
                      <TableHead className="text-right">支出总额</TableHead>
                      <TableHead className="text-center">支出笔数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenseCategories.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                          暂无支出类别数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {expenseCategories.map(cat => (
                          <TableRow key={cat.categoryId}>
                            <TableCell>{cat.categoryName}</TableCell>
                            <TableCell className="text-right">
                              <a
                                href="#"
                                className="text-red-600 hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDrillDown({ categoryId: cat.categoryId, type: 'expense' });
                                }}
                              >
                                ¥ {cat.expenseAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                              </a>
                            </TableCell>
                            <TableCell className="text-center text-gray-600">
                              {cat.expenseCount}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-red-50">
                          <TableCell className="text-gray-900">支出小计</TableCell>
                          <TableCell className="text-right text-red-600">
                            ¥ {expenseCategories.reduce((sum, cat) => 
                              new Decimal(sum).plus(cat.expenseAmount).toNumber(), 0
                            ).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-center text-gray-900">
                            {expenseCategories.reduce((sum, cat) => sum + cat.expenseCount, 0)}
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            
            {/* 未分类 */}
            {uncategorized.length > 0 && (
              <div className="bg-white rounded-lg border">
                <div className="px-4 py-3 border-b bg-yellow-50">
                  <h3 className="text-gray-900">未分类</h3>
                  <p className="text-sm text-yellow-700">需要在出纳日记账中完成分类</p>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>收支类别</TableHead>
                        <TableHead className="text-right">收入总额</TableHead>
                        <TableHead className="text-right">支出总额</TableHead>
                        <TableHead className="text-center">收入笔数</TableHead>
                        <TableHead className="text-center">支出笔数</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uncategorized.map(cat => (
                        <TableRow key={cat.categoryId} className="bg-yellow-50">
                          <TableCell>{cat.categoryName}</TableCell>
                          <TableCell className="text-right">
                            {cat.incomeAmount > 0 ? (
                              <a
                                href="#"
                                className="text-green-600 hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDrillDown({ categoryId: cat.categoryId, type: 'income' });
                                }}
                              >
                                ¥ {cat.incomeAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {cat.expenseAmount > 0 ? (
                              <a
                                href="#"
                                className="text-red-600 hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDrillDown({ categoryId: cat.categoryId, type: 'expense' });
                                }}
                              >
                                ¥ {cat.expenseAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-gray-600">
                            {cat.incomeCount || '-'}
                          </TableCell>
                          <TableCell className="text-center text-gray-600">
                            {cat.expenseCount || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* 说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 核心逻辑说明</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">实时数据源</span>：唯一数据源是出纳日记账(UC11)，与凭证审核状态无关</li>
            <li><span className="font-medium">期初余额</span>：从账户启用日到查询开始日前一天的累计收支 + 账户初始余额</li>
            <li><span className="font-medium">期末余额</span>：期初余额 + 本期收入 - 本期支出（使用高精度计算）</li>
            <li><span className="font-medium">分组显示</span>：收入类别和支出类别分别显示，便于查看</li>
            <li><span className="font-medium">未分类处理</span>：所有未分类流水单独汇总，提醒会计完成分类</li>
            <li><span className="font-medium">钻取查询</span>：点击金额数字可跳转到出纳日记账查看明细</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
