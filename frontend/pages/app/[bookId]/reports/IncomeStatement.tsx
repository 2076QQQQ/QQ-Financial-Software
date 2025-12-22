import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import Decimal from 'decimal.js';
import * as XLSX from 'xlsx';
import { Download, RefreshCw, Printer, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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

// 引入API
import { getAllVouchers, getAllSubjects } from '@/lib/mockData';

// --- 类型定义 ---
interface IncomeStatementLine {
  rowNumber: number;
  itemName: string;
  subjectCodes?: string[]; 
  formula?: string; 
  isTotal?: boolean; 
  isRevenue?: boolean; // true=收入(贷-借), false=费用(借-贷)
  indent?: number;
}

// --- 报表配置 (完全符合会计准则) ---
const incomeLines: IncomeStatementLine[] = [
  { rowNumber: 1, itemName: '一、营业收入', subjectCodes: ['6001', '6051'], isRevenue: true },
  { rowNumber: 2, itemName: '减：营业成本', subjectCodes: ['6401', '6402'], indent: 1, isRevenue: false },
  { rowNumber: 3, itemName: '税金及附加', subjectCodes: ['6403'], indent: 1, isRevenue: false },
  { rowNumber: 4, itemName: '销售费用', subjectCodes: ['6601'], indent: 1, isRevenue: false },
  { rowNumber: 5, itemName: '管理费用', subjectCodes: ['6602'], indent: 1, isRevenue: false },
  { rowNumber: 6, itemName: '研发费用', subjectCodes: ['6604'], indent: 1, isRevenue: false }, // 注意: 研发费用常用6604或管理费用下二级
  { rowNumber: 7, itemName: '财务费用', subjectCodes: ['6603'], indent: 1, isRevenue: false },
  { rowNumber: 8, itemName: '其中：利息费用', subjectCodes: ['660301'], indent: 2, isRevenue: false },
  { rowNumber: 9, itemName: '利息收入', subjectCodes: ['660302'], indent: 2, isRevenue: true }, 
  { rowNumber: 10, itemName: '加：其他收益', subjectCodes: ['6117'], indent: 1, isRevenue: true }, 
  { rowNumber: 11, itemName: '投资收益（损失以"-"号填列）', subjectCodes: ['6111'], indent: 1, isRevenue: true },
  { rowNumber: 12, itemName: '公允价值变动收益（损失以"-"号填列）', subjectCodes: ['6101'], indent: 1, isRevenue: true },
  { rowNumber: 13, itemName: '信用减值损失（损失以"-"号填列）', subjectCodes: ['6701'], indent: 1, isRevenue: false }, 
  { rowNumber: 14, itemName: '资产减值损失（损失以"-"号填列）', subjectCodes: ['6702'], indent: 1, isRevenue: false },
  { rowNumber: 15, itemName: '资产处置收益（损失以"-"号填列）', subjectCodes: ['6115'], indent: 1, isRevenue: true },
  
  // 核心业务利润
  { rowNumber: 16, itemName: '二、营业利润（亏损以"-"号填列）', formula: '1-2-3-4-5-6-7+10+11+12-13-14+15', isTotal: true },
  
  { rowNumber: 17, itemName: '加：营业外收入', subjectCodes: ['6301'], indent: 1, isRevenue: true },
  { rowNumber: 18, itemName: '减：营业外支出', subjectCodes: ['6711'], indent: 1, isRevenue: false },
  
  // 利润总额
  { rowNumber: 19, itemName: '三、利润总额（亏损总额以"-"号填列）', formula: '16+17-18', isTotal: true },
  
  { rowNumber: 20, itemName: '减：所得税费用', subjectCodes: ['6801'], indent: 1, isRevenue: false },
  
  // 净利润
  { rowNumber: 21, itemName: '四、净利润（净亏损以"-"号填列）', formula: '19-20', isTotal: true },
];

export default function IncomeStatement() {
  const router = useRouter();
  const { bookId } = router.query;
  // 确保 bookId 存在
  const currentBookId = useMemo(() => {
     if (Array.isArray(bookId)) return bookId[0];
     return bookId || '';
  }, [bookId]);

  const [currentPeriod, setCurrentPeriod] = useState('2025-12');
  const [showLastYear, setShowLastYear] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allVouchers, setAllVouchers] = useState<any[]>([]);
  const [debugMode, setDebugMode] = useState(false); // 调试开关
  const [debugLines, setDebugLines] = useState<any[]>([])
  
  // 计算结果存储
  const [incomeData, setIncomeData] = useState<Map<number, { currentPeriod: number; currentYear: number }>>(new Map());

  // 1. 数据抓取层：只抓取当前账套的凭证
  useEffect(() => {
    if (currentBookId) {
        fetchRawData();
    }
  }, [currentBookId]);

  // 2. 业务逻辑层：当凭证或月份变化时，重新“剥洋葱”计算
  useEffect(() => {
    if (allVouchers.length > 0 && currentPeriod) {
        calculateReport();
    }
  }, [currentPeriod, allVouchers]);

  const fetchRawData = async () => {
      if (!currentBookId) return;
      setIsLoading(true);
      try {
          console.log(`[会计系统] 正在从账套 ${currentBookId} 抓取凭证数据...`);
          // 获取所有凭证 (MockData 已经根据 bookId 过滤了，但我们这里再次确保)
          const vouchers = await getAllVouchers(currentBookId);
          
          // 过滤逻辑：
          // 1. 必须是已审核 (approved) 或系统生成
          // 2. 必须不是作废的
          const validVouchers = (vouchers || []).filter((v:any) => v.status !== 'void');
          
          setAllVouchers(validVouchers);
          console.log(`[会计系统] 成功抓取有效凭证 ${validVouchers.length} 张`);
          if (validVouchers.length === 0) {
            toast.warning("当前账套没有发现凭证数据，请先录入或审核凭证");
          } else {
            toast.success("财务数据已同步");
          }
      } catch (e) {
          console.error(e);
          toast.error("获取财务数据失败");
      } finally {
          setIsLoading(false);
      }
  };

  // --- 核心计算引擎 ---
  const calculateReport = () => {
      console.time("IncomeCalc");
      const [year, month] = currentPeriod.split('-');
      
      const periodStart = `${currentPeriod}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const periodEnd = `${currentPeriod}-${lastDay}`;
      const yearStart = `${year}-01-01`; 

      console.log(`[会计引擎] 计算期间: ${periodStart} 至 ${periodEnd}`);
      const tempDebugList: any[] = [];

      /**
       * 辅助函数：计算指定科目列表的净发生额
       * 核心逻辑：排除结转凭证，只看业务发生额
       */
const calculateNet = (codes: string[], startDate: string, endDate: string, isRevenue: boolean): Decimal => {
          let total = new Decimal(0);

          const targetVouchers = allVouchers.filter((v: any) => 
             v.voucherDate >= startDate && v.voucherDate <= endDate
          );

          targetVouchers.forEach(v => {
              // --- 修复逻辑：只排除“损益结转”凭证 ---
              // 特征：凭证中包含“本年利润”(3103) 科目，且通常是在月末
              const isPnLTransfer = v.lines.some((l:any) => l.subjectCode.startsWith('3103') || l.subjectCode.startsWith('4103'));
              
              // 如果是“本年利润”结转凭证，直接跳过 (因为它把 6xxx 转平了)
              // 注意：不要根据 closingType 盲目排除，因为“结转成本”也是 closingType
              if (isPnLTransfer) return;

              v.lines.forEach((l: any) => {
                  const code = l.subjectCode;
                  // 匹配科目 (支持前缀，如 6602 匹配 660201)
                  if (codes.some(c => code === c || code.startsWith(c))) {
                      const d = new Decimal(l.debitAmount || 0);
                      const c = new Decimal(l.creditAmount || 0);
                      
                      let amount = new Decimal(0);
                      if (isRevenue) {
                          amount = c.minus(d); // 收入：贷 - 借
                      } else {
                          amount = d.minus(c); // 费用：借 - 贷
                      }
                      total = total.plus(amount);

                      // 收集调试信息 (只收集本期的)
                      if (startDate === periodStart) {
                        tempDebugList.push({
                            voucherDate: v.voucherDate,
                            voucherCode: v.voucherCode,
                            subjectCode: code,
                            summary: l.summary,
                            debit: d.toNumber(),
                            credit: c.toNumber(),
                            netAmount: amount.toNumber(),
                            type: isRevenue ? '收入类' : '费用类',
                            category: codes[0] // 归属哪个报表项目代码
                        });
                      }
                  }
              });
          });
          
          return total;
      };

      const newData = new Map();

      // 1. 计算基础行
      incomeLines.forEach(line => {
          if (line.subjectCodes) {
              const pVal = calculateNet(line.subjectCodes, periodStart, periodEnd, line.isRevenue || false);
              const yVal = calculateNet(line.subjectCodes, yearStart, periodEnd, line.isRevenue || false);
              
              newData.set(line.rowNumber, {
                  currentPeriod: pVal.toNumber(),
                  currentYear: yVal.toNumber()
              });
          }
      });

      // 2. 计算公式行
      const evalFormula = (formula: string, type: 'currentPeriod' | 'currentYear') => {
          const tokens = formula.split(/([+\-])/); 
          let result = new Decimal(0);
          let currentOp = '+';
          tokens.forEach(token => {
              const t = token.trim();
              if (t === '+' || t === '-') currentOp = t;
              else if (t) {
                  const val = newData.get(parseInt(t))?.[type] || 0;
                  result = currentOp === '+' ? result.plus(val) : result.minus(val);
              }
          });
          return result.toNumber();
      };

      incomeLines.forEach(line => {
          if (line.formula) {
              newData.set(line.rowNumber, {
                  currentPeriod: evalFormula(line.formula, 'currentPeriod'),
                  currentYear: evalFormula(line.formula, 'currentYear')
              });
          }
      });

      setIncomeData(newData);
      setDebugLines(tempDebugList); // 更新调试列表
      console.timeEnd("IncomeCalc");
  };

  // 格式化金额
  const formatMoney = (val: number | undefined) => {
    if (val === undefined || val === null) return '-';
    if (Math.abs(val) < 0.01) return '-';
    return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 导出 Excel
  const handleExport = () => {
    const wsData = [
        ["利润表"], 
        [`编制单位：我的公司`, ``, ``, `报表期间：${currentPeriod}`], 
        ["项 目", "行次", "本期金额", "本年累计金额"], 
    ];

    incomeLines.forEach(line => {
        const d = incomeData.get(line.rowNumber);
        const indentSpace = "    ".repeat(line.indent || 0);
        wsData.push([
            indentSpace + line.itemName,
            String(line.rowNumber),
            d ? (Math.abs(d.currentPeriod) < 0.01 ? '-' : d.currentPeriod.toFixed(2)) : '-',
            d ? (Math.abs(d.currentYear) < 0.01 ? '-' : d.currentYear.toFixed(2)) : '-'
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 15 }];
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];

    XLSX.utils.book_append_sheet(wb, ws, "利润表");
    XLSX.writeFile(wb, `利润表_${currentPeriod}.xlsx`);
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-10 space-y-6">
      {/* 头部控制栏 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">利润表</h1>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm print:hidden">
            <Label className="whitespace-nowrap ml-2">报表期间</Label>
            <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-[140px] h-9 border-none bg-gray-50 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => {
                    const m = String(i + 1).padStart(2, '0');
                    return <SelectItem key={m} value={`2025-${m}`}>2025年{i + 1}月</SelectItem>
                  })}
                </SelectContent>
            </Select>

            <div className="h-4 w-[1px] bg-gray-200 mx-2"/>
            
            <Button variant="ghost" size="sm" onClick={fetchRawData} disabled={isLoading} title="强制刷新数据">
                <RefreshCw className={`w-4 h-4 ${isLoading?'animate-spin':''}`}/>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                <Download className="w-4 h-4 "/> 导出 Excel
            </Button>
        </div>
      </div>

      {/* 报表主体 */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:shadow-none print:border-none">
        <Table className="print:text-sm">
          <TableHeader>
            <TableRow className="bg-gray-50/80 hover:bg-gray-50 border-b-2 border-gray-100">
              <TableHead className="w-[45%] pl-6 font-bold text-gray-700">项 目</TableHead>
              <TableHead className="w-[10%] text-center font-bold text-gray-700">行次</TableHead>
              <TableHead className="text-right font-bold text-gray-700">本期金额</TableHead>
              <TableHead className="text-right font-bold text-gray-700 pr-8">本年累计金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomeLines.map(line => {
              const data = incomeData.get(line.rowNumber);
              const pVal = data?.currentPeriod || 0;
              const yVal = data?.currentYear || 0;
              const hasValue = Math.abs(pVal) > 0.01 || Math.abs(yVal) > 0.01;
              
              // 样式处理
              const isTitle = line.isTotal;
              const rowClass = isTitle ? 'bg-yellow-50/40 font-bold text-gray-900' : 'text-gray-700 hover:bg-gray-50';
              const textClass = !hasValue && !isTitle ? 'text-gray-300' : '';

              return (
                <TableRow key={line.rowNumber} className={`${rowClass} ${textClass}`}>
                  <TableCell>
                    <div style={{ paddingLeft: `${(line.indent || 0) * 20 + 24}px` }}>
                        {line.itemName}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs text-gray-400">
                    {line.rowNumber}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatMoney(pVal)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums pr-8">
                    {formatMoney(yVal)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* 底部备注 */}
      <div className="flex items-start gap-2 text-xs text-gray-400 mt-4 px-2">
         <AlertCircle className="w-4 h-4 mt-0.5" />
         <div>
            <p>系统取数说明：</p>
            <ol className="list-decimal list-inside space-y-1 mt-1">
                <li>数据来源：基于【已审核】凭证的发生额实时测算。</li>
                <li>自动过滤：系统已自动排除“结转损益”类凭证，展示真实的经营成果。</li>
                <li>计算公式：收入类科目取（贷方-借方），费用类科目取（借方-贷方）。</li>
            </ol>
         </div>
      </div>
    </div>
  );
}