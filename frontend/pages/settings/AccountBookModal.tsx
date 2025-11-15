import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';   

interface AccountBook {
  id: string;
  name: string;
  companyName: string;
  startPeriod: string;
  accountingStandard: string;
  taxType: string;
  requiresAudit: boolean;
  isActive: boolean;
}

interface AccountBookModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  accountBook?: AccountBook | null;
}

export default function AccountBookModal({ open, onClose, onSave, accountBook }: AccountBookModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    startPeriod: '',
    accountingStandard: '企业会计准则',
    taxType: '一般纳税人',
    requiresAudit: true,
    isActive: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // 日期选择的独立状态
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  // 当编辑目标变化时，更新表单数据
  useEffect(() => {
    if (accountBook) {
      setFormData({
        name: accountBook.name,
        companyName: accountBook.companyName,
        startPeriod: accountBook.startPeriod,
        accountingStandard: accountBook.accountingStandard,
        taxType: accountBook.taxType,
        requiresAudit: accountBook.requiresAudit,
        isActive: accountBook.isActive
      });
      
      // 解析日期到年月日
      if (accountBook.startPeriod) {
        const parts = accountBook.startPeriod.split('-');
        setSelectedYear(parts[0] || '');
        setSelectedMonth(parts[1] || '');
        setSelectedDay(parts[2] || '');
      }
    } else {
      // 重置表单
      setFormData({
        name: '',
        companyName: '',
        startPeriod: '',
        accountingStandard: '企业会计准则',
        taxType: '一般纳税人',
        requiresAudit: true,
        isActive: true
      });
      setSelectedYear('');
      setSelectedMonth('');
      setSelectedDay('');
    }
    setErrors({});
  }, [accountBook, open]);

  // 当年月日变化时，更新 startPeriod
  useEffect(() => {
    if (selectedYear && selectedMonth && selectedDay) {
      setFormData(prev => ({
        ...prev,
        startPeriod: `${selectedYear}-${selectedMonth}-${selectedDay}`
      }));
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  // 当年份改变时，检查月份和日期是否需要重置
  useEffect(() => {
    if (selectedYear) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const currentDay = new Date().getDate();
      
      // 如果选择了今年
      if (parseInt(selectedYear) === currentYear) {
        // 如果选择的月份大于当前月份，重置月份
        if (selectedMonth && parseInt(selectedMonth) > currentMonth) {
          setSelectedMonth('');
          setSelectedDay('');
        }
        // 如果选择的是当前月，检查日期
        else if (selectedMonth && parseInt(selectedMonth) === currentMonth) {
          if (selectedDay && parseInt(selectedDay) > currentDay) {
            setSelectedDay('');
          }
        }
      }
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '请输入账套名称';
    }

    if (!formData.companyName.trim()) {
      newErrors.companyName = '请输入企业名称';
    }

    if (!formData.startPeriod) {
      newErrors.startPeriod = '请选择启用期间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    // 模拟API调用
    setTimeout(() => {
      setLoading(false);
      // 只返回应该编辑的字段，不包含 id、hadRecords 等内部状态
      const dataToSave = {
        name: formData.name,
        companyName: formData.companyName,
        startPeriod: formData.startPeriod,
        accountingStandard: formData.accountingStandard,
        taxType: formData.taxType,
        requiresAudit: formData.requiresAudit,
        // 只在编辑模式下才包含 isActive
        ...(accountBook ? { isActive: formData.isActive } : {})
      };
      onSave(dataToSave);
    }, 800);
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  // 生成年份选项（2000年到今年）
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 2000; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  };

  // 生成月份选项（1-12月，但如果是今年则只到当前月）
  const generateMonthOptions = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    const maxMonth = selectedYear && parseInt(selectedYear) === currentYear ? currentMonth : 12;
    
    return Array.from({ length: maxMonth }, (_, i) => i + 1);
  };

  // 生成日期选项（根据年月动态计算，且不能超过今天）
  const generateDayOptions = () => {
    if (!selectedYear || !selectedMonth) return [];
    
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentDay = new Date().getDate();
    
    // 如果是当前年月，最多只能选到今天
    const maxDay = (year === currentYear && month === currentMonth) ? currentDay : daysInMonth;
    
    return Array.from({ length: maxDay }, (_, i) => i + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{accountBook ? '编辑账套' : '新增账套'}</DialogTitle>
          <DialogDescription>
            {accountBook ? '修改账套信息' : '创建一个新的会计账套，开始您的财务管理'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 账套名称 */}
          <div className="space-y-2">
            <Label htmlFor="name">
              账套名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="例如：2025年账套"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* 企业名称 */}
          <div className="space-y-2">
            <Label htmlFor="companyName">
              企业名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="companyName"
              placeholder="例如：示例科技有限公司"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className={errors.companyName ? 'border-red-500' : ''}
            />
            {errors.companyName && (
              <p className="text-sm text-red-500">{errors.companyName}</p>
            )}
          </div>

          {/* 启用期间 */}
          <div className="space-y-2">
            <Label htmlFor="startPeriod">
              启用期间 <span className="text-red-500">*</span>
            </Label>
            <div className="flex space-x-2">
              <Select
                value={selectedYear}
                onValueChange={(value) => setSelectedYear(value)}
              >
                <SelectTrigger className={errors.startPeriod ? 'border-red-500' : ''}>
                  <SelectValue placeholder="选择年份" />
                </SelectTrigger>
                <SelectContent>
                  {generateYearOptions().map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}年
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMonth}
                onValueChange={(value) => setSelectedMonth(value)}
              >
                <SelectTrigger className={errors.startPeriod ? 'border-red-500' : ''}>
                  <SelectValue placeholder="选择月份" />
                </SelectTrigger>
                <SelectContent>
                  {generateMonthOptions().map((month) => (
                    <SelectItem key={month} value={String(month).padStart(2, '0')}>
                      {month}月
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedDay}
                onValueChange={(value) => setSelectedDay(value)}
              >
                <SelectTrigger className={errors.startPeriod ? 'border-red-500' : ''}>
                  <SelectValue placeholder="选择日期" />
                </SelectTrigger>
                <SelectContent>
                  {generateDayOptions().map((day) => (
                    <SelectItem key={day} value={String(day).padStart(2, '0')}>
                      {day}日
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {errors.startPeriod && (
              <p className="text-sm text-red-500">{errors.startPeriod}</p>
            )}
          </div>

          {/* 会计准则 */}
          <div className="space-y-2">
            <Label htmlFor="accountingStandard">
              会计准则 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.accountingStandard}
              onValueChange={(value) => setFormData({ ...formData, accountingStandard: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="企业会计准则">企业会计准则</SelectItem>
                <SelectItem value="小企业会计准则">小企业会计准则</SelectItem>
                <SelectItem value="民间非营利组织会计制度">民间非营利组织会计制度</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 纳税性质 */}
          <div className="space-y-2">
            <Label htmlFor="taxType">
              纳税性质 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.taxType}
              onValueChange={(value) => setFormData({ ...formData, taxType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="一般纳税人">一般纳税人</SelectItem>
                <SelectItem value="小规模纳税人">小规模纳税人</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 凭证审核 */}
          <div className="space-y-2">
            <Label>凭证审核</Label>
            <RadioGroup
              value={formData.requiresAudit ? 'true' : 'false'}
              onValueChange={(value) => setFormData({ ...formData, requiresAudit: value === 'true' })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="no-audit" />
                <Label htmlFor="no-audit" className="font-normal cursor-pointer">
                  不需审核
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="need-audit" />
                <Label htmlFor="need-audit" className="font-normal cursor-pointer">
                  需要审核
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 启用状态（仅在编辑时显示） */}
          {accountBook && (
            <div className="space-y-2">
              <Label>启用状态</Label>
              <RadioGroup
                value={formData.isActive ? 'true' : 'false'}
                onValueChange={(value) => setFormData({ ...formData, isActive: value === 'true' })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="active" />
                  <Label htmlFor="active" className="font-normal cursor-pointer">
                    已启用
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="inactive" />
                  <Label htmlFor="inactive" className="font-normal cursor-pointer">
                    已停用
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-gray-500">停用后，此账套将不可用，但数据会保留</p>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}