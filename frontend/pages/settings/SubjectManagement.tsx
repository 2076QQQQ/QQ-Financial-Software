import { useState, useEffect, Fragment } from 'react';
import { Plus, Edit, Trash2, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllSubjects, setSubjects as setMockSubjects, activateAllBuiltInSubjects } from '@/lib/mockData';

// 会计科目数据结构
interface Subject {
  id: string;
  code: string;
  name: string;
  category: '资产' | '负债' | '所有者权益' | '成本' | '损益';
  direction: '借' | '贷';
  mnemonic?: string;
  quantityUnit?: string;
  auxiliaryItems?: string[];
  isActive: boolean;
  isBuiltIn: boolean;
  hasBalance: boolean;
  hasChildren: boolean;
  parentId?: string;
}

interface SubjectManagementProps {
  onNavigate?: (path: string) => void;
  userName?: string;
}

export default function SubjectManagement({ onNavigate, userName = '当前用户' }: SubjectManagementProps) {
  const [subjects, setSubjects] = useState<Subject[]>([
    // 资产类 - 默认全部启用
    { id: '1001', code: '1001', name: '库存现金', category: '资产', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '1002', code: '1002', name: '银行存款', category: '资产', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '1003', code: '1003', name: '存货', category: '资产', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '1005', code: '1005', name: '应收账款', category: '资产', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '1008', code: '1008', name: '固定资产', category: '资产', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    // 负债类
    { id: '2002', code: '2002', name: '应付账款', category: '负债', direction: '贷', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '2003', code: '2003', name: '应交税费', category: '负债', direction: '贷', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    // 所有者权益类
    { id: '3001', code: '3001', name: '实收资本', category: '所有者权益', direction: '贷', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '3103', code: '3103', name: '本年利润', category: '所有者权益', direction: '贷', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    // 成本类
    { id: '5001', code: '5001', name: '主营业务成本', category: '成本', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    // 损益类
    { id: '6001', code: '6001', name: '主营业务收入', category: '损益', direction: '贷', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '6602', code: '6602', name: '管理费用', category: '损益', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '6902', code: '6902', name: '营业外支出', category: '损益', direction: '借', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
    { id: '6901', code: '6901', name: '营业外收入', category: '损益', direction: '贷', isActive: true, isBuiltIn: true, hasBalance: false, hasChildren: false },
  ]);
  
  // 组件加载时初始化mockData
  useEffect(() => {
    const mockSubjects = getAllSubjects();
    if (mockSubjects.length === 0) {
      // 如果mockData为空，初始化并同步当前subjects到mockData
      setMockSubjects(subjects);
    } else {
      // 如果mockData有数据，从mockData加载
      setSubjects(mockSubjects);
    }
  }, []);
  const [activeTab, setActiveTab] = useState<'资产' | '负债' | '所有者权益' | '成本' | '损益'>('资产');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  
  // 弹窗状态
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [parentSubject, setParentSubject] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    quantityUnit: '',
    auxiliaryItems: [] as string[],
    isActive: true
  });

  // 生成助记码（简单实现：取每个汉字的拼音首字母）
  const generateMnemonic = (name: string): string => {
    // 这里简化处理，实际应该使用拼音库
    return name.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 10) || 'ZK';
  };

  // 生成科目编码
  const generateCode = (category: string, parentCode?: string): string => {
    const categoryPrefixes: Record<string, string> = {
      '资产': '1',
      '负债': '2',
      '所有者权益': '3',
      '成本': '5',
      '损益': '6'
    };

    if (parentCode) {
      // 生成子科目编码
      const children = subjects.filter(s => s.code.startsWith(parentCode) && s.code.length === parentCode.length + 2);
      const maxCode = children.length > 0 
        ? Math.max(...children.map(s => parseInt(s.code.slice(-2)))) 
        : 0;
      return `${parentCode}${String(maxCode + 1).padStart(2, '0')}`;
    } else {
      // 生成一级科目编码
      const prefix = categoryPrefixes[category];
      const existingCodes = subjects
        .filter(s => s.category === category && s.code.startsWith(prefix) && s.code.length === 4)
        .map(s => parseInt(s.code));
      const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : parseInt(`${prefix}000`);
      return String(maxCode + 1);
    }
  };

  // 获取余额方向
  const getDirection = (category: string): '借' | '贷' => {
    if (category === '资产' || category === '成本') return '借';
    return '贷';
  };

  // 切换展开/收起
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 处理新增一级科目
  const handleAddRootSubject = () => {
    setEditTarget(null);
    setParentSubject(null);
    setFormData({
      name: '',
      quantityUnit: '',
      auxiliaryItems: [],
      isActive: true
    });
    setShowModal(true);
  };

  // 处理新增子科目
  const handleAddChildSubject = (parent: Subject) => {
    setEditTarget(null);
    setParentSubject(parent);
    setFormData({
      name: '',
      quantityUnit: '',
      auxiliaryItems: [],
      isActive: true
    });
    setShowModal(true);
  };

  // 处理编辑
  const handleEdit = (subject: Subject) => {
    setEditTarget(subject);
    setParentSubject(null);
    setFormData({
      name: subject.name,
      quantityUnit: subject.quantityUnit || '',
      auxiliaryItems: subject.auxiliaryItems || [],
      isActive: subject.isActive
    });
    setShowModal(true);
  };

  // 保存科目
  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('请输入科目名称');
      return;
    }

    let updatedSubjects: Subject[];

    if (editTarget) {
      // 编辑现有科目
      updatedSubjects = subjects.map(s => 
        s.id === editTarget.id
          ? {
              ...s,
              name: formData.name,
              mnemonic: generateMnemonic(formData.name),
              quantityUnit: formData.quantityUnit,
              auxiliaryItems: formData.auxiliaryItems,
              isActive: formData.isActive
            }
          : s
      );
    } else {
      // 新增科目
      const category = parentSubject ? parentSubject.category : activeTab;
      const code = generateCode(category, parentSubject?.code);
      const newSubject: Subject = {
        id: code,
        code,
        name: formData.name,
        mnemonic: generateMnemonic(formData.name),
        category,
        direction: getDirection(category),
        quantityUnit: formData.quantityUnit,
        auxiliaryItems: formData.auxiliaryItems,
        isActive: formData.isActive,
        isBuiltIn: false,
        hasBalance: false,
        hasChildren: false,
        parentId: parentSubject?.id
      };
      
      // 更新父科目的 hasChildren 状态
      if (parentSubject) {
        updatedSubjects = subjects.map(s =>
          s.id === parentSubject.id ? { ...s, hasChildren: true } : s
        ).concat(newSubject);
      } else {
        updatedSubjects = [...subjects, newSubject];
      }
    }

    // 同步更新本地state和mockData
    setSubjects(updatedSubjects);
    setMockSubjects(updatedSubjects);

    setShowModal(false);
  };

  // 删除科目
  const handleDelete = (subject: Subject) => {
    // 检查是否可以删除
    if (subject.hasChildren) {
      alert('该科目下有子科目，请先删除或停用所有子科目');
      return;
    }
    if (subject.hasBalance) {
      alert('该科目有期末余额或本年度已发生业务，无法删除。您可以将其停用。');
      return;
    }

    const updatedSubjects = subjects.filter(s => s.id !== subject.id);
    
    // 同步更新本地state和mockData
    setSubjects(updatedSubjects);
    setMockSubjects(updatedSubjects);
    setDeleteTarget(null);
  };

  // 渲染树状表格
  const renderSubjectTree = (subjectsToRender: Subject[], allSubjects: Subject[], level: number = 0): any[] => {
    return subjectsToRender.map(subject => {
      const children = allSubjects.filter(s => s.parentId === subject.id);
      const isExpanded = expandedIds.includes(subject.id);
      const canEdit = !subject.isBuiltIn;
      const canDelete = !subject.isBuiltIn && !subject.hasBalance && !subject.hasChildren;

      return (
        <Fragment key={subject.id}>
          <TableRow>
            <TableCell>
              <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
                {children.length > 0 ? (
                  <button
                    onClick={() => toggleExpand(subject.id)}
                    className="mr-2 p-1 hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                ) : (
                  <span className="w-8 inline-block" />
                )}
                {subject.code}
              </div>
            </TableCell>
            <TableCell>{subject.name}</TableCell>
            <TableCell className="text-gray-500">{subject.mnemonic}</TableCell>
            <TableCell>
              <Badge variant={subject.direction === '借' ? 'default' : 'secondary'}>
                {subject.direction}
              </Badge>
            </TableCell>
            <TableCell>{subject.quantityUnit || '-'}</TableCell>
            <TableCell>
              {subject.auxiliaryItems && subject.auxiliaryItems.length > 0 
                ? subject.auxiliaryItems.join('、') 
                : '-'
              }
            </TableCell>
            <TableCell>
              <Badge 
                className={subject.isActive 
                  ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                }
              >
                {subject.isActive ? '启用' : '停用'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddChildSubject(subject)}
                >
                  新增子科目
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(subject)}
                  disabled={!canEdit}
                  className={!canEdit ? 'text-gray-400 cursor-not-allowed' : ''}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(subject)}
                  disabled={!canDelete}
                  className={!canDelete 
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
          {isExpanded && children.length > 0 && renderSubjectTree(children, allSubjects, level + 1)}
        </Fragment>
      );
    });
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">会计科目管理</h1>
        <p className="text-gray-600">维护您的会计科目体系，确保科目属性的逻辑严谨性</p>
      </div>

      {/* Tab 导航 + 新增按钮 */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="资产">资产</TabsTrigger>
            <TabsTrigger value="负债">负债</TabsTrigger>
            <TabsTrigger value="所有者权益">所有者权益</TabsTrigger>
            <TabsTrigger value="成本">成本</TabsTrigger>
            <TabsTrigger value="损益">损益</TabsTrigger>
          </TabsList>
          <Button onClick={handleAddRootSubject}>
            <Plus className="w-4 h-4 mr-2" />
            新增
          </Button>
        </div>

        {/* 据表格 */}
        {(['资产', '负债', '所有者权益', '成本', '损益'] as const).map(category => (
          <TabsContent key={category} value={category} className="mt-0">
            <div className="bg-white rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目编码</TableHead>
                    <TableHead>科目名称</TableHead>
                    <TableHead>助记码</TableHead>
                    <TableHead>余额方向</TableHead>
                    <TableHead>数量核算</TableHead>
                    <TableHead>辅助核算</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderSubjectTree(
                    subjects.filter(s => s.category === category && !s.parentId),
                    subjects
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 新增/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? '编辑科目' : parentSubject ? `新增子科目（${parentSubject.name}）` : '新增科目'}
            </DialogTitle>
            <DialogDescription>
              {editTarget 
                ? '修改科目信息' 
                : `在"${parentSubject?.category || activeTab}"类别下新增${parentSubject ? '子' : '一级'}科目`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 科目类别（只读） */}
            <div className="space-y-2">
              <Label>科目类别</Label>
              <Input 
                value={parentSubject?.category || editTarget?.category || activeTab} 
                disabled 
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">科目类别由所在Tab或父科目自动确定，不可修改</p>
            </div>

            {/* 余额方向（只读） */}
            <div className="space-y-2">
              <Label>余额方向</Label>
              <Input 
                value={editTarget?.direction || getDirection(parentSubject?.category || activeTab)} 
                disabled 
                className="bg-gray-50"
              />
              <p className="text-xs text-gray-500">
                资产、成本类：借方；负债、所有者权益、损益类：贷方
              </p>
            </div>

            {/* 科目编码（只读） */}
            {editTarget && (
              <div className="space-y-2">
                <Label>科目编码</Label>
                <Input value={editTarget.code} disabled className="bg-gray-50" />
              </div>
            )}

            {/* 科目名称 */}
            <div className="space-y-2">
              <Label>科目名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入科目名称"
              />
            </div>

            {/* 数量核算单位 */}
            <div className="space-y-2">
              <Label>数量核算单位</Label>
              <Select 
                value={formData.quantityUnit || 'none'} 
                onValueChange={(v) => setFormData({ ...formData, quantityUnit: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不启用数量核算" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不启用</SelectItem>
                  <SelectItem value="个">个</SelectItem>
                  <SelectItem value="件">件</SelectItem>
                  <SelectItem value="台">台</SelectItem>
                  <SelectItem value="套">套</SelectItem>
                  <SelectItem value="吨">吨</SelectItem>
                  <SelectItem value="千克">千克</SelectItem>
                  <SelectItem value="米">米</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 辅助核算 */}
            <div className="space-y-2">
              <Label>辅助核算</Label>
              <Select 
                value={formData.auxiliaryItems.length > 0 ? formData.auxiliaryItems.join(',') : 'none'} 
                onValueChange={(v) => setFormData({ ...formData, auxiliaryItems: v === 'none' ? [] : v.split(',') })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="不启用辅助核算" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不启用</SelectItem>
                  <SelectItem value="客户">客户</SelectItem>
                  <SelectItem value="供应商">供应商</SelectItem>
                  <SelectItem value="客户,供应商">客户+供应商</SelectItem>
                  <SelectItem value="部门">部门</SelectItem>
                  <SelectItem value="职员">职员</SelectItem>
                  <SelectItem value="项目">项目</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 启用状态 */}
            <div className="space-y-2">
              <Label>启用状态</Label>
              <RadioGroup
                value={formData.isActive ? 'true' : 'false'}
                onValueChange={(v) => setFormData({ ...formData, isActive: v === 'true' })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="active-yes" />
                  <Label htmlFor="active-yes" className="font-normal cursor-pointer">启用</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="active-no" />
                  <Label htmlFor="active-no" className="font-normal cursor-pointer">停用</Label>
                </div>
              </RadioGroup>
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
              您确定要删除科目 <span className="font-medium">"{deleteTarget?.name}"</span> 吗？此操作不可逆。
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
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate?.('/settings/auxiliary')}>
          <ArrowRight className="w-4 h-4 ml-2" />
          完成会计科目设置，继续下一步
        </Button>
      </div>
    </div>
  );
}