import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Plus, Trash2, Download, Upload, Calendar, Paperclip, Info, Save, Loader2, Check, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/components/ui/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
// 引入 API
import { 
    getEnabledTemplates, 
    addVoucherTemplate, 
    getAllSubjects, 
    getAllAuxiliaryItems, 
    getAccountBooks, 
    type VoucherTemplate 
} from '@/lib/mockData';        
import { toast } from 'sonner';

// --- 类型定义 ---

interface Subject {
  id: string;
  code: string;
  name: string;
  hasAuxiliary: boolean; 
  auxiliaryType?: string; 
}

interface AuxiliaryItem {
  id: string;
  category: string;
  name: string;
  code: string;
}

interface VoucherLine {
  id: string;
  summary: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  requiresAuxiliary?: boolean;
  auxiliaryType?: string; 
  auxiliaryId?: string;   
  auxiliaryName?: string; 
  debitAmount: string;
  creditAmount: string;
  auxiliary?: string;
}

interface VoucherData {
  voucherType: string;
  voucherNumber: string;
  voucherDate: string;
  voucherCode: string;
  attachments: number;
  lines: VoucherLine[];
  debitTotal: number;
  creditTotal: number;
  maker?: string; // 新增：用于判断是否是系统自动生成
  sourceType?: string; // 或者用这个字段，例如 'manual', 'cash_journal', 'internal_transfer'
}

// ✅ 纯组件 Props：完全由父组件控制
interface VoucherEntryProps {
  open: boolean;            
  onClose: () => void;      
  onSave: (data: VoucherData) => void; // 保存逻辑交给父组件
  voucher?: any;            // 编辑模式传入数据
  viewMode?: boolean;       // 查看模式
  forceDate?: string;
}

// 定义常用税率
const TAX_RATES = [
    { label: '13% (基本)', value: 0.13 },
    { label: '9% (交通/建筑)', value: 0.09 },
    { label: '6% (服务)', value: 0.06 },
    { label: '3% (征收率)', value: 0.03 },
    { label: '1% (优惠)', value: 0.01 },
];

export default function VoucherEntry({ open, onClose, voucher, viewMode, onSave,forceDate }: VoucherEntryProps) {
  // --- 状态管理 ---
  const router = useRouter();
  const { bookId } = router.query;
  
  const [formData, setFormData] = useState<VoucherData>({
    voucherDate: forceDate || voucher?.voucherDate || new Date().toISOString().split('T')[0],
    voucherType: '记',
    voucherNumber: '自动生成',
    voucherCode: '',
    attachments: 0,
    lines: [],
    debitTotal: 0,
    creditTotal: 0
  });
  const isSystemGenerated = formData.maker === '系统自动' || formData.sourceType === 'internal_transfer';


  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [allAuxiliaryItems, setAllAuxiliaryItems] = useState<AuxiliaryItem[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  
  const [taxType, setTaxType] = useState<string>('小规模纳税人'); 

  // UI 状态
  const [openSubjectPopover, setOpenSubjectPopover] = useState<string | null>(null);
  const [openAuxPopover, setOpenAuxPopover] = useState<string | null>(null);
  const [openTaxPopover, setOpenTaxPopover] = useState<{lineId: string, field: 'debit' | 'credit'} | null>(null);

  const [showTemplateImport, setShowTemplateImport] = useState(false);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // --- 加载基础数据 ---
  useEffect(() => {
    if (!router.isReady || !bookId || !open) return;
    
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;

    const loadBasics = async () => {
      try {
        const [subjData, auxData, booksData] = await Promise.all([
            getAllSubjects(currentBookId),
            getAllAuxiliaryItems(currentBookId),
            getAccountBooks() 
        ]);

        const activeBook = Array.isArray(booksData) ? booksData.find((b: any) => b.id === currentBookId) : null;
        if (activeBook) {
            setTaxType(activeBook.taxType || '小规模纳税人');
        }

        // 数据清洗
        const allSubjects = Array.isArray(subjData) ? subjData : [];
        
        // 1. 先把所有父级 ID 找出来
        const parentIds = new Set(
            allSubjects
                .map((s: any) => s.parentId)
                .filter(Boolean)
        );

        // 2. 判定末级科目
        const validLeafSubjects = allSubjects.filter((s: any) => {
            // a. 必须是启用状态
            if (!s.isActive) return false;
            
            // b. 关键：在科目表中，没有其他科目的 parentId 指向它
            const hasChildren = s.hasChildren === true || parentIds.has(s.id);
            
            // c. 额外判定：通过代码长度或层级（如果你的数据结构支持）
            // 如果存在下级科目（代码更长且以前缀开头），则不是末级
            const existsDownStream = allSubjects.some((other: any) => 
                other.code !== s.code && String(other.code).startsWith(String(s.code))
            );

            return !hasChildren && !existsDownStream;
        })
        .map((s: any) => ({
            id: s.id, 
            code: s.code, 
            name: s.name,
            hasAuxiliary: s.auxiliaryItems && s.auxiliaryItems.length > 0,
            auxiliaryType: s.auxiliaryItems?.[0] 
        }))
        .sort((a: any, b: any) => String(a.code).localeCompare(String(b.code)));

        setSubjects(validLeafSubjects);
        setAllAuxiliaryItems(Array.isArray(auxData) ? auxData : []);
    } catch (e) {
        console.error("加载基础数据失败", e);
    }
  };
    
    loadBasics();
  }, [open, router.isReady, bookId]); 

  // --- 初始化表单数据 ---
  useEffect(() => {
    if (voucher) {
      setFormData({ ...voucher, lines: voucher.lines.map((l: any) => ({ ...l })) });
    } else if (open) {
      // 仅当 lines 为空时初始化，防止重复重置
      if (!formData.lines || formData.lines.length === 0) {
        setFormData({
            voucherType: '记',
            voucherNumber: '自动生成',
            voucherDate: new Date().toISOString().split('T')[0],
            voucherCode: '',
            attachments: 0,
            lines: [
            { id: `line-${Date.now()}-1`, summary: '', subjectId: '', subjectCode: '', subjectName: '', debitAmount: '', creditAmount: '', requiresAuxiliary: false },
            { id: `line-${Date.now()}-2`, summary: '', subjectId: '', subjectCode: '', subjectName: '', debitAmount: '', creditAmount: '', requiresAuxiliary: false }
            ],
            debitTotal: 0,
            creditTotal: 0
        });
      }
    }
  }, [voucher, open]);

  // --- 计算合计 ---
  useEffect(() => {
    if(!formData.lines) return;
    const debitTotal = formData.lines.reduce((sum, line) => sum + (parseFloat(line.debitAmount) || 0), 0);
    const creditTotal = formData.lines.reduce((sum, line) => sum + (parseFloat(line.creditAmount) || 0), 0);
    setFormData(prev => ({ ...prev, debitTotal, creditTotal }));
  }, [formData.lines]);

  // --- 逻辑方法 ---

  const updateLine = (lineId: string, field: keyof VoucherLine, value: any) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map(line => line.id === lineId ? { ...line, [field]: value } : line)
    }));
  };

  const selectSubject = (lineId: string, subject: Subject) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map(line => {
        if (line.id === lineId) {
            const updatedLine = {
              ...line,
              subjectId: subject.id, subjectCode: subject.code, subjectName: subject.name,
              requiresAuxiliary: subject.hasAuxiliary, auxiliaryType: subject.auxiliaryType,
              auxiliaryId: '', auxiliaryName: ''
            };
            return updatedLine;
        }
        return line;
      })
    }));
    setOpenSubjectPopover(null);
  };

  const selectAuxiliary = (lineId: string, item: AuxiliaryItem) => {
      setFormData(prev => ({
          ...prev,
          lines: prev.lines.map(line => line.id === lineId ? { ...line, auxiliaryId: item.id, auxiliaryName: item.name } : line)
      }));
      setOpenAuxPopover(null);
  };

  const addLine = () => {
    setFormData(prev => ({ ...prev, lines: [...prev.lines, {
      id: `line-${Date.now()}`, summary: '', subjectId: '', subjectCode: '', subjectName: '',
      debitAmount: '', creditAmount: '', requiresAuxiliary: false
    }] }));
  };

  const deleteLine = (lineId: string) => {
    if (formData.lines.length <= 2) return toast.warning('至少需要保留两条分录');
    setFormData(prev => ({ ...prev, lines: prev.lines.filter(line => line.id !== lineId) }));
  };

  const handleSpaceKey = (lineId: string, field: 'debitAmount' | 'creditAmount') => {
    const diff = Math.abs(formData.debitTotal - formData.creditTotal);
    if (diff > 0) updateLine(lineId, field, diff.toFixed(2));
  };

  const handleTabKey = (e: React.KeyboardEvent, lineId: string, field: string, index: number) => {
    if (e.key === 'Tab') {
      if (field === 'creditAmount' && index === formData.lines.length - 1) {
        e.preventDefault();
        addLine();
      }
    }
  };

  const handleCalculateTax = (lineId: string, direction: 'debit' | 'credit', totalAmount: number, rate: number) => {
      const netAmount = totalAmount / (1 + rate);
      const taxAmount = totalAmount - netAmount;
      const targetCodePrefix = direction === 'debit' ? '22210101' : '22210102';
      const vatSubject = subjects.find(s => s.code.startsWith(targetCodePrefix));

      setFormData(prev => {
          const lines = [...prev.lines];
          const currentIndex = lines.findIndex(l => l.id === lineId);
          if (currentIndex === -1) return prev;
          
          const fieldName = direction === 'debit' ? 'debitAmount' : 'creditAmount';
          const updatedLine = { ...lines[currentIndex], [fieldName]: netAmount.toFixed(2) };
          
          const taxLine: VoucherLine = {
              id: `line-${Date.now()}-tax`,
              summary: lines[currentIndex].summary ? `${lines[currentIndex].summary} (税额)` : '税额',
              subjectId: vatSubject ? vatSubject.id : '', subjectCode: vatSubject ? vatSubject.code : '', subjectName: vatSubject ? vatSubject.name : '',
              requiresAuxiliary: false,
              debitAmount: direction === 'debit' ? taxAmount.toFixed(2) : '',
              creditAmount: direction === 'credit' ? taxAmount.toFixed(2) : ''
          };

          lines.splice(currentIndex, 1, updatedLine, taxLine);
          return { ...prev, lines };
      });
      setOpenTaxPopover(null);
      toast.success("价税分离成功");
  };

  const handleSaveAndNew = () => {
    // 校验逻辑
    if (!formData.voucherType || !formData.voucherDate) return toast.error('请填写凭证字和日期');
    if (formData.lines.length < 2) return toast.error('至少需要两条分录');

    for (const line of formData.lines) {
      if (!line.summary.trim()) return toast.error('请填写所有分录的摘要');
      if (!line.subjectId) return toast.error('请选择所有分录的会计科目');
      if (line.requiresAuxiliary && !line.auxiliaryId) return toast.error(`科目"${line.subjectName}"需要选择[${line.auxiliaryType}]`);
      if (!line.debitAmount && !line.creditAmount) return toast.error('每条分录必须填写借方或贷方金额');
    }

    if (Math.abs(formData.debitTotal - formData.creditTotal) > 0.01 || formData.debitTotal === 0) {
      return toast.error('借贷必须平衡且不为0');
    }

    

    const dataToSave = {
        ...formData,
        lines: formData.lines.map(line => ({
            ...line,
            // ★★★ 关键修改：把前端的 auxiliaryName 映射给后端的 auxiliary 字段 ★★★
            // 这样存入数据库时，就是 { ..., auxiliary: "生产部门" }
            auxiliary: line.auxiliaryName || '' 
        }))
    };

    // 调用父组件的保存
    onSave(dataToSave);

    // 重置表单以便继续录入
    if (!voucher) {
        setFormData(prev => ({
            ...prev,
            lines: [
                { id: `line-${Date.now()}-1`, summary: '', subjectId: '', subjectCode: '', subjectName: '', debitAmount: '', creditAmount: '', requiresAuxiliary: false },
                { id: `line-${Date.now()}-2`, summary: '', subjectId: '', subjectCode: '', subjectName: '', debitAmount: '', creditAmount: '', requiresAuxiliary: false }
            ],
            debitTotal: 0,
            creditTotal: 0
        }));
    }
  };

  const fetchTemplates = async () => {
    const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId;
    if (!currentBookId) return;
      setIsLoadingTemplates(true);
      try {
        const data = await getEnabledTemplates(currentBookId); 
        setTemplates(Array.isArray(data) ? data : []);
      } catch (e) { toast.error("加载模板失败"); } 
      finally { setIsLoadingTemplates(false); }
  };
  useEffect(() => { if (showTemplateImport) fetchTemplates(); }, [showTemplateImport]);

  const canSave = formData.debitTotal > 0 && Math.abs(formData.debitTotal - formData.creditTotal) < 0.01;
  const canSaveAsTemplate = formData.lines && formData.lines.some(line => line.summary && line.subjectCode);

  if (!formData.lines) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[1400px] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gray-50/50">
          <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-gray-900">
                    {viewMode ? '查看凭证' : voucher ? '编辑凭证' : '新增凭证'}
                </DialogTitle>
                <DialogDescription>
                    {viewMode ? '凭证详情（只读）' : '录入业务数据，系统自动校验借贷平衡'}
                </DialogDescription>
              </div>
              {!viewMode && (
                  <Badge variant={taxType === '一般纳税人' ? 'default' : 'secondary'}>{taxType}</Badge>
              )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
          
          {/* 顶部信息栏 */}
          <div className="flex flex-wrap items-end gap-6 mb-6 p-5 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-gray-700">凭证字号</Label>
                <div className="flex items-center bg-white border border-gray-300 rounded-md overflow-hidden shadow-sm h-10 w-48 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                    <Select value={formData.voucherType} onValueChange={(value) => setFormData({ ...formData, voucherType: value })} disabled={viewMode}>
                        <SelectTrigger className="w-20 h-full border-0 focus:ring-0 bg-transparent rounded-none px-3"><SelectValue /></SelectTrigger>
                        <SelectContent>{['记', '收', '付', '转'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="w-px h-5 bg-gray-300"></div>
                    <Input value={formData.voucherNumber} disabled className="h-full w-full pl-3 border-0 focus-visible:ring-0 bg-transparent font-mono text-gray-500 text-xs rounded-none" />
                </div>
            </div>
            
            <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-gray-700">制单日期</Label>
                <div className="relative w-42">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"><Calendar className="w-4 h-4 text-gray-500"/></div>
                    <Input type="date" value={formData.voucherDate} onChange={(e) => setFormData({ ...formData, voucherDate: e.target.value })} disabled={viewMode || !!forceDate}  className="h-10 pl-9 w-full bg-white border-gray-300 shadow-sm text-sm" />
                </div>
                {forceDate && <p className="text-[10px] text-orange-500 mt-1">* 新增凭证日期自动锁定为当日</p>}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label className="text-sm font-medium text-gray-700">附件数</Label>
                <div className="relative w-24">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10"><Paperclip className="w-4 h-4 text-gray-500"/></div>
                    <Input type="number" min="0" value={formData.attachments} onChange={(e) => setFormData({ ...formData, attachments: parseInt(e.target.value) || 0 })} disabled={viewMode} className="h-10 pl-9 w-full bg-white border-gray-300 shadow-sm text-sm" />
                </div>
            </div>

            <div className="flex items-center gap-3 ml-auto pb-0.5">
                <Button variant="outline" onClick={() => setShowTemplateImport(true)} disabled={viewMode} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200 h-10">
                  <Download className="w-4 h-4 mr-2" /> 从模板导入
                </Button>
                <Button variant="outline" onClick={() => setShowTemplateSave(true)} disabled={viewMode || !canSaveAsTemplate} className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200 h-10">
                  <Upload className="w-4 h-4 mr-2" /> 存为模板
                </Button>
            </div>
          </div>

          {/* 分录表格 */}
          <div className="border rounded-lg overflow-hidden mb-6 shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] table-fixed border-collapse">
                <thead className="bg-gray-50 text-gray-700 font-medium text-sm">
                    <tr>
                    <th className="border-b border-r px-4 py-3 text-center w-[250px] whitespace-nowrap">摘要 <span className="text-red-500">*</span></th>
                    <th className="border-b border-r px-4 py-3 text-center w-[250px] whitespace-nowrap">会计科目 <span className="text-red-500">*</span></th>
                    <th className="border-b border-r px-4 py-3 text-center w-[200px] whitespace-nowrap">辅助核算</th>
                    <th className="border-b border-r px-4 py-3 text-center w-[180px] whitespace-nowrap">借方金额</th>
                    <th className="border-b border-r px-4 py-3 text-center w-[180px] whitespace-nowrap">贷方金额</th>
                    <th className="border-b px-2 py-3 text-center w-[60px] whitespace-nowrap">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {formData.lines.map((line, index) => (
                    <tr key={line.id} className="group hover:bg-gray-50 transition-colors">
                        
                        {/* 摘要 */}
                        <td className="border-b border-r p-0">
                        <Input value={line.summary} onChange={(e) => updateLine(line.id, 'summary', e.target.value)} onKeyDown={(e) => handleTabKey(e, line.id, 'summary', index)} className="border-0 rounded-none h-12 px-4 w-full focus-visible:ring-0 focus-visible:bg-blue-50/50" placeholder="输入摘要" disabled={viewMode}/>
                        </td>

                        {/* 科目 */}
                        <td className="border-b border-r p-0">
                        {viewMode ? (
                            <div className="h-12 px-4 flex items-center text-sm font-medium text-gray-900 truncate">{line.subjectCode} {line.subjectName}</div>
                        ) : (
                            <Popover open={openSubjectPopover === line.id} onOpenChange={(open) => setOpenSubjectPopover(open ? line.id : null)}>
                            <PopoverTrigger asChild>
                                <button className="w-full h-12 px-4 text-left text-sm hover:bg-blue-50/50 flex items-center justify-between text-gray-700 truncate">
                                {line.subjectId ? <span className="font-medium truncate">{line.subjectCode} {line.subjectName}</span> : <span className="text-gray-400 font-normal">选择科目...</span>}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[450px] p-0" align="start">
                                <Command>
                                <CommandInput placeholder="搜索科目 (仅显示末级科目)..." />
                                <CommandEmpty>未找到符合条件的末级科目</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-y-auto">
                                    {subjects.map((subject) => (
                                    <CommandItem key={subject.id} value={`${subject.code} ${subject.name}`} onSelect={() => selectSubject(line.id, subject)}>
                                        <span className="font-bold mr-2">{subject.code}</span><span>{subject.name}</span>
                                        {subject.hasAuxiliary && <Badge variant="secondary" className="ml-auto text-xs scale-90">辅</Badge>}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </Command>
                            </PopoverContent>
                            </Popover>
                        )}
                        </td>

                        {/* 辅助核算 */}
                        <td className="border-b border-r p-0">
                            <div className="h-12 w-full">
                            {line.requiresAuxiliary ? (
                               viewMode ? (<div className="h-full px-4 flex items-center"><Badge variant="outline">{line.auxiliaryName || '未指定'}</Badge></div>) : (
                                   <Popover open={openAuxPopover === line.id} onOpenChange={(open) => setOpenAuxPopover(open ? line.id : null)}>
                                       <PopoverTrigger asChild>
                                           <button className={cn("w-full h-full px-4 text-left text-sm flex items-center justify-between transition-colors", line.auxiliaryId ? "text-gray-900 bg-amber-50/30 hover:bg-amber-50/60" : "text-amber-600 bg-amber-50 hover:bg-amber-100")}>
                                               <span className="truncate flex-1">{line.auxiliaryName || `选择${line.auxiliaryType || ''}`}</span>
                                               <Badge variant="outline" className="ml-2 border-amber-200 bg-white text-amber-700 text-[10px] h-5 px-1 shadow-sm">{line.auxiliaryType || '辅'}</Badge>
                                           </button>
                                       </PopoverTrigger>
                                       <PopoverContent className="w-[300px] p-0" align="start">
                                           <Command>
                                               <CommandInput placeholder={`搜索${line.auxiliaryType}...`} /><CommandEmpty>无数据</CommandEmpty>
                                               <CommandGroup className="max-h-64 overflow-y-auto">
                                                   {allAuxiliaryItems.filter(item => item.category === line.auxiliaryType).map(item => (
                                                           <CommandItem key={item.id} value={`${item.code} ${item.name}`} onSelect={() => selectAuxiliary(line.id, item)}>
                                                               <span className="w-8 text-gray-400 font-mono text-xs">{item.code}</span><span className="flex-1">{item.name}</span>
                                                               {line.auxiliaryId === item.id && <Check className="w-4 h-4 text-blue-600"/>}
                                                           </CommandItem>
                                                       ))}
                                               </CommandGroup>
                                           </Command>
                                       </PopoverContent>
                                   </Popover>
                               )
                           ) : (<div className="w-full h-full flex items-center justify-center bg-gray-50/50"><span className="text-gray-300">-</span></div>)}
                           </div>
                        </td>

                        {/* 借方金额 */}
                        <td className="border-b border-r p-0 relative group/cell">
                        <Input type="number" value={line.debitAmount} onChange={(e) => { updateLine(line.id, 'debitAmount', e.target.value); if(e.target.value) updateLine(line.id, 'creditAmount', ''); }} onKeyDown={(e) => e.key === ' ' && (e.preventDefault(), handleSpaceKey(line.id, 'debitAmount'))} className="border-0 rounded-none h-12 px-4 w-full text-right font-mono font-medium text-lg focus-visible:ring-0 focus-visible:bg-blue-50/50" placeholder="0.00" disabled={viewMode} />
                        {!viewMode && taxType === '一般纳税人' && !line.creditAmount && (
                            <Popover open={openTaxPopover?.lineId === line.id && openTaxPopover?.field === 'debit'} onOpenChange={(open) => setOpenTaxPopover(open ? {lineId: line.id, field: 'debit'} : null)}>
                                <PopoverTrigger asChild><button className="absolute top-1/2 -translate-y-1/2 left-2 p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-100 rounded opacity-0 group-hover/cell:opacity-100 transition-opacity" title="价税分离"><Calculator className="w-3.5 h-3.5" /></button></PopoverTrigger>
                                <PopoverContent className="w-60 p-3" align="start">
                                    <div className="space-y-3">
                                        <div className="text-xs font-medium text-gray-700">价税分离 (借方)</div>
                                        <div className="space-y-2"><Label className="text-xs text-gray-500">含税总额</Label><Input defaultValue={line.debitAmount} id={`tax-calc-debit-${line.id}`} className="h-8 text-xs" /></div>
                                        <div className="space-y-2"><Label className="text-xs text-gray-500">选择税率</Label>
                                            <Select defaultValue="0.13" onValueChange={(val) => {const total = document.getElementById(`tax-calc-debit-${line.id}`) as HTMLInputElement; if(total.value) handleCalculateTax(line.id, 'debit', parseFloat(total.value), parseFloat(val));}}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{TAX_RATES.map(r => <SelectItem key={r.value} value={String(r.value)} className="text-xs">{r.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        </td>

                        {/* 贷方金额 */}
                        <td className="border-b border-r p-0 relative group/cell">
                        <Input type="number" value={line.creditAmount} onChange={(e) => { updateLine(line.id, 'creditAmount', e.target.value); if(e.target.value) updateLine(line.id, 'debitAmount', ''); }} onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); handleSpaceKey(line.id, 'creditAmount'); } handleTabKey(e, line.id, 'creditAmount', index); }} className="border-0 rounded-none h-12 px-4 w-full text-right font-mono font-medium text-lg focus-visible:ring-0 focus-visible:bg-blue-50/50" placeholder="0.00" disabled={viewMode} />
                         {!viewMode && taxType === '一般纳税人' && !line.debitAmount && (
                            <Popover open={openTaxPopover?.lineId === line.id && openTaxPopover?.field === 'credit'} onOpenChange={(open) => setOpenTaxPopover(open ? {lineId: line.id, field: 'credit'} : null)}>
                                <PopoverTrigger asChild><button className="absolute top-1/2 -translate-y-1/2 left-2 p-1 text-gray-300 hover:text-blue-600 hover:bg-blue-100 rounded opacity-0 group-hover/cell:opacity-100 transition-opacity" title="价税分离"><Calculator className="w-3.5 h-3.5" /></button></PopoverTrigger>
                                <PopoverContent className="w-60 p-3" align="start">
                                    <div className="space-y-3">
                                        <div className="text-xs font-medium text-gray-700">价税分离 (贷方)</div>
                                        <div className="space-y-2"><Label className="text-xs text-gray-500">含税总额</Label><Input defaultValue={line.creditAmount} id={`tax-calc-credit-${line.id}`} className="h-8 text-xs" /></div>
                                        <div className="space-y-2"><Label className="text-xs text-gray-500">选择税率</Label>
                                            <Select defaultValue="0.13" onValueChange={(val) => {const total = document.getElementById(`tax-calc-credit-${line.id}`) as HTMLInputElement; if(total.value) handleCalculateTax(line.id, 'credit', parseFloat(total.value), parseFloat(val));}}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{TAX_RATES.map(r => <SelectItem key={r.value} value={String(r.value)} className="text-xs">{r.label}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        </td>

                        {/* 操作列 */}
                        <td className="border-b px-1 py-2 text-center">
                        {!viewMode && (<div className="flex items-center justify-center h-full"><Button variant="ghost" size="icon" onClick={() => deleteLine(line.id)} className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" disabled={formData.lines.length <= 2}><Trash2 className="w-4 h-4" /></Button></div>)}
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            {!viewMode && (
              <Button variant="outline" onClick={addLine} className="w-full rounded-t-none border-t-0 border-x-0 border-b-0 border-dashed bg-gray-50 text-gray-600 hover:text-blue-600 hover:bg-blue-50 h-10">
                <Plus className="w-4 h-4 mr-2" /> 添加分录行
              </Button>
            )}
          </div>

          {/* 底部合计信息栏 */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50/50 px-3 py-2 rounded border border-blue-100 w-fit">
               <Info className="w-4 h-4"/>
               <span>小技巧：在金额栏按 <span className="font-mono font-bold mx-1 bg-white border px-1.5 py-0.5 rounded text-gray-800 shadow-sm">空格键</span> 可自动计算借贷平衡差额</span>
            </div>
            <div className="flex items-center justify-end gap-10 border-t border-gray-200 pt-4">
                <div className="flex items-center gap-3"><span className="text-gray-500 font-medium">借方合计：</span><span className={`text-2xl font-mono font-bold ${formData.debitTotal === formData.creditTotal && formData.debitTotal > 0 ? 'text-green-600' : 'text-gray-900'}`}>¥ {formData.debitTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex items-center gap-3"><span className="text-gray-500 font-medium">贷方合计：</span><span className={`text-2xl font-mono font-bold ${formData.debitTotal === formData.creditTotal && formData.creditTotal > 0 ? 'text-green-600' : 'text-gray-900'}`}>¥ {formData.creditTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span></div>
                {formData.debitTotal !== formData.creditTotal && (<div className="px-4 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold animate-pulse">差额：¥ {Math.abs(formData.debitTotal - formData.creditTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</div>)}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-white flex items-center justify-end gap-4">
          <Button variant="outline" onClick={onClose} className="h-10 px-6">{viewMode ? '关闭' : '取消'}</Button>
          {!viewMode && <Button onClick={handleSaveAndNew} disabled={!canSave} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 text-base shadow-md transition-all"><Save className="w-4 h-4 mr-2"/> 保存并新增</Button>}
        </div>
      </DialogContent>
    </Dialog>

    {/* 存为模板弹窗 */}
    <Dialog open={showTemplateSave} onOpenChange={setShowTemplateSave}>
      <DialogContent>
        <DialogHeader><DialogTitle>存为模板</DialogTitle><DialogDescription>将当前凭证保存为模板，方便后续快速录入</DialogDescription></DialogHeader>
        {isSystemGenerated && !viewMode && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">关联凭证提醒</h4>
              <p className="text-sm text-amber-700 mt-1">
                此凭证由系统业务（如出纳日记账/内部转账）自动生成。
                <br />
                建议不要修改关键金额或科目，以免造成业务单据与财务数据不一致。
                如需彻底修改，请删除此凭证后在原业务模块重新生成。
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6 bg-white"></div>
        <div className="space-y-4 py-2"><div className="space-y-2"><Label>模板名称 <span className="text-red-500">*</span></Label><Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="请输入模板名称" /></div></div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowTemplateSave(false)}>取消</Button>
          <Button onClick={async () => {
              const currentBookId = Array.isArray(bookId) ? bookId[0] : bookId; if (!currentBookId) return;
              const newTemplate: VoucherTemplate = { id: `tpl-${Date.now()}`, name: templateName, voucherType: formData.voucherType, status: '待审核', lines: formData.lines.map(l => ({ id: l.id, summary: l.summary, subjectId: l.subjectId, subjectCode: l.subjectCode, subjectName: l.subjectName, requiresAuxiliary: l.requiresAuxiliary, auxiliaryType: l.auxiliaryType, debitAmount: '', creditAmount: '' })), createdAt: new Date().toLocaleString('zh-CN'), isReferenced: false };
              await addVoucherTemplate(currentBookId, newTemplate); toast.success(`模板\"${templateName}\"已保存`); setShowTemplateSave(false);
            }}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 从模板导入弹窗 */}
    <Dialog open={showTemplateImport} onOpenChange={setShowTemplateImport}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>从模板导入</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto p-1">
          {isLoadingTemplates ? (<div className="flex justify-center py-8"><Loader2 className="animate-spin text-blue-600"/></div>) : templates.length === 0 ? (<div className="text-center py-8 text-gray-500">暂无可用模板</div>) : (
            templates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4 hover:bg-blue-50 cursor-pointer group transition-colors"
                onClick={() => {
                  setFormData(prev => ({ ...prev, voucherType: template.voucherType || '记', lines: (template.lines || []).map((l: any, idx: number) => ({ id: `line-${Date.now()}-${idx}`, summary: l.summary, subjectId: l.subjectId, subjectCode: l.subjectCode, subjectName: l.subjectName, requiresAuxiliary: l.requiresAuxiliary, auxiliaryType: l.auxiliaryType, auxiliaryId: '', auxiliaryName: '', debitAmount: '', creditAmount: '' })) }));
                  setShowTemplateImport(false); toast.success(`已导入模板：${template.name}`);
                }}>
                <div className="flex items-center justify-between"><span className="font-bold">{template.name}</span><Badge variant="secondary">{template.voucherType}字</Badge></div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}