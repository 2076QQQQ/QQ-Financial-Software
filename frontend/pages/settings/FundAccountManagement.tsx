import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, AlertCircle, ArrowRight } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';     
import { 
  getAllFundAccounts, 
  addFundAccount as addFundAccountToMock, 
  updateFundAccount as updateFundAccountInMock,
  deleteFundAccount as deleteFundAccountFromMock,
  getAllSubjects,
  getFundSubjects
} from '@/lib/mockData';

// 会计科目数据结构
interface Subject {
  id: string;
  code: string;
  name: string;
  category: string;
  isLeaf: boolean; // 是否末级科目
}

// 资金账户数据结构
interface FundAccount {
  id: string;
  accountType: '银行存款' | '现金';
  accountCode: string;
  accountName: string;
  bankCardNumber?: string; // 仅银行存款有
  initialDate: string;
  initialBalance: number;
  relatedSubjectId: string;
  relatedSubjectCode: string;
  relatedSubjectName: string;
  status: '启用' | '停用';
  isReferenced?: boolean; // 是否已被日记账引用
  isInitialLocked?: boolean; // 期初数据是否已锁定
}

interface FundAccountManagementProps {
  onNavigate?: (path: string) => void;
}

export default function FundAccountManagement({ onNavigate }: FundAccountManagementProps = {}) {
  const [activeTab, setActiveTab] = useState<'银行存款' | '现金'>('银行存款');
  const [accounts, setAccounts] = useState<FundAccount[]>([]);
  const [mockSubjects, setMockSubjects] = useState<Subject[]>([]);
  
  // 组件加载时从mockData读取数据
  useEffect(() => {
    const loadedAccounts = getAllFundAccounts();
    setAccounts(loadedAccounts);
    
    // 从会计科目中获取资金类科目
    const allSubjects = getAllSubjects();
    const fundSubjects = allSubjects.filter(s => 
      s.isActive && 
      !s.hasChildren &&
      (s.code.startsWith('1001') || s.code.startsWith('1002'))
    ).map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      category: s.code.startsWith('1001') ? '库存现金' : '银行存款',
      isLeaf: !s.hasChildren
    }));
    setMockSubjects(fundSubjects);
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<FundAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FundAccount | null>(null);
  
  const [formData, setFormData] = useState({
    accountCode: '',
    accountName: '',
    bankCardNumber: '',
    initialDate: '',
    initialBalance: '',
    relatedSubjectId: '',
    status: '启用' as '启用' | '停用'
  });

  // 生成账户编码
  const generateAccountCode = (accountType: '银行存款' | '现金'): string => {
    const prefix = accountType === '银行存款' ? 'BA' : 'CA';
    const existing = accounts.filter(a => a.accountType === accountType);
    const maxNum = existing.length > 0 
      ? Math.max(...existing.map(a => parseInt(a.accountCode.replace(prefix, '')) || 0))
      : 0;
    return `${prefix}${String(maxNum + 1).padStart(3, '0')}`;
  };

  // 获取关联科目下拉选项（BR2：严格过滤）
  const getAvailableSubjects = (): Subject[] => {
    const category = activeTab === '银行存款' ? '银行存款' : '库存现金';
    // 只返回对应类别的末级科目
    return mockSubjects.filter(s => s.category === category && s.isLeaf);
  };

  // 检查账户是否被引用（从出纳日记账中检查）
  const isAccountReferenced = (accountId: string): boolean => {
    // TODO: 实际应该从出纳日记账数据中检查
    // 这里暂时返回isReferenced字段的值
    const account = accounts.find(a => a.id === accountId);
    return account?.isReferenced || false;
  };

  // 新增账户
  const handleAdd = () => {
    setEditTarget(null);
    setFormData({
      accountCode: generateAccountCode(activeTab),
      accountName: '',
      bankCardNumber: '',
      initialDate: new Date().toISOString().split('T')[0],
      initialBalance: '0',
      relatedSubjectId: '',
      status: '停用'
    });
    setShowModal(true);
  };

  // 编辑账户
  const handleEdit = (account: FundAccount) => {
    setEditTarget(account);
    setFormData({
      accountCode: account.accountCode,
      accountName: account.accountName,
      bankCardNumber: account.bankCardNumber || '',
      initialDate: account.initialDate,
      initialBalance: account.initialBalance.toFixed(2),
      relatedSubjectId: account.relatedSubjectId,
      status: account.status
    });
    setShowModal(true);
  };

  // 保存账户
  const handleSave = () => {
    // 表单验证
    if (!formData.accountName.trim()) {
      alert('请输入账户名称');
      return;
    }
    if (!formData.relatedSubjectId) {
      alert('请选择关联会计科目');
      return;
    }
    if (!formData.initialDate) {
      alert('请选择期初日期');
      return;
    }

    // 银行存款必须填写银行卡号
    if (activeTab === '银行存款' && !formData.bankCardNumber.trim()) {
      alert('请输入银行卡号');
      return;
    }

    const selectedSubject = mockSubjects.find(s => s.id === formData.relatedSubjectId);

    if (editTarget) {
      // 编辑模式
      const updatedAccount = {
        accountName: formData.accountName,
        bankCardNumber: formData.bankCardNumber,
        // BR3：如果已锁定，不允许修改期初日期和余额
        initialDate: editTarget.isInitialLocked ? editTarget.initialDate : formData.initialDate,
        initialBalance: editTarget.isInitialLocked ? editTarget.initialBalance : parseFloat(formData.initialBalance),
        relatedSubjectId: formData.relatedSubjectId,
        relatedSubjectCode: selectedSubject?.code || '',
        relatedSubjectName: selectedSubject ? `${selectedSubject.code} ${selectedSubject.name}` : '',
        status: formData.status
      };
      updateFundAccountInMock(editTarget.id, updatedAccount);
      setAccounts(getAllFundAccounts());
    } else {
      // 新增模式
      const newAccount: FundAccount = {
        id: `acc-${Date.now()}`,
        accountType: activeTab,
        accountCode: formData.accountCode,
        accountName: formData.accountName,
        bankCardNumber: activeTab === '银行存款' ? formData.bankCardNumber : undefined,
        initialDate: formData.initialDate,
        initialBalance: parseFloat(formData.initialBalance),
        relatedSubjectId: formData.relatedSubjectId,
        relatedSubjectCode: selectedSubject?.code || '',
        relatedSubjectName: selectedSubject ? `${selectedSubject.code} ${selectedSubject.name}` : '',
        status: formData.status
      };
      addFundAccountToMock(newAccount);
      setAccounts(getAllFundAccounts());
    }
    setShowModal(false);
  };

  // 删除账户（BR4/BR5）
  const handleDelete = (account: FundAccount) => {
    if (isAccountReferenced(account.id)) {
      alert('该账户已被业务引用，无法删除。您可以将其停用。');
      return;
    }
    deleteFundAccountFromMock(account.id);
    setAccounts(getAllFundAccounts());
    setDeleteTarget(null);
  };

  // 检查是否可以删除（BR4/BR5）
  const canDelete = (account: FundAccount): boolean => {
    // 已被引用的账户不能删除
    return !isAccountReferenced(account.id);
  };

  // 过滤账户数据
  const filteredAccounts = accounts.filter(a => 
    a.accountType === activeTab &&
    (a.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     a.accountCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (a.bankCardNumber && a.bankCardNumber.includes(searchTerm)))
  );

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">资金账户管理</h1>
        <p className="text-gray-600">管理公司的现金和银行账户，关联会计科目，设置期初余额</p>
      </div>

      {/* Tab导航 + 新增按钮 */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="银行存款">银行存款</TabsTrigger>
            <TabsTrigger value="现金">现金</TabsTrigger>
          </TabsList>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            新增{activeTab === '银行存款' ? '银行账户' : '现金账户'}
          </Button>
        </div>

        {/* 银行存款Tab */}
        <TabsContent value="银行存款" className="mt-0">
          <div className="bg-white rounded-lg border">
            {/* 搜索栏 */}
            <div className="p-4 border-b">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索账户名称、编码或银行卡号..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* 数据表格 */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账户编码</TableHead>
                  <TableHead>账户名称</TableHead>
                  <TableHead>银行卡号</TableHead>
                  <TableHead>期初余额</TableHead>
                  <TableHead>关联会计科目</TableHead>
                  <TableHead>账户状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">{account.accountCode}</TableCell>
                      <TableCell>{account.accountName}</TableCell>
                      <TableCell className="font-mono text-gray-600">
                        {account.bankCardNumber || '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ¥{account.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{account.relatedSubjectName}</TableCell>
                      <TableCell>
                        <Badge 
                          className={account.status === '启用' 
                            ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                          }
                        >
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget(account)}
                                    disabled={!canDelete(account)}
                                    className={canDelete(account)
                                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                      : 'text-gray-400 cursor-not-allowed'
                                    }
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    删除
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!canDelete(account) && (
                                <TooltipContent>
                                  <p className="text-sm">已被引用的账户无法删除。您可在"编辑"中将其"停用"。</p>
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

        {/* 现金Tab */}
        <TabsContent value="现金" className="mt-0">
          <div className="bg-white rounded-lg border">
            {/* 搜索栏 */}
            <div className="p-4 border-b">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="搜索账户名称或编码..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* 数据表格（不显示银行卡号列） */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账户编码</TableHead>
                  <TableHead>账户名称</TableHead>
                  <TableHead>期初余额</TableHead>
                  <TableHead>关联会计科目</TableHead>
                  <TableHead>账户状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-mono">{account.accountCode}</TableCell>
                      <TableCell>{account.accountName}</TableCell>
                      <TableCell className="text-right font-mono">
                        ¥{account.initialBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{account.relatedSubjectName}</TableCell>
                      <TableCell>
                        <Badge 
                          className={account.status === '启用' 
                            ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                          }
                        >
                          {account.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(account)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteTarget(account)}
                                    disabled={!canDelete(account)}
                                    className={canDelete(account)
                                      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                      : 'text-gray-400 cursor-not-allowed'
                                    }
                                  >
                                    <Trash2 className="w-4 h-4 mr-1" />
                                    删除
                                  </Button>
                                </div>
                              </TooltipTrigger>
                              {!canDelete(account) && (
                                <TooltipContent>
                                  <p className="text-sm">已被引用的账户无法删除。您可在"编辑"中将其"停用"。</p>
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

      {/* 新增/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? `编辑${editTarget.accountType}账户` : `新增${activeTab}账户`}
            </DialogTitle>
            <DialogDescription>
              {editTarget ? '修改账户信息' : '添加新的资金账户'}
              {editTarget?.isInitialLocked && (
                <div className="mt-2 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3">
                  <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-700">
                    此账户已完成期初初始化或已被业务引用，期初日期和期初余额字段已锁定，无法修改。
                  </p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 账户类别（只读） */}
            <div className="space-y-2">
              <Label>账户类别</Label>
              <Input
                value={activeTab}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 账户编码（只读） */}
              <div className="space-y-2">
                <Label>账户编码</Label>
                <Input
                  value={formData.accountCode}
                  disabled
                  className="bg-gray-50"
                />
              </div>

              {/* 账户名称 */}
              <div className="space-y-2">
                <Label>账户名称 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  placeholder={activeTab === '银行存款' ? '例如：招商银行（尾号1234）' : '例如：备用金'}
                />
              </div>
            </div>

            {/* 银行卡号（仅银行存款显示） */}
            {activeTab === '银行存款' && (
              <div className="space-y-2">
                <Label>银行卡号 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.bankCardNumber}
                  onChange={(e) => setFormData({ ...formData, bankCardNumber: e.target.value })}
                  placeholder="请输入完整银行卡号"
                  maxLength={19}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* 期初日期（BR3：已锁定时禁用） */}
              <div className="space-y-2">
                <Label>期初日期 <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={formData.initialDate}
                  onChange={(e) => setFormData({ ...formData, initialDate: e.target.value })}
                  disabled={editTarget?.isInitialLocked}
                  className={editTarget?.isInitialLocked ? 'bg-gray-50' : ''}
                />
              </div>

              {/* 期初余额（BR3：已锁定时禁用） */}
              <div className="space-y-2">
                <Label>期初余额 <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.initialBalance}
                  onChange={(e) => setFormData({ ...formData, initialBalance: e.target.value })}
                  placeholder="0.00"
                  disabled={editTarget?.isInitialLocked}
                  className={editTarget?.isInitialLocked ? 'bg-gray-50' : ''}
                />
              </div>
            </div>

            {/* 关联会计科目（BR2：严格过滤） */}
            <div className="space-y-2">
              <Label>关联会计科目 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.relatedSubjectId}
                onValueChange={(value) => setFormData({ ...formData, relatedSubjectId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`请选择${activeTab === '银行存款' ? '银行存款' : '库存现金'}类科目`} />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSubjects().map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.code} {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                只能选择"{activeTab === '银行存款' ? '银行存款' : '库存现金'}"类别下的末级科目
              </p>
            </div>

            {/* 账户状态 */}
            <div className="space-y-2">
              <Label>账户状态 <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.status === '启用'}
                    onChange={() => setFormData({ ...formData, status: '启用' })}
                    className="w-4 h-4"
                  />
                  <span>启用</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.status === '停用'}
                    onChange={() => setFormData({ ...formData, status: '停用' })}
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
              您确定要删除账户 <span className="font-medium">"{deleteTarget?.accountName}"</span> 吗？此操作不可逆。
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
        <Button size="lg" className="bg-blue-600 hover:bg-blue-700" onClick={() => onNavigate?.('/settings/initial-data')}>
          完成资金账户设置，继续下一步
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
