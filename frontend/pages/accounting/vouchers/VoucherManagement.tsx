import { useState, useEffect } from 'react';
import { Plus, Edit, Copy, Trash2, Download, Upload, ChevronDown, ChevronRight, Eye, CheckCircle, XCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import VoucherEntry from '@/vouchers/VoucherEntry';
import { 
  getAllVouchers, 
  addVoucher, 
  updateVoucher, 
  deleteVoucher,
  batchUpdateVouchers 
} from '@/lib/mockData';

// 凭证分录
interface VoucherLine {
  id: string;
  summary: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  auxiliary?: string;
  debitAmount: string;
  creditAmount: string;
}

// 凭证数据
interface Voucher {
  id: string;
  voucherDate: string; // 记账日期
  voucherType: string; // 凭证字
  voucherNumber: string; // 凭证号
  voucherCode: string; // 凭证字号（如"记-001"）
  attachments: number; // 附件数量
  lines: VoucherLine[]; // 分录明细
  debitTotal: number; // 借方合计
  creditTotal: number; // 贷方合计
  status: 'draft' | 'approved'; // 未审核/已审核
  maker: string; // 制单人
  reviewer?: string; // 审核人
  isExpanded?: boolean; // 是否展开
  createdAt: string;
  updatedAt: string;
}

export default function VoucherManagement() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Voucher | null>(null);
  const [viewMode, setViewMode] = useState(false); // 是否只读模式
  const [deleteTarget, setDeleteTarget] = useState<Voucher | null>(null);

  // 筛选条件 - 默认日期范围为本月1号到本月最后一天
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const [filters, setFilters] = useState({
    dateFrom: firstDayOfMonth.toISOString().split('T')[0],
    dateTo: lastDayOfMonth.toISOString().split('T')[0],
    status: 'all',
    voucherCode: ''
  });

  // 从全局数据中加载凭证
  const loadVouchers = () => {
    const allVouchers = getAllVouchers();
    setVouchers(allVouchers);
  };

  // 加载凭证数据
  useEffect(() => {
    loadVouchers();
  }, []);

  // 切换展开/折叠
  const toggleExpand = (voucherId: string) => {
    setVouchers(vouchers.map(v =>
      v.id === voucherId ? { ...v, isExpanded: !v.isExpanded } : v
    ));
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === vouchers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(vouchers.map(v => v.id));
    }
  };

  // 切换单个选择
  const toggleSelect = (voucherId: string) => {
    if (selectedIds.includes(voucherId)) {
      setSelectedIds(selectedIds.filter(id => id !== voucherId));
    } else {
      setSelectedIds([...selectedIds, voucherId]);
    }
  };

  // 获取选中的凭证
  const getSelectedVouchers = () => {
    return vouchers.filter(v => selectedIds.includes(v.id));
  };

  // 检查是否可以审核（至少选中一张未审核凭证）
  const canApprove = () => {
    const selected = getSelectedVouchers();
    return selected.length > 0 && selected.some(v => v.status === 'draft');
  };

  // 检查是否可以反审核（至少选中一张已审核凭证）
  const canUnapprove = () => {
    const selected = getSelectedVouchers();
    return selected.length > 0 && selected.some(v => v.status === 'approved');
  };

  // 检查是否可以删除（至少选中一张未审核凭证）
  const canDelete = () => {
    const selected = getSelectedVouchers();
    return selected.length > 0 && selected.some(v => v.status === 'draft');
  };

  // 批量审核
  const handleBatchApprove = () => {
    const updatedVouchers = vouchers.map(v =>
      selectedIds.includes(v.id) && v.status === 'draft'
        ? { ...v, status: 'approved', reviewer: '张会计', updatedAt: new Date().toLocaleString('zh-CN') }
        : v
    );
    batchUpdateVouchers(updatedVouchers);
    setVouchers(updatedVouchers);
    setSelectedIds([]);
  };

  // 批量反审核
  const handleBatchUnapprove = () => {
    const updatedVouchers = vouchers.map(v =>
      selectedIds.includes(v.id) && v.status === 'approved'
        ? { ...v, status: 'draft', reviewer: undefined, updatedAt: new Date().toLocaleString('zh-CN') }
        : v
    );
    batchUpdateVouchers(updatedVouchers);
    setVouchers(updatedVouchers);
    setSelectedIds([]);
  };

  // 批量删除
  const handleBatchDelete = () => {
    const draftIds = vouchers.filter(v => v.status === 'draft').map(v => v.id);
    const toDelete = selectedIds.filter(id => draftIds.includes(id));
    const updatedVouchers = vouchers.filter(v => !toDelete.includes(v.id));
    batchUpdateVouchers(updatedVouchers);
    setVouchers(updatedVouchers);
    setSelectedIds([]);
  };

  // 新增凭证
  const handleAdd = () => {
    setEditTarget(null);
    setViewMode(false);
    setShowEntryModal(true);
  };

  // 编辑凭证
  const handleEdit = (voucher: Voucher) => {
    setEditTarget(voucher);
    setViewMode(false);
    setShowEntryModal(true);
  };

  // 查看凭证（只读）
  const handleView = (voucher: Voucher) => {
    setEditTarget(voucher);
    setViewMode(true);
    setShowEntryModal(true);
  };

  // 单条审核
  const handleApprove = (voucher: Voucher) => {
    const updatedVoucher = {
      ...voucher,
      status: 'approved' as 'draft' | 'approved',
      reviewer: '张会计',
      updatedAt: new Date().toLocaleString('zh-CN')
    };
    updateVoucher(voucher.id, updatedVoucher);
    setVouchers(vouchers.map(v => v.id === voucher.id ? updatedVoucher : v));
  };

  // 单条反审核
  const handleUnapprove = (voucher: Voucher) => {
    const updatedVoucher = {
      ...voucher,
      status: 'draft' as 'draft' | 'approved',
      reviewer: undefined,
      updatedAt: new Date().toLocaleString('zh-CN')
    };
    updateVoucher(voucher.id, updatedVoucher);
    setVouchers(vouchers.map(v => v.id === voucher.id ? updatedVoucher : v));
  };

  // 删除凭证
  const handleDelete = (voucher: Voucher) => {
    deleteVoucher(voucher.id);
    setVouchers(vouchers.filter(v => v.id !== voucher.id));
    setDeleteTarget(null);
  };

  // 过滤凭证
  const filteredVouchers = vouchers.filter(v => {
    const matchDate = v.voucherDate >= filters.dateFrom && v.voucherDate <= filters.dateTo;
    const matchStatus = filters.status === 'all' || 
                       (filters.status === 'draft' && v.status === 'draft') ||
                       (filters.status === 'approved' && v.status === 'approved');
    const matchCode = !filters.voucherCode || v.voucherCode.includes(filters.voucherCode);
    return matchDate && matchStatus && matchCode;
  });

  // 获取主要科目（第一笔借方和第一笔贷方）
  const getMainSubjects = (lines: VoucherLine[]) => {
    const debit = lines.find(l => l.debitAmount);
    const credit = lines.find(l => l.creditAmount);
    return {
      debit: debit ? `${debit.subjectCode} ${debit.subjectName}` : '',
      credit: credit ? `${credit.subjectCode} ${credit.subjectName}` : ''
    };
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">凭证管理</h1>
        <p className="text-gray-600">
          查询、编辑、审核会计凭证
        </p>
      </div>

      {/* 筛选和操作区 */}
      <div className="bg-white rounded-lg border mb-4 p-4">
        {/* 筛选区 */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="space-y-2">
            <Label>记账日期（起）</Label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>记账日期（止）</Label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>状态</Label>
            <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="draft">未审核</SelectItem>
                <SelectItem value="approved">已审核</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>凭证字号</Label>
            <Input
              placeholder="如：记-001"
              value={filters.voucherCode}
              onChange={(e) => setFilters({ ...filters, voucherCode: e.target.value })}
            />
          </div>
        </div>

        {/* 操作按钮区 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadVouchers}>
              查询
            </Button>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              新增凭证
            </Button>
            <Button
              variant="outline"
              onClick={handleBatchApprove}
              disabled={!canApprove()}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              审核
            </Button>
            <Button
              variant="outline"
              onClick={handleBatchUnapprove}
              disabled={!canUnapprove()}
            >
              <XCircle className="w-4 h-4 mr-2" />
              反审核
            </Button>
            <Button
              variant="outline"
              onClick={handleBatchDelete}
              disabled={!canDelete()}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </Button>
          </div>
          <div className="text-sm text-gray-600">
            共 {filteredVouchers.length} 条凭证
            {selectedIds.length > 0 && ` / 已选 ${selectedIds.length} 条`}
          </div>
        </div>
      </div>

      {/* 凭证列表 */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.length === filteredVouchers.length && filteredVouchers.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="w-[110px]">记账日期</TableHead>
              <TableHead className="w-[100px]">凭证字号</TableHead>
              <TableHead className="w-[80px] text-center">附件</TableHead>
              <TableHead className="w-[200px]">摘要</TableHead>
              <TableHead className="w-[240px]">科目</TableHead>
              <TableHead className="w-[130px] text-right">借方合计</TableHead>
              <TableHead className="w-[130px] text-right">贷方合计</TableHead>
              <TableHead className="w-[90px]">状态</TableHead>
              <TableHead className="w-[90px]">制单人</TableHead>
              <TableHead className="w-[90px]">审核人</TableHead>
              <TableHead className="text-right w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVouchers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-gray-500 py-8">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              filteredVouchers.map((voucher) => {
                const subjects = getMainSubjects(voucher.lines);
                return (
                  <>
                    {/* 凭证头行 */}
                    <TableRow key={voucher.id} className={voucher.isExpanded ? 'bg-gray-50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(voucher.id)}
                          onCheckedChange={() => toggleSelect(voucher.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleExpand(voucher.id)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          {voucher.isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>{voucher.voucherDate}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleView(voucher)}
                          className="text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {voucher.voucherCode}
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        {voucher.attachments > 0 && (
                          <span className="inline-flex items-center gap-1 text-gray-600">
                            <FileText className="w-4 h-4" />
                            {voucher.attachments}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {voucher.lines[0]?.summary || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">
                          <div className="text-gray-900">借：{subjects.debit}</div>
                          <div className="text-gray-600">贷：{subjects.credit}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {voucher.debitTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {voucher.creditTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={voucher.status === 'approved' ? 'default' : 'secondary'}>
                          {voucher.status === 'approved' ? '已审核' : '未审核'}
                        </Badge>
                      </TableCell>
                      <TableCell>{voucher.maker}</TableCell>
                      <TableCell className="text-gray-600">{voucher.reviewer || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(voucher)}
                            disabled={voucher.status === 'approved'}
                            className={voucher.status === 'approved' ? 'text-gray-400 cursor-not-allowed' : ''}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            编辑
                          </Button>
                          {voucher.status === 'draft' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleApprove(voucher)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              审核
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnapprove(voucher)}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              反审核
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(voucher)}
                            disabled={voucher.status === 'approved'}
                            className={
                              voucher.status === 'approved'
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

                    {/* 展开的分录明细 */}
                    {voucher.isExpanded && (
                      <TableRow>
                        <TableCell colSpan={13} className="bg-gray-50 p-0">
                          <div className="px-16 py-4">
                            <div className="text-sm font-medium text-gray-700 mb-2">分录明细</div>
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-white">
                                  <TableHead>摘要</TableHead>
                                  <TableHead>会计科目代码及名称</TableHead>
                                  <TableHead>辅助核算</TableHead>
                                  <TableHead className="text-right">借方金额</TableHead>
                                  <TableHead className="text-right">贷方金额</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {voucher.lines.map((line) => (
                                  <TableRow key={line.id} className="bg-white">
                                    <TableCell>{line.summary}</TableCell>
                                    <TableCell>{line.subjectCode} {line.subjectName}</TableCell>
                                    <TableCell className="text-gray-600">{line.auxiliary || '-'}</TableCell>
                                    <TableCell className="text-right">
                                      {line.debitAmount || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {line.creditAmount || '-'}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 新增/编辑凭证弹窗 */}
      {showEntryModal && (
        <VoucherEntry
          open={showEntryModal}
          onClose={() => setShowEntryModal(false)}
          voucher={editTarget}
          viewMode={viewMode}
          onSave={(data) => {
            if (editTarget) {
              // 编辑模式
              const updatedVoucher = {
                ...editTarget,
                ...data,
                updatedAt: new Date().toLocaleString('zh-CN')
              };
              updateVoucher(editTarget.id, updatedVoucher);
              setVouchers(vouchers.map(v => v.id === editTarget.id ? updatedVoucher : v));
            } else {
              // 新增模式
              const newVoucher: Voucher = {
                ...data,
                id: `v-${Date.now()}`,
                status: 'draft',
                maker: 'QQ',
                isExpanded: false,
                createdAt: new Date().toLocaleString('zh-CN'),
                updatedAt: new Date().toLocaleString('zh-CN')
              };
              addVoucher(newVoucher);
              setVouchers([...vouchers, newVoucher]);
            }
            setShowEntryModal(false);
          }}
        />
      )}

      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              您确定要删除凭证{' '}
              <span className="font-medium">"{deleteTarget?.voucherCode}"</span> 吗？此操作不可逆。
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