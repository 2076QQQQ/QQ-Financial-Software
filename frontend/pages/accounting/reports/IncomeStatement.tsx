import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
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
import { getSubjectPeriodAmount, getSubjectYearTotal } from '@/lib/mockData';       
import Decimal from 'decimal.js';

// 利润表行项目
interface IncomeStatementLine {
  rowNumber: number;
  itemName: string;
  subjectCodes?: string[]; // 关联的科目代码
  formula?: string; // 计算公式（如果是汇总行）
  isTotal?: boolean; // 是否是合计行
  isRevenue?: boolean; // 是否是收入类（贷方发生额）
}

// 利润表项目
const incomeLines: IncomeStatementLine[] = [
  { rowNumber: 1, itemName: '一、营业收入', subjectCodes: ['6001', '6011', '6021', '6041', '6051', '6061'], isRevenue: true },
  { rowNumber: 2, itemName: '减：营业成本', subjectCodes: ['6401', '6402', '6403'] },
  { rowNumber: 3, itemName: '税金及附加', subjectCodes: ['6405'] },
  { rowNumber: 4, itemName: '销售费用', subjectCodes: ['6601'] },
  { rowNumber: 5, itemName: '管理费用', subjectCodes: ['6602'] },
  { rowNumber: 6, itemName: '研发费用', subjectCodes: ['6603'] },
  { rowNumber: 7, itemName: '财务费用', subjectCodes: ['6603'] },
  { rowNumber: 8, itemName: '其中：利息费用', subjectCodes: [] },
  { rowNumber: 9, itemName: '利息收入', subjectCodes: [] },
  { rowNumber: 10, itemName: '加：其他收益', subjectCodes: ['6051'] },
  { rowNumber: 11, itemName: '投资收益（损失以"-"号填列）', subjectCodes: ['6111'] },
  { rowNumber: 12, itemName: '公允价值变动收益（损失以"-"号填列）', subjectCodes: ['6301'] },
  { rowNumber: 13, itemName: '信用减值损失（损失以"-"号填列）', subjectCodes: ['6701'] },
  { rowNumber: 14, itemName: '资产减值损失（损失以"-"号填列）', subjectCodes: ['6702'] },
  { rowNumber: 15, itemName: '资产处置收益（损失以"-"号填列）', subjectCodes: ['6711'] },
  { rowNumber: 16, itemName: '二、营业利润（亏损以"-"号填列）', formula: '1-2-3-4-5-6-7+10+11+12+13+14+15', isTotal: true },
  { rowNumber: 17, itemName: '加：营业外收入', subjectCodes: ['6801'] },
  { rowNumber: 18, itemName: '减：营业外支出', subjectCodes: ['6841'] },
  { rowNumber: 19, itemName: '三、利润总额（亏损总额以"-"号填列）', formula: '16+17-18', isTotal: true },
  { rowNumber: 20, itemName: '减：所得税费用', subjectCodes: ['6901'] },
  { rowNumber: 21, itemName: '四、净利润（净亏损以"-"号填列）', formula: '19-20', isTotal: true },
];

export default function IncomeStatement() {
  // 当前会计期间
  const [currentPeriod, setCurrentPeriod] = useState('2025-04');
  
  // 是否显示上年累计金额
  const [showLastYear, setShowLastYear] = useState(false);
  
  // 报表数据
  const [incomeData, setIncomeData] = useState<Map<number, { currentPeriod: number; currentYear: number }>>(new Map());
  
  // 加载报表数据
  useEffect(() => {
    loadIncomeStatement();
  }, [currentPeriod]);
  
  // 加载利润表数据
  const loadIncomeStatement = () => {
    const year = currentPeriod.split('-')[0];
    
    // 计算利润表数据
    const dataMap = new Map<number, { currentPeriod: number; currentYear: number }>();
    
    incomeLines.forEach(line => {
      if (line.subjectCodes && line.subjectCodes.length > 0) {
        // 明细行：汇总所有科目发生额
        let periodTotal = new Decimal(0);
        let yearTotal = new Decimal(0);
        
        line.subjectCodes.forEach(code => {
          // 本期金额（来自UC08凭证汇总）
          const periodAmount = getSubjectPeriodAmount(code, currentPeriod);
          
          // 本年累计金额（来自UC16总分类账）
          const yearAmount = getSubjectYearTotal(code, year);
          
          // 收入类科目：贷方发生额 - 借方发生额
          // 费用类科目：借方发生额 - 贷方发生额
          if (line.isRevenue) {
            periodTotal = periodTotal.plus(periodAmount.creditTotal - periodAmount.debitTotal);
            yearTotal = yearTotal.plus(yearAmount.creditTotal - yearAmount.debitTotal);
          } else {
            periodTotal = periodTotal.plus(periodAmount.debitTotal - periodAmount.creditTotal);
            yearTotal = yearTotal.plus(yearAmount.debitTotal - yearAmount.creditTotal);
          }
        });
        
        dataMap.set(line.rowNumber, {
          currentPeriod: periodTotal.toNumber(),
          currentYear: yearTotal.toNumber()
        });
      } else if (line.formula) {
        // 汇总行：根据公式计算（UC19 BR5）
        const calculated = calculateFormula(line.formula, dataMap);
        dataMap.set(line.rowNumber, calculated);
      }
    });
    
    setIncomeData(dataMap);
  };
  
  // 计算公式
  const calculateFormula = (
    formula: string, 
    dataMap: Map<number, { currentPeriod: number; currentYear: number }>
  ): { currentPeriod: number; currentYear: number } => {
    let periodResult = new Decimal(0);
    let yearResult = new Decimal(0);
    
    // 解析公式：1-2-3-4-5-6-7+10+11+12+13+14+15
    const parts = formula.split(/([+\-])/);
    let currentOp = '+';
    
    parts.forEach(part => {
      if (part === '+' || part === '-') {
        currentOp = part;
      } else if (part.trim()) {
        const rowNum = parseInt(part);
        const data = dataMap.get(rowNum);
        if (data) {
          if (currentOp === '+') {
            periodResult = periodResult.plus(data.currentPeriod);
            yearResult = yearResult.plus(data.currentYear);
          } else {
            periodResult = periodResult.minus(data.currentPeriod);
            yearResult = yearResult.minus(data.currentYear);
          }
        }
      }
    });
    
    return {
      currentPeriod: periodResult.toNumber(),
      currentYear: yearResult.toNumber()
    };
  };
  
  // 钻取到明细分类账或总分类账（UC19 QR2）
  const handleDrillDown = (line: IncomeStatementLine, column: 'currentPeriod' | 'currentYear') => {
    if (!line.subjectCodes || line.subjectCodes.length === 0) return;
    
    const targetModule = column === 'currentPeriod' ? 'UC15（明细分类账）' : 'UC16（总分类账）';
    const period = column === 'currentPeriod' ? currentPeriod : `${currentPeriod.split('-')[0]}年全年`;
    
    alert(
      `跳转到${targetModule}\n\n` +
      `项目：${line.itemName}\n` +
      `科目：${line.subjectCodes.join(', ')}\n` +
      `期间：${period}\n\n` +
      `（实际应用中会自动跳转并传递查询参数）`
    );
  };
  
  // 导出Excel
  const handleExport = () => {
    alert('导出Excel功能（MVP版本）\n\n实际应用中会调用后端API生成.xlsx文件');
  };
  
  // 格式化金额
  const formatAmount = (amount: number | undefined) => {
    if (!amount || amount === 0) return '-';
    
    // 负数显示红色并加括号
    if (amount < 0) {
      return (
        <span className="text-red-600">
          ({Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
        </span>
      );
    }
    
    return `${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">利润表</h1>
        <p className="text-gray-600">
          反映企业在一定会计期间的经营成果
        </p>
      </div>
      
      {/* 顶部操作栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>会计期间</Label>
              <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-[180px]">
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
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="showLastYear" 
                checked={showLastYear}
                onCheckedChange={(checked) => setShowLastYear(checked as boolean)}
              />
              <Label htmlFor="showLastYear" className="cursor-pointer">
                显示上年累计金额
              </Label>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
          </div>
        </div>
      </div>
      
      {/* 报表主体 - 单栏布局 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">项目</TableHead>
              <TableHead className="w-[80px] text-center">行次</TableHead>
              <TableHead className="text-right">本年累计金额</TableHead>
              <TableHead className="text-right">本期金额</TableHead>
              {showLastYear && (
                <TableHead className="text-right">上年累计金额</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {incomeLines.map(line => {
              const data = incomeData.get(line.rowNumber);
              const isHeader = !line.subjectCodes && !line.formula;
              const isClickable = line.subjectCodes && line.subjectCodes.length > 0;
              
              return (
                <TableRow 
                  key={line.rowNumber}
                  className={line.isTotal ? 'bg-yellow-50' : ''}
                >
                  <TableCell className={isHeader ? 'font-medium' : ''}>
                    {line.itemName}
                  </TableCell>
                  <TableCell className="text-center text-gray-500">
                    {line.rowNumber}
                  </TableCell>
                  <TableCell className="text-right">
                    {isClickable && data?.currentYear ? (
                      <a
                        href="#"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDrillDown(line, 'currentYear');
                        }}
                      >
                        {formatAmount(data.currentYear)}
                      </a>
                    ) : (
                      <span className={line.isTotal ? 'font-medium' : ''}>
                        {formatAmount(data?.currentYear)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isClickable && data?.currentPeriod ? (
                      <a
                        href="#"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          handleDrillDown(line, 'currentPeriod');
                        }}
                      >
                        {formatAmount(data.currentPeriod)}
                      </a>
                    ) : (
                      <span className={line.isTotal ? 'font-medium' : ''}>
                        {formatAmount(data?.currentPeriod)}
                      </span>
                    )}
                  </TableCell>
                  {showLastYear && (
                    <TableCell className="text-right text-gray-400">
                      -
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* 底部说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 数据说明（UC19业财一体化逻辑）</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">本期金额</span>：数据来源于 UC08（记账凭证汇总），仅统计当前期间</li>
            <li><span className="font-medium">本年累计金额</span>：数据来源于 UC16（总分类账），统计年初至当前期间</li>
            <li><span className="font-medium">汇总计算</span>：营业利润、利润总额、净利润等由系统自动计算（UC19 BR5）</li>
            <li><span className="font-medium">钻取功能</span>：点击本期金额跳转至明细分类账，点击年累计跳转至总分类账</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
