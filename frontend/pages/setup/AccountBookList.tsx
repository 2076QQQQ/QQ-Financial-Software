import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Plus, Edit, Trash2, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'; 
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
import AccountBookModal from './AccountBookModal'; 
import WelcomeModal from '@/pages/setup/WelcomeModal';    
import { me } from '@/lib/mockData'; 
import { getAccountBooks, addAccountBook, updateAccountBook, deleteAccountBook } from '@/lib/mockData';

type TaxType = '一般纳税人' | '小规模纳税人';

interface AccountBookUI {
  id: string;
  name: string;
  companyName: string;
  startPeriod: string;
  accountingStandard: string;
  taxType: TaxType; 
  defaultTaxRate?: number;
  requiresAudit: boolean;
  isActive: boolean;
  hadRecords: boolean;
  fiscalYearStartMonth: number;
}

export default function AccountBookList() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState(false);
  
  const [accountBooks, setAccountBooks] = useState<AccountBookUI[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 1. 获取列表数据
  const fetchAccountBooks = async () => {
    try {
      const data = await getAccountBooks();
      
      const formattedData = (data || []).map((book: any) => {
        const validTaxType: TaxType = (book.taxType === '小规模纳税人' || book.taxType === '一般纳税人') 
          ? book.taxType 
          : '一般纳税人';

        return {
          id: book.id || '',
          name: book.name || '未命名账套', 
          companyName: book.companyName || companyName || '',
          startPeriod: book.period_start || book.startPeriod || '',
          accountingStandard: book.accountingStandard || '企业会计准则',
          taxType: validTaxType,
          defaultTaxRate: book.defaultTaxRate,
          requiresAudit: book.review_enabled ?? true,
          isActive: typeof book.isActive !== 'undefined' ? book.isActive : true,
          hadRecords: book.hadRecords ?? false,
          fiscalYearStartMonth: book.fiscalYearStartMonth || 1 
        };
      });
      
      setAccountBooks(formattedData);
    } catch (error) {
      console.error('获取账套列表失败', error);
      setAccountBooks([]);
    }
  };

  useEffect(() => {
    fetchAccountBooks();
    const fetchCompany = async () => {
      try {
        const info = await me();
        const name = info?.company?.name || info?.user?.companyName || '默认公司';
        setCompanyName(name);
      } catch (e) { console.error(e); }
    };
    fetchCompany();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountBookUI | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountBookUI | null>(null);

  const handleEnterBook = (book: AccountBookUI) => {
    if (!book.isActive) return; 
    router.push(`/app/${book.id}/dashboard`);
  };

  const handleCreateNew = () => {
    setEditTarget(null);
    setShowWelcome(false); 
    setShowModal(true);
  };

  // HandleSave: 处理新建或编辑
  const handleSave = async (data: any) => {
    try {
      const isEdit = !!editTarget?.id;
      
      const payload = {
        id: isEdit ? editTarget?.id : undefined,
        name: data.name,
        companyName: companyName,
        startPeriod: data.startPeriod,
        accountingStandard: data.accountingStandard,
        taxType: data.taxType,
        defaultTaxRate: data.defaultTaxRate,
        requiresAudit: data.requiresAudit,
        isActive: data.isActive, 
        fiscalYearStartMonth: parseInt(data.fiscalYearStartMonth)
      };

      let result;
      if (isEdit) {
          result = await updateAccountBook(payload);
      } else {
    result = await addAccountBook(payload);
    // 初始化逻辑：如果是第一个账套，尝试标记初始化完成
    if (accountBooks.length === 0) {
        try {
            // ✅ 改为相对路径，由 Vercel 的 rewrites 转发给 Render
            await fetch('/api/company/account-book/complete', { 
                method: 'POST', 
                credentials: 'include' 
            });
        } catch (e) { 
            console.warn("Init status update failed", e); 
        }
    }
}

      // 如果是新建，直接跳转进账套
      if (!isEdit) {
          const newBookId = result.id || result.data?.id; 
          if (newBookId) {
              router.push(`/app/${newBookId}/dashboard`);
              // 注意：这里新建后直接跳转，Sidebar 会在跳转后重新加载，所以不需要手动 dispatch
              return; 
          }
      }

      // 编辑成功：关闭弹窗，刷新列表
      setShowModal(false);
      setEditTarget(null);
      await fetchAccountBooks(); 
      
      // ✅ 关键修复：通知 Sidebar 更新（例如修改名字后，Sidebar也要变）
      window.dispatchEvent(new Event('ACCOUNT_BOOK_CHANGE'));

    } catch (error: any) {
      console.error("HandleSave Failed:", error);
      alert(`保存失败: ${error.message || '网络请求错误'}`);
      throw error; // 抛出错误让 Modal 停止 loading
    }
  };

  // HandleDelete: 处理删除，捕获 403
  const handleDelete = async (book: AccountBookUI) => {
    try {
      await deleteAccountBook(book.id);
      
      // 删除成功
      await fetchAccountBooks(); 
      setDeleteTarget(null); 
      
      // ✅ 关键修复：通知 Sidebar 更新（如果删除了当前选中的账套，Sidebar要重置）
      window.dispatchEvent(new Event('ACCOUNT_BOOK_CHANGE'));
    } catch (error: any) {
      console.error(error);
      // 如果后端返回 403 (禁止删除)，提示用户
      if (error.status === 403 || error.message?.includes('禁止删除')) {
          alert(`无法删除：${error.message}\n\n该账套包含业务数据，为了数据安全禁止物理删除。\n请点击“编辑”按钮将账套状态修改为“已停用”。`);
      } else {
          alert(`删除失败：${error.message || '未知错误'}`);
      }
      setDeleteTarget(null);
    }
  };

  const allSelected = accountBooks.length > 0 && selectedIds.length === accountBooks.length;
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(accountBooks.map(ab => ab.id));
    else setSelectedIds([]);
  };
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) setSelectedIds(prev => [...prev, id]);
    else setSelectedIds(prev => prev.filter(i => i !== id));
  };

  return (
    <div>
      <div className="w-full flex items-end justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">账套管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理您的会计账套，设置独立的会计年度</p>
        </div>
        <Button onClick={handleCreateNew} size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          新建账套
        </Button>
      </div>
      
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead className="w-12"><Checkbox checked={allSelected} onCheckedChange={(val) => handleSelectAll(!!val)} /></TableHead>
                <TableHead className="w-[200px]">账套名称</TableHead>
                <TableHead>纳税性质</TableHead>
                <TableHead>启用期间</TableHead>
                <TableHead>会计准则</TableHead>
                <TableHead>年度起始</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-gray-500">暂无账套数据</TableCell>
                </TableRow>
              ) : (
                accountBooks.map((accountBook) => (
                  <TableRow key={accountBook.id} className="hover:bg-slate-50 group">
                    <TableCell><Checkbox checked={selectedIds.includes(accountBook.id)} onCheckedChange={(val) => handleSelectOne(accountBook.id, !!val)} /></TableCell>
                    
                    <TableCell>
                        <div 
                           onClick={() => handleEnterBook(accountBook)}
                           className={`font-medium transition-colors ${accountBook.isActive ? "text-gray-900 cursor-pointer hover:text-blue-600 hover:underline" : "text-gray-400 cursor-not-allowed"}`}
                        >
                            {accountBook.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{accountBook.companyName || companyName}</div>
                    </TableCell>

                    <TableCell>
                        <Badge variant="outline" className={accountBook.taxType === '一般纳税人' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
                            {accountBook.taxType}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-gray-600 font-mono text-xs">{accountBook.startPeriod}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{accountBook.accountingStandard}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-mono">{accountBook.fiscalYearStartMonth}月</Badge></TableCell>
                    <TableCell>
                      {accountBook.isActive ? 
                        <span className="flex items-center text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full w-fit">已启用</span> : 
                        <span className="flex items-center text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-full w-fit">已停用</span>
                      }
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${accountBook.isActive ? "text-blue-600" : "text-gray-300"}`} disabled={!accountBook.isActive} onClick={() => handleEnterBook(accountBook)}>
                            <LayoutDashboard className="w-4 h-4" />
                        </Button>
                        <div className="w-px h-3 bg-gray-300 mx-1"></div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" onClick={() => { setEditTarget(accountBook); setShowModal(true); }}>
                          <Edit className="w-4 h-4" /> 
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-red-600"
                          onClick={() => setDeleteTarget(accountBook)}
                          title="删除账套"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} onCreateClick={handleCreateNew} />

      <AccountBookModal
        open={showModal}
        onClose={() => { setShowModal(false); setEditTarget(null); }}
        onSave={handleSave}
        accountBook={editTarget}
        defaultCompanyName={companyName}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除账套确认</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
                <div>您正在尝试删除账套：<span className="font-bold text-gray-900">{deleteTarget?.name}</span></div>
                <div className="p-3 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">
                    <strong>安全规则：</strong><br/>
                    1. 如果该账套是<strong>空账套</strong>（无凭证、无日记账、无余额），系统将执行<strong>物理删除</strong>。<br/>
                    2. 如果该账套<strong>已有业务数据</strong>，系统将<strong>拒绝删除</strong>，请您在编辑页选择“停用”该账套。
                </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-red-600 hover:bg-red-700">
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}