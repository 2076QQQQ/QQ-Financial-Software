import { useState, useEffect, Fragment, useMemo } from 'react';
// 移除 react-router-dom，改用 next/router
import { useRouter } from 'next/router';
import * as XLSX from 'xlsx';
import { ChevronDown, ChevronRight, Loader2, Search, Download } from 'lucide-react';
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
// ✅ 引入 getAccountBooks 用于获取账套启用日期
import { getAllSubjects, getGeneralLedgerReport, getAccountBooks } from '@/lib/mockData';

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
  isExpanded?: boolean;
  children?: SubjectSummary[];
}

export default function GeneralLedger() {
  const router = useRouter();
  const { bookId } = router.query;
  // 确保拿到字符串格式 ID
  const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true); 
  const [allSubjectsList, setAllSubjectsList] = useState<any[]>([]);
  const [ledgerTreeData, setLedgerTreeData] = useState<SubjectSummary[]>([]);

  // ✅ 新增：可用的会计期间列表
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);

  const [queryConditions, setQueryConditions] = useState({
    periodFrom: '', // 初始为空，等待加载账套信息后填充
    periodTo: '',
    subjectFrom: '', 
    subjectTo: '',
    levelFrom: 1,
    levelTo: 3
  });

  // 1. 核心修复：加载账套信息 + 生成动态日期列表 + 加载科目
  useEffect(() => {
    if (!router.isReady || !currentBookId) return;

    const initPageData = async () => {
      setDataLoading(true);
      try {
        // Parallel Request: 获取科目 + 获取账套信息
        const [subs, books] = await Promise.all([
            getAllSubjects(currentBookId),
            getAccountBooks() // 这里通常获取所有账套，然后我们在下面 find
        ]);

        // A. 处理账套日期逻辑
        const currentBook = (books || []).find((b: any) => b.id === currentBookId);
        if (currentBook) {
            const startPeriod = currentBook.period_start; // e.g. "2025-12"
            const generatedPeriods = generatePeriodList(startPeriod); // 生成从启用日到现在的列表
            setAvailablePeriods(generatedPeriods);

            // 设置默认查询期间
            // 默认查：当前期间。如果当前期间还没到，就查启用期间。
            const now = new Date();
            const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // 确保 defaultPeriod 在有效范围内
            let defaultPeriod = currentMonthStr;
            if (currentMonthStr < startPeriod) defaultPeriod = startPeriod;
            
            // 如果生成的列表里没有当前月份（比如是未来的），就取列表最后一个
            if (!generatedPeriods.includes(defaultPeriod) && generatedPeriods.length > 0) {
                defaultPeriod = generatedPeriods[generatedPeriods.length - 1];
            }

            setQueryConditions(prev => ({
                ...prev,
                periodFrom: defaultPeriod,
                periodTo: defaultPeriod
            }));
        }

        // B. 处理科目逻辑
        if (Array.isArray(subs) && subs.length > 0) {
          // 1. 过滤掉脏数据（解决空白行问题）
          // 2. 仅保留一级科目（解决总账选择逻辑问题，通常一级科目代码长度为4）
          const validSubjects = subs.filter((s: any) => 
              s && 
              s.code && 
              s.name && 
              (s.level === 1 || String(s.code).length === 4) // ★ 强制只显示一级科目
          );

          const sorted = validSubjects.sort((a: any, b: any) => {
             return String(a.code).localeCompare(String(b.code));
          });
          
          setAllSubjectsList(sorted);
          
          // 给下拉框赋默认值
          if (sorted.length > 0) {
              setQueryConditions(prev => ({
                ...prev,
                subjectFrom: sorted[0].code,
                subjectTo: sorted[sorted.length - 1].code
              }));
          }
        }

      } catch (e) { 
        console.error("页面数据加载失败", e); 
      } finally {
        setDataLoading(false);
      }
    };

    initPageData();
  }, [router.isReady, currentBookId]);
  // ✅ 辅助函数：生成日期列表 (从 startPeriod 到 当前日期)
  const generatePeriodList = (startStr: string) => {
     if (!startStr) return [];
     const periods = [];
     
     // 解析启用日期
     const [startYear, startMonth] = startStr.split('-').map(Number);
     
     // 获取当前日期
     const now = new Date();
     const endYear = now.getFullYear();
     const endMonth = now.getMonth() + 1;

     // 循环生成
     let y = startYear;
     let m = startMonth;

     // 逻辑：一直生成到当前月份。如果当前月份小于启用月份（理论不应发生），至少显示启用月份。
     // 也可以改为生成到 "今年年底" 或者 "未来1个月"，这里按 "截止到当前月" 处理
     while (y < endYear || (y === endYear && m <= endMonth)) {
         periods.push(`${y}-${String(m).padStart(2, '0')}`);
         m++;
         if (m > 12) {
             m = 1;
             y++;
         }
     }
     
     // 容错：如果循环没跑（比如本地时间不对），至少把启用日期放进去
     if (periods.length === 0) periods.push(startStr);
     
     // 反转一下，让最近的月份排在前面（可选，看个人喜好，这里不反转保持时间轴顺序）
     return periods;
  };

  const handleQuery = async () => {
    if (!currentBookId) return;

    // 校验
    if (!queryConditions.subjectFrom || !queryConditions.subjectTo) {
      // alert("请等待科目数据加载完成");
      return;
    }

    setLoading(true);
    setLedgerTreeData([]);
    try {
      const conditionsToSend = {
          ...queryConditions,
          subjectTo: queryConditions.subjectTo + '\uFFFF' // 或者用 'z'，'999' 均可
      };
      const rawData = await getGeneralLedgerReport(currentBookId, conditionsToSend);
      const tree = buildSubjectTree(rawData);
      setLedgerTreeData(tree);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const handleExport = () => {
      if (ledgerTreeData.length === 0) {
    alert("没有可导出的数据，请先查询");
    return;
  }

  // 1. 定义表头
  const tableRows = [
    ["科目编码", "科目名称", "项目", "借方金额", "贷方金额", "方向", "余额"]
  ];

  // 2. 递归将树形数据转为平铺的行
  const flattenData = (items: SubjectSummary[]) => {
    items.forEach(item => {
      // A. 期初余额行
      tableRows.push([
        item.code,
        item.name,
        "期初余额",
        "",
        "",
        item.direction,
        item.initialBalance.toFixed(2)
      ]);

      // B. 本期发生行
      tableRows.push([
        "",
        "",
        "本期发生",
        item.periodDebit.toFixed(2),
        item.periodCredit.toFixed(2),
        "",
        item.periodBalance.toFixed(2)
      ]);

      // C. 本年累计行
      tableRows.push([
        "",
        "",
        "本年累计",
        item.yearDebit.toFixed(2),
        item.yearCredit.toFixed(2),
        "",
        item.yearBalance.toFixed(2)
      ]);

      // D. 如果有子级，递归处理
      if (item.children && item.children.length > 0) {
        flattenData(item.children);
      }
    });
  };

  flattenData(ledgerTreeData);

  // 3. 创建工作簿和工作表
  const ws = XLSX.utils.aoa_to_sheet(tableRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "总分类账");

  // 4. 设置列宽 (可选)
  ws['!cols'] = [
    { wch: 15 }, // 科目编码
    { wch: 25 }, // 科目名称
    { wch: 12 }, // 项目
    { wch: 15 }, // 借方
    { wch: 15 }, // 贷方
    { wch: 8 },  // 方向
    { wch: 15 }, // 余额
  ];

  // 5. 导出文件
  const fileName = `总分类账_${queryConditions.periodFrom}_${queryConditions.periodTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

  // 树构建逻辑...
  const buildSubjectTree = (flatList: SubjectSummary[]) => {
      const map = new Map<string, SubjectSummary>();
      flatList.forEach(item => {
        map.set(item.code, { ...item, isExpanded: true, children: [] });
      });
      const roots: SubjectSummary[] = [];
      flatList.forEach(item => {
          const node = map.get(item.code)!;
          let parentCode = '';
          if (item.code.length > 4) {
             const prefix = item.code.substring(0, item.code.length - 2);
             if (map.has(prefix)) parentCode = prefix;
          }
          if (parentCode && map.has(parentCode)) {
             map.get(parentCode)!.children!.push(node);
          } else {
             roots.push(node);
          }
      });
      return roots;
  };

  const toggleExpand = (code: string) => {
    const toggleInTree = (items: SubjectSummary[]): SubjectSummary[] => {
      return items.map(item => {
        if (item.code === code) return { ...item, isExpanded: !item.isExpanded };
        if (item.children) return { ...item, children: toggleInTree(item.children) };
        return item;
      });
    };
    setLedgerTreeData(toggleInTree(ledgerTreeData));
  };

  const renderSubjectTree = (subject: SubjectSummary, level: number = 0): React.ReactNode => {
    const indent = level * 24;
    return (
      <Fragment key={subject.code}>
        <TableRow className={level === 0 ? "bg-gray-100/80 hover:bg-gray-200" : "hover:bg-gray-50"}>
          <TableCell>
            <div className="flex items-center" style={{ paddingLeft: `${indent}px` }}>
              {subject.children && subject.children.length > 0 ? (
                <button onClick={() => toggleExpand(subject.code)} className="p-1 hover:bg-gray-300 rounded">
                  {subject.isExpanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                </button>
              ) : <div className="w-6"/>}
              <span className="ml-2 font-mono text-gray-900">{subject.code}</span>
              <span className="ml-2 text-gray-700">{subject.name}</span>
            </div>
          </TableCell>
          <TableCell></TableCell>
          <TableCell colSpan={4}></TableCell>
        </TableRow>
        {subject.isExpanded && (
          <>
             {/* 期初 */}
             <TableRow className="border-b-0 text-gray-500">
               <TableCell style={{paddingLeft:`${indent+48}px`}}></TableCell>
               <TableCell>期初余额</TableCell>
               <TableCell className="text-right">-</TableCell>
               <TableCell className="text-right">-</TableCell>
               <TableCell className="text-center">{subject.direction}</TableCell>
               <TableCell className="text-right font-mono">{subject.initialBalance.toFixed(2)}</TableCell>
             </TableRow>
             {/* 本期 */}
             <TableRow className="border-b-0 text-gray-900 font-medium bg-blue-50/30">
               <TableCell style={{paddingLeft:`${indent+48}px`}}></TableCell>
               <TableCell>本期发生</TableCell>
               <TableCell className="text-right font-mono">{subject.periodDebit.toFixed(2)}</TableCell>
               <TableCell className="text-right font-mono">{subject.periodCredit.toFixed(2)}</TableCell>
               <TableCell className="text-center">-</TableCell>
               <TableCell className="text-right font-mono">{subject.periodBalance.toFixed(2)}</TableCell>
             </TableRow>
             {/* 本年 */}
             <TableRow className="border-b text-gray-500">
               <TableCell style={{paddingLeft:`${indent+48}px`}}></TableCell>
               <TableCell>本年累计</TableCell>
               <TableCell className="text-right font-mono">{subject.yearDebit.toFixed(2)}</TableCell>
               <TableCell className="text-right font-mono">{subject.yearCredit.toFixed(2)}</TableCell>
               <TableCell className="text-center">-</TableCell>
               <TableCell className="text-right font-mono">{subject.yearBalance.toFixed(2)}</TableCell>
             </TableRow>
          </>
        )}
        {subject.isExpanded && subject.children && subject.children.map(child => renderSubjectTree(child, level+1))}
      </Fragment>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      <div className="mb-6 flex justify-between items-start">
        <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">总分类账</h1>
        <p className="text-gray-600">按科目汇总显示期初、本期发生、本年累计和期末余额</p>
      </div>
      {/* ✅ 3. 新增导出按钮 */}
      <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" />
            导出Excel
        </Button>
      </div>
      
      {/* 筛选栏 */}
      <div className="bg-white rounded-lg border p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-12 gap-4">
           {/* ✅ 修复：日期选择不再是写死的，而是读取 availablePeriods */}
           <div className="col-span-3 space-y-2">
              <Label>会计期间（起）</Label>
              <Select value={queryConditions.periodFrom} onValueChange={v=>setQueryConditions({...queryConditions, periodFrom:v})}>
                 <SelectTrigger>
                     {/* 增加 Loading 状态显示 */}
                     <SelectValue placeholder={dataLoading ? "加载账套配置..." : "选择期间"} />
                 </SelectTrigger>
                 <SelectContent className="max-h-[300px]">
                   {availablePeriods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                 </SelectContent>
              </Select>
           </div>
           <div className="col-span-3 space-y-2">
              <Label>会计期间（止）</Label>
              <Select value={queryConditions.periodTo} onValueChange={v=>setQueryConditions({...queryConditions, periodTo:v})}>
                 <SelectTrigger>
                     <SelectValue placeholder={dataLoading ? "加载账套配置..." : "选择期间"} />
                 </SelectTrigger>
                 <SelectContent className="max-h-[300px]">
                   {availablePeriods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                 </SelectContent>
              </Select>
           </div>

           {/* 科目选择 */}
           <div className="col-span-3 space-y-2">
              <Label>起始科目</Label>
              <Select 
                 disabled={dataLoading} 
                 value={queryConditions.subjectFrom} 
                 onValueChange={v => setQueryConditions({...queryConditions, subjectFrom: v})}
              >
                 <SelectTrigger className="bg-gray-50">
                    <SelectValue placeholder={dataLoading ? "加载中..." : "选择科目"} />
                 </SelectTrigger>
                 <SelectContent className="max-h-[300px]">
                    {allSubjectsList.map(s => (
                       <SelectItem key={s.code} value={s.code}>
                          <span className="font-mono text-gray-500 mr-2">{s.code}</span>
                          {s.name}
                       </SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>
           
           <div className="col-span-3 space-y-2">
              <Label>结束科目</Label>
              <Select 
                 disabled={dataLoading} 
                 value={queryConditions.subjectTo} 
                 onValueChange={v => setQueryConditions({...queryConditions, subjectTo: v})}
              >
                 <SelectTrigger className="bg-gray-50">
                    <SelectValue placeholder={dataLoading ? "加载中..." : "选择科目"} />
                 </SelectTrigger>
                 <SelectContent className="max-h-[300px]">
                    {allSubjectsList.map(s => (
                       <SelectItem key={s.code} value={s.code}>
                          <span className="font-mono text-gray-500 mr-2">{s.code}</span>
                          {s.name}
                       </SelectItem>
                    ))}
                 </SelectContent>
              </Select>
           </div>
        </div>

        <div className="mt-4 flex justify-end">
           <Button onClick={handleQuery} disabled={loading || dataLoading} className="bg-blue-600 w-24">
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "查询"}
           </Button>
        </div>
      </div>

      {/* 表格区域 */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden min-h-[400px]">
         <Table>
            <TableHeader>
               <TableRow className="bg-gray-50">
                  <TableHead className="w-[300px] pl-8">科目</TableHead>
                  <TableHead className="w-[120px] font-bold text-gray-700">项目</TableHead>
                  <TableHead className="text-right w-[150px] font-bold text-gray-700">借方金额</TableHead>
                  <TableHead className="text-right w-[150px] font-bold text-gray-700">贷方金额</TableHead>
                  <TableHead className="text-center w-[80px] font-bold text-gray-700">方向</TableHead>
                  <TableHead className="text-right w-[150px] font-bold text-gray-700">余额</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {ledgerTreeData.length > 0 ? (
                  ledgerTreeData.map(subject => renderSubjectTree(subject))
               ) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-gray-400">暂无数据，请点击查询</TableCell></TableRow>
               )}
            </TableBody>
         </Table>
      </div>
    </div>
  );
}