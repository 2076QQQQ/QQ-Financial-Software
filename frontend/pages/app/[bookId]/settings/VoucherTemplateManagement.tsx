import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Plus, Edit, Copy, Trash2, Search, Loader2, Save, FileText, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';       
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';      
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
import { 
  getAllTemplates, 
  addVoucherTemplate, 
  updateVoucherTemplate, 
  deleteVoucherTemplate,
  getAllSubjects, 
} from '@/lib/mockData';

// ✅ 1. 修改接口定义：增加 accountBookId
export interface VoucherTemplate {
  id: string;
  name: string;
  voucherType: string;
  status: string;
  lines: any[];
  createdAt: string;
  updatedAt?: string;
  maker?: string;
  isReferenced?: boolean;
  accountBookId?: string; // ★ 新增：账套ID
}

// 会计科目数据结构
interface Subject {
  id: string;
  code: string;
  name: string;
  hasAuxiliary: boolean;
  auxiliaryType?: string;
  accountBookId?: string; // ★ 新增：账套ID
}

interface VoucherEntry {
  id: string;
  summary: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  debitAmount: string;
  creditAmount: string;
  requiresAuxiliary: boolean;
  auxiliaryInfo?: string;
}

export default function VoucherTemplateManagement() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;

  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]); 
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<VoucherTemplate | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VoucherTemplate | null>(null);
  const [openSubjectPopover, setOpenSubjectPopover] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<VoucherTemplate>({
    id: '',
    name: '',
    voucherType: '',
    status: '待审核',
    lines: [],
    createdAt: ''
  });
  const handleBatchUnAudit = async () => {
    const candidates = templates.filter(t => selectedIds.includes(t.id) && t.status === '已启用');
    
    if (candidates.length === 0) return;

    // ✅ 核心校验：检查是否有“已被引用”的模板
    const referencedTemplates = candidates.filter(t => t.isReferenced);

    if (referencedTemplates.length > 0) {
      // 如果发现被引用的模板，拦截操作并提示具体的模板名称
      const names = referencedTemplates.map(t => t.name).join('、');
      return alert(`操作失败！\n以下模板已被使用生成凭证，禁止反审核：\n\n${names}`);
    }

    // 2. 执行反审核（只有通过校验才执行）
    setIsLoading(true); // 加上 loading 体验更好
    try {
      await Promise.all(candidates.map(t => updateVoucherTemplate(t.id, { ...t, status: '待审核' })));
      await loadTemplates();
      setSelectedIds([]);
      // 可以加个提示
      // toast.success("反审核成功"); 
    } catch (e) {
      console.error(e);
      alert("操作失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 1. 加载模板 (增加严格过滤)
  const loadTemplates = async () => {
    if (!currentBookId) return;

    setIsLoading(true);
    try {
      const data = await getAllTemplates(currentBookId);
      // ✅ 2. 核心修复：前端强制过滤，确保只显示当前账套的模板
      const filteredData = (data || []).filter((t: any) => t.accountBookId === currentBookId);
      setTemplates(filteredData);
    } catch (error) {
      console.error("加载模板失败", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 加载并过滤科目 (增加严格过滤)
  const loadSubjects = async () => {
    if (!currentBookId) return;

    try {
      const allSubjects = await getAllSubjects(currentBookId);
      
      if (!Array.isArray(allSubjects)) return;

      // ✅ 3. 核心修复：先过滤出属于当前账套的科目
      const bookSubjects = allSubjects.filter((s: any) => s.accountBookId === currentBookId);
      
      const allCodes = bookSubjects.map((s: any) => String(s.code));

      const validSubjects = bookSubjects
        .filter((s: any) => {
          if (!s.isActive) return false;
          const currentCode = String(s.code);
          const hasChild = allCodes.some((otherCode: string) => 
            otherCode !== currentCode && otherCode.startsWith(currentCode)
          );
          return !hasChild; // 只允许选择末级科目
        })
        .map((s: any) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          hasAuxiliary: s.auxiliaryItems && s.auxiliaryItems.length > 0,
          auxiliaryType: s.auxiliaryItems?.[0],
          accountBookId: s.accountBookId
        }))
        .sort((a: any, b: any) => a.code.localeCompare(b.code));

      setSubjects(validSubjects);
    } catch (error) {
      console.error("加载科目失败", error);
    }
  };

  useEffect(() => {
    if (router.isReady && currentBookId) {
        loadTemplates();
        loadSubjects();
    }
  }, [router.isReady, currentBookId]);

  const filteredTemplates = templates.filter(t =>
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.voucherType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.lines?.some((e: any) => e.summary?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTemplates.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };

  const handleBatchApprove = async () => {
    const targets = templates.filter(t => selectedIds.includes(t.id) && t.status === '待审核');
    await Promise.all(targets.map(t => updateVoucherTemplate(t.id, { ...t, status: '已启用' })));
    await loadTemplates();
    setSelectedIds([]);
  };

  const handleBatchReject = async () => {
    const targets = templates.filter(t => selectedIds.includes(t.id) && t.status === '待审核');
    await Promise.all(targets.map(t => updateVoucherTemplate(t.id, { ...t, status: '已驳回' })));
    await loadTemplates();
    setSelectedIds([]);
  };

  const canApprove = selectedIds.length > 0 && 
    templates.some(t => selectedIds.includes(t.id) && t.status === '待审核');

  const handleAdd = () => {
    setEditTarget(null);
    setIsCopyMode(false);
    setFormData({
      id: '',
      name: '',
      voucherType: '记', 
      status: '待审核',
      lines: [
        { id: `entry-${Date.now()}-1`, summary: '', subjectId: '', subjectCode: '', subjectName: '', debitAmount: '', creditAmount: '', requiresAuxiliary: false },
        { id: `entry-${Date.now()}-2`, summary: '', subjectId: '', subjectCode: '', subjectName: '', debitAmount: '', creditAmount: '', requiresAuxiliary: false }
      ],
      createdAt: ''
    });
    setShowModal(true);
  };

  const handleEdit = (template: VoucherTemplate) => {
    setEditTarget(template);
    setIsCopyMode(false);
    setFormData({ ...template });
    setShowModal(true);
  };

  const handleCopy = (template: VoucherTemplate) => {
    setEditTarget(template);
    setIsCopyMode(true);
    setFormData({
      ...template,
      id: '',
      name: `${template.name} (复制)`,
      // 复制时，虽然内容一样，但这个新对象要准备好绑定到当前账套（逻辑在 Save 处理）
      lines: template.lines.map((e: any) => ({ ...e, id: `entry-${Date.now()}-${Math.random()}` }))
    });
    setShowModal(true);
  };

  const handleDelete = async (template: VoucherTemplate) => {
    try {
      await deleteVoucherTemplate(template.id);
      await loadTemplates();
      setDeleteTarget(null);
    } catch (error) {
      alert("删除失败");
    }
  };

  const canDelete = (template: VoucherTemplate): boolean => {
    // 规则 1: 必须是“待审核”或“已驳回”状态才能删 (已启用的不让删，防止误删正在用的)
    const isStatusAllow = template.status === '待审核' || template.status === '已驳回';
    
    // 规则 2: 绝对不能已被引用
    const isNotReferenced = !template.isReferenced;
    return (template.status === '待审核' || template.status === '已驳回') && !template.isReferenced;
  };

  const canEdit = (template: VoucherTemplate): boolean => {
    return template.status === '待审核' || template.status === '已驳回';
  };

  const addEntry = () => {
    const newEntry: VoucherEntry = {
      id: `entry-${Date.now()}`,
      summary: '', subjectId: '', subjectCode: '', subjectName: '',
      debitAmount: '', creditAmount: '', requiresAuxiliary: false
    };
    setFormData({ ...formData, lines: [...formData.lines, newEntry] });
  };

  const removeEntry = (entryId: string) => {
    if (formData.lines.length <= 1) return alert('至少需要保留一行分录');
    setFormData({ ...formData, lines: formData.lines.filter((e: any) => e.id !== entryId) });
  };

  const updateEntry = (entryId: string, field: keyof VoucherEntry, value: any) => {
    setFormData({
      ...formData,
      lines: formData.lines.map((e: any) => {
        if (e.id === entryId) {
          const updated = { ...e, [field]: value };
          
          if (field === 'subjectId') {
            const subject = subjects.find(s => s.id === value);
            if (subject) {
              updated.subjectCode = subject.code;
              updated.subjectName = subject.name;
              updated.requiresAuxiliary = subject.hasAuxiliary;
              updated.auxiliaryInfo = subject.hasAuxiliary ? `需指定${subject.auxiliaryType}` : undefined;
            }
          }
          return updated;
        }
        return e;
      })
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, entryId: string, field: string, index: number) => {
    if (e.key === 'Tab') {
      if (index === formData.lines.length - 1) {
          // addEntry(); 
      }
    }
  };

  const handleSave = async () => {
    if (!currentBookId) return;

    if (!formData.name.trim()) return alert("请输入模板名称");
    const isDuplicateName = templates.some(t => 
      t.name === formData.name.trim() && 
      t.id !== editTarget?.id // 编辑模式下排除自己
    );

    if (isDuplicateName) {
      return alert("模板名称已存在，请使用其他名称");
    }
    for (const entry of formData.lines) {
      if (!entry.summary.trim()) return alert('所有分录行的摘要不能为空');
      if (!entry.subjectId) return alert('所有分录行必须选择会计科目');
    }

    setIsSaving(true);
    try {
      if (editTarget && !isCopyMode) {
        // 编辑模式：保持原有的 accountBookId (通常不用变)，但为了安全可以强制覆盖或检查
        const updated = { 
            ...formData, 
            updatedAt: new Date().toLocaleString('zh-CN'),
            accountBookId: currentBookId // 确保ID归属正确
        };
        await updateVoucherTemplate(updated);
      } else {
        // 新增或复制模式
        const newTemplate = {
          ...formData,
          id: `tpl-${Date.now()}`,
          status: '待审核',
          createdAt: new Date().toLocaleString('zh-CN'),
          updatedAt: new Date().toLocaleString('zh-CN'),
          isReferenced: false,
          accountBookId: currentBookId // ✅ 4. 核心修复：确保写入账套ID
        };
        await addVoucherTemplate(newTemplate, currentBookId);
      }
      await loadTemplates();
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">凭证模板管理</h1>
        <p className="text-sm text-gray-500 mt-1">管理全公司可用的记账模板，提高凭证录入效率</p>
      </div>

      {/* 顶部操作区 */}
      <div className="bg-white rounded-lg border mb-4 shadow-sm">
        <div className="p-4 flex items-center justify-between">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="搜索凭证字号、名称或摘要..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleBatchApprove}
              disabled={!canApprove || selectedIds.length === 0}
            >
              审核通过
            </Button>
            <Button 
    size="sm" 
    variant="outline"
    onClick={handleBatchUnAudit} // 需要定义这个函数
    disabled={selectedIds.length === 0 || !templates.some(t => selectedIds.includes(t.id) && t.status === '已启用')||
    templates.some(t => selectedIds.includes(t.id) && t.isReferenced)}
  >
    反审核
  </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleBatchReject}
              disabled={!canApprove || selectedIds.length === 0}
            >
              驳回
            </Button>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              新增模板
            </Button>
          </div>
        </div>
      </div>

      {/* 列表表格 */}
      <div className="bg-white rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.length === filteredTemplates.length && filteredTemplates.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[180px]">模板名称</TableHead>
              <TableHead className="w-[100px]">凭证字号</TableHead>
              <TableHead>摘要示例</TableHead>
              <TableHead className="w-[80px] text-center">分录数</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[100px]">制单人</TableHead>
              <TableHead className="w-[160px]">更新时间</TableHead>
              <TableHead className="text-right w-[150px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="animate-spin w-6 h-6 mx-auto text-blue-600"/></TableCell></TableRow>
            ) : filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-12">暂无数据</TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => (
                <TableRow key={template.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(template.id)}
                      onCheckedChange={(checked) => handleSelectOne(template.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">{template.name}</TableCell>
                  <TableCell>{template.voucherType}</TableCell>
                  <TableCell className="text-gray-500 truncate max-w-xs">
                    {template.lines && template.lines[0]?.summary || '-'}
                  </TableCell>
                  <TableCell className="text-center">{template.lines?.length || 0}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        template.status === '已启用' ? 'default' : 
                        template.status === '待审核' ? 'secondary' : 'destructive'
                      }
                      className={
                        template.status === '已启用' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 
                        template.status === '待审核' ? 'bg-blue-50 text-blue-700 hover:bg-blue-50' : ''
                      }
                    >
                      {template.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">{template.maker || '-'}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{template.updatedAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} disabled={!canEdit(template)} className="h-8 w-8 text-gray-500 hover:text-blue-600">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(template)} className="h-8 w-8 text-gray-500 hover:text-blue-600">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(template)} disabled={!canDelete(template)} className={canDelete(template) ? 'h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50' : 'h-8 w-8 text-gray-300 cursor-not-allowed'}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {!canDelete(template) && (
                            <TooltipContent><p className="text-xs">{template.isReferenced 
            ? '该模板已被引用，无法删除' 
            : template.status === '已启用' 
              ? '请先反审核后再删除' 
              : '无法删除'}</p></TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[1400px] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gray-50/50">
            <DialogTitle className="text-xl font-bold text-gray-900">
              {isCopyMode ? '复制凭证模板' : editTarget ? '编辑凭证模板' : '新增凭证模板'}
            </DialogTitle>
            <DialogDescription>
              配置模板的默认科目与摘要，金额栏可留空，使用时再填写
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
            {/* 1. 顶部表单 */}
            <div className="flex flex-wrap items-end gap-6 mb-6 p-5 bg-gray-50 rounded-lg border border-gray-100">
              
              {/* 模板名称 */}
              <div className="flex flex-col gap-1.5">
                 <Label className="text-sm font-medium text-gray-700">模板名称 <span className="text-red-500">*</span></Label>
                 <div className="relative w-64">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                       <FileText className="w-4 h-4 text-gray-500" />
                    </div>
                    <Input 
                      value={formData.name} 
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                      className="h-10 pl-9 bg-white border-gray-300 shadow-sm"
                      placeholder="例如：工资发放"
                    />
                 </div>
              </div>

              {/* 凭证字 */}
              <div className="flex flex-col gap-1.5">
                 <Label className="text-sm font-medium text-gray-700">默认凭证字</Label>
                 <div className="relative w-32">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                       <Hash className="w-4 h-4 text-gray-500" />
                    </div>
                    <Select 
                        value={formData.voucherType} 
                        onValueChange={(value) => setFormData({ ...formData, voucherType: value })}
                    >
                      <SelectTrigger className="h-10 pl-9 bg-white border-gray-300 shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                         {['记', '收', '付', '转'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
              </div>
            </div>

            {/* 2. 表格区域 */}
            <div className="border rounded-lg overflow-hidden mb-6 shadow-sm">
               <div className="overflow-x-auto">
                 <table className="w-full min-w-[1000px] table-fixed border-collapse">
                    <thead className="bg-gray-50 text-gray-700 font-medium text-sm">
                       <tr>
                          <th className="border-b border-r px-4 py-3 text-center w-[250px] whitespace-nowrap">摘要 <span className="text-red-500">*</span></th>
                          <th className="border-b border-r px-4 py-3 text-center w-[250px] whitespace-nowrap">会计科目 <span className="text-red-500">*</span></th>
                          <th className="border-b border-r px-4 py-3 text-center w-[150px] whitespace-nowrap">辅助核算</th>
                          <th className="border-b border-r px-4 py-3 text-center w-[150px] whitespace-nowrap">默认借方金额</th>
                          <th className="border-b border-r px-4 py-3 text-center w-[150px] whitespace-nowrap">默认贷方金额</th>
                          <th className="border-b px-2 py-3 text-center w-[60px] whitespace-nowrap">操作</th>
                       </tr>
                    </thead>
                    <tbody>
                       {formData.lines.map((entry: any, index: number) => (
                          <tr key={entry.id} className="group hover:bg-gray-50 transition-colors">
                             <td className="border-b border-r p-0">
                                <Input
                                  value={entry.summary}
                                  onChange={(e) => updateEntry(entry.id, 'summary', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, entry.id, 'summary', index)}
                                  className="border-0 rounded-none h-12 px-4 w-full focus-visible:ring-0 focus-visible:bg-blue-50/50"
                                  placeholder="输入摘要"
                                />
                             </td>
                             <td className="border-b border-r p-0">
                                <Popover open={openSubjectPopover === entry.id} onOpenChange={(open) => setOpenSubjectPopover(open ? entry.id : null)}>
                                  <PopoverTrigger asChild>
                                    <button className="w-full h-12 px-4 text-left text-sm hover:bg-blue-50/50 flex items-center justify-between text-gray-700 truncate">
                                      {entry.subjectId ? (
                                        <span className="font-medium truncate">{entry.subjectCode} {entry.subjectName}</span>
                                      ) : (
                                        <span className="text-gray-400 font-normal">选择科目...</span>
                                      )}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="搜索科目 (仅显示末级)..." />
                                      <CommandEmpty>未找到</CommandEmpty>
                                      <CommandGroup className="max-h-64 overflow-y-auto">
                                        {subjects.map((subject) => (
                                          <CommandItem key={subject.id} value={`${subject.code} ${subject.name}`} onSelect={() => { updateEntry(entry.id, 'subjectId', subject.id); setOpenSubjectPopover(null); }}>
                                            <span className="font-bold mr-2">{subject.code}</span>
                                            <span>{subject.name}</span>
                                            {subject.hasAuxiliary && <Badge variant="secondary" className="ml-auto text-xs scale-90">辅</Badge>}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                             </td>
                             <td className="border-b border-r p-0">
                              <div className="h-12 flex items-center justify-center">
                                {entry.requiresAuxiliary ? (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 h-6">
                                    {entry.auxiliaryInfo || '需指定'}
                                  </Badge>
                                ) : <span className="text-gray-300 text-xs">-</span>}
                              </div>
                              </td>
                             <td className="border-b border-r p-0">
                                <Input 
                                  type="number" 
                                  value={entry.debitAmount} 
                                  onChange={(e) => updateEntry(entry.id, 'debitAmount', e.target.value)} 
                                  className="border-0 rounded-none h-12 px-4 w-full text-right font-mono font-medium text-lg focus-visible:ring-0 focus-visible:bg-blue-50/50"
                                  placeholder="0.00"
                                />
                             </td>
                             <td className="border-b border-r p-0">
                                <Input 
                                  type="number" 
                                  value={entry.creditAmount} 
                                  onChange={(e) => updateEntry(entry.id, 'creditAmount', e.target.value)} 
                                  className="border-0 rounded-none h-12 px-4 w-full text-right font-mono font-medium text-lg focus-visible:ring-0 focus-visible:bg-blue-50/50"
                                  placeholder="0.00"
                                />
                             </td>
                             <td className="border-b px-1 py-2 text-center">
                                <div className="flex items-center justify-center h-full">
                                  <Button variant="ghost" size="icon" onClick={() => removeEntry(entry.id)} className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
               </div>
               <Button variant="outline" onClick={addEntry} className="w-full rounded-t-none border-t-0 border-x-0 border-b-0 border-dashed bg-gray-50 text-gray-600 hover:text-blue-600 hover:bg-blue-50 h-10">
                  <Plus className="w-4 h-4 mr-2" /> 添加分录行
               </Button>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="px-6 py-4 border-t bg-white flex items-center justify-end gap-4">
            <Button variant="outline" onClick={() => setShowModal(false)} className="h-10 px-6">取消</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 h-10 px-6 shadow-md transition-all">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" /> 保存模板
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>您确定要删除模板 <span className="font-bold text-gray-900">{deleteTarget?.name}</span> 吗？此操作不可逆。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-red-600 hover:bg-red-700">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}