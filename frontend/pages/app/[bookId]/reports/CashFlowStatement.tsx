import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Download, RefreshCw, FileBarChart, AlertCircle } from 'lucide-react'; // 移除了 Printer 图标引用
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
import {
    getCashFlowStatementReport, 
    getSubjectAggregatedBalance 
} from '@/lib/mockData';
import Decimal from 'decimal.js';

interface CashFlowLine {
  rowNumber: number;
  itemName: string;
  formula?: string;        
  isTotal?: boolean;       
  indent?: number;         
}

const cashFlowLines: CashFlowLine[] = [
  // --- 一、经营活动 ---
  { rowNumber: 1, itemName: '一、经营活动产生的现金流量：', isTotal: true },
  { rowNumber: 2, itemName: '销售商品、提供劳务收到的现金', indent: 1 },
  { rowNumber: 3, itemName: '收到的税费返还', indent: 1 },
  { rowNumber: 4, itemName: '收到其他与经营活动有关的现金', indent: 1 },
  { rowNumber: 5, itemName: '经营活动现金流入小计', formula: '2+3+4', isTotal: true, indent: 1 },
  
  { rowNumber: 6, itemName: '购买商品、接受劳务支付的现金', indent: 1 },
  { rowNumber: 7, itemName: '支付给职工以及为职工支付的现金', indent: 1 },
  { rowNumber: 8, itemName: '支付的各项税费', indent: 1 },
  { rowNumber: 9, itemName: '支付其他与经营活动有关的现金', indent: 1 },
  { rowNumber: 10, itemName: '经营活动现金流出小计', formula: '6+7+8+9', isTotal: true, indent: 1 },
  { rowNumber: 11, itemName: '经营活动产生的现金流量净额', formula: '5-10', isTotal: true },

  // --- 二、投资活动 ---
  { rowNumber: 12, itemName: '二、投资活动产生的现金流量：', isTotal: true },
  { rowNumber: 13, itemName: '收回投资收到的现金', indent: 1 },
  { rowNumber: 14, itemName: '取得投资收益收到的现金', indent: 1 },
  { rowNumber: 15, itemName: '投资活动现金流入小计', formula: '13+14', isTotal: true, indent: 1 },
  
  { rowNumber: 16, itemName: '购建固定资产、无形资产支付的现金', indent: 1 },
  { rowNumber: 17, itemName: '投资支付的现金', indent: 1 },
  { rowNumber: 18, itemName: '投资活动现金流出小计', formula: '16+17', isTotal: true, indent: 1 },
  { rowNumber: 19, itemName: '投资活动产生的现金流量净额', formula: '15-18', isTotal: true },

  // --- 三、筹资活动 ---
  { rowNumber: 20, itemName: '三、筹资活动产生的现金流量：', isTotal: true },
  { rowNumber: 21, itemName: '吸收投资收到的现金', indent: 1 },
  { rowNumber: 22, itemName: '取得借款收到的现金', indent: 1 },
  { rowNumber: 23, itemName: '筹资活动现金流入小计', formula: '21+22', isTotal: true, indent: 1 },
  
  { rowNumber: 24, itemName: '偿还债务支付的现金', indent: 1 },
  { rowNumber: 25, itemName: '分配股利、利润或偿付利息支付的现金', indent: 1 },
  { rowNumber: 26, itemName: '筹资活动现金流出小计', formula: '24+25', isTotal: true, indent: 1 },
  { rowNumber: 27, itemName: '筹资活动产生的现金流量净额', formula: '23-26', isTotal: true },

  // --- 四、汇率变动 ---
  { rowNumber: 28, itemName: '四、汇率变动对现金的影响', indent: 0 },

  // --- 五、总计 ---
  { rowNumber: 29, itemName: '五、现金及现金等价物净增加额', formula: '11+19+27+28', isTotal: true },
  { rowNumber: 30, itemName: '加：期初现金及现金等价物余额', indent: 0 },
  { rowNumber: 31, itemName: '六、期末现金及现金等价物余额', formula: '29+30', isTotal: true },
];

export default function CashFlowStatement() {
  const router = useRouter();
  const { bookId } = router.query;

  // 根据你的数据情况，默认设为 2025-12，以便直接看到数据
  const [currentPeriod, setCurrentPeriod] = useState('2025-12');
  const [isLoading, setIsLoading] = useState(false);
  const [flowData, setFlowData] = useState<Map<number, { currentPeriod: number; currentYear: number }>>(new Map());

  useEffect(() => {
    if (router.isReady && bookId) {
      loadCashFlowStatement();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPeriod, router.isReady, bookId]);

  const loadCashFlowStatement = async () => {
    // 1. 【账套分离确认】获取当前账套ID
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) return;

    setIsLoading(true);
    
    try {
        // 2. 【账套分离确认】请求API时传入 currentBookId
        const engineData = await getCashFlowStatementReport(currentBookId, currentPeriod);
        const dataMap = new Map<number, { currentPeriod: number; currentYear: number }>();
        
        if (engineData) {
            Object.keys(engineData).forEach((key) => {
                dataMap.set(Number(key), engineData[Number(key)]);
            });
        }

        const cashCodes = ['1001', '1002', '1012'];
        
        // 日期计算
        const startDate = new Date(`${currentPeriod}-01`);
        startDate.setDate(startDate.getDate() - 1); 
        const periodStartStr = startDate.toISOString().split('T')[0];
        
        const prevYearEndStr = `${parseInt(currentPeriod.split('-')[0]) - 1}-12-31`;

        let periodBeginTotal = new Decimal(0);
        let yearBeginTotal = new Decimal(0);

        // 3. 【账套分离确认】获取余额时也传入了 currentBookId
        await Promise.all(cashCodes.map(async (code) => {
             const pBal = await getSubjectAggregatedBalance(currentBookId, code, periodStartStr);
             const yBal = await getSubjectAggregatedBalance(currentBookId, code, prevYearEndStr);
             
             periodBeginTotal = periodBeginTotal.plus(pBal);
             yearBeginTotal = yearBeginTotal.plus(yBal);
        }));

        dataMap.set(30, {
            currentPeriod: periodBeginTotal.toNumber(),
            currentYear: yearBeginTotal.toNumber()
        });

        // 计算公式
        for (let i = 0; i < 3; i++) {
            cashFlowLines.forEach(line => {
                if (line.formula) {
                    const res = calculateFormula(line.formula, dataMap);
                    dataMap.set(line.rowNumber, res);
                }
            });
        }

        setFlowData(dataMap);

    } catch (e) {
      console.error("Failed to load flow statement:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateFormula = (formula: string, map: Map<number, {currentPeriod: number, currentYear: number}>) => {
     let pRes = new Decimal(0);
     let yRes = new Decimal(0);
     
     const parts = formula.match(/([+\-]?\d+)/g); 
     
     if (parts) {
         parts.forEach(part => {
            const rowNum = parseInt(part); 
            const absRowNum = Math.abs(rowNum);
            const data = map.get(absRowNum) || { currentPeriod: 0, currentYear: 0 };
            
            if (rowNum > 0) {
                pRes = pRes.plus(data.currentPeriod);
                yRes = yRes.plus(data.currentYear);
            } else {
                pRes = pRes.minus(data.currentPeriod);
                yRes = yRes.minus(data.currentYear);
            }
         });
     }

     return { currentPeriod: pRes.toNumber(), currentYear: yRes.toNumber() };
  };

  // --- 新增：导出 Excel 功能 ---
  const handleExport = () => {
    // 1. 定义 CSV 表头
    // \uFEFF 是 BOM (Byte Order Mark)，强制 Excel 用 UTF-8 打开，防止中文乱码
    let csvContent = "\uFEFF"; 
    csvContent += "项目名称,行次,本期金额,本年累计金额\n";

    // 2. 遍历数据行生成内容
    cashFlowLines.forEach(line => {
        const data = flowData.get(line.rowNumber);
        const pAmt = data?.currentPeriod || 0;
        const yAmt = data?.currentYear || 0;
        
        // 为了美观，可以加一些缩进空格在 CSV 里（可选）
        const indentSpace = "  ".repeat(line.indent || 0);
        const name = `"${indentSpace}${line.itemName}"`; // 加双引号防止名称中有逗号破坏格式

        // 拼接一行
        csvContent += `${name},${line.rowNumber},${pAmt},${yAmt}\n`;
    });

    // 3. 创建下载链接并触发
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `现金流量表_${currentPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatAmount = (val: number | undefined) => {
    if (val === undefined || val === null) return '-';
    const num = Math.round(val * 100) / 100;
    if (num === 0) return '-';
    if (num < 0) return <span className="text-red-600">({Math.abs(num).toLocaleString()})</span>;
    return num.toLocaleString();
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-green-600"/>
            现金流量表
        </h1>
        <p className="text-gray-600 text-sm">反映企业现金及现金等价物的流入和流出情况 (自动分析已审核凭证)</p>
      </div>

      <div className="bg-white rounded-lg border p-4 mb-4 shadow-sm flex items-center gap-4">
         <Label>会计期间</Label>
         <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectItem value="2025-11">2025年11月</SelectItem>
                <SelectItem value="2025-12">2025年12月</SelectItem>
                <SelectItem value="2026-01">2026年01月</SelectItem>
            </SelectContent>
         </Select>
         <Button variant="outline" size="sm" onClick={loadCashFlowStatement} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading?'animate-spin':''}`}/> 刷新数据
         </Button>

         {/* 打印按钮已移除，只保留导出 Excel */}
         <div className="flex-1 text-right flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2"/> 导出 Excel
            </Button>
         </div>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
            <TableHeader>
                <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[400px] pl-6">项目</TableHead>
                    <TableHead className="w-[80px] text-center">行次</TableHead>
                    <TableHead className="text-right">本期金额</TableHead>
                    <TableHead className="text-right">本年累计金额</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {cashFlowLines.map(line => {
                    const data = flowData.get(line.rowNumber);
                    const isGroupTitle = line.itemName.endsWith('：');
                    
                    return (
                        <TableRow key={line.rowNumber} className={line.isTotal ? 'bg-green-50/30 font-bold' : ''}>
                             <TableCell className={`pl-6 ${isGroupTitle ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                                <div style={{ paddingLeft: `${(line.indent || 0) * 20}px` }}>
                                    {line.itemName}
                                </div>
                             </TableCell>
                             <TableCell className="text-center text-gray-400 text-xs">{line.rowNumber}</TableCell>
                             <TableCell className="text-right font-mono">{formatAmount(data?.currentPeriod)}</TableCell>
                             <TableCell className="text-right font-mono">{formatAmount(data?.currentYear)}</TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
      </div>
      
      <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex gap-3">
         <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5"/>
         <div className="text-sm text-yellow-800">
            <p className="font-bold mb-1">数据说明</p>
            <p>1. 本表基于<b>已审核凭证</b>自动生成，请确保所有业务凭证已完成审核。</p>
            <p>2. 若部分流量分类不准确，请检查凭证录入时对方科目的选择是否规范。</p>
         </div>
      </div>
    </div>
  );
}