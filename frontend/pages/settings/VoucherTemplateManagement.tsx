import { useState, useEffect } from 'react';
import { Plus, Edit, Copy, Trash2, Search, AlertCircle } from 'lucide-react';
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
  type VoucherTemplate 
} from '@/lib/mockData';

// 会计科目数据结构
interface Subject {
  id: string;
  code: string;
  name: string;
  hasAuxiliary: boolean;
  auxiliaryType?: string;
  searchCode?: string; // 助记码
}

// 模拟会计科目数据
const mockSubjects: Subject[] = [
  { id: 's1001', code: '1001', name: '库存现金', hasAuxiliary: false, searchCode: 'KCXJ' },
  { id: 's1002', code: '1002', name: '银行存款', hasAuxiliary: false, searchCode: 'YHCK' },
  { id: 's1005', code: '1005', name: '应收账款', hasAuxiliary: true, auxiliaryType: '客户', searchCode: 'YSZK' },
  { id: 's2002', code: '2002', name: '应付账款', hasAuxiliary: true, auxiliaryType: '供应商', searchCode: 'YFZK' },
  { id: 's3001', code: '3001', name: '实收资本', hasAuxiliary: false, searchCode: 'SSZB' },
  { id: 's6001', code: '6001', name: '主营业务收入', hasAuxiliary: false, searchCode: 'ZYYWSR' },
  { id: 's6602', code: '6602', name: '管理费用', hasAuxiliary: false, searchCode: 'GLFY' },
  { id: 's5001', code: '5001', name: '主营业务成本', hasAuxiliary: false, searchCode: 'ZYYWCB' },
  { id: 's1123', code: '1123', name: '应收股利', hasAuxiliary: false, searchCode: 'YSGL' },
  { id: 's6051', code: '6051', name: '其他业务收入', hasAuxiliary: false, searchCode: 'QTYWSR' },
];

export default function VoucherTemplateManagement() {
  const [templates, setTemplates] = useState<VoucherTemplate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<VoucherTemplate | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VoucherTemplate | null>(null);
  const [openSubjectPopover, setOpenSubjectPopover] = useState<string | null>(null);

  const [formData, setFormData] = useState<VoucherTemplate>({
    id: '',
    name: '',
    voucherType: '',
    status: '待审核',
    lines: [],
    createdAt: ''
  });

  useEffect(() => {
    // 加载模板数据
    setTemplates(getAllTemplates());
  }, []);

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTemplates.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  // 单选
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    }
  };

  // 批量审核
  const handleBatchApprove = () => {
    const updated = templates.map(t => {
      if (selectedIds.includes(t.id) && t.status === '待审核') {
        const updatedTemplate = { ...t, status: '已启用' as '待审核' | '已启用' | '已驳回' };
        updateVoucherTemplate(t.id, updatedTemplate);
        return updatedTemplate;
      }
      return t;
    });
    setTemplates(updated);
    setSelectedIds([]);
  };

  // 批量驳回
  const handleBatchReject = () => {
    const updated = templates.map(t => {
      if (selectedIds.includes(t.id) && t.status === '待审核') {
        const updatedTemplate = { ...t, status: '已驳回' as '待审核' | '已启用' | '已驳回' };
        updateVoucherTemplate(t.id, updatedTemplate);
        return updatedTemplate;
      }
      return t;
    });
    setTemplates(updated);
    setSelectedIds([]);
  };

  // 检查是否可以审核
  const canApprove = selectedIds.length > 0 && 
    templates.some(t => selectedIds.includes(t.id) && t.status === '待审核');

  // 新增模板
  const handleAdd = () => {
    setEditTarget(null);
    setIsCopyMode(false);
    const currentDate = new Date();
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    setFormData({
      id: '',
      name: '',
      voucherType: '',
      status: '待审核',
      lines: [
        {
          id: `entry-${Date.now()}-1`,
          summary: '',
          subjectId: '',
          subjectCode: '',
          subjectName: '',
          debitAmount: '',
          creditAmount: '',
          requiresAuxiliary: false
        },
        {
          id: `entry-${Date.now()}-2`,
          summary: '',
          subjectId: '',
          subjectCode: '',
          subjectName: '',
          debitAmount: '',
          creditAmount: '',
          requiresAuxiliary: false
        }
      ],
      createdAt: ''
    });
    setShowModal(true);
  };

  // 编辑模板
  const handleEdit = (template: VoucherTemplate) => {
    setEditTarget(template);
    setIsCopyMode(false);
    setFormData({ ...template });
    setShowModal(true);
  };

  // 复制模板
  const handleCopy = (template: VoucherTemplate) => {
    setEditTarget(template);
    setIsCopyMode(true);
    setFormData({
      ...template,
      id: '',
      voucherType: '',
      lines: template.lines.map(e => ({ ...e, id: `entry-${Date.now()}-${Math.random()}` }))
    });
    setShowModal(true);
  };

  // 删除模板
  const handleDelete = (template: VoucherTemplate) => {
    setTemplates(templates.filter(t => t.id !== template.id));
    setDeleteTarget(null);
  };

  // 检查是否可以删除（BR3）
  const canDelete = (template: VoucherTemplate): boolean => {
    return (template.status === '待审核' || template.status === '已驳回') && !template.isReferenced;
  };

  // 检查是否可以编辑
  const canEdit = (template: VoucherTemplate): boolean => {
    return template.status === '待审核' || template.status === '已驳回';
  };

  // 添加分录行
  const addEntry = () => {
    const newEntry: VoucherEntry = {
      id: `entry-${Date.now()}`,
      summary: '',
      subjectId: '',
      subjectCode: '',
      subjectName: '',
      debitAmount: '',
      creditAmount: '',
      requiresAuxiliary: false
    };
    setFormData({
      ...formData,
      lines: [...formData.lines, newEntry]
    });
  };

  // 删除分录行
  const removeEntry = (entryId: string) => {
    if (formData.lines.length <= 1) {
      alert('至少需要保留一行分录');
      return;
    }
    setFormData({
      ...formData,
      lines: formData.lines.filter(e => e.id !== entryId)
    });
  };

  // 更新分录行
  const updateEntry = (entryId: string, field: keyof VoucherEntry, value: any) => {
    setFormData({
      ...formData,
      lines: formData.lines.map(e => {
        if (e.id === entryId) {
          const updated = { ...e, [field]: value };
          
          // 如果更新的是科目，需要同步更新科目相关信息
          if (field === 'subjectId') {
            const subject = mockSubjects.find(s => s.id === value);
            if (subject) {
              updated.subjectCode = subject.code;
              updated.subjectName = subject.name;
              updated.requiresAuxiliary = subject.hasAuxiliary;
              updated.auxiliaryInfo = subject.hasAuxiliary ? `[需指定${subject.auxiliaryType}]` : undefined;
            }
          }
          
          return updated;
        }
        return e;
      })
    });
  };

  // 处理Tab键导航
  const handleKeyDown = (e: React.KeyboardEvent, entryId: string, field: string, index: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const fields = ['summary', 'subject', 'debitAmount', 'creditAmount'];
      const currentFieldIndex = fields.indexOf(field);
      
      if (currentFieldIndex < fields.length - 1) {
        // 移动到下一个字段
        const nextField = fields[currentFieldIndex + 1];
        const nextInput = document.querySelector(`[data-entry="${entryId}"][data-field="${nextField}"]`) as HTMLInputElement;
        nextInput?.focus();
      } else {
        // 移动到下一行的第一个字段
        const currentEntryIndex = formData.lines.findIndex(e => e.id === entryId);
        if (currentEntryIndex < formData.lines.length - 1) {
          const nextEntryId = formData.lines[currentEntryIndex + 1].id;
          const nextInput = document.querySelector(`[data-entry="${nextEntryId}"][data-field="summary"]`) as HTMLInputElement;
          nextInput?.focus();
        }
      }
    }
  };

  // 保存模板
  const handleSave = () => {
    // 表单验证 - 凭证字号不是必填项，可以为空
    
    // 验证所有分录行
    for (const entry of formData.lines) {
      if (!entry.summary.trim()) {
        alert('所有分录行的摘要不能为空');
        return;
      }
      if (!entry.subjectId) {
        alert('所有分录行必须选择会计科目');
        return;
      }
    }

    // 编码唯一性校验（BR1）- 仅当输入了凭证字号时才检查
    if (formData.voucherType && formData.voucherType.trim()) {
      const duplicate = templates.find(
        t => t.voucherType === formData.voucherType && 
        (!editTarget || t.id !== editTarget.id)
      );
      if (duplicate) {
        alert('凭证字号已存在，请使用其他字号');
        return;
      }
    }

    if (editTarget && !isCopyMode) {
      // 编辑模式
      setTemplates(templates.map(t => 
        t.id === editTarget.id
          ? {
              ...formData,
              updatedAt: new Date().toLocaleString('zh-CN')
            }
          : t
      ));
      updateVoucherTemplate(formData);
    } else {
      // 新增或复制模式
      const newTemplate: VoucherTemplate = {
        ...formData,
        id: `tpl-${Date.now()}`,
        status: '待审核',
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN'),
        isReferenced: false
      };
      setTemplates([...templates, newTemplate]);
      addVoucherTemplate(newTemplate);
    }

    setShowModal(false);
  };

  // 过滤模板数据
  const filteredTemplates = templates.filter(t =>
    t.voucherType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.lines.some(e => e.summary.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">凭证模板管理</h1>
        <p className="text-gray-600">管理全公司可用的记账模板，提高凭证录入效率</p>
      </div>

      {/* 顶部操作区 */}
      <div className="bg-white rounded-lg border mb-4">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="搜索凭证字号或摘要..."
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
                onClick={handleBatchReject}
                disabled={!canApprove || selectedIds.length === 0}
              >
                驳回
              </Button>
              <Button onClick={handleAdd}>
                <Plus className="w-4 h-4 mr-2" />
                新增模板
              </Button>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="pt-3 border-t">
              <span className="text-sm text-gray-600">已选择 {selectedIds.length} 项</span>
            </div>
          )}
        </div>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.length === filteredTemplates.length && filteredTemplates.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[120px]">凭证字号</TableHead>
              <TableHead className="w-[100px]">凭证日期</TableHead>
              <TableHead>摘要</TableHead>
              <TableHead className="w-[80px]">分录数</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[100px]">制单人</TableHead>
              <TableHead className="w-[150px]">更新时间</TableHead>
              <TableHead className="text-right w-[200px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              filteredTemplates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(template.id)}
                      onCheckedChange={(checked) => handleSelectOne(template.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{template.voucherType}</TableCell>
                  <TableCell>{template.voucherDate}</TableCell>
                  <TableCell className="text-gray-600">
                    {template.lines[0]?.summary || '-'}
                  </TableCell>
                  <TableCell>{template.lines.length} 行</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        template.status === '已启用'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : template.status === '待审核'
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                          : 'bg-red-100 text-red-700 hover:bg-red-50'
                      }
                    >
                      {template.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-600">{template.maker}</TableCell>
                  <TableCell className="text-gray-600 text-sm">{template.updatedAt}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        disabled={!canEdit(template)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(template)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        复制
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget(template)}
                                disabled={!canDelete(template)}
                                className={
                                  canDelete(template)
                                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                    : 'text-gray-400 cursor-not-allowed'
                                }
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                删除
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {!canDelete(template) && (
                            <TooltipContent>
                              <p className="text-sm">
                                {template.isReferenced
                                  ? '该模板已被凭证引用，无法删除'
                                  : '只有"待审核"或"已驳回"状态的模板才能删除'}
                              </p>
                            </TooltipContent>
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

      {/* 新增/编辑/复制模板弹窗 - 超大尺寸 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-xl">
              {isCopyMode ? '复制凭证模板' : editTarget ? '编辑证模板' : '新增凭证模板'}
            </DialogTitle>
            <DialogDescription>
              填写模板基本信息和分录明细，留空金额表示使用时填写
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* 凭证头 - 单行紧凑布局 */}
            <div className="border-b border-gray-200 pb-4 mb-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">凭证日期</Label>
                  <Input
                    type="month"
                    value={formData.voucherDate}
                    onChange={(e) => setFormData({ ...formData, voucherDate: e.target.value })}
                    className="w-40 h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">
                    凭证字号 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.voucherType}
                    onChange={(e) => setFormData({ ...formData, voucherType: e.target.value })}
                    placeholder="例如：记-01"
                    className="w-32 h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">制单人</Label>
                  <Input
                    value={formData.maker}
                    onChange={(e) => setFormData({ ...formData, maker: e.target.value })}
                    className="w-32 h-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">审核人</Label>
                  <Input
                    value={formData.reviewer}
                    onChange={(e) => setFormData({ ...formData, reviewer: e.target.value })}
                    placeholder="留空"
                    className="w-32 h-9"
                  />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-sm text-gray-600 whitespace-nowrap">附件数</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.defaultAttachments}
                    onChange={(e) => setFormData({ ...formData, defaultAttachments: parseInt(e.target.value) || 0 })}
                    className="w-20 h-9"
                  />
                </div>
              </div>
            </div>

            {/* 分录网格 - Excel 风格 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-gray-700">分录明细</h3>
              </div>

              {/* 可编辑网格表格 */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[350px]">
                          摘要 <span className="text-red-500">*</span>
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[300px]">
                          会计目代码及名称 <span className="text-red-500">*</span>
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[130px]">
                          借方金额
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[130px]">
                          贷方金额
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[140px]">
                          辅助核算
                        </th>
                        <th className="border border-gray-200 px-3 py-2 text-center text-xs text-gray-600 w-[60px]">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.lines.map((entry, index) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          {/* 摘要 */}
                          <td className="border border-gray-200 p-0">
                            <Input
                              value={entry.summary}
                              onChange={(e) => updateEntry(entry.id, 'summary', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, entry.id, 'summary', index)}
                              data-entry={entry.id}
                              data-field="summary"
                              placeholder="输入摘要"
                              className="border-0 rounded-none h-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-blue-50"
                            />
                          </td>

                          {/* 会计科目 - 下拉搜索 */}
                          <td className="border border-gray-200 p-0">
                            <Popover 
                              open={openSubjectPopover === entry.id} 
                              onOpenChange={(open) => setOpenSubjectPopover(open ? entry.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <button
                                  className="w-full h-10 px-3 text-left text-sm hover:bg-blue-50 flex items-center justify-between"
                                  data-entry={entry.id}
                                  data-field="subject"
                                >
                                  {entry.subjectId ? (
                                    <span>{entry.subjectCode} {entry.subjectName}</span>
                                  ) : (
                                    <span className="text-gray-400">选择科目</span>
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0" align="start">
                                <Command>
                                  <CommandInput placeholder="搜索科目代码、名称或助记码..." />
                                  <CommandEmpty>未找到科目</CommandEmpty>
                                  <CommandGroup className="max-h-64 overflow-y-auto">
                                    {mockSubjects.map((subject) => (
                                      <CommandItem
                                        key={subject.id}
                                        value={`${subject.code} ${subject.name} ${subject.searchCode}`}
                                        onSelect={() => {
                                          updateEntry(entry.id, 'subjectId', subject.id);
                                          setOpenSubjectPopover(null);
                                        }}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span>
                                            {subject.code} {subject.name}
                                          </span>
                                          {subject.hasAuxiliary && (
                                            <Badge variant="outline" className="ml-2 text-xs">
                                              {subject.auxiliaryType}
                                            </Badge>
                                          )}
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </td>

                          {/* 借方金额 */}
                          <td className="border border-gray-200 p-0">
                            <Input
                              type="number"
                              step="0.01"
                              value={entry.debitAmount}
                              onChange={(e) => updateEntry(entry.id, 'debitAmount', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, entry.id, 'debitAmount', index)}
                              data-entry={entry.id}
                              data-field="debitAmount"
                              placeholder="0.00"
                              className="border-0 rounded-none h-10 text-right focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-blue-50"
                            />
                          </td>

                          {/* 贷方金额 */}
                          <td className="border border-gray-200 p-0">
                            <Input
                              type="number"
                              step="0.01"
                              value={entry.creditAmount}
                              onChange={(e) => updateEntry(entry.id, 'creditAmount', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, entry.id, 'creditAmount', index)}
                              data-entry={entry.id}
                              data-field="creditAmount"
                              placeholder="0.00"
                              className="border-0 rounded-none h-10 text-right focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:bg-blue-50"
                            />
                          </td>

                          {/* 辅助核算 */}
                          <td className="border border-gray-200 px-3 py-2">
                            {entry.requiresAuxiliary ? (
                              <Badge 
                                variant="outline" 
                                className="bg-yellow-50 text-yellow-700 border-yellow-300 cursor-pointer hover:bg-yellow-100"
                                onClick={() => {
                                  // 这里可以弹出辅助核算选择器
                                  alert(`请选择${entry.auxiliaryInfo?.replace('[需指定', '').replace(']', '')}`);
                                }}
                              >
                                {entry.auxiliaryInfo}
                              </Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>

                          {/* 操作 */}
                          <td className="border border-gray-200 px-2 py-2 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeEntry(entry.id)}
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 添加分录行按钮 */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addEntry}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加分录行
                </Button>

                {/* 黄色提示 */}
                <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded border border-yellow-200">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>提示：借方金额和贷方金额可留空，使用模板时再填写具体金额</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-gray-50">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>保存模板</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除模板{' '}
              <span className="font-medium">"{deleteTarget?.voucherType}"</span> 吗？此操作不可逆。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-red-600 hover:bg-red-700"
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}