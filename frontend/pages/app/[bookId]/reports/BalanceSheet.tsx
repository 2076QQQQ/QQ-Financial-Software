import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Decimal from 'decimal.js';
import * as XLSX from 'xlsx'; 
import { Download, AlertCircle, Loader2, RefreshCw, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch'; 
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
import { getAllSubjects, getAllVouchers } from '@/lib/mockData';
import { toast } from 'sonner';

interface BalanceSheetLine {
  rowNumber: number;
  itemName: string;
  matchKeywords?: string[]; 
  excludeKeywords?: string[];
  formula?: string; 
  isTotal?: boolean;
  isHeader?: boolean;
  dynamicCodes?: string[]; 
}

// --- 报表定义 ---

const assetRules: BalanceSheetLine[] = [
  { rowNumber: 1, itemName: '流动资产：', isHeader: true },
  { rowNumber: 2, itemName: '货币资金', matchKeywords: ['库存现金', '银行存款', '其他货币资金'] }, 
  { rowNumber: 3, itemName: '交易性金融资产', matchKeywords: ['交易性金融资产'] },
  { rowNumber: 4, itemName: '应收票据', matchKeywords: ['应收票据'] },
  { rowNumber: 5, itemName: '应收账款', matchKeywords: ['应收账款'] },
  { rowNumber: 6, itemName: '预付账款', matchKeywords: ['预付账款'] },
  { rowNumber: 7, itemName: '应收股利', matchKeywords: ['应收股利'] },
  { rowNumber: 8, itemName: '应收利息', matchKeywords: ['应收利息'] },
  { rowNumber: 9, itemName: '其他应收款', matchKeywords: ['其他应收款'] },
  // 存货：包含库存商品及生产环节的成本
  { 
    rowNumber: 10, 
    itemName: '存货', 
    matchKeywords: [
      '库存商品', '原材料', '周转材料', '消耗性生物资产', '在途物资', '委托加工物资',
      '生产成本', '制造费用', '劳务成本', '工程施工'
    ] 
  }, 
  { rowNumber: 11, itemName: '一年内到期的非流动资产', matchKeywords: [] }, 
  { rowNumber: 12, itemName: '其他流动资产', matchKeywords: ['待认证进项税额', '待抵扣进项税额', '预缴税金'] }, 
  { rowNumber: 13, itemName: '流动资产合计', formula: 'sum(2-12)', isTotal: true },
  
  { rowNumber: 14, itemName: '非流动资产：', isHeader: true },
  { rowNumber: 15, itemName: '长期股权投资', matchKeywords: ['长期股权投资'] },
  { rowNumber: 16, itemName: '固定资产原价', matchKeywords: ['固定资产'], excludeKeywords: ['累计折旧', '清理'] },
  { rowNumber: 17, itemName: '减：累计折旧', matchKeywords: ['累计折旧'] }, 
  { rowNumber: 18, itemName: '固定资产净值', formula: '16-17' },
  { rowNumber: 19, itemName: '在建工程', matchKeywords: ['在建工程'] },
  { rowNumber: 20, itemName: '无形资产', matchKeywords: ['无形资产'], excludeKeywords: ['累计摊销'] },
  { rowNumber: 21, itemName: '长期待摊费用', matchKeywords: ['长期待摊费用'] },
  { rowNumber: 22, itemName: '非流动资产合计', formula: 'sum(15-21)-16-17+18', isTotal: true }, 
  { rowNumber: 23, itemName: '资产总计', formula: '13+22', isTotal: true },
];

const liabilityRules: BalanceSheetLine[] = [
  { rowNumber: 1, itemName: '流动负债：', isHeader: true },
  { rowNumber: 2, itemName: '短期借款', matchKeywords: ['短期借款'] },
  { rowNumber: 3, itemName: '应付票据', matchKeywords: ['应付票据'] },
  { rowNumber: 4, itemName: '应付账款', matchKeywords: ['应付账款'] },
  { rowNumber: 5, itemName: '预收账款', matchKeywords: ['预收账款', '合同负债'] }, 
  { rowNumber: 6, itemName: '应付职工薪酬', matchKeywords: ['应付职工薪酬', '应付工资'] },
  
  // ★★★ 修复：只匹配一级科目关键词，防重复 ★★★
  // 引擎会自动处理 "应交税费(2221)" 下的所有子级余额汇总
  { 
    rowNumber: 7, 
    itemName: '应交税费', 
    matchKeywords: ['应交税费'] 
  }, 
  
  { rowNumber: 8, itemName: '其他应付款', matchKeywords: ['其他应付款'] },
  { rowNumber: 9, itemName: '一年内到期的非流动负债', matchKeywords: [] },
  { rowNumber: 10, itemName: '其他流动负债', matchKeywords: ['待转销项税额'] },
  { rowNumber: 11, itemName: '流动负债合计', formula: 'sum(2-10)', isTotal: true },
  
  { rowNumber: 12, itemName: '非流动负债：', isHeader: true },
  { rowNumber: 13, itemName: '长期借款', matchKeywords: ['长期借款'] },
  { rowNumber: 14, itemName: '长期应付款', matchKeywords: ['长期应付款'] },
  { rowNumber: 15, itemName: '非流动负债合计', formula: 'sum(13-14)', isTotal: true },
  { rowNumber: 16, itemName: '负债合计', formula: '11+15', isTotal: true },
  
  { rowNumber: 17, itemName: '所有者权益：', isHeader: true },
  { rowNumber: 18, itemName: '实收资本', matchKeywords: ['实收资本', '股本'] },
  { rowNumber: 19, itemName: '资本公积', matchKeywords: ['资本公积'] },
  { rowNumber: 20, itemName: '盈余公积', matchKeywords: ['盈余公积'] },
  { rowNumber: 21, itemName: '未分配利润', matchKeywords: ['本年利润', '利润分配', '未分配利润'] }, 
  { rowNumber: 22, itemName: '所有者权益合计', formula: 'sum(18-21)', isTotal: true },
  { rowNumber: 23, itemName: '负债和所有者权益总计', formula: '16+22', isTotal: true },
];

export default function BalanceSheet() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;
  
  const [currentPeriod, setCurrentPeriod] = useState('2025-12');
  const [isLoading, setIsLoading] = useState(false);
  const [includeDraft, setIncludeDraft] = useState(true); 
  
  const [rawSubjects, setRawSubjects] = useState<any[]>([]);
  const [allVouchers, setAllVouchers] = useState<any[]>([]); 

  const [mappedAssetLines, setMappedAssetLines] = useState<BalanceSheetLine[]>(assetRules);
  const [mappedLiabilityLines, setMappedLiabilityLines] = useState<BalanceSheetLine[]>(liabilityRules);

  const [assetData, setAssetData] = useState<Map<number, { periodEnd: number; yearBegin: number }>>(new Map());
  const [liabilityData, setLiabilityData] = useState<Map<number, { periodEnd: number; yearBegin: number }>>(new Map());
  const [balanceStatus, setBalanceStatus] = useState<{isBalanced: boolean, diff: number} | null>(null);

  const fetchRawData = async () => {
    if (!currentBookId) return;
    setIsLoading(true);
    try {
        const [subjects, vouchers] = await Promise.all([
            getAllSubjects(currentBookId),
            getAllVouchers(currentBookId)
        ]);
        setRawSubjects(subjects || []);
        setAllVouchers(vouchers || []); 
        toast.success("数据已更新");
    } catch (e) {
        console.error(e);
        toast.error("获取数据失败");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentBookId) fetchRawData();
  }, [currentBookId]);

  // ★★★ 智能映射核心：升级版防重复逻辑 ★★★
  useEffect(() => {
      if (rawSubjects.length === 0) return;

      const mapLines = (rules: BalanceSheetLine[]) => {
          return rules.map(rule => {
              if (rule.matchKeywords) {
                  // 1. 先找出所有匹配的科目代码
                  const allMatchedCodes = rawSubjects
                      .filter(s => {
                          const name = s.name || '';
                          const hasKeyword = rule.matchKeywords!.some(k => name.includes(k));
                          const notExcluded = !rule.excludeKeywords?.some(k => name.includes(k));
                          return hasKeyword && notExcluded;
                      })
                      .map(s => s.code);

                  // 2. ★ 核心修复：剔除子级科目 ★
                  // 如果已经选中了 "2221" (应交税费)，就自动剔除 "222101" (应交增值税)，避免 getBalance 计算两次
                  const uniqueCodes = allMatchedCodes.filter((code, _, self) => {
                      // 检查当前代码是否是列表中其他代码的子级
                      const isChild = self.some(other => other !== code && code.startsWith(other));
                      return !isChild; // 只保留顶级代码
                  });
                  
                  return { ...rule, dynamicCodes: uniqueCodes };
              }
              return rule;
          });
      };

      setMappedAssetLines(mapLines(assetRules));
      setMappedLiabilityLines(mapLines(liabilityRules));

  }, [rawSubjects]);

  useEffect(() => {
    if (rawSubjects.length === 0 || !currentPeriod) return;
    calculateReport();
  }, [currentPeriod, rawSubjects, allVouchers, includeDraft, mappedAssetLines]); 

  const calculateReport = () => {
    console.time("ReportCalculation");
    const year = currentPeriod.split('-')[0];
    const yearBeginDate = `${parseInt(year) - 1}-12-31`; 
    const [y, m] = currentPeriod.split('-');
    const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
    const periodEndDate = `${currentPeriod}-${lastDay}`; 

    const activeVouchers = allVouchers.filter((v: any) => {
        if (v.status === 'void') return false; 
        if (includeDraft) return true;
        return v.status === 'approved';
    });

    const getBalance = (codeList: string[] | undefined, dateLimit: string): Decimal => {
        if (!codeList || codeList.length === 0) return new Decimal(0);

        let total = new Decimal(0);

        codeList.forEach(codePrefix => {
            // A. 期初余额：只加末级
            const leafSubjects = rawSubjects.filter(s => {
                if (!s || !s.code) return false;
                const sCode = String(s.code);
                if (sCode !== codePrefix && !sCode.startsWith(codePrefix)) return false;
                const isParent = rawSubjects.some(child => 
                    child && child.code && String(child.code) !== sCode && String(child.code).startsWith(sCode)
                );
                return !isParent;
            });

            leafSubjects.forEach(s => {
                let b = new Decimal(s.initialBalance || 0);
                if (s.direction === '贷') b = b.negated();
                total = total.plus(b);
            });

            // B. 凭证发生额
            let voucherSum = new Decimal(0);
            activeVouchers.forEach(v => {
                if (v.voucherDate <= dateLimit) {
                    v.lines.forEach((l: any) => {
                        if (l.subjectCode && String(l.subjectCode).startsWith(codePrefix)) {
                            const d = new Decimal(l.debitAmount || 0);
                            const c = new Decimal(l.creditAmount || 0);
                            voucherSum = voucherSum.plus(d).minus(c); 
                        }
                    });
                }
            });
            total = total.plus(voucherSum);
        });

        return total; 
    };

    const processLines = (lines: BalanceSheetLine[], type: 'asset' | 'liability') => {
        const map = new Map<number, { periodEnd: number; yearBegin: number }>();
        
        lines.forEach(line => {
            if (line.dynamicCodes) {
                const endRaw = getBalance(line.dynamicCodes, periodEndDate);
                const beginRaw = getBalance(line.dynamicCodes, yearBeginDate);
                
                const end = type === 'asset' ? endRaw : endRaw.negated();
                const begin = type === 'asset' ? beginRaw : beginRaw.negated();

                map.set(line.rowNumber, { periodEnd: end.toNumber(), yearBegin: begin.toNumber() });
            }
        });

        lines.forEach(line => {
            if (line.formula) {
                const res = evalFormula(line.formula, map);
                map.set(line.rowNumber, res);
            }
        });
        return map;
    };

    const newAssetData = processLines(mappedAssetLines, 'asset');
    const newLiabilityData = processLines(mappedLiabilityLines, 'liability');

    setAssetData(newAssetData);
    setLiabilityData(newLiabilityData);

    const totalAssets = newAssetData.get(23)?.periodEnd || 0;
    const totalLiabEquity = newLiabilityData.get(23)?.periodEnd || 0;
    
    setBalanceStatus({
        isBalanced: Math.abs(totalAssets - totalLiabEquity) < 0.01,
        diff: totalAssets - totalLiabEquity
    });
    console.timeEnd("ReportCalculation");
  };

  const evalFormula = (formula: string, dataMap: Map<number, { periodEnd: number; yearBegin: number }>) => {
    let endVal = new Decimal(0);
    let beginVal = new Decimal(0);

    let currentFormula = formula;
    const sumMatch = currentFormula.match(/sum\((\d+)-(\d+)\)/);
    
    if (sumMatch) {
        const start = parseInt(sumMatch[1]);
        const end = parseInt(sumMatch[2]);
        for (let i = start; i <= end; i++) {
            const d = dataMap.get(i);
            if (d) {
                endVal = endVal.plus(d.periodEnd);
                beginVal = beginVal.plus(d.yearBegin);
            }
        }
        currentFormula = currentFormula.replace(sumMatch[0], '');
    }

    if (!currentFormula.trim()) {
         return { periodEnd: endVal.toNumber(), yearBegin: beginVal.toNumber() };
    }

    const parts = currentFormula.match(/([+\-]?)(\d+)/g);

    if (parts) {
        parts.forEach(part => {
            let op = '+';
            let numStr = part;

            if (part.startsWith('+') || part.startsWith('-')) {
                op = part.charAt(0);
                numStr = part.substring(1);
            }

            const row = parseInt(numStr);
            const d = dataMap.get(row);

            if (d) {
                if (op === '+') {
                    endVal = endVal.plus(d.periodEnd);
                    beginVal = beginVal.plus(d.yearBegin);
                } else {
                    endVal = endVal.minus(d.periodEnd);
                    beginVal = beginVal.minus(d.yearBegin);
                }
            }
        });
    }

    return { periodEnd: endVal.toNumber(), yearBegin: beginVal.toNumber() };
  };

  const formatMoney = (val: number | undefined) => {
    if (val === undefined || val === 0) return '-';
    return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleExport = () => {
    if (!assetData || !liabilityData) return;
    const headerTitle = [["资产负债表"]];
    const headerInfo = [[`报表期间: ${currentPeriod}`, "", "", "", "", "", "", `单位: 元`]];
    const tableHeader = [["资产", "行次", "期末余额", "年初余额", "负债和所有者权益", "行次", "期末余额", "年初余额"]];
    const maxRows = Math.max(mappedAssetLines.length, mappedLiabilityLines.length);
    const bodyData = [];
    for (let i = 0; i < maxRows; i++) {
        const left = mappedAssetLines[i];
        const right = mappedLiabilityLines[i];
        const leftVal = left ? assetData.get(left.rowNumber) : null;
        const rightVal = right ? liabilityData.get(right.rowNumber) : null;
        bodyData.push([
            left ? left.itemName : "", left ? left.rowNumber : "", leftVal?.periodEnd || 0, leftVal?.yearBegin || 0,
            right ? right.itemName : "", right ? right.rowNumber : "", rightVal?.periodEnd || 0, rightVal?.yearBegin || 0
        ]);
    }
    const ws = XLSX.utils.aoa_to_sheet([...headerTitle, ...headerInfo, ...tableHeader, ...bodyData]);
    if(!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } });
    ws['!cols'] = [{ wch: 25 }, { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 5 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "资产负债表");
    XLSX.writeFile(wb, `资产负债表_${currentPeriod}.xlsx`);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">资产负债表</h1>
            <p className="text-gray-500 text-sm mt-1">反映企业在特定日期（{currentPeriod}月末）的财务状况</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
            <div className="flex items-center space-x-2 mr-4 border-r pr-4">
                <Switch id="include-draft" checked={includeDraft} onCheckedChange={setIncludeDraft} className="data-[state=checked]:bg-blue-600"/>
                <Label htmlFor="include-draft" className="text-sm text-gray-600 cursor-pointer flex items-center gap-1">
                    {includeDraft ? <Eye className="w-3 h-3"/> : <EyeOff className="w-3 h-3"/>}
                    包含未过账
                </Label>
            </div>
            <Label className="whitespace-nowrap ml-2">报表期间</Label>
            <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-[140px] h-9 border-none bg-gray-50 focus:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({length: 12}, (_, i) => <SelectItem key={i} value={`2025-${String(i+1).padStart(2,'0')}`}>2025年{i+1}月</SelectItem>)}</SelectContent>
            </Select>
            <div className="h-4 w-[1px] bg-gray-200 mx-2"/>
            <Button variant="ghost" size="sm" onClick={fetchRawData} disabled={isLoading} className="h-8 w-8 p-0"><RefreshCw className={`w-4 h-4 ${isLoading?'animate-spin':''}`}/></Button>
            <Button variant="ghost" size="sm" onClick={handleExport} className="text-gray-600 hover:text-blue-600 flex gap-2 px-2" title="导出为 Excel"><Download className="w-4 h-4"/> 导出 Excel</Button>
        </div>
      </div>

      {balanceStatus && (
          <div className={`p-4 rounded-lg border flex items-center justify-between ${balanceStatus.isBalanced ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-center gap-3">
                  {balanceStatus.isBalanced ? <CheckCircle2 className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                  <span className="font-semibold">{balanceStatus.isBalanced ? '资产负债表平衡校验通过' : '警告：资产负债表不平衡'}</span>
              </div>
              {!balanceStatus.isBalanced && <div className="font-mono text-sm bg-white/50 px-3 py-1 rounded">差额: {formatMoney(balanceStatus.diff)}</div>}
          </div>
      )}

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div>
                <div className="bg-gray-50/80 p-3 text-center font-semibold text-gray-700 border-b text-sm sticky top-0">资 产</div>
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40%] pl-6">项目</TableHead>
                            <TableHead className="w-[10%] text-center">行次</TableHead>
                            <TableHead className="text-right">期末余额</TableHead>
                            <TableHead className="text-right pr-6">年初余额</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mappedAssetLines.map(line => {
                            const d = assetData.get(line.rowNumber);
                            if (line.isHeader) return <TableRow key={line.rowNumber} className="bg-white hover:bg-white"><TableCell colSpan={4} className="font-bold text-gray-800 pt-6 pb-2 pl-6">{line.itemName}</TableCell></TableRow>;
                            return <TableRow key={line.rowNumber} className={line.isTotal ? 'bg-yellow-50/50 font-bold hover:bg-yellow-50' : 'hover:bg-gray-50'}><TableCell className={`pl-6 ${line.isTotal ? 'text-gray-900' : 'text-gray-600'}`}>{line.itemName}</TableCell><TableCell className="text-center text-gray-400 text-xs font-mono">{line.rowNumber}</TableCell><TableCell className="text-right font-mono text-gray-900">{formatMoney(d?.periodEnd)}</TableCell><TableCell className="text-right font-mono text-gray-500 pr-6">{formatMoney(d?.yearBegin)}</TableCell></TableRow>;
                        })}
                    </TableBody>
                </Table>
            </div>
            <div>
                <div className="bg-gray-50/80 p-3 text-center font-semibold text-gray-700 border-b text-sm sticky top-0">负债和所有者权益</div>
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[40%] pl-6">项目</TableHead>
                            <TableHead className="w-[10%] text-center">行次</TableHead>
                            <TableHead className="text-right">期末余额</TableHead>
                            <TableHead className="text-right pr-6">年初余额</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {mappedLiabilityLines.map(line => {
                            const d = liabilityData.get(line.rowNumber);
                            if (line.isHeader) return <TableRow key={line.rowNumber} className="bg-white hover:bg-white"><TableCell colSpan={4} className="font-bold text-gray-800 pt-6 pb-2 pl-6">{line.itemName}</TableCell></TableRow>;
                            return <TableRow key={line.rowNumber} className={line.isTotal ? 'bg-yellow-50/50 font-bold hover:bg-yellow-50' : 'hover:bg-gray-50'}><TableCell className={`pl-6 ${line.isTotal ? 'text-gray-900' : 'text-gray-600'}`}>{line.itemName}</TableCell><TableCell className="text-center text-gray-400 text-xs font-mono">{line.rowNumber}</TableCell><TableCell className="text-right font-mono text-gray-900">{formatMoney(d?.periodEnd)}</TableCell><TableCell className="text-right font-mono text-gray-500 pr-6">{formatMoney(d?.yearBegin)}</TableCell></TableRow>;
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
      </div>
    </div>
  );
}