import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Filter, Loader2, Search, Download } from 'lucide-react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { getDetailedLedgerReport, getAllSubjects } from '@/lib/mockData';
import * as XLSX from 'xlsx';

const inputStyle = "bg-gray-100/80 border-transparent focus:border-blue-500 focus:bg-white transition-all";

// 1. 定义新接口：单行流水
interface DetailedLedgerRow {
  date: string;
  voucherCode: string;
  voucherId: string;
  summary: string;
  debit: number;
  credit: number;
  direction: '借' | '贷';
  balance: number;
}

// 2. 定义新接口：单个科目的完整账页数据
interface SubjectLedgerData {
  subjectCode: string;
  subjectName: string;
  direction: '借' | '贷';
  initialBalance: number;
  rows: DetailedLedgerRow[];
  periodTotalDebit: number;
  periodTotalCredit: number;
  yearTotalDebit: number;
  yearTotalCredit: number;
}

interface Subject {
  code: string;
  name: string;
  level?: number;
  direction?: string;
  codeStr?: string;
  accountBookId?: string; // ★ 新增字段定义
}

export default function DetailedLedger() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = (Array.isArray(bookId) ? bookId[0] : bookId) || '';

  const [loading, setLoading] = useState(false);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  
  // 核心修复：更强壮的末级科目筛选逻辑
  const leafSubjects = useMemo(() => {
    if (!allSubjects.length) return [];
    
    const normalizedSubjects = allSubjects.map(s => ({
      ...s,
      codeStr: String(s.code).trim() 
    }));

    const leaves = normalizedSubjects.filter(current => {
       const isParent = normalizedSubjects.some(other => {
          if (other.codeStr === current.codeStr) return false; 
          return other.codeStr.startsWith(current.codeStr);
       });
       return !isParent; 
    });

    return leaves.sort((a, b) => a.codeStr.localeCompare(b.codeStr));
  }, [allSubjects]);

  const [currentPeriod, setCurrentPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [currentSubject, setCurrentSubject] = useState('');

  // 状态变更：这里存的是“科目账页数组”
  const [ledgerReports, setLedgerReports] = useState<SubjectLedgerData[]>([]);

  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    periodFrom: currentPeriod,
    periodTo: currentPeriod,
    subjectFrom: '',
    subjectTo: '',
    onlyLeaf: true, 
  });

  // 初始化数据加载
  useEffect(() => {
    if (!router.isReady || !currentBookId) return;
    
    const init = async () => {
      try {
        const data: any[] = await getAllSubjects(currentBookId);
        if (Array.isArray(data)) {
          // ★★★ 核心修复：前端强制过滤，只保留属于当前账套的科目 ★★★
          // 这能防止用户在下拉框里看到其他账套的资金账户（对应的科目）
          const validSubjects = data.filter((s: any) => s.accountBookId === currentBookId);
          
          const sorted = validSubjects.sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));
          setAllSubjects(sorted);
        }
      } catch (error) {
        console.error("加载科目失败", error);
      }
    };
    init();
  }, [router.isReady, currentBookId]); 

  // 自动选中第一个末级科目 
  useEffect(() => {
    if (leafSubjects.length > 0) {
       const exists = leafSubjects.find(s => String(s.code) === String(currentSubject));
       
       if (!currentSubject || !exists) {
         const firstLeaf = leafSubjects[0].code;
         setCurrentSubject(firstLeaf);
         
         setAdvancedFilters(prev => ({
           ...prev,
           subjectFrom: firstLeaf,
           subjectTo: firstLeaf
         }));
       }
    }
  }, [leafSubjects, currentSubject]);

  // 查询逻辑
  const handleQuery = async (useAdvanced = false) => {
    if (!currentBookId) return;

    let pFrom = currentPeriod;
    let pTo = currentPeriod;
    let sCodeFrom = currentSubject;
    let sCodeTo = currentSubject;

    if (useAdvanced) {
      pFrom = advancedFilters.periodFrom;
      pTo = advancedFilters.periodTo;
      sCodeFrom = advancedFilters.subjectFrom;
      sCodeTo = advancedFilters.subjectTo;
      
      // 同步回简易筛选栏
      if (sCodeFrom === sCodeTo && pFrom === pTo) {
         setCurrentPeriod(pFrom); 
         setCurrentSubject(sCodeFrom);
      }
    }

    if (!sCodeFrom) return;

    setLoading(true);
    setLedgerReports([]); // 先清空，避免显示旧数据

    try {
      // 这里的 data 现在是一个数组：SubjectLedgerData[]
      const data: any = await getDetailedLedgerReport(
          currentBookId as string, 
          sCodeFrom, 
          pTo, 
          pFrom, 
          sCodeTo
      );
      
      if (Array.isArray(data)) {
          setLedgerReports(data);
      } else {
          setLedgerReports([]);
      }
      
      setShowFilterDialog(false);
    } catch (error) {
      console.error("查询失败", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (ledgerReports.length === 0) {
      alert("没有可导出的数据，请先查询");
      return;
    }

    // 1. 定义表头
    const rows: (string | number)[][] = [
      ["日期", "凭证字号", "摘要", "借方金额", "贷方金额", "方向", "余额"]
    ];

    // 2. 遍历每个科目的账页数据
    ledgerReports.forEach((report) => {
      // A. 插入科目分隔标题行
      rows.push([`${report.subjectCode} ${report.subjectName}`, "", "", "", "", "", ""]);

      // B. 期初余额行
      rows.push([
        "", 
        "", 
        "期初余额", 
        0, 
        0, 
        report.initialBalance === 0 ? "平" : report.direction, 
        Math.abs(report.initialBalance)
      ]);

      // C. 业务流水行
      report.rows.forEach((line) => {
        rows.push([
          line.date,
          line.voucherCode,
          line.summary,
          line.debit || 0,
          line.credit || 0,
          line.balance === 0 ? "平" : line.direction,
          Math.abs(line.balance)
        ]);
      });

      // D. 本期合计
      rows.push([
        "",
        "",
        "本期合计",
        report.periodTotalDebit,
        report.periodTotalCredit,
        "-",
        "-"
      ]);

      // E. 本年累计
      rows.push([
        "",
        "",
        "本年累计",
        report.yearTotalDebit,
        report.yearTotalCredit,
        "-",
        "-"
      ]);

      // F. 空一行作为科目间的间隔
      rows.push(["", "", "", "", "", "", ""]);
    });

    // 3. 生成工作表
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // 4. 设置列宽
    const colWidths = [
      { wch: 12 }, // 日期
      { wch: 15 }, // 凭证字号
      { wch: 30 }, // 摘要
      { wch: 15 }, // 借方
      { wch: 15 }, // 贷方
      { wch: 8 },  // 方向
      { wch: 15 }, // 余额
    ];
    worksheet['!cols'] = colWidths;

    // 5. 创建工作簿并下载
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "明细分类账");
    
    // 文件名包含期间信息
    const fileName = `明细账_${advancedFilters.periodFrom}_to_${advancedFilters.periodTo}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // 辅助函数：格式化金额（处理0和负数）
  const fmtMoney = (val: number) => {
      if (val === 0 || val === undefined) return '-';
      return val.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  };

  // 辅助函数：判断显示方向
  const getDisplayDirection = (balance: number, defaultDir: string) => {
      if (balance === 0) return '平';
      return defaultDir; 
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      <div className="mb-6 flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">明细分类账</h1>
            <p className="text-gray-600">按科目分组查看业务流水及余额变动</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" /> 导出Excel
        </Button>
      </div>
      
      {/* 顶部简易筛选栏 */}
      <div className="bg-white rounded-lg border p-4 mb-6 shadow-sm">
        <div className="flex items-end gap-4">
          <div className="space-y-2 w-48">
            <Label className="text-xs text-gray-500 font-medium ml-1">会计期间</Label>
            <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
              <SelectTrigger className={inputStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({length: 12}, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  const val = `2025-${m}`;
                  return <SelectItem key={val} value={val}>2025年{i+1}月</SelectItem>
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2 w-64">
            <Label className="text-xs text-gray-500 font-medium ml-1">科目 (仅显示末级)</Label>
            <Select value={currentSubject} onValueChange={setCurrentSubject}>
              <SelectTrigger className={inputStyle}>
                  <SelectValue placeholder="选择科目" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {leafSubjects.map(s => (
                  <SelectItem key={s.code} value={s.code}>
                    <span className="font-mono text-gray-500 mr-2">{s.code}</span>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => handleQuery(false)} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              查询
            </Button>
            <Button variant="outline" onClick={() => setShowFilterDialog(true)} className="bg-white">
              <Filter className="w-4 h-4 mr-2" />
              高级筛选
            </Button>
          </div>
        </div>
      </div>
      
      {/* 报表渲染区 */}
      {ledgerReports.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center text-gray-400">
             {loading ? '正在查询...' : '暂无数据，请选择科目进行查询'}
          </div>
      ) : (
          <div className="space-y-8">
             {ledgerReports.map((report) => (
                <div key={report.subjectCode} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    {/* 科目表头卡片 */}
                    <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center">
                        <div>
                            <span className="bg-blue-100 text-blue-800 text-xs font-mono px-2 py-1 rounded mr-2">
                                {report.subjectCode}
                            </span>
                            <span className="font-bold text-gray-800 text-lg">
                                {report.subjectName}
                            </span>
                        </div>
                        <div className="text-sm text-gray-500">
                           余额方向：{report.direction}
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50">
                                <TableHead className="w-[120px]">日期</TableHead>
                                <TableHead className="w-[120px]">凭证字号</TableHead>
                                <TableHead>摘要</TableHead>
                                <TableHead className="text-right w-[140px] text-gray-600">借方金额</TableHead>
                                <TableHead className="text-right w-[140px] text-gray-600">贷方金额</TableHead>
                                <TableHead className="text-center w-[80px]">方向</TableHead>
                                <TableHead className="text-right w-[140px] text-gray-900 font-bold">余额</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* 期初余额 */}
                            <TableRow className="bg-yellow-50/30 hover:bg-yellow-50/50">
                                <TableCell className="text-gray-500 font-medium" colSpan={3}>
                                   &nbsp;&nbsp;期初余额
                                </TableCell>
                                <TableCell className="text-right text-gray-400">-</TableCell>
                                <TableCell className="text-right text-gray-400">-</TableCell>
                                <TableCell className="text-center text-sm text-gray-500">
                                    {getDisplayDirection(report.initialBalance, report.direction)}
                                </TableCell>
                                <TableCell className={`text-right font-mono font-medium ${report.initialBalance < 0 ? 'text-red-600' : ''}`}>
                                    {fmtMoney(Math.abs(report.initialBalance))}
                                </TableCell>
                            </TableRow>

                            {/* 流水 */}
                            {report.rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                                        本期无发生额
                                    </TableCell>
                                </TableRow>
                            ) : (
                                report.rows.map((row, idx) => (
                                    <TableRow key={`${report.subjectCode}-${idx}`} className="hover:bg-gray-50">
                                        <TableCell className="text-gray-600 font-mono text-sm">{row.date}</TableCell>
                                        <TableCell 
                                            className="text-blue-600 cursor-pointer hover:underline font-mono text-sm"
                                            onClick={() => router.push(`/app/${currentBookId}/accounting/vouchers?id=${row.voucherId}`)}
                                        >
                                            {row.voucherCode}
                                        </TableCell>
                                        <TableCell className="text-gray-700">{row.summary}</TableCell>
                                        <TableCell className="text-right font-mono text-gray-600 text-sm">
                                            {fmtMoney(row.debit)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-gray-600 text-sm">
                                            {fmtMoney(row.credit)}
                                        </TableCell>
                                        <TableCell className="text-center text-gray-500 text-xs">
                                            {getDisplayDirection(row.balance, row.direction)}
                                        </TableCell>
                                        <TableCell className={`text-right font-mono text-sm ${row.balance < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                                            {fmtMoney(Math.abs(row.balance))}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}

                            {/* 本期合计 */}
                            <TableRow className="bg-gray-50 border-t-2 border-gray-100 font-medium">
                                <TableCell colSpan={3} className="pl-4 text-gray-700">本期合计</TableCell>
                                <TableCell className="text-right text-gray-900 font-mono">
                                    {fmtMoney(report.periodTotalDebit)}
                                </TableCell>
                                <TableCell className="text-right text-gray-900 font-mono">
                                    {fmtMoney(report.periodTotalCredit)}
                                </TableCell>
                                <TableCell className="text-center text-gray-400">-</TableCell>
                                <TableCell className="text-right text-gray-400">-</TableCell>
                            </TableRow>

                            {/* 本年累计 */}
                            <TableRow className="bg-gray-50 font-medium border-b">
                                <TableCell colSpan={3} className="pl-4 text-gray-700">本年累计</TableCell>
                                <TableCell className="text-right text-gray-900 font-mono">
                                    {fmtMoney(report.yearTotalDebit)}
                                </TableCell>
                                <TableCell className="text-right text-gray-900 font-mono">
                                    {fmtMoney(report.yearTotalCredit)}
                                </TableCell>
                                <TableCell className="text-center text-gray-400">-</TableCell>
                                <TableCell className="text-right text-gray-400">-</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
             ))}
          </div>
      )}

      {/* 高级筛选弹窗 */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>高级筛选</DialogTitle>
            <DialogDescription>批量查询末级科目明细</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-5 py-4">
            <div className="space-y-2">
              <Label>期间（起）</Label>
              <Select value={advancedFilters.periodFrom} onValueChange={(v) => setAdvancedFilters({...advancedFilters, periodFrom: v})}>
                <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => {
                      const val = `2025-${String(i+1).padStart(2,'0')}`;
                      return <SelectItem key={val} value={val}>2025年{i+1}月</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>期间（止）</Label>
              <Select value={advancedFilters.periodTo} onValueChange={(v) => setAdvancedFilters({...advancedFilters, periodTo: v})}>
                <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({length: 12}, (_, i) => {
                      const val = `2025-${String(i+1).padStart(2,'0')}`;
                      return <SelectItem key={val} value={val}>2025年{i+1}月</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>科目（起）</Label>
              <Select value={advancedFilters.subjectFrom} onValueChange={(v) => setAdvancedFilters({...advancedFilters, subjectFrom: v})}>
                <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {leafSubjects.map(s => <SelectItem key={s.code} value={s.code}>{s.code} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>科目（止）</Label>
              <Select value={advancedFilters.subjectTo} onValueChange={(v) => setAdvancedFilters({...advancedFilters, subjectTo: v})}>
                <SelectTrigger className={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {leafSubjects.map(s => <SelectItem key={s.code} value={s.code}>{s.code} {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 mt-2">
              <div className="flex items-center space-x-2 border p-3 rounded-md bg-gray-50">
                <Checkbox 
                  id="c1" 
                  checked={advancedFilters.onlyLeaf}
                  disabled 
                  onCheckedChange={(c) => setAdvancedFilters({...advancedFilters, onlyLeaf: !!c})}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="c1" className="cursor-not-allowed font-medium text-gray-700">
                    仅显示末级科目
                  </Label>
                  <p className="text-sm text-gray-500">
                    系统将自动过滤非末级科目，仅展示具体的业务流水明细
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowFilterDialog(false)}>取消</Button>
            <Button onClick={() => handleQuery(true)}>确认查询</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}