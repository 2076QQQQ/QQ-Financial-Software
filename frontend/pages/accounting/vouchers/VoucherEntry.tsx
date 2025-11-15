import { useState, useEffect } from 'react';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { getEnabledTemplates, addVoucherTemplate, type VoucherTemplate } from '@/lib/mockData';         
import { toast } from 'sonner@2.0.3';

// 会计科目
interface Subject {
  id: string;
  code: string;
  name: string;
  requiresAuxiliary: boolean;
}

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
  requiresAuxiliary?: boolean;
}

// 凭证数据
interface VoucherData {
  voucherType: string;
  voucherNumber: string;
  voucherDate: string;
  voucherCode: string;
  attachments: number;
  lines: VoucherLine[];
  debitTotal: number;
  creditTotal: number;
}

interface VoucherEntryProps {
  open: boolean;
  onClose: () => void;
  voucher?: any;
  viewMode?: boolean;
  onSave: (data: VoucherData) => void;
}

// 模拟会计科目数据
const mockSubjects: Subject[] = [
  { id: 's1', code: '1001', name: '库存现金', requiresAuxiliary: false },
  { id: 's2', code: '1002', name: '银行存款', requiresAuxiliary: true },
  { id: 's3', code: '1122', name: '应收账款', requiresAuxiliary: true },
  { id: 's4', code: '2202', name: '应付账款', requiresAuxiliary: true },
  { id: 's5', code: '2211', name: '应付职工薪酬', requiresAuxiliary: false },
  { id: 's6', code: '6001', name: '主营业务收入', requiresAuxiliary: false },
  { id: 's7', code: '6602', name: '管理费用', requiresAuxiliary: false },
];

export default function VoucherEntry({ open, onClose, voucher, viewMode = false, onSave }: VoucherEntryProps) {
  const [formData, setFormData] = useState<VoucherData>({
    voucherType: '记',
    voucherNumber: '001',
    voucherDate: new Date().toISOString().split('T')[0],
    voucherCode: '记-001',
    attachments: 0,
    lines: [
      {
        id: `line-${Date.now()}-1`,
        summary: '',
        subjectId: '',
        subjectCode: '',
        subjectName: '',
        debitAmount: '',
        creditAmount: '',
        requiresAuxiliary: false
      },
      {
        id: `line-${Date.now()}-2`,
        summary: '',
        subjectId: '',
        subjectCode: '',
        subjectName: '',
        debitAmount: '',
        creditAmount: '',
        requiresAuxiliary: false
      }
    ],
    debitTotal: 0,
    creditTotal: 0
  });

  const [openSubjectPopover, setOpenSubjectPopover] = useState<string | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ lineId: string; field: string } | null>(null);
  const [showTemplateImport, setShowTemplateImport] = useState(false);
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [templateName, setTemplateName] = useState('');

  // 加载凭证数据
  useEffect(() => {
    if (voucher) {
      setFormData({
        voucherType: voucher.voucherType,
        voucherNumber: voucher.voucherNumber,
        voucherDate: voucher.voucherDate,
        voucherCode: voucher.voucherCode,
        attachments: voucher.attachments,
        lines: voucher.lines.map((l: any) => ({ ...l })),
        debitTotal: voucher.debitTotal,
        creditTotal: voucher.creditTotal
      });
    } else {
      // 新增模式：生成新的凭证号
      const date = new Date();
      const nextNumber = String(date.getTime()).slice(-3);
      setFormData({
        voucherType: '记',
        voucherNumber: nextNumber,
        voucherDate: date.toISOString().split('T')[0],
        voucherCode: `记-${nextNumber}`,
        attachments: 0,
        lines: [
          {
            id: `line-${Date.now()}-1`,
            summary: '',
            subjectId: '',
            subjectCode: '',
            subjectName: '',
            debitAmount: '',
            creditAmount: '',
            requiresAuxiliary: false
          },
          {
            id: `line-${Date.now()}-2`,
            summary: '',
            subjectId: '',
            subjectCode: '',
            subjectName: '',
            debitAmount: '',
            creditAmount: '',
            requiresAuxiliary: false
          }
        ],
        debitTotal: 0,
        creditTotal: 0
      });
    }
  }, [voucher, open]);

  // 计算合计
  useEffect(() => {
    const debitTotal = formData.lines.reduce((sum, line) => {
      return sum + (parseFloat(line.debitAmount) || 0);
    }, 0);
    const creditTotal = formData.lines.reduce((sum, line) => {
      return sum + (parseFloat(line.creditAmount) || 0);
    }, 0);
    setFormData(prev => ({ ...prev, debitTotal, creditTotal }));
  }, [formData.lines]);

  // 更新分录
  const updateLine = (lineId: string, field: keyof VoucherLine, value: any) => {
    console.log('🔍 更新字段:', { lineId, field, value }); // 👈 调试日志
    setFormData({
      ...formData,
      lines: formData.lines.map(line =>
        line.id === lineId ? { ...line, [field]: value } : line
      )
    });
  };

  // 选择会计科
  const selectSubject = (lineId: string, subject: Subject) => {
    setFormData({
      ...formData,
      lines: formData.lines.map(line =>
        line.id === lineId
          ? {
              ...line,
              subjectId: subject.id,
              subjectCode: subject.code,
              subjectName: subject.name,
              requiresAuxiliary: subject.requiresAuxiliary
            }
          : line
      )
    });
    setOpenSubjectPopover(null);
  };

  // 添加分录
  const addLine = () => {
    const newLine: VoucherLine = {
      id: `line-${Date.now()}`,
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
      lines: [...formData.lines, newLine]
    });
  };

  // 删除分录
  const deleteLine = (lineId: string) => {
    if (formData.lines.length <= 2) {
      alert('至少需要保留两条分录');
      return;
    }
    setFormData({
      ...formData,
      lines: formData.lines.filter(line => line.id !== lineId)
    });
  };

  // 空格键平账
  const handleSpaceKey = (lineId: string, field: 'debitAmount' | 'creditAmount') => {
    const diff = Math.abs(formData.debitTotal - formData.creditTotal);
    if (diff > 0) {
      updateLine(lineId, field, diff.toFixed(2));
    }
  };

  // Tab键导航
  const handleTabKey = (e: React.KeyboardEvent, lineId: string, field: string) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const lineIndex = formData.lines.findIndex(l => l.id === lineId);
      const fields = ['summary', 'subject', 'auxiliary', 'debitAmount', 'creditAmount'];
      const fieldIndex = fields.indexOf(field);

      if (fieldIndex < fields.length - 1) {
        // 同一行的下一个字段
        setFocusedCell({ lineId, field: fields[fieldIndex + 1] });
      } else if (lineIndex < formData.lines.length - 1) {
        // 下一行的第一个字段
        setFocusedCell({ lineId: formData.lines[lineIndex + 1].id, field: 'summary' });
      } else {
        // 最后一行最后一个字段：添加新行
        addLine();
      }
    }
  };

  // 保存
  const handleSave = (saveAndNew = false) => {
    // 验证
    if (!formData.voucherType || !formData.voucherDate) {
      alert('请填写凭证字和日期');
      return;
    }

    if (formData.lines.length < 2) {
      alert('至少需要两条分录');
      return;
    }

    for (const line of formData.lines) {
      if (!line.summary.trim()) {
        alert('请填写所有分录的摘要');
        return;
      }
      if (!line.subjectId) {
        alert('请择所有分录的会计科目');
        return;
      }
      if (line.requiresAuxiliary && !line.auxiliary) {
        alert(`科目"${line.subjectName}"需要填写辅助核算`);
        return;
      }
      if (!line.debitAmount && !line.creditAmount) {
        alert('每条分录必须填写借方金额或贷方金额');
        return;
      }
    }

    // BR1: 借贷必须平衡
    if (formData.debitTotal !== formData.creditTotal || formData.debitTotal === 0) {
      alert('借方合计必须等于贷方合计，且不能为0');
      return;
    }

    onSave(formData);

    if (saveAndNew) {
      // 保存并新增：清空表单
      const date = new Date();
      const nextNumber = String(date.getTime()).slice(-3);
      setFormData({
        voucherType: '记',
        voucherNumber: nextNumber,
        voucherDate: date.toISOString().split('T')[0],
        voucherCode: `记-${nextNumber}`,
        attachments: 0,
        lines: [
          {
            id: `line-${Date.now()}-1`,
            summary: '',
            subjectId: '',
            subjectCode: '',
            subjectName: '',
            debitAmount: '',
            creditAmount: '',
            requiresAuxiliary: false
          },
          {
            id: `line-${Date.now()}-2`,
            summary: '',
            subjectId: '',
            subjectCode: '',
            subjectName: '',
            debitAmount: '',
            creditAmount: '',
            requiresAuxiliary: false
          }
        ],
        debitTotal: 0,
        creditTotal: 0
      });
    }
  };

  // 检查是否可以保存（BR1）
  const canSave = formData.debitTotal > 0 && formData.debitTotal === formData.creditTotal;
  
  // 检查是否可以存为模板（需要至少有一行数据且有科目）
  const canSaveAsTemplate = formData.lines.some(line => 
    line.summary && line.subjectCode && line.subjectName
  );

  // 检查是否有效（用于连续录入模式）
  const isValid = canSave && formData.lines.some(l => l.debitAmount || l.creditAmount);

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">
            {viewMode ? '查看凭证' : voucher ? '编辑凭证' : '新增凭证'}
          </DialogTitle>
          <DialogDescription>
            {viewMode ? '凭证详情（只读）' : '填写凭证信息和分录明细'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* 凭证头 */}
          <div className="grid grid-cols-12 gap-4 mb-6">
            <div className="col-span-2 space-y-2">
              <Label>凭证字 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.voucherType}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    voucherType: value,
                    voucherCode: `${value}-${formData.voucherNumber}`
                  });
                }}
                disabled={viewMode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="记">记</SelectItem>
                  <SelectItem value="收">收</SelectItem>
                  <SelectItem value="付">付</SelectItem>
                  <SelectItem value="转">转</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 space-y-2">
              <Label>号</Label>
              <Input
                value={formData.voucherNumber}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="col-span-3 space-y-2">
              <Label>日期 <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={formData.voucherDate}
                onChange={(e) => setFormData({ ...formData, voucherDate: e.target.value })}
                disabled={viewMode}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>附单据</Label>
              <Input
                type="number"
                min="0"
                value={formData.attachments}
                onChange={(e) => setFormData({ ...formData, attachments: parseInt(e.target.value) || 0 })}
                disabled={viewMode}
              />
            </div>
            <div className="col-span-4 space-y-2">
              <Label className="invisible">操作</Label>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setShowTemplateImport(true)}
                  disabled={viewMode}
                >
                  <Download className="w-4 h-4 mr-1" />
                  从模板导入
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setShowTemplateSave(true)}
                  disabled={viewMode || !canSaveAsTemplate}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  存为模板
                </Button>
              </div>
            </div>
          </div>

          {/* 凭证体 - 可编辑表格 */}
          <div className="border rounded-lg overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[350px]">
                      摘要 <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[300px]">
                      会计科目代码及名称 <span className="text-red-500">*</span>
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[140px]">
                      辅助核算
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[130px]">
                      借方金额
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 w-[130px]">
                      贷方金额
                    </th>
                    <th className="border border-gray-200 px-3 py-2 text-center text-xs text-gray-600 w-[60px]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {formData.lines.map((line, index) => (
                    <tr key={line.id} className="hover:bg-gray-50">
                      {/* 摘要 */}
                      <td className="border border-gray-200 p-0">
                        <Input
                          value={line.summary}
                          onChange={(e) => updateLine(line.id, 'summary', e.target.value)}
                          onKeyDown={(e) => handleTabKey(e, line.id, 'summary')}
                          placeholder="输入摘要"
                          className="border-0 rounded-none h-9 px-3"
                          disabled={viewMode}
                        />
                      </td>

                      {/* 会计科目 */}
                      <td className="border border-gray-200 p-0">
                        {viewMode ? (
                          <div className="px-3 py-2 text-sm">
                            {line.subjectCode} {line.subjectName}
                          </div>
                        ) : (
                          <Popover
                            open={openSubjectPopover === line.id}
                            onOpenChange={(open) => setOpenSubjectPopover(open ? line.id : null)}
                          >
                            <PopoverTrigger asChild>
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 h-9"
                                onKeyDown={(e) => handleTabKey(e, line.id, 'subject')}
                              >
                                {line.subjectId ? (
                                  <span>{line.subjectCode} {line.subjectName}</span>
                                ) : (
                                  <span className="text-gray-400">选择科目</span>
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="搜索科目代码或称..." />
                                <CommandEmpty>未找到科目</CommandEmpty>
                                <CommandGroup className="max-h-64 overflow-y-auto">
                                  {mockSubjects.map((subject) => (
                                    <CommandItem
                                      key={subject.id}
                                      value={`${subject.code} ${subject.name}`}
                                      onSelect={() => selectSubject(line.id, subject)}
                                    >
                                      {subject.code} {subject.name}
                                      {subject.requiresAuxiliary && (
                                        <span className="ml-2 text-xs text-orange-600">需辅助核算</span>
                                      )}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>

                      {/* 辅助核算 */}
                      <td className="border border-gray-200 p-0">
                        <Input
                          value={line.auxiliary || ''}
                          onChange={(e) => updateLine(line.id, 'auxiliary', e.target.value)}
                          onKeyDown={(e) => handleTabKey(e, line.id, 'auxiliary')}
                          placeholder={line.requiresAuxiliary ? '必填' : ''}
                          className={`border-0 rounded-none h-9 px-3 ${
                            line.requiresAuxiliary ? 'bg-orange-50' : ''
                          }`}
                          disabled={viewMode}
                        />
                      </td>

                      {/* 借方金额 */}
                      <td className="border border-gray-200 p-0">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.debitAmount || ''}
                          onChange={(e) => {
                            let value = e.target.value;
                            console.log('💰 借方金额输入:', value);
                            
                            // 允许空值
                            if (value === '') {
                              updateLine(line.id, 'debitAmount', '');
                              return;
                            }
                            
                            // 允许单独的小数点（输入 "." 时）
                            if (value === '.') {
                              updateLine(line.id, 'debitAmount', '0.');
                              return;
                            }
                            
                            // 验证格式：允许数字和小数（最多2位小数）
                            if (/^\d+\.?\d{0,2}$/.test(value)) {
                              updateLine(line.id, 'debitAmount', value);
                              // 如果输入借方，清空贷方
                              if (line.creditAmount) {
                                updateLine(line.id, 'creditAmount', '');
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // 失去焦点时格式化为两位小数
                            const value = e.target.value;
                            if (value && !isNaN(parseFloat(value))) {
                              const formatted = parseFloat(value).toFixed(2);
                              updateLine(line.id, 'debitAmount', formatted);
                            } else if (value === '0.') {
                              updateLine(line.id, 'debitAmount', '0.00');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === ' ') {
                              e.preventDefault();
                              handleSpaceKey(line.id, 'debitAmount');
                            } else {
                              handleTabKey(e, line.id, 'debitAmount');
                            }
                          }}
                          placeholder="0.00"
                          className="border-0 rounded-none h-9 px-3 text-right"
                          disabled={viewMode}
                        />
                      </td>

                      {/* 贷方金额 */}
                      <td className="border border-gray-200 p-0">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={line.creditAmount || ''}
                          onChange={(e) => {
                            let value = e.target.value;
                            console.log('💰 贷方金额输入:', value);
                            
                            // 允许空值
                            if (value === '') {
                              updateLine(line.id, 'creditAmount', '');
                              return;
                            }
                            
                            // 允许单独的小数点（输入 "." 时）
                            if (value === '.') {
                              updateLine(line.id, 'creditAmount', '0.');
                              return;
                            }
                            
                            // 验证格式：允许数字和小数（最多2位小数）
                            if (/^\d+\.?\d{0,2}$/.test(value)) {
                              updateLine(line.id, 'creditAmount', value);
                              // 如果输入贷方，清空借方
                              if (line.debitAmount) {
                                updateLine(line.id, 'debitAmount', '');
                              }
                            }
                          }}
                          onBlur={(e) => {
                            // 失去焦点时格式化为两位小数
                            const value = e.target.value;
                            if (value && !isNaN(parseFloat(value))) {
                              const formatted = parseFloat(value).toFixed(2);
                              updateLine(line.id, 'creditAmount', formatted);
                            } else if (value === '0.') {
                              updateLine(line.id, 'creditAmount', '0.00');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === ' ') {
                              e.preventDefault();
                              handleSpaceKey(line.id, 'creditAmount');
                            } else {
                              handleTabKey(e, line.id, 'creditAmount');
                            }
                          }}
                          placeholder="0.00"
                          className="border-0 rounded-none h-9 px-3 text-right"
                          disabled={viewMode}
                        />
                      </td>

                      {/* 操作 */}
                      <td className="border border-gray-200 p-0 text-center">
                        {!viewMode && (
                          <button
                            onClick={() => deleteLine(line.id)}
                            className="text-red-600 hover:text-red-700 p-2"
                            disabled={formData.lines.length <= 2}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!viewMode && (
              <div className="p-3 border-t border-gray-200 bg-gray-50">
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  添加分录
                </Button>
              </div>
            )}
          </div>

          {/* 凭证尾 - 合计 */}
          <div className="bg-gray-50 rounded-lg border p-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">借方合计</div>
                <div className={`text-2xl font-medium ${
                  formData.debitTotal === formData.creditTotal && formData.debitTotal > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  ¥ {formData.debitTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">贷方合计</div>
                <div className={`text-2xl font-medium ${
                  formData.debitTotal === formData.creditTotal && formData.creditTotal > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  ¥ {formData.creditTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">差额</div>
                <div className={`text-2xl font-medium ${
                  formData.debitTotal === formData.creditTotal && formData.debitTotal > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}>
                  ¥ {Math.abs(formData.debitTotal - formData.creditTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            {!canSave && formData.lines.some(l => l.debitAmount || l.creditAmount) && (
              <div className="mt-3 text-sm text-red-600">
                ⚠️ 借方合计必须等于贷方合计，且不能为0
              </div>
            )}
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {viewMode ? '关闭' : '取消'}
          </Button>
          {!viewMode && (
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(true)}
                disabled={!canSave}
              >
                保存并新增
              </Button>
              <Button onClick={handleSave} disabled={!isValid}>
                保存
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* 从模板导入对话框 */}
    <Dialog open={showTemplateImport} onOpenChange={setShowTemplateImport}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>从模板导入</DialogTitle>
          <DialogDescription>
            选择一个已启用的凭证模板，导入到当前凭证中
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {getEnabledTemplates().length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              暂无已启用的模板
            </div>
          ) : (
            getEnabledTemplates().map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  // 导入模板数据到当前凭证
                  setFormData({
                    ...formData,
                    voucherType: template.voucherType,
                    voucherCode: `${template.voucherType}-${formData.voucherNumber}`,
                    lines: template.lines.map((l, idx) => ({
                      id: `line-${Date.now()}-${idx}`,
                      summary: l.summary,
                      subjectId: l.subjectId,
                      subjectCode: l.subjectCode,
                      subjectName: l.subjectName,
                      auxiliary: '',
                      debitAmount: '',
                      creditAmount: '',
                      requiresAuxiliary: false
                    }))
                  });
                  setShowTemplateImport(false);
                  toast.success(`已导入模板：${template.name}`);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{template.name}</h4>
                    <div className="text-sm text-gray-600 mb-2">
                      凭证字：{template.voucherType} | 创建时间：{template.createdAt}
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      {template.lines.map((line) => (
                        <div key={line.id}>
                          {line.summary} - {line.subjectCode} {line.subjectName}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    选
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowTemplateImport(false)}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* 存为模板对话框 */}
    <Dialog open={showTemplateSave} onOpenChange={setShowTemplateSave}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>存为模板</DialogTitle>
          <DialogDescription>
            将当前凭证保存为模板，方便后续快速录入
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>模板名称 <span className="text-red-500">*</span></Label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="请输入模板名称，如：工资发放"
            />
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-2">模板预览：</div>
            <div className="space-y-1 text-xs text-gray-700">
              <div>凭证字：{formData.voucherType}</div>
              <div>分录数：{formData.lines.length} 条</div>
              <div className="mt-2">
                {formData.lines.map((line, idx) => (
                  <div key={idx}>
                    {idx + 1}. {line.summary || '（未填写）'} - {line.subjectName || '（未选择科目）'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setShowTemplateSave(false);
            setTemplateName('');
          }}>
            取消
          </Button>
          <Button
            onClick={() => {
              if (!templateName.trim()) {
                alert('请输入模板名称');
                return;
              }
              
              // 保存为模板
              const newTemplate: VoucherTemplate = {
                id: `tpl-${Date.now()}`,
                name: templateName,
                voucherType: formData.voucherType,
                status: '待审核',
                lines: formData.lines.map(l => ({
                  id: l.id,
                  summary: l.summary,
                  subjectId: l.subjectId,
                  subjectCode: l.subjectCode,
                  subjectName: l.subjectName,
                  debitAmount: '',  // 模板不保存金额
                  creditAmount: ''
                })),
                createdAt: new Date().toLocaleString('zh-CN')
              };
              
              addVoucherTemplate(newTemplate);
              toast.success(`模板\"${templateName}\"已保存，待审核通过后可使用`);
              setShowTemplateSave(false);
              setTemplateName('');
            }}
            disabled={!templateName.trim()}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}