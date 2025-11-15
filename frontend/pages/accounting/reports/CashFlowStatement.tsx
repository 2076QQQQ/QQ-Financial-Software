import { useState, useEffect } from 'react';
import { Printer, Download, Settings, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';        
import { getCashFlowByCategory, getYearCashFlow, getMoneyFundBalance } from '@/lib/mockData';
import Decimal from 'decimal.js';

// 现金流量表行项目
interface CashFlowLine {
  rowNumber: number;
  itemName: string;
  categoryNames?: string[]; // 关联的收支类别名称（从UC10获取，在UC11中标记）
  formula?: string; // 计算公式（如果是汇总行）
  isTotal?: boolean; // 是否是合计行
  isSpecial?: boolean; // 是否是特殊行（期初/期末）
  isNegative?: boolean; // 是否取负值（支出项）
}

// 现金流量表项目（使用辅助核算法 - UC20 BR5强制要求）
const cashFlowLines: CashFlowLine[] = [
  { rowNumber: 1, itemName: '一、经营活动产生的现金流量：' },
  { rowNumber: 2, itemName: '销售商品、提供劳务收到的现金', categoryNames: ['销售回款', '服务收入'] },
  { rowNumber: 3, itemName: '收到的税费返还', categoryNames: ['税费返还'] },
  { rowNumber: 4, itemName: '收到其他与经营活动有关的现金', categoryNames: ['其他经营收入'] },
  { rowNumber: 5, itemName: '经营活动现金流入小计', formula: 'sum(2-4)', isTotal: true },
  { rowNumber: 6, itemName: '购买商品、接受劳务支付的现金', categoryNames: ['采购付款', '服务采购'], isNegative: true },
  { rowNumber: 7, itemName: '支付给职工以及为职工支付的现金', categoryNames: ['工资薪酬'], isNegative: true },
  { rowNumber: 8, itemName: '支付的各项税费', categoryNames: ['税费缴纳'], isNegative: true },
  { rowNumber: 9, itemName: '支付其他与经营活动有关的现金', categoryNames: ['其他经营支出'], isNegative: true },
  { rowNumber: 10, itemName: '经营活动现金流出小计', formula: 'sum(6-9)', isTotal: true },
  { rowNumber: 11, itemName: '经营活动产生的现金流量净额', formula: '5+10', isTotal: true },
  { rowNumber: 12, itemName: '二、投资活动产生的现金流量：' },
  { rowNumber: 13, itemName: '收回投资收到的现金', categoryNames: ['投资收回'] },
  { rowNumber: 14, itemName: '取得投资收益收到的现金', categoryNames: ['投资收益'] },
  { rowNumber: 15, itemName: '处置固定资产、无形资产和其他长期资产收回的现金净额', categoryNames: ['资产处置'] },
  { rowNumber: 16, itemName: '投资活动现金流入小计', formula: 'sum(13-15)', isTotal: true },
  { rowNumber: 17, itemName: '购建固定资产、无形资产和其他长期资产支付的现金', categoryNames: ['资产购置'], isNegative: true },
  { rowNumber: 18, itemName: '投资支付的现金', categoryNames: ['对外投资'], isNegative: true },
  { rowNumber: 19, itemName: '投资活动现金流出小计', formula: 'sum(17-18)', isTotal: true },
  { rowNumber: 20, itemName: '投资活动产生的现金流量净额', formula: '16+19', isTotal: true },
  { rowNumber: 21, itemName: '三、筹资活动产生的现金流量：' },
  { rowNumber: 22, itemName: '吸收投资收到的现金', categoryNames: ['股东投资'] },
  { rowNumber: 23, itemName: '取得借款收到的现金', categoryNames: ['借款收入'] },
  { rowNumber: 24, itemName: '筹资活动现金流入小计', formula: 'sum(22-23)', isTotal: true },
  { rowNumber: 25, itemName: '偿还债务支付的现金', categoryNames: ['还款支出'], isNegative: true },
  { rowNumber: 26, itemName: '分配股利、利润或偿付利息支付的现金', categoryNames: ['利息支出', '股利分配'], isNegative: true },
  { rowNumber: 27, itemName: '筹资活动现金流出小计', formula: 'sum(25-26)', isTotal: true },
  { rowNumber: 28, itemName: '筹资活动产生的现金流量净额', formula: '24+27', isTotal: true },
  { rowNumber: 29, itemName: '四、汇率变动对现金及现金等价物的影响', categoryNames: ['汇兑损益'] },
  { rowNumber: 30, itemName: '五、现金及现金等价物净增加额', formula: '11+20+28+29', isTotal: true },
  { rowNumber: 31, itemName: '加：期初现金及现金等价物余额', isSpecial: true },
  { rowNumber: 32, itemName: '六、期末现金及现金等价物余额', formula: '30+31', isTotal: true, isSpecial: true },
];

export default function CashFlowStatement() {
  // 当前会计期间
  const [currentPeriod, setCurrentPeriod] = useState('2025-04');
  
  // 报表数据
  const [cashFlowData, setCashFlowData] = useState<Map<number, { currentPeriod: number; currentYear: number }>>(new Map());
  
  // 平衡校验
  const [isBalanced, setIsBalanced] = useState(true);
  const [balanceError, setBalanceError] = useState('');
  
  // 加载报表数据
  useEffect(() => {
    loadCashFlowStatement();
  }, [currentPeriod]);
  
  // 加载现金流量表数据
  const loadCashFlowStatement = () => {
    const year = currentPeriod.split('-')[0];
    
    // UC20 BR1：唯一数据源是UC11（出纳日记账）
    const periodCashFlow = getCashFlowByCategory(currentPeriod);
    const yearCashFlow = getYearCashFlow(year);
    
    // UC20 BR2 & BR3：期初/期末余额来自UC16（总分类账的货币资金科目）
    const fundBalance = getMoneyFundBalance(currentPeriod);
    
    // 计算现金流量表数据
    const dataMap = new Map<number, { currentPeriod: number; currentYear: number }>();
    
    cashFlowLines.forEach(line => {
      if (line.categoryNames && line.categoryNames.length > 0) {
        // 明细行：从UC11出纳日记账汇总（按UC10设置的关联现金流分组）
        let periodTotal = new Decimal(0);
        let yearTotal = new Decimal(0);
        
        line.categoryNames.forEach(categoryName => {
          const periodData = periodCashFlow.get(categoryName);
          const yearData = yearCashFlow.get(categoryName);
          
          if (periodData) {
            // 收入项：取income；支出项：取expense并取负
            if (line.isNegative) {
              periodTotal = periodTotal.minus(periodData.expense);
            } else {
              periodTotal = periodTotal.plus(periodData.income);
            }
          }
          
          if (yearData) {
            if (line.isNegative) {
              yearTotal = yearTotal.minus(yearData.expense);
            } else {
              yearTotal = yearTotal.plus(yearData.income);
            }
          }
        });
        
        dataMap.set(line.rowNumber, {
          currentPeriod: periodTotal.toNumber(),
          currentYear: yearTotal.toNumber()
        });
      } else if (line.isSpecial) {
        // 特殊行：期初/期末余额
        if (line.rowNumber === 31) {
          // 期初现金余额
          dataMap.set(line.rowNumber, {
            currentPeriod: fundBalance.totalInitial,
            currentYear: fundBalance.totalInitial
          });
        } else if (line.rowNumber === 32) {
          // 期末现金余额（会在公式计算中覆盖，这里先设置实际值用于校验）
          dataMap.set(line.rowNumber, {
            currentPeriod: fundBalance.totalPeriodEnd,
            currentYear: fundBalance.totalPeriodEnd
          });
        }
      } else if (line.formula) {
        // 汇总行：根据公式计算
        const calculated = calculateFormula(line.formula, dataMap);
        dataMap.set(line.rowNumber, calculated);
      }
    });
    
    setCashFlowData(dataMap);
    
    // UC20 BR4：平衡校验（净增加额 + 期初 == 期末）
    const netIncrease = dataMap.get(30); // 现金净增加额
    const periodBegin = dataMap.get(31); // 期初余额
    const periodEnd = dataMap.get(32); // 期末余额（从公式计算）
    const actualPeriodEnd = fundBalance.totalPeriodEnd; // 实际期末余额（从UC16读取）
    
    if (netIncrease && periodBegin && periodEnd) {
      const calculatedEnd = new Decimal(netIncrease.currentPeriod).plus(periodBegin.currentPeriod).toNumber();
      const isEqual = Math.abs(calculatedEnd - actualPeriodEnd) < 0.01;
      setIsBalanced(isEqual);
      
      if (!isEqual) {
        const diff = new Decimal(calculatedEnd).minus(actualPeriodEnd).toFixed(2);
        setBalanceError(`计算期末 ¥${calculatedEnd.toFixed(2)} ≠ 实际期末 ¥${actualPeriodEnd.toFixed(2)}，差额：¥${diff}元`);
      }
    }
  };
  
  // 计算公式
  const calculateFormula = (
    formula: string, 
    dataMap: Map<number, { currentPeriod: number; currentYear: number }>
  ): { currentPeriod: number; currentYear: number } => {
    let periodResult = new Decimal(0);
    let yearResult = new Decimal(0);
    
    if (formula.includes('sum')) {
      // 求和公式：sum(2-4)
      const match = formula.match(/sum\((\d+)-(\d+)\)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        
        for (let i = start; i <= end; i++) {
          const data = dataMap.get(i);
          if (data) {
            periodResult = periodResult.plus(data.currentPeriod);
            yearResult = yearResult.plus(data.currentYear);
          }
        }
      }
    } else if (formula.includes('+') || formula.includes('-')) {
      // 加减公式：11+20+28+29 或 30+31
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
    }
    
    return {
      currentPeriod: periodResult.toNumber(),
      currentYear: yearResult.toNumber()
    };
  };
  
  // 钻取到出纳日记账（UC20 QR2）
  const handleDrillDown = (line: CashFlowLine, column: 'currentPeriod' | 'currentYear') => {
    if (!line.categoryNames || line.categoryNames.length === 0) return;
    
    const period = column === 'currentPeriod' ? currentPeriod : `${currentPeriod.split('-')[0]}年全年`;
    
    alert(
      `跳转到出纳日记账（UC11）\n\n` +
      `项目：${line.itemName}\n` +
      `收支类别：${line.categoryNames.join(', ')}\n` +
      `期间：${period}\n\n` +
      `系统会自动筛选出所有关联现金流标签为"${line.categoryNames[0]}"的流水明细\n` +
      `（实际应用中会自动跳转并传递查询参数）`
    );
  };
  
  // 设置期初余额
  const handleSetInitial = () => {
    alert(
      '设置期初现金余额\n\n' +
      '跳转到 UC09（资金账户管理）或 UC04（期初数据录入）\n' +
      '修改货币资金科目（1001库存现金、1002银行存款）的期初余额'
    );
  };
  
  // 打印
  const handlePrint = () => {
    window.print();
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
        <h1 className="text-gray-900 mb-1">现金流量表</h1>
        <p className="text-gray-600">
          反映企业在一定会计期间现金和现金等价物流入和流出的情况（辅助核算法）
        </p>
      </div>
      
      {/* 顶部操作栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSetInitial}>
              <Settings className="w-4 h-4 mr-2" />
              期初
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              打印
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
          </div>
        </div>
      </div>
      
      {/* 平衡校验错误提示 */}
      {!isBalanced && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            严重错误：报表试算不平衡！{balanceError}
          </AlertDescription>
        </Alert>
      )}
      
      {/* 编制方法说明 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <div className="text-amber-600 mt-0.5">ℹ️</div>
          <div className="text-sm text-amber-900">
            <span className="font-medium">编制方法：辅助核算法</span> - 
            本报表所有发生额数据均来源于 <span className="font-medium">UC11（出纳日记账）</span>，
            按 <span className="font-medium">UC10（收支类别管理）</span> 中设置的"关联现金流"标签自动分组统计。
            MVP版本已移除"公式法"选项（UC20 BR5）。
          </div>
        </div>
      </div>
      
      {/* 报表主体 - 单栏布局 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">项目</TableHead>
              <TableHead className="w-[80px] text-center">行次</TableHead>
              <TableHead className="text-right">本年累计金额</TableHead>
              <TableHead className="text-right">本期金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashFlowLines.map(line => {
              const data = cashFlowData.get(line.rowNumber);
              const isHeader = !line.categoryNames && !line.formula && !line.isSpecial;
              const isClickable = line.categoryNames && line.categoryNames.length > 0;
              
              return (
                <TableRow 
                  key={line.rowNumber}
                  className={
                    line.isTotal && !line.isSpecial 
                      ? 'bg-blue-50' 
                      : line.rowNumber === 32 
                      ? 'bg-green-50' 
                      : line.rowNumber === 31
                      ? 'bg-gray-50'
                      : ''
                  }
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      
      {/* 底部说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 数据说明（UC20业财一体化逻辑）</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">发生额数据</span>：唯一来源于 UC11（出纳日记账），按UC10设置的"关联现金流"自动分组（UC20 BR1）</li>
            <li><span className="font-medium">期初余额</span>：来源于 UC16（总分类账）的货币资金科目期初余额（UC20 BR2）</li>
            <li><span className="font-medium">期末余额</span>：来源于 UC16（总分类账）的货币资金科目期末余额（UC20 BR3）</li>
            <li><span className="font-medium">平衡校验</span>：系统自动验证"现金净增加额 + 期初余额 == 期末余额"（UC20 BR4）</li>
            <li><span className="font-medium">钻取功能</span>：点击任意发生额可跳转到UC11出纳日记账查看构成该金额的所有流水明细</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
