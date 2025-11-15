import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
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
import WelcomeModal from '../setup/WelcomeModal';

interface AccountBook {
  id: string;
  name: string;
  companyName: string;
  startPeriod: string;
  accountingStandard: string;
  taxType: string;
  requiresAudit: boolean;
  isActive: boolean;
  hadRecords: boolean;
}

interface AccountBookListProps {
  isFirstTime?: boolean;
  onAccountBookCreated?: () => void;
}

export default function AccountBookList({ isFirstTime = false, onAccountBookCreated }: AccountBookListProps) {
  // 如果是首次使用，初始数据为空数组；否则显示示例数据
  const [accountBooks, setAccountBooks] = useState<AccountBook[]>(
    isFirstTime ? [] : [
      {
        id: '1',
        name: '2025年账套',
        companyName: '示例科技有限公司',
        startPeriod: '2025-01-01',
        accountingStandard: '企业会计准则',
        taxType: '一般纳税人',
        requiresAudit: true,
        isActive: true,
        hadRecords: true  // 这个账套已有业务数据
      }
    ]
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showWelcome, setShowWelcome] = useState(isFirstTime);
  const [editTarget, setEditTarget] = useState<AccountBook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountBook | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(accountBooks.map(ab => ab.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleCreateNew = () => {
    setEditTarget(null);
    setShowModal(true);
  };

  const handleEdit = (accountBook: AccountBook) => {
    setEditTarget(accountBook);
    setShowModal(true);
  };

  const handleToggleActive = (accountBook: AccountBook) => {
    setAccountBooks(accountBooks.map(ab =>
      ab.id === accountBook.id
        ? { ...ab, isActive: !ab.isActive }
        : ab
    ));
  };

  const handleSave = (data: any) => {
    if (editTarget) {
      // 编辑现有账套
      setAccountBooks(accountBooks.map(ab => {
        if (ab.id === editTarget.id) {
          // 合并数据，但强制保留某些关键字段
          return {
            ...ab,              // 先保留原有所有字段
            ...data,            // 再应用新数据
            id: ab.id,          // 强制保留 ID（防止被覆盖）
            hadRecords: ab.hadRecords,  // 强制保留业务记录状态（核心字段）
          };
        }
        return ab;
      }));
    } else {
      // 创建新账套
      const newAccountBook: AccountBook = {
        id: Date.now().toString(),
        ...data,
        isActive: true,
        hadRecords: false,  // 新账套一定没有业务记录，可以删除
      };
      setAccountBooks([...accountBooks, newAccountBook]);
      
      // 如果是首次创建，通知父组件
      if (isFirstTime && onAccountBookCreated) {
        onAccountBookCreated();
      }
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = (accountBook: AccountBook) => {
    if (accountBook.hadRecords) {
      return; // 不应该能点击，但双重保护
    }
    setAccountBooks(accountBooks.filter(ab => ab.id !== accountBook.id));
    setDeleteTarget(null);
  };

  const allSelected = accountBooks.length > 0 && selectedIds.length === accountBooks.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < accountBooks.length;

  return (
    <div>
      {/* 页面标题和操作区 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-gray-900 mb-1">账套管理</h1>
          <p className="text-gray-600">管理您的会计账套，每个账套对应一个独立的会计期间</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          新增
        </Button>
      </div>

      {/* 数据表格 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="全选"
                  className={someSelected ? 'data-[state=checked]:bg-gray-400' : ''}
                />
              </TableHead>
              <TableHead>账套名称</TableHead>
              <TableHead>企业名称</TableHead>
              <TableHead>启用期间</TableHead>
              <TableHead>会计准则</TableHead>
              <TableHead>纳税性质</TableHead>
              <TableHead>凭证审核</TableHead>
              <TableHead>启用状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountBooks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-gray-500">
                  暂无账套数据，请点击右上角"新增"按钮创建您的第一个账套
                </TableCell>
              </TableRow>
            ) : (
              accountBooks.map((accountBook) => (
                <TableRow key={accountBook.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(accountBook.id)}
                      onCheckedChange={(checked) => handleSelectOne(accountBook.id, checked as boolean)}
                      aria-label={`选择 ${accountBook.name}`}
                    />
                  </TableCell>
                  <TableCell>{accountBook.name}</TableCell>
                  <TableCell>{accountBook.companyName}</TableCell>
                  <TableCell>{accountBook.startPeriod}</TableCell>
                  <TableCell>{accountBook.accountingStandard}</TableCell>
                  <TableCell>{accountBook.taxType}</TableCell>
                  <TableCell>
                    <Badge variant={accountBook.requiresAudit ? 'default' : 'secondary'}>
                      {accountBook.requiresAudit ? '需要审核' : '不需审核'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={accountBook.isActive 
                        ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                      }
                    >
                      {accountBook.isActive ? '已启用' : '未启用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(accountBook)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(accountBook)}
                        disabled={accountBook.hadRecords}
                        className={accountBook.hadRecords 
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

      {/* 提示信息 */}
      {accountBooks.some(ab => ab.hadRecords) && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
          <p className="text-sm text-yellow-900">
            💡 提示：已有业务记录的账套无法删除，确保数据安全。
          </p>
        </div>
      )}

      {/* 新用户欢迎弹窗 */}
      <WelcomeModal
        open={showWelcome}
        onCreateAccountBook={() => {
          setShowWelcome(false);
          handleCreateNew();
        }}
      />

      {/* 新增/编辑账套弹窗 */}
      <AccountBookModal
        open={showModal}
        onClose={() => {
          setShowModal(false);
          setEditTarget(null);
        }}
        onSave={handleSave}
        accountBook={editTarget}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除账套 <span className="font-medium">"{deleteTarget?.name}"</span> 吗？此操作不可逆。
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