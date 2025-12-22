import { useState, useEffect } from 'react';
// 【修复1】移除 react-router-dom，改用 next/router
import { useRouter } from 'next/router';

import { Search, Download, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
// 【修复2】引入统一的 mockData API，确保数据和凭证管理页一致
import { getAllVouchers, getAccountBooks } from '@/lib/mockData';

// 科目汇总数据接口
interface SubjectSummary {
  subjectCode: string;
  subjectName: string;
  debitAmount: number;
  creditAmount: number;
}

// 原始分录明细接口
interface VoucherLine {
  subjectCode: string;
  subjectName: string;
  debitAmount: number;
  creditAmount: number;
  voucherDate: string;
  voucherNumber: string;
}

export default function VoucherSummary() {
  // 【修复3】使用 useRouter 获取 bookId
  const router = useRouter();
  const { bookId } = router.query;

  // allData 存储所有从 API 获取的原始分录明细
  const [allLines, setAllLines] = useState<VoucherLine[]>([]); 
  // summaryData 存储经过筛选和汇总后的结果
  const [summaryData, setSummaryData] = useState<SubjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 账套信息和日期
  const [accountBookStartDate, setAccountBookStartDate] = useState('2001-01-01');
  const today = new Date().toISOString().split('T')[0];
  
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    voucherFrom: '',
    voucherTo: ''
  });

  // --- 辅助函数：核心汇总逻辑 ---
  const aggregateData = (data: VoucherLine[]): SubjectSummary[] => {
    const summaryMap: { [key: string]: SubjectSummary } = {};
    
    data.forEach(item => {
      const key = item.subjectCode;
      if (!summaryMap[key]) {
        // 初始化汇总行
        summaryMap[key] = {
          subjectCode: item.subjectCode,
          subjectName: item.subjectName,
          debitAmount: 0,
          creditAmount: 0,
        };
      }
      // 累加借贷金额
      summaryMap[key].debitAmount += item.debitAmount;
      summaryMap[key].creditAmount += item.creditAmount;
    });
    
    // 转换为数组并按科目编码排序
    return Object.values(summaryMap).sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
  };

  // 1. 获取账套信息 & 加载凭证数据
  useEffect(() => {
    // 【修复4】确保路由准备好且 bookId 存在
    if (!router.isReady || !bookId) return;
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // 1. 获取账套信息 (使用 mockData)
        const books = await getAccountBooks();
        // 简单逻辑：找到当前 ID 的账套，或者取第一个激活的
        const activeBook = (books || []).find((b: any) => b.id === currentBookId || b.isActive);
        
        if (activeBook && activeBook.period_start) {
           setAccountBookStartDate(`${activeBook.period_start}-01`);
           // 如果还没有选日期，默认设置为当月
           if (!filters.dateFrom) {
               const now = new Date();
               const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
               setFilters(prev => ({ ...prev, dateFrom: firstDay, dateTo: today }));
           }
        }

        // 2. 获取凭证数据 (使用 mockData)
        const vouchers = await getAllVouchers(currentBookId);
        
        const lineItems: VoucherLine[] = [];

        // 展平分录，创建原始明细列表
        (vouchers || []).forEach((voucher: any) => {
          // 只统计已审核的凭证？通常凭证汇总表包含所有或可选。这里暂且包含所有。
          (voucher.lines || []).forEach((line: any) => {
            const debit = parseFloat(line.debitAmount) || 0;
            const credit = parseFloat(line.creditAmount) || 0;
            
            lineItems.push({
              subjectCode: line.subjectCode,
              subjectName: line.subjectName,
              debitAmount: debit,
              creditAmount: credit,
              voucherDate: voucher.voucherDate,
              voucherNumber: voucher.voucherNumber // 假设 voucherNumber 是纯数字或 "记-001" 格式
            });
          });
        });
        
        // 存储所有原始明细
        setAllLines(lineItems); 

        // 立即对数据进行汇总 (基于默认筛选或全量)
        setSummaryData(aggregateData(lineItems));

      } catch (error) {
        console.error("加载凭证数据失败", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, bookId]);

  // --- 查询和筛选逻辑 ---
  const handleQuery = () => {
    setIsLoading(true);
    
    // 模拟异步筛选体验
    setTimeout(() => {
      let filteredLines = allLines.filter(item => {
        // 1. 日期筛选
        if (filters.dateFrom && item.voucherDate < filters.dateFrom) return false;
        if (filters.dateTo && item.voucherDate > filters.dateTo) return false;
        
        // 2. 凭证号筛选
        // 假设 voucherNumber 格式可能是 "记-1", "1", "001" 等
        // 提取其中的数字部分进行比较
        const extractNumber = (str: string) => parseInt(str.replace(/\D/g, '') || '0');
        
        const itemNum = extractNumber(item.voucherNumber);
        const fromNum = filters.voucherFrom ? parseInt(filters.voucherFrom) : null;
        const toNum = filters.voucherTo ? parseInt(filters.voucherTo) : null;
        
        if (fromNum !== null && itemNum < fromNum) return false;
        if (toNum !== null && itemNum > toNum) return false;

        return true;
      });
      
      const summaryArray = aggregateData(filteredLines);
      
      setSummaryData(summaryArray);
      setIsLoading(false);
    }, 200);
  };

  const totalDebit = summaryData.reduce((sum, item) => sum + item.debitAmount, 0);
  const totalCredit = summaryData.reduce((sum, item) => sum + item.creditAmount, 0);

  const handleDrillDown = (subjectCode: string) => {
    // 实际项目中可以使用 router.push 跳转到明细账
    alert(`正在跳转到科目【${subjectCode}】的明细分类账，带入期间筛选...`);
  };

  const handleExport = () => {
    if (summaryData.length === 0) {
        alert("没有数据可供导出");
        return;
    }
    // 简单的 CSV 导出
    const csvHeader = "科目编码,科目名称,借方金额,贷方金额\n";
    const csvBody = summaryData.map(row => 
        `${row.subjectCode},${row.subjectName},${row.debitAmount},${row.creditAmount}`
    ).join("\n");
    const blob = new Blob(["\ufeff" + csvHeader + csvBody], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `凭证汇总表_${filters.dateFrom}_${filters.dateTo}.csv`;
    link.click();
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1 text-2xl font-bold">凭证汇总表</h1>
        <p className="text-gray-600">按科目汇总凭证借贷金额</p>
      </div>

      {/* 筛选区域 */}
      <div className="bg-white rounded-lg border p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-12 gap-4 mb-4">
          <div className="col-span-2 space-y-2">
            <Label>日期区间（起）</Label>
            <div className="relative">
              <Input 
                type="date" 
                value={filters.dateFrom} 
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} 
                // min={accountBookStartDate} 
                max={today} 
                className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"
              />
              {filters.dateFrom && <button onClick={() => setFilters({ ...filters, dateFrom: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>日期区间（止）</Label>
            <div className="relative">
              <Input 
                type="date" 
                value={filters.dateTo} 
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} 
                // min={accountBookStartDate} 
                max={today} 
                className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"
              />
              {filters.dateTo && <button onClick={() => setFilters({ ...filters, dateTo: '' })} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>凭证号（起）</Label>
            <Input 
              placeholder="如：1" 
              value={filters.voucherFrom} 
              onChange={(e) => setFilters({ ...filters, voucherFrom: e.target.value })} 
              className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>凭证号（止）</Label>
            <Input 
              placeholder="如：100" 
              value={filters.voucherTo} 
              onChange={(e) => setFilters({ ...filters, voucherTo: e.target.value })} 
              className="bg-white border-gray-300 shadow-sm focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="col-span-4 space-y-2 flex items-end">
            <div className="flex items-center gap-2 w-full">
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleQuery} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Search className="w-4 h-4 mr-2" />}
                查询
              </Button>
              <Button variant="outline" className="flex-1 bg-white" onClick={handleExport} disabled={summaryData.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* 汇总信息区域 */}
        <div className="pt-3 border-t space-y-2">
          <div className="text-sm text-gray-600">
            查询期间：<span className="font-medium text-gray-900">{filters.dateFrom || '期初'} 至 {filters.dateTo || '至今'}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-gray-600">借方合计：</span>
              <span className={`font-mono font-bold ml-2 text-lg ${totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'}`}>
                ¥ {totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">贷方合计：</span>
              <span className={`font-mono font-bold ml-2 text-lg ${totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'}`}>
                ¥ {totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {Math.abs(totalDebit - totalCredit) < 0.01 ? (
              <div className="text-sm text-green-600 font-medium flex items-center gap-1">✓ 借贷平衡</div>
            ) : (
              <div className="text-sm text-red-600 font-medium">⚠️ 借贷不平 (差额: {(totalDebit - totalCredit).toLocaleString('zh-CN', { minimumFractionDigits: 2 })})</div>
            )}
          </div>
        </div>
      </div>

      {/* 汇总表格 */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <Table className="w-full min-w-[800px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[120px]">科目编码</TableHead>
              <TableHead>科目名称</TableHead>
              <TableHead className="text-right w-[160px]">借方金额</TableHead>
              <TableHead className="text-right w-[160px]">贷方金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></TableCell></TableRow>
            ) : summaryData.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-gray-500 py-12">暂无数据，请调整查询条件</TableCell></TableRow>
            ) : (
              summaryData.map((item) => (
                <TableRow key={item.subjectCode} className="hover:bg-gray-50 transition-colors">
                  <TableCell className="text-left">
                    <button onClick={() => handleDrillDown(item.subjectCode)} className="text-blue-600 hover:text-blue-800 hover:underline font-mono font-medium">
                      {item.subjectCode}
                    </button>
                  </TableCell>
                  <TableCell className="text-gray-900 font-medium">{item.subjectName}</TableCell>
                  <TableCell className="text-right font-mono text-gray-700">
                    {item.debitAmount > 0 ? item.debitAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-700">
                    {item.creditAmount > 0 ? item.creditAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {!isLoading && summaryData.length > 0 && (
            <TableFooter>
              <TableRow className="bg-gray-100 font-bold text-gray-900">
                <TableCell colSpan={2} className="text-left">合计</TableCell>
                <TableCell className="text-right font-mono">¥ {totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
                <TableCell className="text-right font-mono">¥ {totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}