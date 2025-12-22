/*
import { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Search, Download, Upload, ChevronRight, ChevronDown, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList, // 必须引入
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

// 引入 XLSX 库 (确保你已经 npm install xlsx)
import * as XLSX from 'xlsx';

import { 
  getExpenseCategories, 
  addExpenseCategory, 
  updateExpenseCategory, 
  deleteExpenseCategory,
  getAllSubjects 
} from '@/lib/mockData';

// --- 类型定义 ---
interface IncomeCategory {
  id: string;
  code: string;
  name: string;
  type: 'expense' | 'income'; 
  parentId?: string;
  parentName?: string;
  subjectId: string; 
  subjectCode: string; 
  subjectName: string; 
  cashFlowId?: string; 
  cashFlowName?: string; 
  keywords?: string[]; 
  isEnabled: boolean; 
  children?: IncomeCategory[];
  isExpanded?: boolean; 
  level?: number; 
}

interface Subject {
  id: string;
  code: string;
  name: string;
  category?: string; 
}

const mockCashFlows = [
  { id: 'cf1', name: '销售商品、提供劳务收到的现金' },
  { id: 'cf2', name: '收到其他与经营活动有关的现金' },
  { id: 'cf3', name: '购买商品、接受劳务支付的现金' },
  { id: 'cf4', name: '支付给职工以及为职工支付的现金' },
];

export default function IncomeCategoryManagement() {
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [currentTab, setCurrentTab] = useState<'expense' | 'income'>('expense');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<IncomeCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeCategory | null>(null);
  
  const [openSubjectPopover, setOpenSubjectPopover] = useState(false);
  const [openCashFlowPopover, setOpenCashFlowPopover] = useState(false);
  const [parentLocked, setParentLocked] = useState(false);

  // 文件上传的 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<IncomeCategory>>({
    code: '',
    name: '',
    type: 'expense',
    isEnabled: true,
    level: 0
  });

  // --- 1. 初始加载 ---
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesData, subjectsData] = await Promise.all([
        getExpenseCategories(),
        getAllSubjects()
      ]);
      if (Array.isArray(subjectsData)) setSubjects(subjectsData);
      if (Array.isArray(categoriesData)) {
        const tree = buildCategoryTree(categoriesData);
        setCategories(tree);
      }
    } catch (error) {
      console.error("加载数据失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshList = async () => {
    try {
      const data = await getExpenseCategories();
      if (Array.isArray(data)) {
        setCategories(buildCategoryTree(data));
      }
    } catch (error) {
      console.error("刷新列表失败:", error);
    }
  };

  // --- EXCEL 功能区 (核心修改) ---

  // 1. 下载导入模板
  const handleDownloadTemplate = () => {
    // 定义表头
    const headers = [
      ['编码*', '名称*', '上级类别编码', '会计科目编码*', '现金流项目', '类型(支出/收入)']
    ];
    // 创建 Sheet
    const ws = XLSX.utils.aoa_to_sheet(headers);
    
    // 设置列宽 (可选优化)
    ws['!cols'] = [
      { wch: 15 }, // 编码
      { wch: 25 }, // 名称
      { wch: 15 }, // 上级编码
      { wch: 15 }, // 科目编码
      { wch: 25 }, // 现金流
      { wch: 10 }  // 类型
    ];

    // 写入 Workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "导入模板");
    
    // 下载文件
    XLSX.writeFile(wb, "收支类别导入模板.xlsx");
  };

  // 2. 导出当前数据
  const handleExportExcel = () => {
    // 准备数据：将树形结构展平，只导出当前 Tab 的数据
    const flatData: any[] = [];
    
    const traverse = (nodes: IncomeCategory[]) => {
      nodes.forEach(node => {
        if (node.type === currentTab) {
          flatData.push({
            '编码': node.code,
            '名称': node.name,
            '上级编码': node.parentName ? categories.find(p => p.id === node.parentId)?.code || '' : '',
            '会计科目': `${node.subjectCode} ${node.subjectName}`,
            '现金流项目': node.cashFlowName || '',
            '状态': node.isEnabled ? '启用' : '禁用'
          });
        }
        if (node.children) traverse(node.children);
      });
    };
    traverse(categories);

    if (flatData.length === 0) {
      alert("当前没有数据可导出");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(flatData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currentTab === 'expense' ? "支出类别" : "收入类别");
    XLSX.writeFile(wb, `收支类别导出_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // 3. 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 4. 处理 Excel 文件导入
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' }); // 读取 Excel
        const wsname = wb.SheetNames[0]; // 取第一个 Sheet
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws); // 转为 JSON

        console.log("解析到的数据:", data);
        
        if (data.length > 0) {
           // 模拟提交给后端
           // const res = await api.importCategories(data);
           alert(`解析成功！读取到 ${data.length} 条数据。\n请查看控制台(F12)确认数据格式是否符合预期。`);
        } else {
           alert("文件中没有数据");
        }
      } catch (error) {
        console.error(error);
        alert("文件解析失败，请确保是标准的 Excel (.xlsx/.xls) 文件");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // 清空 input 防止无法连续上传同名文件
  };

  // --- 增删改逻辑 ---
  const handleSave = async () => {
    if (!formData.code || !formData.name || !formData.subjectId) {
      alert('请填写编码、名称及关联会计科目');
      return;
    }
    const payload = { ...formData };
    delete payload.children;
    delete payload.isExpanded;

    try {
      if (editTarget) {
        await updateExpenseCategory({ ...payload, id: editTarget.id });
      } else {
        await addExpenseCategory(payload);
      }
      setShowModal(false);
      refreshList();
    } catch (error: any) {
      console.error(error);
      alert('保存失败，请检查编码是否重复');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpenseCategory(deleteTarget.id);
      setDeleteTarget(null);
      refreshList();
    } catch (error) {
      alert('删除失败：可能该类别已被使用或存在子类别');
    }
  };

  const toggleEnabled = async (category: IncomeCategory) => {
    try {
      await updateExpenseCategory({ 
        id: category.id, 
        isEnabled: !category.isEnabled 
      });
      refreshList();
    } catch (error) {
      alert('状态更新失败');
    }
  };

  // --- 树形/平铺处理 ---
  const buildCategoryTree = (flatList: IncomeCategory[]): IncomeCategory[] => {
    const map = new Map<string, IncomeCategory>();
    const roots: IncomeCategory[] = [];
    const list = flatList.map(item => ({ ...item, children: [], isExpanded: true, level: 0 }));

    list.forEach(item => map.set(item.id, item));
    list.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!;
        item.level = (parent.level || 0) + 1;
        item.parentName = parent.name;
        parent.children?.push(item);
      } else {
        roots.push(item);
      }
    });
    return roots.sort((a, b) => a.code.localeCompare(b.code));
  };

  const flattenForDisplay = (nodes: IncomeCategory[]): IncomeCategory[] => {
    let result: IncomeCategory[] = [];
    const rootNodes = nodes.filter(n => n.type === currentTab);

    const traverse = (items: IncomeCategory[]) => {
      for (const item of items) {
        const match = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      item.code.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (searchTerm) {
          let shouldDisplay = match;
          if (!shouldDisplay && item.children) {
             shouldDisplay = item.children.some(child => 
               child.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
               child.code.toLowerCase().includes(searchTerm.toLowerCase())
             );
          }
          if (shouldDisplay) result.push(item);
          if (item.children) traverse(item.children);
        } else {
          result.push(item);
          if (item.isExpanded && item.children) {
            traverse(item.children);
          }
        }
      }
    };
    traverse(rootNodes);
    return result;
  };
  
  const displayCategories = flattenForDisplay(categories);

  // --- UI Event Handlers ---
  const handleAdd = () => {
    setEditTarget(null);
    setParentLocked(false);
    setFormData({
      code: '',
      name: '',
      type: currentTab,
      subjectId: '',
      subjectCode: '',
      subjectName: '',
      isEnabled: true,
      level: 0
    });
    setShowModal(true);
  };

  const handleAddChild = (parent: IncomeCategory) => {
    setEditTarget(null);
    setParentLocked(true);
    setFormData({
      code: `${parent.code}-`, 
      name: '',
      type: currentTab,
      parentId: parent.id,
      parentName: parent.name,
      subjectId: parent.subjectId, 
      subjectCode: parent.subjectCode,
      subjectName: parent.subjectName,
      isEnabled: true,
      level: (parent.level || 0) + 1
    });
    setShowModal(true);
  };

  const handleEdit = (category: IncomeCategory) => {
    setEditTarget(category); 
    setParentLocked(!!category.parentId); 
    setFormData({ ...category });
    setShowModal(true); 
  };

  const toggleExpand = (id: string) => {
    const toggle = (items: IncomeCategory[]): IncomeCategory[] => {
      return items.map(item => {
        if (item.id === id) return { ...item, isExpanded: !item.isExpanded };
        if (item.children) return { ...item, children: toggle(item.children) };
        return item;
      });
    };
    setCategories(toggle(categories));
  };
  
  const canSave = formData.code?.trim() && formData.name?.trim() && formData.subjectId;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">收支类别管理</h1>
        <p className="text-gray-600">
          配置资金收支与会计科目的映射规则，支持 Excel 批量导入导出
        </p>
      </div>

      <div className="bg-white rounded-lg border mb-4">
        <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as any)}>
          <div className="border-b px-4 pt-4">
            <TabsList>
              <TabsTrigger value="expense">支出类别</TabsTrigger>
              <TabsTrigger value="income">收入类别</TabsTrigger>
            </TabsList>
          </div>

          {/* 工具栏 }
          <div className="p-4 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索编码或名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-gray-100 border-none shadow-none focus-visible:ring-1 focus-visible:bg-white transition-colors"
                />
              </div>
              
              {/* 导入导出按钮组 }
              <div className="flex items-center gap-2 border-l pl-4 ml-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-600 hover:bg-gray-100"
                  onClick={handleDownloadTemplate}
                  title="下载Excel模板"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" /> 模板
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white hover:bg-gray-50"
                  onClick={handleImportClick}
                >
                  <Upload className="w-4 h-4 mr-2" /> 导入
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white hover:bg-gray-50"
                  onClick={handleExportExcel}
                >
                  <Download className="w-4 h-4 mr-2" /> 导出
                </Button>

                {/* 隐藏的文件输入框，用于触发文件选择 *}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".xlsx, .xls" // 限制只能选 Excel
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            <Button onClick={handleAdd} className="bg-black text-white hover:bg-gray-800">
              <Plus className="w-4 h-4 mr-2" />
              新增类别
            </Button>
          </div>

          <TabsContent value={currentTab} className="m-0">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">编码</TableHead>
                    <TableHead className="w-[300px]">名称</TableHead>
                    <TableHead>关联会计科目</TableHead>
                    <TableHead>关联现金流</TableHead>
                    <TableHead className="w-[100px]">状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">加载中...</TableCell></TableRow>
                  ) : displayCategories.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">暂无数据</TableCell></TableRow>
                  ) : (
                    displayCategories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center" style={{ paddingLeft: `${(cat.level || 0) * 20}px` }}>
                            {cat.children && cat.children.length > 0 ? (
                              <button onClick={() => toggleExpand(cat.id)} className="mr-1 p-1 hover:bg-gray-100 rounded">
                                {cat.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            ) : <span className="w-6 block" />}
                            {cat.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {cat.subjectCode ? (
                            <Badge variant="outline" className="font-normal text-gray-700">
                              {cat.subjectCode} {cat.subjectName}
                            </Badge>
                          ) : <span className="text-red-400 text-xs">未配置</span>}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{cat.cashFlowName || '-'}</TableCell>
                        <TableCell>
                          <Switch checked={cat.isEnabled} onCheckedChange={() => toggleEnabled(cat)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(cat)}>
                              <Edit className="w-4 h-4 mr-1" /> 编辑
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleAddChild(cat)}
                              disabled={cat.level !== 0} 
                            >
                              <Plus className="w-4 h-4 mr-1" /> 子类别
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span tabIndex={0}>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setDeleteTarget(cat)} 
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>删除类别</p>
                                </TooltipContent>
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
          </TabsContent>
        </Tabs>
      </div>

      {/* 新增/编辑弹窗 *}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? '编辑' : '新增'}{currentTab === 'expense' ? '支出' : '收入'}类别</DialogTitle>
            <DialogDescription>配置该类别的默认会计科目，以便在录入日记账时自动生成凭证。</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>编码 <span className="text-red-500">*</span></Label>
                {/* 修复：增加了 bg-gray-50 和 border-gray-300 样式 *}
                <Input 
                  value={formData.code} 
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className="bg-gray-50 border-gray-300 focus:bg-white transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label>名称 <span className="text-red-500">*</span></Label>
                {/* 修复：增加了 bg-gray-50 和 border-gray-300 样式 *}
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="bg-gray-50 border-gray-300 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>上级类别</Label>
              {parentLocked ? (
                <Input value={formData.parentName || '无'} disabled className="bg-gray-100 text-gray-500" />
              ) : (
                <div className="text-sm text-gray-500 border p-2 rounded bg-gray-50">
                  {editTarget?.parentName ? `当前上级：${editTarget.parentName}` : '一级类别 (无上级)'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>关联会计科目 <span className="text-red-500">*</span></Label>
              <Popover open={openSubjectPopover} onOpenChange={setOpenSubjectPopover} modal={true}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox"
                    type="button"
                    className="w-full justify-start text-left font-normal"
                  >
                    {formData.subjectId 
                      ? <span className="text-black">{formData.subjectCode} {formData.subjectName}</span> 
                      : <span className="text-gray-500">选择会计科目</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 z-[9999]" align="start" side="bottom">
                  <Command>
                    <CommandInput placeholder="搜索科目..." />
                    {/* 关键修复：引入 CommandList 解决点击无效问题 *}
                    <CommandList>
                      <CommandEmpty>
                        {subjects.length === 0 ? "未加载到数据" : "无搜索结果"}
                      </CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        {subjects.map(sub => (
                          <CommandItem 
                            key={sub.id} 
                            value={`${sub.code} ${sub.name}`} 
                            onSelect={() => {
                              setFormData({
                                ...formData, 
                                subjectId: sub.id, 
                                subjectCode: sub.code, 
                                subjectName: sub.name 
                              });
                              setOpenSubjectPopover(false);
                            }}
                          >
                            <span>{sub.code}</span>
                            <span className="ml-2">{sub.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>关联现金流项目 (可选)</Label>
              <Popover open={openCashFlowPopover} onOpenChange={setOpenCashFlowPopover} modal={true}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    role="combobox"
                    type="button"
                    className="w-full justify-start text-left font-normal"
                  >
                    {formData.cashFlowId 
                      ? <span className="text-black">{formData.cashFlowName}</span> 
                      : <span className="text-gray-500">选择现金流项目</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 z-[9999]" align="start" side="bottom">
                  <Command>
                    <CommandInput placeholder="搜索..." />
                    {/* 关键修复：引入 CommandList *}
                    <CommandList>
                      <CommandEmpty>无结果</CommandEmpty>
                      <CommandGroup>
                        {mockCashFlows.map(flow => (
                          <CommandItem key={flow.id} onSelect={() => {
                            setFormData({
                              ...formData,
                              cashFlowId: flow.id,
                              cashFlowName: flow.name
                            });
                            setOpenCashFlowPopover(false);
                          }}>
                            {flow.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>取消</Button>
            <Button onClick={handleSave} disabled={!canSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认 *}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除?</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除类别"{deleteTarget?.name}"吗？<br/>
              如果该类别已被使用，系统将阻止删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600">删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
*/
