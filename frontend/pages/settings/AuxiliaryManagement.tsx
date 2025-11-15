import { useState } from 'react';
import { Plus, Edit, Trash2, Search, ArrowRight } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';  

interface AuxiliaryItem {
  id: string;
  category: '存货' | '客户' | '供应商' | '部门' | '职员' | '项目';
  name: string;
  code: string;
  isActive: boolean;
  isReferenced: boolean;  // 是否已被凭证引用
}

interface AuxiliaryManagementProps {
  onNavigate?: (path: string) => void;
}

export default function AuxiliaryManagement({ onNavigate }: AuxiliaryManagementProps = {}) {
  const [activeTab, setActiveTab] = useState<'存货' | '客户' | '供应商' | '部门' | '职员' | '项目'>('客户');
  const [items, setItems] = useState<AuxiliaryItem[]>([
    // 客户
    { id: 'c1', category: '客户', name: '深圳市腾讯科技有限公司', code: 'KH001', isActive: true, isReferenced: false },
    { id: 'c2', category: '客户', name: '阿里巴巴（中国）有限公司', code: 'KH002', isActive: true, isReferenced: false },
    { id: 'c3', category: '客户', name: '北京字节跳动科技有限公司', code: 'KH003', isActive: true, isReferenced: false },
    // 供应商
    { id: 's1', category: '供应商', name: '华为技术有限公司', code: 'GYS001', isActive: true, isReferenced: false },
    { id: 's2', category: '供应商', name: '小米科技有限责任公司', code: 'GYS002', isActive: true, isReferenced: false },
    // 部门
    { id: 'd1', category: '部门', name: '研发部', code: 'BM001', isActive: true, isReferenced: false },
    { id: 'd2', category: '部门', name: '销售部', code: 'BM002', isActive: true, isReferenced: false },
    { id: 'd3', category: '部门', name: '行政部', code: 'BM003', isActive: true, isReferenced: false },
    // 职员
    { id: 'e1', category: '职员', name: '张三', code: 'ZY001', isActive: true, isReferenced: false },
    { id: 'e2', category: '职员', name: '李四', code: 'ZY002', isActive: true, isReferenced: false },
    // 项目
    { id: 'p1', category: '项目', name: 'ERP系统开发项目', code: 'XM001', isActive: true, isReferenced: false },
    // 存货
    { id: 'i1', category: '存货', name: '笔记本电脑', code: 'CH001', isActive: true, isReferenced: false },
    { id: 'i2', category: '存货', name: '办公桌椅', code: 'CH002', isActive: true, isReferenced: false },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AuxiliaryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuxiliaryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    isActive: true
  });

  // 生成编码
  const generateCode = (category: string): string => {
    const prefixes: Record<string, string> = {
      '存货': 'CH',
      '客户': 'KH',
      '供应商': 'GYS',
      '部门': 'BM',
      '职员': 'ZY',
      '项目': 'XM'
    };
    const prefix = prefixes[category];
    const existing = items.filter(i => i.category === category);
    const maxNum = existing.length > 0 
      ? Math.max(...existing.map(i => parseInt(i.code.replace(prefix, '')) || 0))
      : 0;
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  // 新增
  const handleAdd = () => {
    setEditTarget(null);
    setFormData({
      name: '',
      code: generateCode(activeTab),
      isActive: true
    });
    setShowModal(true);
  };

  // 编辑
  const handleEdit = (item: AuxiliaryItem) => {
    setEditTarget(item);
    setFormData({
      name: item.name,
      code: item.code,
      isActive: item.isActive
    });
    setShowModal(true);
  };

  // 保存
  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('请输入名称');
      return;
    }

    if (editTarget) {
      setItems(items.map(i => 
        i.id === editTarget.id
          ? { ...i, name: formData.name, isActive: formData.isActive }
          : i
      ));
    } else {
      const newItem: AuxiliaryItem = {
        id: `${activeTab}-${Date.now()}`,
        category: activeTab,
        name: formData.name,
        code: formData.code,
        isActive: formData.isActive,
        isReferenced: false
      };
      setItems([...items, newItem]);
    }
    setShowModal(false);
  };

  // 删除
  const handleDelete = (item: AuxiliaryItem) => {
    if (item.isReferenced) {
      alert('该项目已被凭证引用，无法删除');
      return;
    }
    setItems(items.filter(i => i.id !== item.id));
    setDeleteTarget(null);
  };

  // 过滤数据
  const filteredItems = items.filter(i => 
    i.category === activeTab &&
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     i.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">辅助核算项目管理</h1>
        <p className="text-gray-600">管理客户、供应商、部门等辅助核算项目，用于多维度的账务分析</p>
      </div>

      {/* Tab导航 */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="客户">客户</TabsTrigger>
            <TabsTrigger value="供应商">供应商</TabsTrigger>
            <TabsTrigger value="部门">部门</TabsTrigger>
            <TabsTrigger value="职员">职员</TabsTrigger>
            <TabsTrigger value="项目">项目</TabsTrigger>
            <TabsTrigger value="存货">存货</TabsTrigger>
          </TabsList>
        </div>

        {/* 每个Tab的内容 */}
        {(['客户', '供应商', '部门', '职员', '项目', '存货'] as const).map(category => (
          <TabsContent key={category} value={category} className="mt-0">
            <div className="bg-white rounded-lg border">
              {/* 工具栏 */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder={`搜索${category}名称或编码...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button onClick={handleAdd}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增{category}
                </Button>
              </div>

              {/* 数据表格 */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编码</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>引用状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.code}</TableCell>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>
                          <Badge 
                            className={item.isActive 
                              ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                            }
                          >
                            {item.isActive ? '启用' : '停用'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.isReferenced ? (
                            <Badge variant="outline">已被引用</Badge>
                          ) : (
                            <span className="text-gray-400 text-sm">未使用</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteTarget(item)}
                              disabled={item.isReferenced}
                              className={item.isReferenced 
                                ? 'text-gray-400 cursor-not-allowed' 
                                : 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              }
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 新增/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editTarget ? `编辑${editTarget.category}` : `新增${activeTab}`}
            </DialogTitle>
            <DialogDescription>
              {editTarget ? `修改${editTarget.category}信息` : `添加新的${activeTab}项目`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>编码</Label>
              <Input
                value={formData.code}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label>名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`请输入${activeTab}名称`}
              />
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.isActive}
                    onChange={() => setFormData({ ...formData, isActive: true })}
                    className="w-4 h-4"
                  />
                  <span>启用</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.isActive}
                    onChange={() => setFormData({ ...formData, isActive: false })}
                    className="w-4 h-4"
                  />
                  <span>停用</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>取消</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除 <span className="font-medium">"{deleteTarget?.name}"</span> 吗？此操作不可逆。
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

      {/* 完成并继续按钮 */}
      <div className="mt-6 flex justify-end">
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate?.('/settings/fund-accounts')}>
          完成辅助核算设置，继续下一步
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
