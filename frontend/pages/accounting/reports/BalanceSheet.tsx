import { useState, useEffect } from 'react';
import { Printer, Download, AlertCircle } from 'lucide-react';
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
import { getSubjectInitialBalance, getSubjectPeriodBalance } from '@/lib/mockData';     
// 使用原生 BigInt 或 Number 进行高精度计算，避免引入外部库
// 如需更高精度，可后续自行实现或引入轻量级 decimal 实现

// 资产负债表行项目
interface BalanceSheetLine {
  rowNumber: number;
  itemName: string;
  subjectCodes?: string[]; // 关联的科目代码
  formula?: string; // 计算公式（如果是汇总行）
  isTotal?: boolean; // 是否是合计行
}

// 资产项目
const assetLines: BalanceSheetLine[] = [
  { rowNumber: 1, itemName: '流动资产：' },
  { rowNumber: 2, itemName: '货币资金', subjectCodes: ['1001', '1002', '1009'] },
  { rowNumber: 3, itemName: '短期投资', subjectCodes: ['1101'] },
  { rowNumber: 4, itemName: '应收票据', subjectCodes: ['1121'] },
  { rowNumber: 5, itemName: '应收账款', subjectCodes: ['1122'] },
  { rowNumber: 6, itemName: '预付账款', subjectCodes: ['1123'] },
  { rowNumber: 7, itemName: '应收股利', subjectCodes: ['1131'] },
  { rowNumber: 8, itemName: '应收利息', subjectCodes: ['1132'] },
  { rowNumber: 9, itemName: '其他应收款', subjectCodes: ['1221'] },
  { rowNumber: 10, itemName: '存货', subjectCodes: ['1401', '1402', '1403', '1404', '1405', '1406', '1407', '1408', '1411', '1421'] },
  { rowNumber: 11, itemName: '其他流动资产', subjectCodes: ['1501'] },
  { rowNumber: 12, itemName: '流动资产合计', formula: 'sum(2-11)', isTotal: true },
  { rowNumber: 13, itemName: '非流动资产：' },
  { rowNumber: 14, itemName: '长期债券投资', subjectCodes: ['1503'] },
  { rowNumber: 15, itemName: '长期股权投资', subjectCodes: ['1511'] },
  { rowNumber: 16, itemName: '固定资产原价', subjectCodes: ['1601'] },
  { rowNumber: 17, itemName: '减：累计折旧', subjectCodes: ['1602'] },
  { rowNumber: 18, itemName: '固定资产净值', formula: '16-17' },
  { rowNumber: 19, itemName: '在建工程', subjectCodes: ['1604'] },
  { rowNumber: 20, itemName: '工程物资', subjectCodes: ['1605'] },
  { rowNumber: 21, itemName: '固定资产清理', subjectCodes: ['1606'] },
  { rowNumber: 22, itemName: '无形资产', subjectCodes: ['1701'] },
  { rowNumber: 23, itemName: '长期待摊费用', subjectCodes: ['1801'] },
  { rowNumber: 24, itemName: '非流动资产合计', formula: 'sum(14-23)', isTotal: true },
  { rowNumber: 25, itemName: '资产总计', formula: '12+24', isTotal: true },
];

// 负债及所有者权益项目
const liabilityEquityLines: BalanceSheetLine[] = [
  { rowNumber: 1, itemName: '流动负债：' },
  { rowNumber: 2, itemName: '短期借款', subjectCodes: ['2001'] },
  { rowNumber: 3, itemName: '应付票据', subjectCodes: ['2201'] },
  { rowNumber: 4, itemName: '应付账款', subjectCodes: ['2202'] },
  { rowNumber: 5, itemName: '预收账款', subjectCodes: ['2203'] },
  { rowNumber: 6, itemName: '应付职工薪酬', subjectCodes: ['2211'] },
  { rowNumber: 7, itemName: '应交税费', subjectCodes: ['2221'] },
  { rowNumber: 8, itemName: '应付利息', subjectCodes: ['2231'] },
  { rowNumber: 9, itemName: '应付股利', subjectCodes: ['2232'] },
  { rowNumber: 10, itemName: '其他应付款', subjectCodes: ['2241'] },
  { rowNumber: 11, itemName: '其他流动负债', subjectCodes: ['2501'] },
  { rowNumber: 12, itemName: '流动负债合计', formula: 'sum(2-11)', isTotal: true },
  { rowNumber: 13, itemName: '非流动负债：' },
  { rowNumber: 14, itemName: '长期借款', subjectCodes: ['2701'] },
  { rowNumber: 15, itemName: '长期应付款', subjectCodes: ['2702'] },
  { rowNumber: 16, itemName: '非流动负债合计', formula: 'sum(14-15)', isTotal: true },
  { rowNumber: 17, itemName: '负债合计', formula: '12+16', isTotal: true },
  { rowNumber: 18, itemName: '所有者权益（或股东权益）：' },
  { rowNumber: 19, itemName: '实收资本（或股本）', subjectCodes: ['4001'] },
  { rowNumber: 20, itemName: '资本公积', subjectCodes: ['4002'] },
  { rowNumber: 21, itemName: '盈余公积', subjectCodes: ['4101'] },
  { rowNumber: 22, itemName: '未分配利润', subjectCodes: ['4103'] },
  { rowNumber: 23, itemName: '所有者权益合计', formula: 'sum(19-22)', isTotal: true },
  { rowNumber: 24, itemName: '负债和所有者权益总计', formula: '17+23', isTotal: true },
];

export default function BalanceSheet() {
  // 当前会计期间
  const [currentPeriod, setCurrentPeriod] = useState('2025-04');
  
  // 报表数据
  const [assetData, setAssetData] = useState<Map<number, { periodEnd: number; yearBegin: number }>>(new Map());
  const [liabilityEquityData, setLiabilityEquityData] = useState<Map<number, { periodEnd: number; yearBegin: number }>>(new Map());
  
  // 平衡校验
  const [isBalanced, setIsBalanced] = useState(true);
  const [balanceError, setBalanceError] = useState('');
  
  // 加载报表数据
  useEffect(() => {
    loadBalanceSheet();
  }, [currentPeriod]);
  
  // 加载资产负债表数据
  const loadBalanceSheet = () => {
    const year = currentPeriod.split('-')[0];
    const yearBeginPeriod = `${year}-01`;
    
    // 计算资产侧数据
    const assetMap = new Map<number, { periodEnd: number; yearBegin: number }>();
    
    assetLines.forEach(line => {
      if (line.subjectCodes && line.subjectCodes.length > 0) {
        // 明细行：汇总所有科目余额
        let periodEndTotal = 0;
        let yearBeginTotal = new Decimal(0);
        
        line.subjectCodes.forEach(code => {
          // 期末余额（来自UC16总分类账）
          const periodBalance = getSubjectPeriodBalance(code, currentPeriod);
          // 资产类科目：借方余额为正
          periodEndTotal = periodEndTotal.plus(periodBalance.balance);
          
          // 年初余额（来自UC04期初数据录入）
          const initialBalance = getSubjectInitialBalance(code);
          yearBeginTotal = yearBeginTotal.plus(initialBalance.debitBalance - initialBalance.creditBalance);
        });
        
        assetMap.set(line.rowNumber, {
          periodEnd: periodEndTotal.toNumber(),
          yearBegin: yearBeginTotal.toNumber()
        });
      } else if (line.formula) {
        // 汇总行：根据公式计算
        const calculated = calculateFormula(line.formula, assetMap);
        assetMap.set(line.rowNumber, calculated);
      }
    });
    
    // 计算负债及所有者权益侧数据
    const liabilityEquityMap = new Map<number, { periodEnd: number; yearBegin: number }>();
    
    liabilityEquityLines.forEach(line => {
      if (line.subjectCodes && line.subjectCodes.length > 0) {
        // 明细行：汇总所有科目余额
        let periodEndTotal = new Decimal(0);
        let yearBeginTotal = new Decimal(0);
        
        line.subjectCodes.forEach(code => {
          // 期末余额（来自UC16总分类账）
          const periodBalance = getSubjectPeriodBalance(code, currentPeriod);
          // 负债及所有者权益类科目：贷方余额为正
          periodEndTotal = periodEndTotal.plus(periodBalance.balance);
          
          // 年初余额（来自UC04期初数据录入）
          const initialBalance = getSubjectInitialBalance(code);
          yearBeginTotal = yearBeginTotal.plus(initialBalance.creditBalance - initialBalance.debitBalance);
        });
        
        liabilityEquityMap.set(line.rowNumber, {
          periodEnd: periodEndTotal.toNumber(),
          yearBegin: yearBeginTotal.toNumber()
        });
      } else if (line.formula) {
        // 汇总行：根据公式计算
        const calculated = calculateFormula(line.formula, liabilityEquityMap);
        liabilityEquityMap.set(line.rowNumber, calculated);
      }
    });
    
    setAssetData(assetMap);
    setLiabilityEquityData(liabilityEquityMap);
    
    // UC18 BR5：平衡校验（资产总计 == 负债和所有者权益总计）
    const assetTotal = assetMap.get(25); // 资产总计
    const liabilityEquityTotal = liabilityEquityMap.get(24); // 负债和所有者权益总计
    
    if (assetTotal && liabilityEquityTotal) {
      const isEqual = Math.abs(assetTotal.periodEnd - liabilityEquityTotal.periodEnd) < 0.01;
      setIsBalanced(isEqual);
      
      if (!isEqual) {
        const diff = new Decimal(assetTotal.periodEnd).minus(liabilityEquityTotal.periodEnd).toFixed(2);
        setBalanceError(`期末余额不平衡，差额：¥${diff}元`);
      }
    }
  };
  
  // 计算公式
  const calculateFormula = (
    formula: string, 
    dataMap: Map<number, { periodEnd: number; yearBegin: number }>
  ): { periodEnd: number; yearBegin: number } => {
    let periodEndResult = new Decimal(0);
    let yearBeginResult = new Decimal(0);
    
    if (formula.includes('sum')) {
      // 求和公式：sum(2-11)
      const match = formula.match(/sum\((\d+)-(\d+)\)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]);
        
        for (let i = start; i <= end; i++) {
          const data = dataMap.get(i);
          if (data) {
            periodEndResult = periodEndResult.plus(data.periodEnd);
            yearBeginResult = yearBeginResult.plus(data.yearBegin);
          }
        }
      }
    } else if (formula.includes('+') || formula.includes('-')) {
      // 加减公式：12+24 或 16-17
      const parts = formula.split(/([+\-])/);
      let currentOp = '+';
      
      parts.forEach(part => {
        if (part === '+' || part === '-') {
          currentOp = part;
        } else {
          const rowNum = parseInt(part);
          const data = dataMap.get(rowNum);
          if (data) {
            if (currentOp === '+') {
              periodEndResult = periodEndResult.plus(data.periodEnd);
              yearBeginResult = yearBeginResult.plus(data.yearBegin);
            } else {
              periodEndResult = periodEndResult.minus(data.periodEnd);
              yearBeginResult = yearBeginResult.minus(data.yearBegin);
            }
          }
        }
      });
    }
    
    return {
      periodEnd: periodEndResult.toNumber(),
      yearBegin: yearBeginResult.toNumber()
    };
  };
  
  // 钻取到总分类账（UC18 QR2）
  const handleDrillDown = (line: BalanceSheetLine, column: 'periodEnd' | 'yearBegin') => {
    if (!line.subjectCodes || line.subjectCodes.length === 0) return;
    
    const period = column === 'periodEnd' ? currentPeriod : currentPeriod.split('-')[0] + '-01';
    alert(
      `跳转到总分类账（UC16）\n\n` +
      `项目：${line.itemName}\n` +
      `科目：${line.subjectCodes.join(', ')}\n` +
      `期间：${period}\n\n` +
      `（实际应用中会自动跳转并传递查询参数）`
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
    return `¥ ${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">资产负债表</h1>
        <p className="text-gray-600">
          反映企业在某一特定日期的财务状况
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
      
      {/* 报表主体 - 双栏布局 */}
      <div className="bg-white rounded-lg border">
        <div className="grid grid-cols-2 gap-0">
          {/* 左侧：资产 */}
          <div className="border-r">
            <div className="border-b bg-gray-50 p-4">
              <h3 className="text-center">资产</h3>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">项目</TableHead>
                  <TableHead className="w-[80px] text-center">行次</TableHead>
                  <TableHead className="text-right">期末余额</TableHead>
                  <TableHead className="text-right">年初余额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetLines.map(line => {
                  const data = assetData.get(line.rowNumber);
                  const isHeader = !line.subjectCodes && !line.formula;
                  const isClickable = line.subjectCodes && line.subjectCodes.length > 0;
                  
                  return (
                    <TableRow 
                      key={line.rowNumber}
                      className={line.isTotal ? 'bg-blue-50' : ''}
                    >
                      <TableCell className={isHeader ? 'font-medium' : ''}>
                        {line.itemName}
                      </TableCell>
                      <TableCell className="text-center text-gray-500">
                        {line.rowNumber}
                      </TableCell>
                      <TableCell className="text-right">
                        {isClickable && data?.periodEnd ? (
                          <a
                            href="#"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDrillDown(line, 'periodEnd');
                            }}
                          >
                            {formatAmount(data.periodEnd)}
                          </a>
                        ) : (
                          <span className={line.isTotal ? 'font-medium' : ''}>
                            {formatAmount(data?.periodEnd)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isClickable && data?.yearBegin ? (
                          <a
                            href="#"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDrillDown(line, 'yearBegin');
                            }}
                          >
                            {formatAmount(data.yearBegin)}
                          </a>
                        ) : (
                          <span className={line.isTotal ? 'font-medium' : ''}>
                            {formatAmount(data?.yearBegin)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* 右侧：负债和所有者权益 */}
          <div>
            <div className="border-b bg-gray-50 p-4">
              <h3 className="text-center">负债和所有者权益</h3>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">项目</TableHead>
                  <TableHead className="w-[80px] text-center">行次</TableHead>
                  <TableHead className="text-right">期末余额</TableHead>
                  <TableHead className="text-right">年初余额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liabilityEquityLines.map(line => {
                  const data = liabilityEquityData.get(line.rowNumber);
                  const isHeader = !line.subjectCodes && !line.formula;
                  const isClickable = line.subjectCodes && line.subjectCodes.length > 0;
                  
                  return (
                    <TableRow 
                      key={line.rowNumber}
                      className={line.isTotal ? 'bg-blue-50' : ''}
                    >
                      <TableCell className={isHeader ? 'font-medium' : ''}>
                        {line.itemName}
                      </TableCell>
                      <TableCell className="text-center text-gray-500">
                        {line.rowNumber}
                      </TableCell>
                      <TableCell className="text-right">
                        {isClickable && data?.periodEnd ? (
                          <a
                            href="#"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDrillDown(line, 'periodEnd');
                            }}
                          >
                            {formatAmount(data.periodEnd)}
                          </a>
                        ) : (
                          <span className={line.isTotal ? 'font-medium' : ''}>
                            {formatAmount(data?.periodEnd)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isClickable && data?.yearBegin ? (
                          <a
                            href="#"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDrillDown(line, 'yearBegin');
                            }}
                          >
                            {formatAmount(data.yearBegin)}
                          </a>
                        ) : (
                          <span className={line.isTotal ? 'font-medium' : ''}>
                            {formatAmount(data?.yearBegin)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      
      {/* 底部说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-2">💡 数据说明（UC18业财一体化逻辑）</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li><span className="font-medium">年初余额</span>：数据来源于 UC04（期初数据录入）</li>
            <li><span className="font-medium">期末余额</span>：数据来源于 UC16（总分类账），自动累加本期发生额</li>
            <li><span className="font-medium">平衡校验</span>：系统自动验证"资产总计 == 负债和所有者权益总计"</li>
            <li><span className="font-medium">钻取功能</span>：点击任意金额可跳转到总分类账查看明细</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
