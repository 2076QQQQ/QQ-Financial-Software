import { useState, useEffect } from 'react';
import { Search, Download, X } from 'lucide-react';
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
import { getAllVouchers } from '@/lib/mockData';

// 科目汇总数据
interface SubjectSummary {
  subjectCode: string;
  subjectName: string;
  debitAmount: number;
  creditAmount: number;
  voucherDate: string; // 凭证日期
  voucherNumber: string; // 凭证号
}

export default function VoucherSummary() {
  const [allData, setAllData] = useState<SubjectSummary[]>([]);

  // 从全局凭证数据中提取科目汇总数据
  useEffect(() => {
    const vouchers = getAllVouchers();
    const summaryItems: SubjectSummary[] = [];
    
    vouchers.forEach(voucher => {
      voucher.lines.forEach((line: any) => {
        // 借方金额
        if (line.debitAmount && parseFloat(line.debitAmount) > 0) {
          summaryItems.push({
            subjectCode: line.subjectCode,
            subjectName: line.subjectName,
            debitAmount: parseFloat(line.debitAmount),
            creditAmount: 0,
            voucherDate: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber
          });
        }
        // 贷方金额
        if (line.creditAmount && parseFloat(line.creditAmount) > 0) {
          summaryItems.push({
            subjectCode: line.subjectCode,
            subjectName: line.subjectName,
            debitAmount: 0,
            creditAmount: parseFloat(line.creditAmount),
            voucherDate: voucher.voucherDate,
            voucherNumber: voucher.voucherNumber
          });
        }
      });
    });
    
    setAllData(summaryItems);
  }, []);
  const [summaryData, setSummaryData] = useState<SubjectSummary[]>([]);

  // 账套建立日期（假设为2025-01-01）
  const accountBookStartDate = '2025-01-01';
  const today = new Date().toISOString().split('T')[0];
  
  // 筛选条件 - 初始为空，显示所有凭证
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    voucherFrom: '',
    voucherTo: ''
  });

  // 计算总计
  const totalDebit = summaryData.reduce((sum, item) => sum + item.debitAmount, 0);
  const totalCredit = summaryData.reduce((sum, item) => sum + item.creditAmount, 0);

  // 钻取到明细账
  const handleDrillDown = (subjectCode: string) => {
    // TODO: 跳转到UC15明细分类账，传入科目和日期范围
    console.log('钻取到明细账：', subjectCode, filters.dateFrom, filters.dateTo);
  };

  // 查询筛选功能
  const handleQuery = () => {
    console.log('🔍 查询条件:', filters);
    
    // 筛选数据
    let filtered = allData.filter(item => {
      // 日期筛选
      if (filters.dateFrom && item.voucherDate < filters.dateFrom) {
        return false;
      }
      if (filters.dateTo && item.voucherDate > filters.dateTo) {
        return false;
      }
      
      // 凭证号筛选
      if (filters.voucherFrom && item.voucherNumber < filters.voucherFrom) {
        return false;
      }
      if (filters.voucherTo && item.voucherNumber > filters.voucherTo) {
        return false;
      }
      
      return true;
    });
    
    console.log('筛选后数据:', filtered);
    
    // 按科目汇总
    const summary: { [key: string]: SubjectSummary } = {};
    
    filtered.forEach(item => {
      const key = item.subjectCode;
      if (!summary[key]) {
        summary[key] = {
          subjectCode: item.subjectCode,
          subjectName: item.subjectName,
          debitAmount: 0,
          creditAmount: 0,
          voucherDate: item.voucherDate,
          voucherNumber: item.voucherNumber
        };
      }
      summary[key].debitAmount += item.debitAmount;
      summary[key].creditAmount += item.creditAmount;
    });
    
    const summaryArray = Object.values(summary);
    console.log('汇总后数据:', summaryArray);
    
    setSummaryData(summaryArray);
  };

  // 导出为Word（使用HTML格式）
  const handleExport = () => {
    // 创建HTML内容
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>凭证汇总表</title>
          <style>
            body { font-family: '微软雅黑', Arial, sans-serif; }
            h1 { text-align: center; font-size: 24px; margin-bottom: 10px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 20px; }
            .info { text-align: center; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid black; padding: 8px; text-align: left; }
            th { background-color: #E0E0E0; font-weight: bold; text-align: center; }
            td.number { text-align: right; }
            td.center { text-align: center; }
            .footer { background-color: #E0E0E0; font-weight: bold; }
            .balance { color: green; font-weight: bold; }
            .unbalance { color: red; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>凭证汇总表</h1>
          <div class="subtitle">按科目汇总凭证借贷金额</div>
          <div class="info">查询期间：${filters.dateFrom || '所有日期'} 至 ${filters.dateTo || '所有日期'}</div>
          <div class="info">借方合计：¥ ${totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="info">贷方合计：¥ ${totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div class="info ${totalDebit === totalCredit ? 'balance' : 'unbalance'}">
            ${totalDebit === totalCredit 
              ? '✓ 借贷平衡' 
              : `⚠️ 借贷不平衡（差额：¥${Math.abs(totalDebit - totalCredit).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}）`
            }
          </div>
          <table>
            <thead>
              <tr>
                <th>科目编码</th>
                <th>科目名称</th>
                <th>借方金额</th>
                <th>贷方金额</th>
              </tr>
            </thead>
            <tbody>
              ${summaryData.map(item => `
                <tr>
                  <td class="center">${item.subjectCode}</td>
                  <td>${item.subjectName}</td>
                  <td class="number">${item.debitAmount > 0 ? item.debitAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                  <td class="number">${item.creditAmount > 0 ? item.creditAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="footer">
                <td colspan="2" class="center">合计</td>
                <td class="number ${totalDebit === totalCredit ? 'balance' : 'unbalance'}">¥ ${totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td class="number ${totalDebit === totalCredit ? 'balance' : 'unbalance'}">¥ ${totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `;

    // 创建Blob并下载
    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '凭证汇总表.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[1400px] mx-auto">{/* 增加最大宽度容器 */}
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">凭证汇总表</h1>
        <p className="text-gray-600">
          按科目汇总凭证借贷金额
        </p>
      </div>

      {/* 筛选和操作区 */}
      <div className="bg-white rounded-lg border p-4 mb-4">
        {/* 筛选区 */}
        <div className="grid grid-cols-12 gap-3 mb-4">
          <div className="col-span-2 space-y-2">
            <Label>日期区间（起）</Label>
            <div className="relative">
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                min={accountBookStartDate}
                max={today}
                placeholder="所有日期"
              />
              {filters.dateFrom && (
                <button
                  onClick={() => setFilters({ ...filters, dateFrom: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>日期区间（止）</Label>
            <div className="relative">
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                min={accountBookStartDate}
                max={today}
                placeholder="所有日期"
              />
              {filters.dateTo && (
                <button
                  onClick={() => setFilters({ ...filters, dateTo: '' })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>凭证号（起）</Label>
            <Input
              placeholder="如：001"
              value={filters.voucherFrom}
              onChange={(e) => setFilters({ ...filters, voucherFrom: e.target.value })}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>凭证号（止）</Label>
            <Input
              placeholder="如：100"
              value={filters.voucherTo}
              onChange={(e) => setFilters({ ...filters, voucherTo: e.target.value })}
            />
          </div>
          <div className="col-span-4 space-y-2">
            <Label className="invisible">操作</Label>
            <div className="flex items-center gap-2">
              <Button className="flex-1" onClick={handleQuery}>
                <Search className="w-4 h-4 mr-2" />
                查询
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </div>
          </div>
        </div>

        {/* 统计信息栏 */}
        <div className="pt-3 border-t space-y-2">
          <div className="text-sm text-gray-600">
            查询期间：<span className="font-medium text-gray-900">
              {filters.dateFrom || '所有日期'} 至 {filters.dateTo || '所有日期'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-gray-600">借方合计：</span>
              <span className={`font-semibold ml-2 text-lg ${
                totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'
              }`}>
                ¥ {totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">贷方合计：</span>
              <span className={`font-semibold ml-2 text-lg ${
                totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'
              }`}>
                ¥ {totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {totalDebit === totalCredit ? (
              <div className="text-sm text-green-600 font-medium">
                ✓ 借贷平衡
              </div>
            ) : (
              <div className="text-sm text-red-600 font-medium">
                ⚠️ 借贷不平衡（差额：¥{Math.abs(totalDebit - totalCredit).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}）
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 汇总表格 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px]">科目编码</TableHead>
              <TableHead>科目名称</TableHead>
              <TableHead className="text-right w-[200px]">借方金额</TableHead>
              <TableHead className="text-right w-[200px]">贷方金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              summaryData.map((item) => (
                <TableRow key={item.subjectCode} className="hover:bg-gray-50">
                  <TableCell>
                    <button
                      onClick={() => handleDrillDown(item.subjectCode)}
                      className="text-blue-600 hover:text-blue-700 hover:underline font-medium"
                    >
                      {item.subjectCode}
                    </button>
                  </TableCell>
                  <TableCell className="text-gray-900">{item.subjectName}</TableCell>
                  <TableCell className="text-right font-medium">
                    {item.debitAmount > 0
                      ? item.debitAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {item.creditAmount > 0
                      ? item.creditAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-gray-50">
              <TableCell colSpan={2} className="font-medium">合计</TableCell>
              <TableCell className={`text-right font-medium text-lg ${
                totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'
              }`}>
                ¥ {totalDebit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
              <TableCell className={`text-right font-medium text-lg ${
                totalDebit === totalCredit ? 'text-green-600' : 'text-red-600'
              }`}>
                ¥ {totalCredit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* 说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-sm text-blue-900">
          <div className="font-medium mb-1">💡 使用说明</div>
          <ul className="list-disc list-inside space-y-1 text-blue-800">
            <li>只汇总<span className="font-medium">已审核</span>的凭证</li>
            <li>点击科目编码可以<span className="font-medium">钻取</span>到明细分类账查看详细分录</li>
            <li>借方合计必须严格等于贷方合计</li>
            <li>支持按日期区间和凭证号范围筛选</li>
          </ul>
        </div>
      </div>
    </div>
  );
}