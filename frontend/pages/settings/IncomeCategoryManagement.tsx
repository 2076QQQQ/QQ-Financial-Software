import { useState } from 'react';
import { Plus, Edit, Trash2, Search, Download, Upload, ChevronRight, ChevronDown } from 'lucide-react';
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
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';  

// 收支类别数据结构
interface IncomeCategory {
  id: string;
  code: string;
  name: string;
  type: 'expense' | 'income'; // 支出/收入
  parentId?: string; // 上级类别ID
  parentName?: string; // 上级类别名称
  subjectId: string; // 关联会计科目ID（必填）
  subjectCode: string; // 会计科目代码
  subjectName: string; // 会计科目名称
  cashFlowId?: string; // 关联现金流ID（非必填）
  cashFlowName?: string; // 现金流项目名称
  keywords?: string[]; // 智能匹配关键字
  isEnabled: boolean; // 启用状态
  isReferenced: boolean; // 是否已被日记账引用
  children?: IncomeCategory[]; // 子类别
  isExpanded?: boolean; // 是否展开
  level?: number; // 层级（用于缩进）
  createdAt: string;
  updatedAt: string;
}

// 会计科目数据结构
interface Subject {
  id: string;
  code: string;
  name: string;
}

// 现金流量项目
interface CashFlow {
  id: string;
  name: string;
}

// 模拟会计科目数据
const mockSubjects: Subject[] = [
  { id: 's1001', code: '1001', name: '库存现金' },
  { id: 's1002', code: '1002', name: '银行存款' },
  { id: 's1003', code: '1003', name: '存货' },
  { id: 's2211', code: '2211', name: '应付职工薪酬' },
  { id: 's5001', code: '5001', name: '主营业务成本' },
  { id: 's6001', code: '6001', name: '主营业务收入' },
  { id: 's6051', code: '6051', name: '其他业务收入' },
  { id: 's6601', code: '6601', name: '销售费用' },
  { id: 's6602', code: '6602', name: '管理费用' },
  { id: 's6603', code: '6603', name: '财务费用' },
  { id: 's6901', code: '6901', name: '营业外收入' },
];

// 模拟现金流量数据
const mockCashFlows: CashFlow[] = [
  { id: 'cf1', name: '销售商品、提供劳务收到的现金' },
  { id: 'cf2', name: '收到其他与经营活动有关的现金' },
  { id: 'cf3', name: '购买商品、接受劳务支付的现金' },
  { id: 'cf4', name: '支付给职工以及为职工支付的现金' },
  { id: 'cf5', name: '支付的各项税费' },
  { id: 'cf6', name: '支付其他与经营活动有关的现金' },
];

// 系统预置收支类别数据
const getPresetCategories = (): IncomeCategory[] => {
  const now = new Date().toLocaleString('zh-CN');
  
  return [
    // ========== 支出类别 ==========
    {
      id: 'exp-mgmt',
      code: 'EXP-001',
      name: '管理费用',
      type: 'expense',
      subjectId: 's6602',
      subjectCode: '6602',
      subjectName: '管理费用',
      isEnabled: true,
      isReferenced: false,
      isExpanded: true,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: [
        {
          id: 'exp-mgmt-salary',
          code: 'EXP-001-01',
          name: '工资社保',
          type: 'expense',
          parentId: 'exp-mgmt',
          parentName: '管理费用',
          subjectId: 's2211',
          subjectCode: '2211',
          subjectName: '应付职工薪酬',
          keywords: ['工资', '社保', '公积金'],
          isEnabled: true,
          isReferenced: false,
          level: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'exp-mgmt-travel',
          code: 'EXP-001-02',
          name: '差旅费',
          type: 'expense',
          parentId: 'exp-mgmt',
          parentName: '管理费用',
          subjectId: 's6602',
          subjectCode: '6602',
          subjectName: '管理费用',
          keywords: ['出差', '机票', '酒店'],
          isEnabled: true,
          isReferenced: false,
          level: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'exp-mgmt-office',
          code: 'EXP-001-03',
          name: '办公用品',
          type: 'expense',
          parentId: 'exp-mgmt',
          parentName: '管理费用',
          subjectId: 's6602',
          subjectCode: '6602',
          subjectName: '管理费用',
          keywords: ['文具', '纸张', '耗材'],
          isEnabled: true,
          isReferenced: false,
          level: 1,
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'exp-mgmt-entertain',
          code: 'EXP-001-04',
          name: '招待费',
          type: 'expense',
          parentId: 'exp-mgmt',
          parentName: '管理费用',
          subjectId: 's6602',
          subjectCode: '6602',
          subjectName: '管理费用',
          keywords: ['接待', '餐饮'],
          isEnabled: true,
          isReferenced: false,
          level: 1,
          createdAt: now,
          updatedAt: now
        }
      ]
    },
    {
      id: 'exp-sales',
      code: 'EXP-002',
      name: '销售费用',
      type: 'expense',
      subjectId: 's6601',
      subjectCode: '6601',
      subjectName: '销售费用',
      isEnabled: true,
      isReferenced: false,
      isExpanded: false,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: []
    },
    {
      id: 'exp-finance',
      code: 'EXP-003',
      name: '财务费用',
      type: 'expense',
      subjectId: 's6603',
      subjectCode: '6603',
      subjectName: '财务费用',
      isEnabled: true,
      isReferenced: false,
      isExpanded: true,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: [
        {
          id: 'exp-finance-fee',
          code: 'EXP-003-01',
          name: '手续费',
          type: 'expense',
          parentId: 'exp-finance',
          parentName: '财务费用',
          subjectId: 's6603',
          subjectCode: '6603',
          subjectName: '财务费用',
          keywords: ['银行', '手续费'],
          isEnabled: true,
          isReferenced: false,
          level: 1,
          createdAt: now,
          updatedAt: now
        }
      ]
    },
    {
      id: 'exp-purchase',
      code: 'EXP-004',
      name: '采购成本',
      type: 'expense',
      subjectId: 's5001',
      subjectCode: '5001',
      subjectName: '主营业务成本',
      isEnabled: true,
      isReferenced: false,
      isExpanded: false,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: []
    },

    // ========== 收入类别 ==========
    {
      id: 'inc-main',
      code: 'INC-001',
      name: '主营业务收入',
      type: 'income',
      subjectId: 's6001',
      subjectCode: '6001',
      subjectName: '主营业务收入',
      keywords: ['销售', '货款'],
      isEnabled: true,
      isReferenced: false,
      isExpanded: false,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: []
    },
    {
      id: 'inc-other',
      code: 'INC-002',
      name: '其他业务收入',
      type: 'income',
      subjectId: 's6051',
      subjectCode: '6051',
      subjectName: '其他业务收入',
      isEnabled: true,
      isReferenced: false,
      isExpanded: false,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: []
    },
    {
      id: 'inc-nonop',
      code: 'INC-003',
      name: '营业外收入',
      type: 'income',
      subjectId: 's6901',
      subjectCode: '6901',
      subjectName: '营业外收入',
      isEnabled: true,
      isReferenced: false,
      isExpanded: false,
      level: 0,
      createdAt: now,
      updatedAt: now,
      children: []
    }
  ];
};

export default function IncomeCategoryManagement() {
  const [categories, setCategories] = useState<IncomeCategory[]>(getPresetCategories());
  const [currentTab, setCurrentTab] = useState<'expense' | 'income'>('expense');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<IncomeCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IncomeCategory | null>(null);
  const [openSubjectPopover, setOpenSubjectPopover] = useState(false);
  const [openCashFlowPopover, setOpenCashFlowPopover] = useState(false);
  const [parentLocked, setParentLocked] = useState(false); // 上级类别是否锁定

  const [formData, setFormData] = useState<IncomeCategory>({
    id: '',
    code: '',
    name: '',
    type: 'expense',
    subjectId: '',
    subjectCode: '',
    subjectName: '',
    isEnabled: true,
    isReferenced: false,
    level: 0,
    createdAt: '',
    updatedAt: ''
  });

  // 新增一级类别
  const handleAdd = () => {
    setEditTarget(null);
    setParentLocked(false);
    setFormData({
      id: '',
      code: '',
      name: '',
      type: currentTab,
      parentId: undefined,
      parentName: undefined,
      subjectId: '',
      subjectCode: '',
      subjectName: '',
      isEnabled: true,
      isReferenced: false,
      level: 0,
      createdAt: '',
      updatedAt: ''
    });
    setShowModal(true);
  };

  // 新增子类别
  const handleAddChild = (parent: IncomeCategory) => {
    setEditTarget(null);
    setParentLocked(true);
    setFormData({
      id: '',
      code: '',
      name: '',
      type: currentTab,
      parentId: parent.id,
      parentName: parent.name,
      subjectId: '',
      subjectCode: '',
      subjectName: '',
      isEnabled: true,
      isReferenced: false,
      level: (parent.level || 0) + 1,
      createdAt: '',
      updatedAt: ''
    });
    setShowModal(true);
  };

  // 编辑类别
  const handleEdit = (category: IncomeCategory) => {
    setEditTarget(category);
    setParentLocked(false);
    setFormData({ ...category });
    setShowModal(true);
  };

  // 删除类别
  const handleDelete = (categoryId: string) => {
    const deleteRecursive = (cats: IncomeCategory[]): IncomeCategory[] => {
      return cats.filter(c => c.id !== categoryId).map(c => ({
        ...c,
        children: c.children ? deleteRecursive(c.children) : undefined
      }));
    };
    setCategories(deleteRecursive(categories));
    setDeleteTarget(null);
  };

  // 检查是否可以删除（BR3）
  const canDelete = (category: IncomeCategory): boolean => {
    return !category.isReferenced;
  };

  // 切换启用状态（BR2）
  const toggleEnabled = (categoryId: string) => {
    const toggleRecursive = (cats: IncomeCategory[]): IncomeCategory[] => {
      return cats.map(c => {
        if (c.id === categoryId) {
          return { ...c, isEnabled: !c.isEnabled, updatedAt: new Date().toLocaleString('zh-CN') };
        }
        if (c.children) {
          return { ...c, children: toggleRecursive(c.children) };
        }
        return c;
      });
    };
    setCategories(toggleRecursive(categories));
  };

  // 切换展开/折叠
  const toggleExpand = (categoryId: string) => {
    const toggleRecursive = (cats: IncomeCategory[]): IncomeCategory[] => {
      return cats.map(c => {
        if (c.id === categoryId) {
          return { ...c, isExpanded: !c.isExpanded };
        }
        if (c.children) {
          return { ...c, children: toggleRecursive(c.children) };
        }
        return c;
      });
    };
    setCategories(toggleRecursive(categories));
  };

  // 保存类别
  const handleSave = () => {
    // 表单验证
    if (!formData.code.trim()) {
      alert('请输入编码');
      return;
    }
    if (!formData.name.trim()) {
      alert('请输入名称');
      return;
    }
    if (!formData.subjectId) {
      alert('请选择关联会计科目（必填）');
      return;
    }

    // BR1: 编码唯一性校验（递归检查所有类别）
    const checkCodeUnique = (cats: IncomeCategory[]): boolean => {
      for (const c of cats) {
        if (c.code === formData.code && c.type === formData.type && (!editTarget || c.id !== editTarget.id)) {
          return false;
        }
        if (c.children && !checkCodeUnique(c.children)) {
          return false;
        }
      }
      return true;
    };

    if (!checkCodeUnique(categories)) {
      alert('编码已存在，请使用其他编码');
      return;
    }

    // BR1: 名称唯一性校验
    const checkNameUnique = (cats: IncomeCategory[]): boolean => {
      for (const c of cats) {
        if (c.name === formData.name && c.type === formData.type && (!editTarget || c.id !== editTarget.id)) {
          return false;
        }
        if (c.children && !checkNameUnique(c.children)) {
          return false;
        }
      }
      return true;
    };

    if (!checkNameUnique(categories)) {
      alert('名称已存在，请使用其他名称');
      return;
    }

    if (editTarget) {
      // 编辑模式
      const updateRecursive = (cats: IncomeCategory[]): IncomeCategory[] => {
        return cats.map(c => {
          if (c.id === editTarget.id) {
            return {
              ...formData,
              children: c.children,
              isExpanded: c.isExpanded,
              updatedAt: new Date().toLocaleString('zh-CN')
            };
          }
          if (c.children) {
            return { ...c, children: updateRecursive(c.children) };
          }
          return c;
        });
      };
      setCategories(updateRecursive(categories));
    } else {
      // 新增模式
      const newCategory: IncomeCategory = {
        ...formData,
        id: `cat-${Date.now()}`,
        createdAt: new Date().toLocaleString('zh-CN'),
        updatedAt: new Date().toLocaleString('zh-CN'),
        isReferenced: false,
        isExpanded: false,
        children: []
      };

      if (formData.parentId) {
        // 添加为子类别
        const addToParent = (cats: IncomeCategory[]): IncomeCategory[] => {
          return cats.map(c => {
            if (c.id === formData.parentId) {
              return {
                ...c,
                children: [...(c.children || []), newCategory]
              };
            }
            if (c.children) {
              return { ...c, children: addToParent(c.children) };
            }
            return c;
          });
        };
        setCategories(addToParent(categories));
      } else {
        // 添加为一级类别
        setCategories([...categories, newCategory]);
      }
    }

    setShowModal(false);
  };

  // 过滤类别数据
  const filterCategories = (cats: IncomeCategory[]): IncomeCategory[] => {
    return cats.filter(c => c.type === currentTab).filter(c => {
      const matchesSearch = c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           c.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  };

  // 展平树结构用于显示
  const flattenCategories = (cats: IncomeCategory[]): IncomeCategory[] => {
    const result: IncomeCategory[] = [];
    const flatten = (items: IncomeCategory[]) => {
      items.forEach(item => {
        result.push(item);
        if (item.isExpanded && item.children && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    flatten(cats);
    return result;
  };

  const filteredCategories = filterCategories(categories);
  const displayCategories = flattenCategories(filteredCategories);

  // 添加关键字
  const addKeyword = (keyword: string) => {
    if (keyword.trim() && !formData.keywords?.includes(keyword.trim())) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keyword.trim()]
      });
    }
  };

  // 删除关键字
  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter(k => k !== keyword)
    });
  };

  // BR4校验：关联会计科目必填，否则保存按钮禁用
  const canSave = formData.code.trim() && formData.name.trim() && formData.subjectId;

  // 获取所有一级类别（用于上级类别下拉）
  const getParentOptions = (): IncomeCategory[] => {
    return categories.filter(c => c.type === formData.type && !c.parentId && c.id !== editTarget?.id);
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">收支类别管理</h1>
        <p className="text-gray-600">
          配置资金收支与会计科目的映射规则，为出纳日记账自动生成凭证提供依据
        </p>
      </div>

      {/* Tab导航 + 操作区 */}
      <div className="bg-white rounded-lg border mb-4">
        <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'expense' | 'income')}>
          <div className="border-b px-4 pt-4">
            <TabsList>
              <TabsTrigger value="expense">支出</TabsTrigger>
              <TabsTrigger value="income">收入</TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索编码或名称..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                导入
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                导出
              </Button>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              新增类别
            </Button>
          </div>

          {/* 支出Tab */}
          <TabsContent value="expense" className="m-0">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">支出编码</TableHead>
                    <TableHead className="w-[250px]">支出名称</TableHead>
                    <TableHead>关联会计科目</TableHead>
                    <TableHead>关联现金流</TableHead>
                    <TableHead className="w-[100px]">启用状态</TableHead>
                    <TableHead className="text-right w-[280px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center" style={{ paddingLeft: `${(category.level || 0) * 24}px` }}>
                            {category.children && category.children.length > 0 ? (
                              <button
                                onClick={() => toggleExpand(category.id)}
                                className="mr-2 text-gray-500 hover:text-gray-700"
                              >
                                {category.isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 h-4 mr-2" />
                            )}
                            <span>{category.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          {category.subjectCode} {category.subjectName}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {category.cashFlowName || '-'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={category.isEnabled}
                            onCheckedChange={() => toggleEnabled(category.id)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddChild(category)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              新增子类别
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteTarget(category)}
                                      disabled={!canDelete(category)}
                                      className={
                                        canDelete(category)
                                          ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                          : 'text-gray-400 cursor-not-allowed'
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      删除
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                {!canDelete(category) && (
                                  <TooltipContent>
                                    <p className="text-sm">
                                      该类别已被日记账引用，无法删除。您可以将其"停用"
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
          </TabsContent>

          {/* 收入Tab */}
          <TabsContent value="income" className="m-0">
            <div className="border-t">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">收入编码</TableHead>
                    <TableHead className="w-[250px]">收入名称</TableHead>
                    <TableHead>关联会计科目</TableHead>
                    <TableHead>关联现金流</TableHead>
                    <TableHead className="w-[100px]">启用状态</TableHead>
                    <TableHead className="text-right w-[280px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayCategories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center" style={{ paddingLeft: `${(category.level || 0) * 24}px` }}>
                            {category.children && category.children.length > 0 ? (
                              <button
                                onClick={() => toggleExpand(category.id)}
                                className="mr-2 text-gray-500 hover:text-gray-700"
                              >
                                {category.isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            ) : (
                              <span className="w-4 h-4 mr-2" />
                            )}
                            <span>{category.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-900">
                          {category.subjectCode} {category.subjectName}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {category.cashFlowName || '-'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={category.isEnabled}
                            onCheckedChange={() => toggleEnabled(category.id)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(category)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAddChild(category)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              新增子类别
                            </Button>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteTarget(category)}
                                      disabled={!canDelete(category)}
                                      className={
                                        canDelete(category)
                                          ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                          : 'text-gray-400 cursor-not-allowed'
                                      }
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      删除
                                    </Button>
                                  </div>
                                </TooltipTrigger>
                                {!canDelete(category) && (
                                  <TooltipContent>
                                    <p className="text-sm">
                                      该类别已被日记账引用，无法删除。您可以将其"停用"
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
          </TabsContent>
        </Tabs>
      </div>

      {/* 新增/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? '编辑' : (parentLocked ? '新增子' : '新增')}{formData.type === 'expense' ? '支出' : '收入'}类别
            </DialogTitle>
            <DialogDescription>
              关联会计科目是必填项，用于自动生成会计凭证
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 类别（只读） */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>类别</Label>
                <Input
                  value={formData.type === 'expense' ? '支出' : '收入'}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              {/* 编码（必填） */}
              <div className="space-y-2">
                <Label>
                  编码 <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="例如：EXP-001-01"
                />
              </div>
            </div>

            {/* 名称（必填） */}
            <div className="space-y-2">
              <Label>
                名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={`输入${formData.type === 'expense' ? '支出' : '收入'}类别名称`}
              />
            </div>

            {/* 上级类别（可选，子类别时锁定） */}
            <div className="space-y-2">
              <Label>上级类别{parentLocked && ' (自动填充)'}</Label>
              {parentLocked ? (
                <Input
                  value={formData.parentName || ''}
                  disabled
                  className="bg-gray-50"
                />
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start ${!formData.parentId && 'text-gray-400'}`}
                    >
                      {formData.parentId ? (
                        <span>{formData.parentName}</span>
                      ) : (
                        '选择上级类别（创建层级）'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[500px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="搜索类别名称..." />
                      <CommandEmpty>未找到类别</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-y-auto">
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              parentId: undefined,
                              parentName: undefined,
                              level: 0
                            });
                          }}
                        >
                          无上级类别（一级类别）
                        </CommandItem>
                        {getParentOptions().map((cat) => (
                          <CommandItem
                            key={cat.id}
                            value={cat.name}
                            onSelect={() => {
                              setFormData({
                                ...formData,
                                parentId: cat.id,
                                parentName: cat.name,
                                level: (cat.level || 0) + 1
                              });
                            }}
                          >
                            {cat.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* 关联会计科目（必填）- BR4核心 */}
            <div className="space-y-2">
              <Label>
                关联会计科目 <span className="text-red-500">*（必填）</span>
              </Label>
              <Popover open={openSubjectPopover} onOpenChange={setOpenSubjectPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start ${!formData.subjectId && 'text-gray-400'}`}
                  >
                    {formData.subjectId ? (
                      <span>{formData.subjectCode} {formData.subjectName}</span>
                    ) : (
                      '选择会计科目（自动生成凭证的依据）'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索科目代码或名称..." />
                    <CommandEmpty>未找到科目</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-y-auto">
                      {mockSubjects.map((subject) => (
                        <CommandItem
                          key={subject.id}
                          value={`${subject.code} ${subject.name}`}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              subjectId: subject.id,
                              subjectCode: subject.code,
                              subjectName: subject.name
                            });
                            setOpenSubjectPopover(false);
                          }}
                        >
                          {subject.code} {subject.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500">
                💡 此字段用于UC11"一键生成凭证"功能，必须填写
              </p>
            </div>

            {/* 关联现金流（可选） */}
            <div className="space-y-2">
              <Label>关联现金流（可选）</Label>
              <Popover open={openCashFlowPopover} onOpenChange={setOpenCashFlowPopover}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={`w-full justify-start ${!formData.cashFlowId && 'text-gray-400'}`}
                  >
                    {formData.cashFlowId ? (
                      <span>{formData.cashFlowName}</span>
                    ) : (
                      '选择现金流量表项目'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[500px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="搜索现金流项目..." />
                    <CommandEmpty>未找到项目</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-y-auto">
                      {mockCashFlows.map((flow) => (
                        <CommandItem
                          key={flow.id}
                          value={flow.name}
                          onSelect={() => {
                            setFormData({
                              ...formData,
                              cashFlowId: flow.id,
                              cashFlowName: flow.name
                            });
                            setOpenCashFlowPopover(false);
                          }}
                        >
                          {flow.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-gray-500">
                用于自动生成现金流量表（UC20）
              </p>
            </div>

            {/* 智能匹配关键字（可选） */}
            <div className="space-y-2">
              <Label>智能匹配关键字（可选）</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="输入关键字，按Enter添加"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.keywords?.map((keyword) => (
                  <Badge
                    key={keyword}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => removeKeyword(keyword)}
                  >
                    {keyword}
                    <span className="ml-1 text-gray-500">×</span>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                用于辅助UC11（出纳日记账）的智能分类功能
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!canSave}>
              保存
            </Button>
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
              您确定要删除类别{' '}
              <span className="font-medium">"{deleteTarget?.name}"</span> 吗？此操作不可逆。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
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