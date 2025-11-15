import { useState, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'; 
import Decimal from 'decimal.js';
import { getAllVouchers, getSubjectInitialBalance, getAllSubjects } from '@/lib/mockData';  

// 科目汇总数据
interface SubjectSummary {
  code: string;
  name: string;
  level: number;
  direction: '借' | '贷';
  initialBalance: number;
  periodDebit: number;
  periodCredit: number;
  periodBalance: number;
  yearDebit: number;
  yearCredit: number;
  yearBalance: number;
  isExpanded: boolean;
  children?: SubjectSummary[];
}

export default function GeneralLedger() {
  // 查询条件
  const [queryConditions, setQueryConditions] = useState({
    periodFrom: '2025-01',
    periodTo: '2025-04',
    subjectFrom: '1001',
    subjectTo: '6999',
    levelFrom: 1,
    levelTo: 3
  });
  
  // 科目汇总数据
  const [ledgerData, setLedgerData] = useState<SubjectSummary[]>([]);
  
  // 从SubjectManagement读取真实科目数据，并按科目编码排序
  const allSubjects = getAllSubjects()
    .filter(s => s.isActive) // 只显示启用的科目
    .map(s => ({
      code: s.code,
      name: s.name,
      level: s.level,
      direction: s.direction,
      parent: s.parentId ? getAllSubjects().find(p => p.id === s.parentId)?.code || null : null
    }))
    .sort((a, b) => a.code.localeCompare(b.code)); // 按科目编码排序
  
  // 查询总账数据
  const handleQuery = () => {
    // 获取所有已审核凭证
    const allVouchers = getAllVouchers().filter(v => v.status === 'approved');
    
    // 转换期间为日期范围
    const dateFrom = `${queryConditions.periodFrom}-01`;
    const dateTo = `${queryConditions.periodTo}-31`;
    const yearStart = `${queryConditions.periodFrom.split('-')[0]}-01-01`;
    
    // 筛选期间内的凭证
    const periodVouchers = allVouchers.filter(v => 
      v.voucherDate >= dateFrom && v.voucherDate <= dateTo
    );
    
    // 筛选本年累计的凭证
    const yearVouchers = allVouchers.filter(v => 
      v.voucherDate >= yearStart && v.voucherDate <= dateTo
    );
    
    // 计算每个科目的汇总数据
    const summaries: SubjectSummary[] = [];
    const summaryMap = new Map<string, SubjectSummary>();
    
    allSubjects.forEach(subject => {
      // 只处理符合科目范围的科目
      if (subject.code < queryConditions.subjectFrom || subject.code > queryConditions.subjectTo) {
        return;
      }
      
      // 只处理符合级别范围的科目
      if (subject.level < queryConditions.levelFrom || subject.level > queryConditions.levelTo) {
        return;
      }
      
      // 从期初余额数据中获取
      const initialBalanceData = getSubjectInitialBalance(subject.code);
      const initialBalance = subject.direction === '借' 
        ? initialBalanceData.debitBalance - initialBalanceData.creditBalance
        : initialBalanceData.creditBalance - initialBalanceData.debitBalance;
      
      // BR1：数据来源于UC08（记账凭证汇总）
      let periodDebit = 0;
      let periodCredit = 0;
      let yearDebit = 0;
      let yearCredit = 0;
      
      periodVouchers.forEach(voucher => {
        voucher.lines.forEach((line: any) => {
          if (line.subjectCode === subject.code) {
            if (line.debitAmount) {
              periodDebit = new Decimal(periodDebit)
                .plus(parseFloat(line.debitAmount) || 0)
                .toNumber();
            }
            if (line.creditAmount) {
              periodCredit = new Decimal(periodCredit)
                .plus(parseFloat(line.creditAmount) || 0)
                .toNumber();
            }
          }
        });
      });
      
      yearVouchers.forEach(voucher => {
        voucher.lines.forEach((line: any) => {
          if (line.subjectCode === subject.code) {
            if (line.debitAmount) {
              yearDebit = new Decimal(yearDebit)
                .plus(parseFloat(line.debitAmount) || 0)
                .toNumber();
            }
            if (line.creditAmount) {
              yearCredit = new Decimal(yearCredit)
                .plus(parseFloat(line.creditAmount) || 0)
                .toNumber();
            }
          }
        });
      });
      
      // BR2, BR3, BR4：计算余额
      const periodBalance = subject.direction === '借'
        ? new Decimal(initialBalance).plus(periodDebit).minus(periodCredit).toNumber()
        : new Decimal(initialBalance).plus(periodCredit).minus(periodDebit).toNumber();
      
      const yearBalance = subject.direction === '借'
        ? new Decimal(initialBalance).plus(yearDebit).minus(yearCredit).toNumber()
        : new Decimal(initialBalance).plus(yearCredit).minus(yearDebit).toNumber();
      
      const summary = {
        code: subject.code,
        name: subject.name,
        level: subject.level,
        direction: subject.direction,
        initialBalance,
        periodDebit,
        periodCredit,
        periodBalance,
        yearDebit,
        yearCredit,
        yearBalance,
        isExpanded: true,
        children: [] as SubjectSummary[]
      };
      
      summaryMap.set(subject.code, summary);
      summaries.push(summary);
    });
    
    // 构建树形结构
    const rootSummaries: SubjectSummary[] = [];
    
    summaries.forEach(summary => {
      const subject = allSubjects.find(s => s.code === summary.code);
      if (subject && subject.parent) {
        // 找到父科目
        const parentSummary = summaryMap.get(subject.parent);
        if (parentSummary) {
          if (!parentSummary.children) {
            parentSummary.children = [];
          }
          parentSummary.children.push(summary);
        } else {
          // 父科目不在查询范围内，当作根节点
          rootSummaries.push(summary);
        }
      } else {
        // 一级科目或没有父科目
        rootSummaries.push(summary);
      }
    });
    
    setLedgerData(rootSummaries);
  };
  
  // 重置查询条件
  const handleReset = () => {
    setQueryConditions({
      periodFrom: '2025-01',
      periodTo: '2025-04',
      subjectFrom: '1001',
      subjectTo: '6999',
      levelFrom: 1,
      levelTo: 3
    });
  };
  
  // 切换展开/折叠（递归处理）
  const toggleExpand = (code: string) => {
    const toggleInTree = (items: SubjectSummary[]): SubjectSummary[] => {
      return items.map(item => {
        if (item.code === code) {
          return { ...item, isExpanded: !item.isExpanded };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: toggleInTree(item.children) };
        }
        return item;
      });
    };
    
    setLedgerData(toggleInTree(ledgerData));
  };
  
  // QR2：钻取到明细账
  const handleDrillToDetail = (subjectCode: string, type: 'period' | 'year') => {
    alert(`跳转到明细分类账（UC15）\n\n科目：${subjectCode}\n期间：${type === 'period' ? queryConditions.periodFrom + '至' + queryConditions.periodTo : '本年累计'}`);
  };
  
  // 递归渲染科目树
  const renderSubjectTree = (subject: SubjectSummary, level: number = 0): React.ReactNode => {
    const indent = level * 24; // 每层缩进24px
    
    return (
      <Fragment key={subject.code}>
        {/* 科目标题行 */}
        <TableRow className={level === 0 ? "bg-gray-100 hover:bg-gray-200" : "hover:bg-gray-50"}>
          <TableCell>
            <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
              {subject.children && subject.children.length > 0 ? (
                <button
                  className="p-1 hover:bg-gray-300 rounded"
                  onClick={() => toggleExpand(subject.code)}
                >
                  {subject.isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <div className="w-6" /> // 占位，保持对齐
              )}
              <span className={`ml-2 ${level === 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                {subject.code} {subject.name}
              </span>
            </div>
          </TableCell>
          <TableCell colSpan={5}></TableCell>
        </TableRow>
        
        {/* 展开后的汇总行 */}
        {subject.isExpanded && (
          <>
            {/* 期初余额 */}
            <TableRow>
              <TableCell style={{ paddingLeft: `${indent + 48}px` }}></TableCell>
              <TableCell className="text-gray-600">期初余额</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-right">-</TableCell>
              <TableCell className="text-center">
                <span className={`px-2 py-1 rounded text-xs ${
                  subject.direction === '借' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {subject.direction}
                </span>
              </TableCell>
              <TableCell className="text-right text-blue-600">
                ¥ {subject.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
            
            {/* 本期合计 */}
            <TableRow className="hover:bg-gray-50">
              <TableCell style={{ paddingLeft: `${indent + 48}px` }}></TableCell>
              <TableCell className="text-gray-600">本期合计</TableCell>
              <TableCell className="text-right">
                {subject.periodDebit > 0 ? (
                  <a
                    href="#"
                    className="text-green-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDrillToDetail(subject.code, 'period');
                    }}
                  >
                    ¥ {subject.periodDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {subject.periodCredit > 0 ? (
                  <a
                    href="#"
                    className="text-red-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDrillToDetail(subject.code, 'period');
                    }}
                  >
                    ¥ {subject.periodCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span className={`px-2 py-1 rounded text-xs ${
                  subject.direction === '借' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {subject.direction}
                </span>
              </TableCell>
              <TableCell className="text-right text-blue-600">
                ¥ {subject.periodBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
            
            {/* 本年累计 */}
            <TableRow className="hover:bg-gray-50">
              <TableCell style={{ paddingLeft: `${indent + 48}px` }}></TableCell>
              <TableCell className="text-gray-600">本年累计</TableCell>
              <TableCell className="text-right">
                {subject.yearDebit > 0 ? (
                  <a
                    href="#"
                    className="text-green-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDrillToDetail(subject.code, 'year');
                    }}
                  >
                    ¥ {subject.yearDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {subject.yearCredit > 0 ? (
                  <a
                    href="#"
                    className="text-red-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDrillToDetail(subject.code, 'year');
                    }}
                  >
                    ¥ {subject.yearCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                <span className={`px-2 py-1 rounded text-xs ${
                  subject.direction === '借' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {subject.direction}
                </span>
              </TableCell>
              <TableCell className="text-right text-blue-600">
                ¥ {subject.yearBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </>
        )}
        
        {/* 递归渲染子科目 */}
        {subject.isExpanded && subject.children && subject.children.map(child => 
          renderSubjectTree(child, level + 1)
        )}
      </Fragment>
    );
  };
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">总分类账</h1>
        <p className="text-gray-600">
          按科目汇总显示期初、本期发生、本年累计和期末余额
        </p>
      </div>
      
      {/* 查询条件栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 space-y-2">
              <Label>会计期间（起） <span className="text-red-500">*</span></Label>
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
            <div className="col-span-3 space-y-2">
              <Label>会计期间（止） <span className="text-red-500">*</span></Label>
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
            <div className="col-span-3 space-y-2">
              <Label>起始科目</Label>
              <Select 
                value={queryConditions.subjectFrom} 
                onValueChange={(v) => setQueryConditions({...queryConditions, subjectFrom: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allSubjects.map(s => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-2">
              <Label>结束科目</Label>
              <Select 
                value={queryConditions.subjectTo} 
                onValueChange={(v) => setQueryConditions({...queryConditions, subjectTo: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allSubjects.map(s => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3 space-y-2">
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
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-2">
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
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6 space-y-2">
              <Label className="invisible">操作</Label>
              <div className="flex items-center gap-2">
                <Button onClick={handleQuery}>查询</Button>
                <Button variant="outline" onClick={handleReset}>重置</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 数据列表 */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">科目</TableHead>
                <TableHead className="w-[150px]">摘要</TableHead>
                <TableHead className="text-right w-[140px]">借方金额</TableHead>
                <TableHead className="text-right w-[140px]">贷方金额</TableHead>
                <TableHead className="text-center w-[80px]">方向</TableHead>
                <TableHead className="text-right w-[140px]">余额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledgerData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    请设置查询条件后点击"查询"
                  </TableCell>
                </TableRow>
              ) : (
                ledgerData.map(subject => renderSubjectTree(subject))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      
      {/* 说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 核心逻辑说明</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">数据来源</span>：所有合计数据来源于UC08记账凭证汇总</li>
            <li><span className="font-medium">树状结构</span>：可折叠展示各科目，二级科目显示在母科目下方</li>
            <li><span className="font-medium">期末余额计算</span>：借方科目=期初+借方-贷方；贷方科目=期初+贷方-借方</li>
            <li><span className="font-medium">钻取功能</span>：点击金额可跳转到明细分类账查看详细分录</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
