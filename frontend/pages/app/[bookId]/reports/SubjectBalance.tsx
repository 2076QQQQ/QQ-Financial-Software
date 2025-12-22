import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Loader2, Download, Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';
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
import { toast } from 'sonner';

// 复用现有的 API
import { getGeneralLedgerReport, getAccountBooks } from '@/lib/mockData';

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
}

export default function SubjectBalanceTable() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<SubjectSummary[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // 筛选条件
  const [queryConditions, setQueryConditions] = useState({
    periodFrom: '',
    periodTo: '',
    levelFrom: 1,
    levelTo: 10 
  });

  // 1. 初始化页面配置 (日期下拉框)
  useEffect(() => {
    if (!router.isReady || !currentBookId) return;

    const initPageData = async () => {
      try {
        const books = await getAccountBooks();
        const currentBook = (books || []).find((b: any) => b.id === currentBookId);
        
        if (currentBook) {
            const startPeriod = currentBook.period_start || '2025-01';
            const generatedPeriods = generatePeriodList(startPeriod);
            setAvailablePeriods(generatedPeriods);

            const now = new Date();
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // 默认选中当前月，如果当前月还没到，选最后一个可用月
            let defaultPeriod = currentMonthStr;
            if (generatedPeriods.length > 0 && !generatedPeriods.includes(defaultPeriod)) {
                 // 如果当前月不在范围内（比如是未来），或者比建账还早
                 if (currentMonthStr < startPeriod) defaultPeriod = startPeriod;
                 else defaultPeriod = generatedPeriods[generatedPeriods.length - 1];
            }

            setQueryConditions(prev => ({
                ...prev,
                periodFrom: defaultPeriod,
                periodTo: defaultPeriod
            }));
            
            // 标记初始化完成，触发数据查询
            setIsInitialized(true);
        }
      } catch (e) { 
        console.error("初始化失败", e); 
        toast.error("加载账套信息失败");
      }
    };

    initPageData();
  }, [router.isReady, currentBookId]);

  // 2. 自动查询数据 (当初始化完成或 bookId 变化时)
  useEffect(() => {
      if (isInitialized && currentBookId) {
          handleQuery();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, currentBookId]);

  // 辅助函数：生成日期列表
  const generatePeriodList = (startStr: string) => {
     if (!startStr) return [];
     const periods = [];
     const [startYear, startMonth] = startStr.split('-').map(Number);
     const now = new Date();
     // 多生成几个月以防万一
     const endYear = now.getFullYear() + 1; 
     let y = startYear;
     let m = startMonth;
     
     // 生成到明年年底，或者根据实际业务限制
     while (y < endYear) {
         periods.push(`${y}-${String(m).padStart(2, '0')}`);
         m++;
         if (m > 12) { m = 1; y++; }
     }
     return periods;
  };

  // 3. 核心查询逻辑
  const handleQuery = async () => {
    if (!currentBookId) return;
    if (!queryConditions.periodFrom || !queryConditions.periodTo) return;

    setLoading(true);
    try {
      console.log("正在查询科目余额表...", queryConditions);
      
      const rawData = await getGeneralLedgerReport(currentBookId, {
          ...queryConditions,
          subjectFrom: '', 
          subjectTo: '' 
      });
      
      if (Array.isArray(rawData)) {
          // 按科目代码排序
          const sorted = rawData.sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));
          setReportData(sorted);
          toast.success("数据已刷新");
      } else {
          setReportData([]);
          toast.warning("未查询到数据");
      }

    } catch (error) {
      console.error(error);
      toast.error("查询数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 格式化金额
  const fmtMoney = (val: number) => {
      if (val === undefined || val === null) return '-';
      if (Math.abs(val) < 0.001) return '-'; // 0 不显示，保持页面整洁
      return val.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  };

  const handleExport = () => {
    if (reportData.length === 0) {
        toast.warning("暂无数据可导出");
        return;
    }

    const headers = [
        "科目编码", "科目名称", "方向", 
        "期初余额", "本期借方", "本期贷方", 
        "本年借方累计", "本年贷方累计", "期末余额"
    ];

    const excelData = reportData.map(row => ({
        "科目编码": row.code,
        "科目名称": "  ".repeat(Math.max(0, row.level - 1) * 2) + row.name, 
        "方向": row.direction,
        "期初余额": row.initialBalance,
        "本期借方": row.periodDebit,
        "本期贷方": row.periodCredit,
        "本年借方累计": row.yearDebit,
        "本年贷方累计": row.yearCredit,
        "期末余额": row.periodBalance
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData, { header: headers });
    worksheet['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "科目余额表");
    const fileName = `科目余额表_${queryConditions.periodFrom}_${queryConditions.periodTo}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      <div className="mb-6 flex justify-between items-start">
        <div>
           <h1 className="text-2xl font-bold text-gray-900 mb-1">科目余额表</h1>
           <p className="text-gray-600">查看所有科目的期初、发生及期末余额汇总</p>
        </div>
        
        <Button 
            variant="outline" 
            onClick={handleExport} 
            disabled={reportData.length === 0}
            className={reportData.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
        >
            <Download className="w-4 h-4 mr-2" /> 导出 Excel
        </Button>
      </div>
      
      {/* 筛选区域 */}
      <div className="bg-white rounded-lg border p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-12 gap-4 items-end">
           <div className="col-span-3 space-y-2">
              <Label>会计期间（起）</Label>
              <Select value={queryConditions.periodFrom} onValueChange={v=>setQueryConditions({...queryConditions, periodFrom:v})}>
                 <SelectTrigger><SelectValue placeholder="选择期间" /></SelectTrigger>
                 <SelectContent className="max-h-[300px]">
                   {availablePeriods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                 </SelectContent>
              </Select>
           </div>
           <div className="col-span-3 space-y-2">
              <Label>会计期间（止）</Label>
              <Select value={queryConditions.periodTo} onValueChange={v=>setQueryConditions({...queryConditions, periodTo:v})}>
                 <SelectTrigger><SelectValue placeholder="选择期间" /></SelectTrigger>
                 <SelectContent className="max-h-[300px]">
                   {availablePeriods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                 </SelectContent>
              </Select>
           </div>
           
           <div className="col-span-3 space-y-2">
              <Label>科目级次</Label>
              <div className="flex items-center gap-2">
                  <Select value={String(queryConditions.levelFrom)} onValueChange={v=>setQueryConditions({...queryConditions, levelFrom: Number(v)})}>
                     <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        {[1,2,3,4].map(l => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}
                     </SelectContent>
                  </Select>
                  <span className="text-gray-400">-</span>
                  <Select value={String(queryConditions.levelTo)} onValueChange={v=>setQueryConditions({...queryConditions, levelTo: Number(v)})}>
                     <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                     <SelectContent>
                        {[1,2,3,4,10].map(l => <SelectItem key={l} value={String(l)}>{l === 10 ? '末级' : l}</SelectItem>)}
                     </SelectContent>
                  </Select>
              </div>
           </div>

           <div className="col-span-3 pb-0.5">
               <Button onClick={handleQuery} disabled={loading} className="bg-blue-600 w-full">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Search className="w-4 h-4 mr-2"/>}
                  查询
               </Button>
           </div>
        </div>
      </div>

      {/* 报表主体 */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
         <Table>
            <TableHeader>
               <TableRow className="bg-gray-100/80 hover:bg-gray-100">
                  <TableHead className="w-[120px] font-bold text-gray-900 border-r">科目编码</TableHead>
                  <TableHead className="min-w-[200px] font-bold text-gray-900 border-r">科目名称</TableHead>
                  <TableHead className="text-center w-[60px] text-xs border-r">方向</TableHead>
                  
                  <TableHead className="text-right bg-yellow-50/50 font-bold text-gray-700 border-r w-[120px]">期初余额</TableHead>
                  
                  <TableHead className="text-right font-bold text-blue-700 w-[120px]">本期借方</TableHead>
                  <TableHead className="text-right font-bold text-green-700 border-r w-[120px]">本期贷方</TableHead>
                  
                  <TableHead className="text-right font-bold text-gray-600 w-[120px]">本年借方</TableHead>
                  <TableHead className="text-right font-bold text-gray-600 border-r w-[120px]">本年贷方</TableHead>
                  
                  <TableHead className="text-right bg-blue-50/50 font-bold text-gray-900 w-[120px]">期末余额</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {reportData.length > 0 ? (
                  reportData.map((row) => (
                    <TableRow key={row.code} className="hover:bg-gray-50 border-b border-gray-100">
                       <TableCell className="font-mono text-gray-600 border-r bg-gray-50/30">{row.code}</TableCell>
                       <TableCell className={`border-r ${row.level === 1 ? "font-bold text-gray-900" : "text-gray-700"}`}>
                          <span style={{paddingLeft: `${(row.level - 1) * 16}px`}}>{row.name}</span>
                       </TableCell>
                       <TableCell className="text-center text-xs text-gray-400 border-r">{row.direction}</TableCell>
                       
                       {/* 期初 */}
                       <TableCell className="text-right font-mono text-gray-600 border-r bg-yellow-50/20">
                           {fmtMoney(row.initialBalance)}
                       </TableCell>
                       
                       {/* 本期发生 */}
                       <TableCell className="text-right font-mono text-gray-900">
                           {fmtMoney(row.periodDebit)}
                       </TableCell>
                       <TableCell className="text-right font-mono text-gray-900 border-r">
                           {fmtMoney(row.periodCredit)}
                       </TableCell>

                       {/* 本年累计 */}
                       <TableCell className="text-right font-mono text-gray-400">
                           {fmtMoney(row.yearDebit)}
                       </TableCell>
                       <TableCell className="text-right font-mono text-gray-400 border-r">
                           {fmtMoney(row.yearCredit)}
                       </TableCell>

                       {/* 期末余额 */}
                       <TableCell className={`text-right font-mono bg-blue-50/20 font-medium ${row.periodBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                           {fmtMoney(row.periodBalance)}
                       </TableCell>
                    </TableRow>
                  ))
               ) : (
                  <TableRow><TableCell colSpan={9} className="text-center py-16 text-gray-400">
                      {loading ? '数据加载中...' : '暂无数据或请点击查询'}
                  </TableCell></TableRow>
               )}
            </TableBody>
         </Table>
      </div>
    </div>
  );
}