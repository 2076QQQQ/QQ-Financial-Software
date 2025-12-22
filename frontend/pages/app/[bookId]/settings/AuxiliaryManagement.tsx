import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import ExcelJS from 'exceljs';

import { 
  Plus, Edit, Trash2, Search, ArrowRight, 
  FileSpreadsheet, Download, Loader2, AlertCircle, Upload,
  Settings, Info, LayoutGrid, X
} from 'lucide-react';
interface AuxiliaryManagementProps {
  onNavigate: (path: string) => Promise<boolean>;
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table'; 
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import { 
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction 
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from 'sonner'; // 建议加上这个用于显示报错，如果没有安装可以用 alert

// 引用 API 
import { 
    getAuxiliaryCategories,
    createAuxiliaryCategory,
    updateAuxiliaryCategory,
    deleteAuxiliaryCategory, // ✨ 新增
    getAllAuxiliaryItems, 
    addAuxiliaryItem, 
    updateAuxiliaryItem, 
    deleteAuxiliaryItem,
    updateAccountBook 
} from '@/lib/mockData';

const DEFAULT_CATEGORIES = [
  { name: '客户', isBuiltIn: true },
  { name: '供应商', isBuiltIn: true },
  { name: '部门', isBuiltIn: true },
  { name: '职员', isBuiltIn: true },
  { name: '项目', isBuiltIn: true },
  { name: '存货', isBuiltIn: true },
  { name: '资金账号', isBuiltIn: true } 
];

interface AuxCategory {
    id: string;
    name: string;
    isBuiltIn: boolean;
}

interface AuxiliaryItem {
  id: string;
  categoryId: string;
  code: string;
  name: string;
  isActive: boolean;
  isReferenced: boolean;
}

export default function AuxiliaryManagement({ onNavigate }: AuxiliaryManagementProps) {
  const router = useRouter();
  const { bookId } = router.query; 
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;

  // --- State ---
  const [categories, setCategories] = useState<AuxCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(''); 
  const [items, setItems] = useState<AuxiliaryItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);

  // --- Modal States ---
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  // --- Targets & Form Data ---
  const [editItemTarget, setEditItemTarget] = useState<AuxiliaryItem | null>(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState<AuxiliaryItem | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<AuxCategory | null>(null); // ✨ 删除维度的目标
  
  const [itemFormData, setItemFormData] = useState({ name: '', code: '', isActive: true });
  const [categoryFormData, setCategoryFormData] = useState({ name: '' });

  const [searchTerm, setSearchTerm] = useState('');

  // 1. 初始化：加载维度列表
  const loadCategories = async () => {
      if (!currentBookId) return;
      setIsCategoryLoading(true);
      try {
          let cats = await getAuxiliaryCategories(currentBookId);
          
          if (!cats || cats.length === 0) {
              await Promise.all(DEFAULT_CATEGORIES.map(def => 
                  createAuxiliaryCategory({
                      name: def.name,
                      bookId: currentBookId,
                      isBuiltIn: def.isBuiltIn
                  })
              ));
              cats = await getAuxiliaryCategories(currentBookId);
          }

          setCategories(cats || []);
          
          // 如果当前选中的ID不在新的列表中（比如刚被删除），则重置选中第一个
          if (cats && cats.length > 0) {
              const currentExists = cats.find((c: AuxCategory) => c.id === activeCategoryId);
              if (!activeCategoryId || !currentExists) {
                  setActiveCategoryId(cats[0].id);
              }
          }
      } catch (e) {
          console.error("加载维度失败", e);
      } finally {
          setIsCategoryLoading(false);
      }
  };

  // 2. 监听 Tab 变化，加载对应的档案列表
  const loadItems = async () => {
      if (!currentBookId || !activeCategoryId) return;
      setIsLoading(true);
      try {
          const data = await getAllAuxiliaryItems(currentBookId, activeCategoryId);
          setItems(data || []);
      } catch (error) {
          console.error("加载档案失败", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    if (router.isReady && currentBookId) {
      loadCategories();
    }
  }, [router.isReady, currentBookId]);

  useEffect(() => {
      if (activeCategoryId) {
          loadItems();
      }
  }, [activeCategoryId]);


  // --- Logic: Category Management ---
  const handleAddCategory = () => {
      setCategoryFormData({ name: '' });
      setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
      if (!categoryFormData.name.trim()) return alert('请输入维度名称');
      if (!currentBookId) return;
      
      try {
          const newCat = await createAuxiliaryCategory({
              name: categoryFormData.name,
              bookId: currentBookId,
              isBuiltIn: false
          });
          await loadCategories(); 
          setActiveCategoryId(newCat.id);
          setShowCategoryModal(false);
      } catch (e) {
          alert('创建维度失败');
      }
  };

  // ✨ 删除维度逻辑
  const handleDeleteCategory = async () => {
      if (!deleteCategoryTarget) return;
      try {
          await deleteAuxiliaryCategory(deleteCategoryTarget.id);
          setDeleteCategoryTarget(null);
          // 删除成功后刷新列表，loadCategories 会自动处理 activeTab 的切换
          await loadCategories(); 
      } catch (e: any) {
          // 显示后端返回的具体错误信息（如：该维度下有档案）
          const msg = e.message || '删除失败';
          alert(msg); // 或者使用 toast.error(msg)
      }
  };


  // --- Logic: Item Management ---
  const handleGenerateCode = () => `AUTO-${Date.now().toString().slice(-4)}`;

  const handleAddItem = () => {
    setEditItemTarget(null);
    setItemFormData({ name: '', code: handleGenerateCode(), isActive: true });
    setShowItemModal(true);
  };

  const handleEditItem = (item: AuxiliaryItem) => {
    setEditItemTarget(item);
    setItemFormData({ name: item.name, code: item.code, isActive: item.isActive });
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!currentBookId || !activeCategoryId) return;
    if (!itemFormData.name.trim()) return alert('请输入名称');
    
    setIsLoading(true);
    try {
        if (editItemTarget) {
          await updateAuxiliaryItem({ ...editItemTarget, ...itemFormData });
        } else {
          await addAuxiliaryItem({ 
              categoryId: activeCategoryId, 
              ...itemFormData, 
              isReferenced: false 
          }, currentBookId);
        }
        await loadItems();
        setShowItemModal(false);
    } catch (e) {
        console.error(e);
        alert('保存失败');
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteItem = async (item: AuxiliaryItem) => {
    if (item.isReferenced) return alert('该项目已被引用，无法删除');
    if (item.isActive) return alert('必须先停用该项目，才能删除');

    try {
        await deleteAuxiliaryItem(item.id);
        await loadItems();
        setDeleteItemTarget(null);
    } catch (e) {
        alert('删除失败');
    }
  };

  // --- Logic: Excel ---
  const activeCategoryName = categories.find(c => c.id === activeCategoryId)?.name || '未知';

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${activeCategoryName}导入模板`);
    sheet.columns = [
      { header: '名称(必填)', key: 'name', width: 30 },
      { header: '编码(选填)', key: 'code', width: 20 },
      { header: '状态(启用/停用)', key: 'status', width: 15 },
    ];
    sheet.addRow({ name: '示例名称', code: '', status: '启用' });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCategoryName}_模板.xlsx`;
    a.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentBookId || !activeCategoryId) return;
    
    setIsImporting(true);
    try {
      const ab = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(ab);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('No sheet');

      const newItems: any[] = [];
      ws.eachRow((row, n) => {
        if (n === 1) return; 
        const name = row.getCell(1).text; 
        const code = row.getCell(2).text; 
        const status = row.getCell(3).text; 
        
        if (name) {
            newItems.push({
                categoryId: activeCategoryId,
                name: name,
                code: code || handleGenerateCode(),
                isActive: status !== '停用',
                isReferenced: false
            });
        }
      });
      
      for (const item of newItems) {
          await addAuxiliaryItem(item, currentBookId); 
      }
      await loadItems();
      alert(`成功导入 ${newItems.length} 条`);
      setShowImportModal(false);
    } catch (e) {
      console.error(e);
      alert('导入失败，请检查文件格式');
    } finally {
      setIsImporting(false);
      e.target.value = ''; 
    }
  };

  const handleCompleteAndNext = async () => {
    if (!currentBookId) return;
    try {
        await updateAccountBook({
            id: currentBookId,
            auxiliaryConfigured: true
        });
        router.push(`/app/${currentBookId}/settings/fund-accounts`);
    } catch (error) {
        console.error("更新状态失败", error);
        router.push(`/app/${currentBookId}/settings/fund-accounts`);
    }
  };

  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* 头部区域 */}
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center">
                <LayoutGrid className="w-5 h-5 mr-2 text-blue-600" />
                辅助核算维度设置
            </h1>
            <p className="text-xs text-gray-500 mt-1">
                定义核算维度（如客户、项目）及其具体档案。维度将在科目设置中被引用。
            </p>
        </div>
        
        <Button variant="outline" size="sm" onClick={handleAddCategory} className="h-8 border-dashed border-gray-400 text-gray-600 hover:border-blue-500 hover:text-blue-600">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            新建自定义维度
        </Button>
      </div>

      {/* 温馨提示 */}
      <Alert variant="default" className="bg-blue-50/60 border-blue-100 text-blue-900 p-3 flex items-start">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="ml-3">
            <AlertTitle className="text-sm font-bold text-blue-800 mb-1">温馨提示</AlertTitle>
            <AlertDescription className="text-sm text-blue-700 leading-relaxed">
                建议仅设置必要的核算维度，维度过多会增加凭证录入的工作量。常用维度：客户、供应商、员工、部门、项目。
            </AlertDescription>
          </div>
      </Alert>

      {/* 核心内容区 */}
      <div className="bg-white rounded-lg border shadow-sm min-h-[500px] flex flex-col">
        {/* 如果正在加载维度 */}
        {isCategoryLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-200 mb-3" />
                <span>加载配置中...</span>
            </div>
        ) : (
             <Tabs value={activeCategoryId} onValueChange={setActiveCategoryId} className="flex flex-col h-full">
                
                {/* 优化的 Tabs 头部：支持横向滚动，增加删除按钮 */}
                <div className="border-b bg-gray-50/50 px-2 pt-2">
                    <TabsList className="bg-transparent p-0 h-auto flex overflow-x-auto space-x-1 no-scrollbar items-end w-full justify-start">
                        {categories.map(cat => (
                            <div key={cat.id} className="group relative flex items-center">
                                <TabsTrigger 
                                    value={cat.id}
                                    className="
                                        rounded-t-md rounded-b-none border-t border-x border-transparent 
                                        data-[state=active]:bg-white data-[state=active]:border-gray-200 data-[state=active]:shadow-none data-[state=active]:text-blue-700
                                        px-4 py-2.5 font-medium text-gray-600 hover:text-gray-900 transition-all text-sm shrink-0 pr-8
                                    "
                                >
                                    {cat.name}
                                </TabsTrigger>
                                {/* ✨ 删除维度按钮：仅对非内置维度显示 */}
                                {!cat.isBuiltIn && (
                                    <span 
                                        onClick={(e) => {
                                            e.stopPropagation(); // 防止触发Tab切换
                                            setDeleteCategoryTarget(cat);
                                        }}
                                        className="
                                            absolute right-2 top-1/2 -translate-y-1/2 
                                            p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50
                                            opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10
                                        "
                                        title="删除此维度"
                                    >
                                        <X size={12} />
                                    </span>
                                )}
                            </div>
                        ))}
                    </TabsList>
                </div>

                {/* 工具栏 */}
                <div className="p-3 border-b flex items-center justify-between gap-4 bg-white">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input 
                        placeholder={`搜索${activeCategoryName}...`} 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        className="pl-9 h-9 bg-white text-sm"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} className="h-9">
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-green-600"/>
                            导入
                        </Button>
                        <Button size="sm" onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700 h-9 shadow-sm">
                            <Plus className="w-3.5 h-3.5 mr-1.5"/>
                            新增{activeCategoryName}
                        </Button>
                    </div>
                </div>

                {/* 表格主体 */}
                <div className="flex-1 overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50/50 border-b border-gray-100 hover:bg-gray-50">
                            <TableHead className="w-[180px] font-semibold text-gray-700 pl-4">编码</TableHead>
                            <TableHead className="font-semibold text-gray-700">名称</TableHead>
                            <TableHead className="w-[100px] font-semibold text-gray-700">状态</TableHead>
                            <TableHead className="w-[100px] font-semibold text-gray-700">引用情况</TableHead>
                            <TableHead className="text-right pr-6 font-semibold text-gray-700">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                    数据加载中...
                                </TableCell>
                            </TableRow>
                            ) : filteredItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-48 text-center text-gray-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <p className="mb-2 text-sm">暂无“{activeCategoryName}”档案</p>
                                        <Button variant="link" size="sm" onClick={handleAddItem}>立即创建</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                            ) : (
                            filteredItems.map(item => (
                                <TableRow key={item.id} className="group hover:bg-slate-50 transition-colors">
                                <TableCell className="font-mono text-gray-600 pl-4">{item.code}</TableCell>
                                <TableCell className="font-medium text-gray-900">{item.name}</TableCell>
                                <TableCell>
                                    {item.isActive ? (
                                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-normal">启用</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 font-normal">停用</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {item.isReferenced ? (
                                        <Badge variant="secondary" className="font-normal text-xs text-blue-600 bg-blue-50">已引用</Badge> 
                                    ) : (
                                        <span className="text-gray-300 text-xs">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleEditItem(item)}>
                                        <Edit className="w-3.5 h-3.5"/>
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30" 
                                        onClick={() => setDeleteItemTarget(item)} 
                                        disabled={item.isActive || item.isReferenced}
                                    >
                                        <Trash2 className="w-3.5 h-3.5"/>
                                    </Button>
                                    </div>
                                </TableCell>
                                </TableRow>
                            ))
                            )}
                        </TableBody>
                    </Table>
                </div>
             </Tabs>
        )}
      </div>

      {/* 弹窗：档案编辑/新增 */}
      <Dialog open={showItemModal} onOpenChange={setShowItemModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
              <DialogTitle>{editItemTarget ? `编辑档案` : `新增档案`}</DialogTitle>
              <DialogDescription>
                  当前维度：<span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{activeCategoryName}</span>
              </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-gray-500">编码</Label>
              <Input value={itemFormData.code} disabled className="col-span-3 bg-gray-50 font-mono text-gray-600 h-9"/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-gray-500">名称 <span className="text-red-500">*</span></Label>
              <Input 
                value={itemFormData.name} 
                onChange={e => setItemFormData({...itemFormData, name: e.target.value })} 
                className="col-span-3 h-9 focus-visible:ring-blue-500"
                placeholder="请输入档案名称"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-gray-500">状态</Label>
                <div className="col-span-3 flex gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" className="accent-blue-600 w-4 h-4" checked={itemFormData.isActive} onChange={() => setItemFormData({...itemFormData, isActive: true})}/>
                        启用
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" className="accent-blue-600 w-4 h-4" checked={!itemFormData.isActive} onChange={() => setItemFormData({...itemFormData, isActive: false})}/>
                        停用
                    </label>
                </div>
            </div>
          </div>
          <DialogFooter>
              <Button variant="outline" onClick={() => setShowItemModal(false)}>取消</Button>
              <Button onClick={handleSaveItem} className="bg-blue-600 hover:bg-blue-700">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 弹窗：新增核算维度 */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
              <DialogTitle>新建辅助核算维度</DialogTitle>
              <DialogDescription>
                  创建一个新的核算维度类别，例如“货位”、“合同”、“车辆”。
              </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">维度名称</Label>
              <Input 
                value={categoryFormData.name} 
                onChange={e => setCategoryFormData({ name: e.target.value })} 
                placeholder="例如：合同编号"
                className="col-span-3 h-9"
              />
            </div>
          </div>
          <DialogFooter>
              <Button variant="outline" onClick={() => setShowCategoryModal(false)}>取消</Button>
              <Button onClick={handleSaveCategory} className="bg-blue-600 hover:bg-blue-700">创建维度</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 导入弹窗 */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>批量导入 - {activeCategoryName}</DialogTitle>
                <DialogDescription>请下载模板，填入数据后上传。</DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-6">
                <Button variant="outline" onClick={handleDownloadTemplate} className="w-full h-12 border-dashed border-2 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-600">
                    <Download className="mr-2 h-5 w-5 text-blue-600"/>
                    步骤 1: 下载 Excel 模板
                </Button>
                
                <div className="relative flex items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isImporting ? (
                             <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                        ) : (
                             <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        )}
                        <p className="text-sm text-gray-500">
                            {isImporting ? '正在解析并导入数据...' : <><span className="font-semibold text-blue-600">点击上传</span> 或拖拽文件至此</>}
                        </p>
                    </div>
                    <input type="file" accept=".xlsx" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isImporting}/>
                </div>
            </div>
        </DialogContent>
      </Dialog>

      {/* 删除档案确认 */}
      <AlertDialog open={!!deleteItemTarget} onOpenChange={(open) => !open && setDeleteItemTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除档案？</AlertDialogTitle>
            <AlertDialogDescription>
                您正在删除档案 <span className="font-bold text-gray-900">"{deleteItemTarget?.name}"</span>。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteItemTarget && handleDeleteItem(deleteItemTarget)} className="bg-red-600 hover:bg-red-700">
                确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ✨ 删除维度确认 */}
      <AlertDialog open={!!deleteCategoryTarget} onOpenChange={(open) => !open && setDeleteCategoryTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5"/>
                确认删除维度？
            </AlertDialogTitle>
            <AlertDialogDescription>
                您正在删除自定义维度 <span className="font-bold text-gray-900">"{deleteCategoryTarget?.name}"</span>。<br/><br/>
                <span className="text-xs bg-red-50 text-red-600 p-2 rounded block">
                    注意：删除前必须先清空该维度下的所有档案，且确保没有科目引用此维度。
                </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-red-600 hover:bg-red-700">
                确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 底部按钮 */}
      <div className="mt-6 pt-4 border-t flex justify-end items-center">
        <div className="flex-1 text-sm text-gray-500">
            已配置 <span className="font-bold text-gray-900">{categories.length}</span> 个核算维度
        </div>
        <Button 
            size="default" 
            className="bg-gray-900 text-white hover:bg-gray-800 shadow-sm" 
            onClick={handleCompleteAndNext}
        >
            完成设置，下一步
            <ArrowRight className="w-4 h-4 ml-2"/>
        </Button>
      </div>
    </div>
  );
}