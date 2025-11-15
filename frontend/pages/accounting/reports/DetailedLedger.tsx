import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';   
import Decimal from 'decimal.js';
import { getAllVouchers, getSubjectInitialBalance, getAllSubjects } from '@/lib/mockData';

// 明细账数据行
interface DetailedLedgerRow {
  date: string;
  voucherCode: string;
  voucherId: string;
  summary: string;
  debit: number;
  credit: number;
  direction: '借' | '贷';
  balance: number;
}

export default function DetailedLedger() {
  // 当前选择（初级筛选）
  const [currentPeriod, setCurrentPeriod] = useState('2025-04');
  const [currentSubject, setCurrentSubject] = useState('1001');
  
  // 高级筛选对话框
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [useAdvancedFilter, setUseAdvancedFilter] = useState(false);
  
  // 高级查询条件
  const [queryConditions, setQueryConditions] = useState({
    periodFrom: '2025-01',
    periodTo: '2025-12',
    subjectFrom: '',
    subjectTo: '',
    levelFrom: 1,
    levelTo: 4,
    sortBy: 'voucherDate' as 'voucherCode' | 'voucherDate',
    showAuxiliary: false,
    onlyLeaf: false
  });
  
  // 明细数据
  const [ledgerData, setLedgerData] = useState<DetailedLedgerRow[]>([]);
  const [periodInitialBalance, setPeriodInitialBalance] = useState(0);
  const [periodTotalDebit, setPeriodTotalDebit] = useState(0);
  const [periodTotalCredit, setPeriodTotalCredit] = useState(0);
  const [yearTotalDebit, setYearTotalDebit] = useState(0);
  const [yearTotalCredit, setYearTotalCredit] = useState(0);
  
  // 从SubjectManagement读取真实科目数据，并按科目编码排序
  const subjects = getAllSubjects()
    .filter(s => s.isActive) // 只显示启用的科目
    .map(s => ({
      code: s.code,
      name: s.name,
      level: s.level,
      direction: s.direction
    }))
    .sort((a, b) => a.code.localeCompare(b.code)); // 按科目编码排序
  
  // 打开高级筛选对话框
  const handleOpenFilter = () => {
    // 初始化高级筛选条件为当前的初级筛选值
    setQueryConditions({
      ...queryConditions,
      periodFrom: currentPeriod,
      periodTo: currentPeriod,
      subjectFrom: currentSubject,
      subjectTo: currentSubject
    });
    setShowFilterDialog(true);
  };
  
  // 确认高级筛选并查询
  const handleConfirmFilter = () => {
    setUseAdvancedFilter(true);
    setShowFilterDialog(false);
    executeQuery(true);
  };
  
  // 重置筛选条件
  const handleResetFilter = () => {
    setQueryConditions({
      periodFrom: '2025-01',
      periodTo: '2025-12',
      subjectFrom: '',
      subjectTo: '',
      levelFrom: 1,
      levelTo: 4,
      sortBy: 'voucherDate',
      showAuxiliary: false,
      onlyLeaf: false
    });
  };
  
  // 普通查询（使用顶部筛选栏的会计期间和科目）
  const handleQuery = () => {
    setUseAdvancedFilter(false);
    executeQuery(false);
  };
  
  // 统一的查询执行函数
  const executeQuery = (isAdvanced: boolean) => {
    // 确定查询参数
    let periodFrom: string;
    let periodTo: string;
    let targetSubjectCode: string;
    let sortBy: 'voucherCode' | 'voucherDate';
    
    if (isAdvanced) {
      periodFrom = queryConditions.periodFrom;
      periodTo = queryConditions.periodTo;
      // 高级筛选：如果设置了科目范围，使用范围的起始科目；否则使用当前科目
      if (queryConditions.subjectFrom && queryConditions.subjectTo) {
        // 找到范围内的第一个符合条件的科目
        const matchedSubjects = subjects.filter(s => {
          const inRange = s.code >= queryConditions.subjectFrom && s.code <= queryConditions.subjectTo;
          const inLevel = s.level >= queryConditions.levelFrom && s.level <= queryConditions.levelTo;
          return inRange && inLevel;
        });
        
        if (matchedSubjects.length === 0) {
          alert('没有符合筛选条件的科目');
          return;
        }
        
        // 明细账一次只能查一个科目，取第一个
        targetSubjectCode = matchedSubjects[0].code;
      } else {
        targetSubjectCode = currentSubject;
      }
      sortBy = queryConditions.sortBy;
    } else {
      periodFrom = currentPeriod;
      periodTo = currentPeriod;
      targetSubjectCode = currentSubject;
      sortBy = 'voucherDate';
    }
    
    // 获取目标科目
    const subject = subjects.find(s => s.code === targetSubjectCode);
    if (!subject) {
      alert('科目不存在');
      return;
    }
    
    // 获取所有已审核凭证 (BR1: 状态必须是"已审核")
    const allVouchers = getAllVouchers().filter(v => v.status === 'approved');
    
    // 转换期间为日期范围 (BR1: 日期必须在用户选择的会计期间范围内)
    const dateFrom = `${periodFrom}-01`;
    const dateTo = `${periodTo}-31`;
    
    // 年初日期（用于计算期初余额和本年累计）
    const yearStart = `${periodFrom.split('-')[0]}-01-01`;
    
    // 筛选期间内的凭证
    const periodVouchers = allVouchers.filter(v => 
      v.voucherDate >= dateFrom && v.voucherDate <= dateTo
    );
    
    // 筛选年初到查询期间结束的所有凭证（用于计算本年累计）
    const yearVouchers = allVouchers.filter(v =>
      v.voucherDate >= yearStart && v.voucherDate <= dateTo
    );
    
    // 筛选年初到查询期间开始之前的凭证（用于计算期初余额）
    const beforePeriodVouchers = allVouchers.filter(v =>
      v.voucherDate >= yearStart && v.voucherDate < dateFrom
    );
    
    // A-1: 获取期初余额 (BR2: 来自UC16总分类账的上期期末余额，源头来自UC04期初数据录入)
    const initialBalanceData = getSubjectInitialBalance(targetSubjectCode);
    let periodInitBalance = subject.direction === '借'
      ? initialBalanceData.debitBalance - initialBalanceData.creditBalance
      : initialBalanceData.creditBalance - initialBalanceData.debitBalance;
    
    // 累加年初到查询期间开始前的发生额
    beforePeriodVouchers.forEach(voucher => {
      voucher.lines.forEach((line: any) => {
        if (line.subjectCode === targetSubjectCode) {
          const debit = parseFloat(line.debitAmount) || 0;
          const credit = parseFloat(line.creditAmount) || 0;
          
          if (subject.direction === '借') {
            periodInitBalance = new Decimal(periodInitBalance).plus(debit).minus(credit).toNumber();
          } else {
            periodInitBalance = new Decimal(periodInitBalance).plus(credit).minus(debit).toNumber();
          }
        }
      });
    });
    
    // A-2: 获取凭证分录 (BR1: 已审核 + 期间内 + 科目匹配)
    const rows: DetailedLedgerRow[] = [];
    let runningBalance = periodInitBalance;
    
    // BR4: 排序（按日期或凭证字号）
    const sortedVouchers = [...periodVouchers].sort((a, b) => {
      if (sortBy === 'voucherDate') {
        return a.voucherDate.localeCompare(b.voucherDate) || a.voucherCode.localeCompare(b.voucherCode);
      } else {
        return a.voucherCode.localeCompare(b.voucherCode);
      }
    });
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    // 提取分录并计算余额
    sortedVouchers.forEach(voucher => {
      voucher.lines.forEach((line: any) => {
        if (line.subjectCode === targetSubjectCode) {
          const debit = parseFloat(line.debitAmount) || 0;
          const credit = parseFloat(line.creditAmount) || 0;
          
          totalDebit += debit;
          totalCredit += credit;
          
          // BR3: 计算余额（借方科目：借增贷减，贷方科目：贷增借减）
          if (subject.direction === '借') {
            runningBalance = new Decimal(runningBalance).plus(debit).minus(credit).toNumber();
          } else {
            runningBalance = new Decimal(runningBalance).plus(credit).minus(debit).toNumber();
          }
          
          rows.push({
            date: voucher.voucherDate,
            voucherCode: voucher.voucherCode,
            voucherId: voucher.id,
            summary: line.summary || '',
            debit,
            credit,
            direction: subject.direction,
            balance: runningBalance
          });
        }
      });
    });
    
    // A-3: 获取本年累计（年初到查询期间结束）
    let yearDebit = 0;
    let yearCredit = 0;
    
    yearVouchers.forEach(voucher => {
      voucher.lines.forEach((line: any) => {
        if (line.subjectCode === targetSubjectCode) {
          yearDebit += parseFloat(line.debitAmount) || 0;
          yearCredit += parseFloat(line.creditAmount) || 0;
        }
      });
    });
    
    // 更新状态
    setLedgerData(rows);
    setPeriodInitialBalance(periodInitBalance);
    setPeriodTotalDebit(totalDebit);
    setPeriodTotalCredit(totalCredit);
    setYearTotalDebit(yearDebit);
    setYearTotalCredit(yearCredit);
  };
  
  // 钻取到凭证详情（数据流出到UC06）
  const handleDrillToVoucher = (voucherId: string, voucherCode: string) => {
    alert(`跳转到凭证管理（UC06）\n\n凭证字号：${voucherCode}\n凭证ID：${voucherId}\n\n（实际应用中会弹出凭证详情的只读窗口）`);
  };
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">明细分类账</h1>
        <p className="text-gray-600">
          按科目显示所有凭证分录的明细流水和逐笔余额
        </p>
      </div>
      
      {/* 查询条件栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label>会计期间 <span className="text-red-500">*</span></Label>
            <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 12}, (_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return (
                    <SelectItem key={month} value={`2025-${month}`}>
                      2025年{i + 1}月
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 space-y-2">
            <Label>科目 <span className="text-red-500">*</span></Label>
            <Select value={currentSubject} onValueChange={setCurrentSubject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={handleQuery}>查询</Button>
          <Button variant="outline" onClick={handleOpenFilter}>
            <Filter className="w-4 h-4 mr-2" />
            高级筛选
          </Button>
        </div>
        
        {useAdvancedFilter && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-sm text-blue-600">
              当前使用高级筛选：
              期间 {queryConditions.periodFrom} 至 {queryConditions.periodTo}
              {queryConditions.subjectFrom && queryConditions.subjectTo && (
                <>, 科目 {queryConditions.subjectFrom} 至 {queryConditions.subjectTo}</>
              )}
              , 排序方式：{queryConditions.sortBy === 'voucherDate' ? '按日期' : '按凭证字号'}
            </div>
          </div>
        )}
      </div>
      
      {/* 数据列表 */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">日期</TableHead>
                <TableHead className="w-[120px]">凭证字号</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead className="text-right w-[140px]">借方金额</TableHead>
                <TableHead className="text-right w-[140px]">贷方金额</TableHead>
                <TableHead className="text-center w-[80px]">方向</TableHead>
                <TableHead className="text-right w-[140px]">余额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                    请选择会计期间和科目后点击"查询"
                  </TableCell>
                </TableRow>
              )}
              
              {ledgerData.length > 0 && (
                <>
                  {/* 期初余额行 */}
                  <TableRow className="bg-blue-50">
                    <TableCell colSpan={3} className="text-gray-900">
                      期初余额
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        ledgerData[0]?.direction === '借' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {ledgerData[0]?.direction || '借'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ¥ {periodInitialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                  
                  {/* 明细流水行 */}
                  {ledgerData.map((row, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      <TableCell className="text-gray-600">{row.date}</TableCell>
                      <TableCell>
                        <a
                          href="#"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDrillToVoucher(row.voucherId, row.voucherCode);
                          }}
                        >
                          {row.voucherCode}
                        </a>
                      </TableCell>
                      <TableCell className="text-gray-700">{row.summary}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {row.debit > 0 ? `¥ ${row.debit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {row.credit > 0 ? `¥ ${row.credit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.direction === '借' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {row.direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-blue-600">
                        ¥ {row.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* 本期合计行 */}
                  <TableRow className="bg-yellow-50">
                    <TableCell colSpan={3} className="text-gray-900">
                      本期合计
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ¥ {periodTotalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ¥ {periodTotalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                  
                  {/* 本年累计行 */}
                  <TableRow className="bg-green-50">
                    <TableCell colSpan={3} className="text-gray-900">
                      本年累计
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ¥ {yearTotalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ¥ {yearTotalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">-</TableCell>
                    <TableCell className="text-right">-</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* 高级筛选对话框 */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>高级筛选</DialogTitle>
            <DialogDescription>
              设置更精细的查询条件
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* 期间范围 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>会计期间（起）</Label>
                <Select 
                  value={queryConditions.periodFrom} 
                  onValueChange={(v) => setQueryConditions({...queryConditions, periodFrom: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}, (_, i) => {
                      const month = String(i + 1).padStart(2, '0');
                      return (
                        <SelectItem key={month} value={`2025-${month}`}>
                          2025年{i + 1}月
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>会计期间（止）</Label>
                <Select 
                  value={queryConditions.periodTo} 
                  onValueChange={(v) => setQueryConditions({...queryConditions, periodTo: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({length: 12}, (_, i) => {
                      const month = String(i + 1).padStart(2, '0');
                      return (
                        <SelectItem key={month} value={`2025-${month}`}>
                          2025年{i + 1}月
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* 科目范围 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>起始科目</Label>
                <Select 
                  value={queryConditions.subjectFrom} 
                  onValueChange={(v) => setQueryConditions({...queryConditions, subjectFrom: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择起始科目" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>结束科目</Label>
                <Select 
                  value={queryConditions.subjectTo} 
                  onValueChange={(v) => setQueryConditions({...queryConditions, subjectTo: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择结束科目" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map(s => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.code} {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* 科目级别 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>科目级别（从）</Label>
                <Select 
                  value={String(queryConditions.levelFrom)} 
                  onValueChange={(v) => setQueryConditions({...queryConditions, levelFrom: parseInt(v)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1级</SelectItem>
                    <SelectItem value="2">2级</SelectItem>
                    <SelectItem value="3">3级</SelectItem>
                    <SelectItem value="4">4级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>科目级别（至）</Label>
                <Select 
                  value={String(queryConditions.levelTo)} 
                  onValueChange={(v) => setQueryConditions({...queryConditions, levelTo: parseInt(v)})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1级</SelectItem>
                    <SelectItem value="2">2级</SelectItem>
                    <SelectItem value="3">3级</SelectItem>
                    <SelectItem value="4">4级</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* 排序方式 */}
            <div className="space-y-2">
              <Label>排序方式</Label>
              <RadioGroup 
                value={queryConditions.sortBy} 
                onValueChange={(v) => setQueryConditions({...queryConditions, sortBy: v as 'voucherCode' | 'voucherDate'})}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="voucherDate" id="date" />
                  <Label htmlFor="date" className="cursor-pointer">按日期排序</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="voucherCode" id="code" />
                  <Label htmlFor="code" className="cursor-pointer">按凭证字号排序</Label>
                </div>
              </RadioGroup>
            </div>
            
            {/* 其他选项 */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="onlyLeaf" 
                  checked={queryConditions.onlyLeaf}
                  onCheckedChange={(checked) => setQueryConditions({...queryConditions, onlyLeaf: checked as boolean})}
                />
                <Label htmlFor="onlyLeaf" className="cursor-pointer">只显示末级科目</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="showAuxiliary" 
                  checked={queryConditions.showAuxiliary}
                  onCheckedChange={(checked) => setQueryConditions({...queryConditions, showAuxiliary: checked as boolean})}
                />
                <Label htmlFor="showAuxiliary" className="cursor-pointer">显示辅助核算</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleResetFilter}>重置</Button>
            <Button variant="outline" onClick={() => setShowFilterDialog(false)}>取消</Button>
            <Button onClick={handleConfirmFilter}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 核心逻辑说明</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">数据来源</span>：所有流水数据来源于UC06/UC07（已审核的记账凭证）</li>
            <li><span className="font-medium">期初余额</span>：来自UC16（总分类账）的上期期末余额，源头是UC04（期初数据录入）</li>
            <li><span className="font-medium">余额计算</span>：从期初余额开始逐笔累加，借方科目=期初+借-贷，贷方科目=期初+贷-借</li>
            <li><span className="font-medium">钻取功能</span>：点击凭证字号可跳转到UC06查看完整凭证详情</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
