import { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface AccountBook {
  id: string;
  name: string;
  companyName: string;
  startPeriod: string;
  accountingStandard: string;
  taxType: '一般纳税人' | '小规模纳税人';
  defaultTaxRate?: number;
  requiresAudit: boolean;
  isActive: boolean;
  fiscalYearStartMonth?: number;
}

interface AccountBookModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void> | void;
  accountBook?: AccountBook | null;
  defaultCompanyName?: string;
}

const TAX_RATES = {
  general: [
    { value: '13', label: '13% (基本税率 - 货物/劳务)' },
    { value: '9', label: '9% (交通/建筑/不动产/农产品)' },
    { value: '6', label: '6% (服务/金融/无形资产)' },
  ],
  small: [
    { value: '3', label: '3% (标准征收率)' },
    { value: '1', label: '1% (优惠征收率)' },
    { value: '0', label: '0% (免税)' },
  ]
};

export default function AccountBookModal({ 
  open, 
  onClose, 
  onSave, 
  accountBook,
  defaultCompanyName 
}: AccountBookModalProps) {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    startPeriod: '',
    accountingStandard: '小企业会计准则',
    taxType: '一般纳税人' as '一般纳税人' | '小规模纳税人',
    defaultTaxRate: '13',
    requiresAudit: true,
    isActive: true,
    fiscalYearStartMonth: '1'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');

  // 初始化逻辑
  useEffect(() => {
    const safeCompanyName = defaultCompanyName || '';

    if (accountBook) {
      setFormData({
        name: accountBook.name,
        companyName: accountBook.companyName || safeCompanyName,
        startPeriod: accountBook.startPeriod,
        accountingStandard: accountBook.accountingStandard,
        taxType: accountBook.taxType,
        defaultTaxRate: String(accountBook.defaultTaxRate || (accountBook.taxType === '小规模纳税人' ? '3' : '13')),
        requiresAudit: accountBook.requiresAudit,
        isActive: accountBook.isActive,
        fiscalYearStartMonth: String(accountBook.fiscalYearStartMonth || '1')
      });
      
      if (accountBook.startPeriod) {
        const parts = accountBook.startPeriod.split('-');
        setSelectedYear(parts[0] || '');
        setSelectedMonth(parts[1] ? parts[1].padStart(2, '0') : '');
        setSelectedDay(parts[2] ? parts[2].padStart(2, '0') : '');
      }
    } else {
      setFormData({
        name: '',
        companyName: safeCompanyName,
        startPeriod: '',
        accountingStandard: '小企业会计准则',
        taxType: '一般纳税人',
        defaultTaxRate: '13',
        requiresAudit: true,
        isActive: true,
        fiscalYearStartMonth: '1'
      });
      const now = new Date();
      setSelectedYear(String(now.getFullYear()));
      setSelectedMonth(String(now.getMonth() + 1).padStart(2, '0'));
      setSelectedDay('');
    }
    setErrors({});
  }, [accountBook, open, defaultCompanyName]);

  // 税率联动
  useEffect(() => {
    if (formData.taxType === '一般纳税人') {
      if (!TAX_RATES.general.find(r => r.value === formData.defaultTaxRate)) {
        setFormData(prev => ({ ...prev, defaultTaxRate: '13' }));
      }
    } else {
      if (!TAX_RATES.small.find(r => r.value === formData.defaultTaxRate)) {
        setFormData(prev => ({ ...prev, defaultTaxRate: '3' }));
      }
      setFormData(prev => ({...prev, accountingStandard: '小企业会计准则'})); 
    }
  }, [formData.taxType]);

  // 日期拼接
  useEffect(() => {
    if (selectedYear && selectedMonth && selectedDay) {
      setFormData(prev => ({
        ...prev,
        startPeriod: `${selectedYear}-${selectedMonth}-${selectedDay}`
      }));
      if (errors.startPeriod) setErrors(prev => ({...prev, startPeriod: ''}));
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  // 监听年月变化，自动修正日期的合法性（防止选了未来日期或不存在的日期）
  useEffect(() => {
    if (!selectedYear || !selectedMonth) return;

    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // 1. 如果年份是今年，月份不能超过当前月
    if (year === currentYear && month > currentMonth) {
        setSelectedMonth(String(currentMonth).padStart(2, '0'));
        // 这里的 return 很重要，因为 setSelectedMonth 会触发下一次 effect
        return; 
    }

    // 2. 修正天数 (处理大小月及未来日期)
    if (selectedDay) {
        const day = parseInt(selectedDay);
        // 计算当月最大天数
        const daysInMonth = new Date(year, month, 0).getDate();
        
        let maxAllowedDay = daysInMonth;
        // 如果是当年当月，最大天数不能超过今天
        if (year === currentYear && month === currentMonth) {
            maxAllowedDay = currentDay;
        }

        // 如果选中的天数非法，重置为空
        if (day > maxAllowedDay) {
            setSelectedDay('');
        }
    }
  }, [selectedYear, selectedMonth]);

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    // 允许建过去几年的账，但未来只允许到今年
    for (let year = 2000; year <= currentYear; year++) { years.push(year); }
    return years.reverse();
  };

  const generateMonthOptions = () => {
    if (!selectedYear) return Array.from({ length: 12 }, (_, i) => i + 1);

    const year = parseInt(selectedYear);
    const now = new Date();
    // 如果选了今年，月份最多显示到这个月
    const maxMonth = (year === now.getFullYear()) ? (now.getMonth() + 1) : 12;
    
    return Array.from({ length: maxMonth }, (_, i) => i + 1);
  };

  const generateDayOptions = () => {
    if (!selectedYear || !selectedMonth) return [];
    
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const now = new Date();
    
    // 计算当月有多少天
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let maxDay = daysInMonth;
    // 如果是当年当月，天数最多显示到今天
    if (year === now.getFullYear() && month === (now.getMonth() + 1)) {
        maxDay = now.getDate();
    }

    return Array.from({ length: maxDay }, (_, i) => i + 1);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = '请输入账套名称';
    if (!formData.companyName.trim()) newErrors.companyName = '请输入企业名称';
    if (!formData.startPeriod) newErrors.startPeriod = '请完整选择启用日期';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setLoading(true);
    try {
      await onSave({
        ...formData,
        defaultTaxRate: Number(formData.defaultTaxRate)
      });
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{accountBook ? '编辑账套' : '新增账套'}</DialogTitle>
          <DialogDescription>
            {accountBook ? '修改账套及会计年度配置' : '创建一个新的会计账套，设置独立的会计年度周期'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="name">账套名称 <span className="text-red-500">*</span></Label>
                <Input
                  id="name"
                  placeholder="例如：2025年主账套"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="companyName">企业名称 <span className="text-red-500">*</span></Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  disabled={true} 
                  className="bg-gray-100 text-gray-500 cursor-not-allowed"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label>启用期间 (建账日) <span className="text-red-500">*</span></Label>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger type="button"><Info className="h-4 w-4 text-gray-400" /></TooltipTrigger>
                            <TooltipContent>只能选择不晚于今日的日期</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <div className="flex space-x-2">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="年" /></SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {generateYearOptions().map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="月" /></SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {generateMonthOptions().map(m => <SelectItem key={m} value={String(m).padStart(2,'0')}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedDay} onValueChange={setSelectedDay} disabled={!selectedYear || !selectedMonth}>
                    <SelectTrigger className={`bg-white ${(!selectedYear || !selectedMonth) ? 'opacity-50' : ''}`}>
                      <SelectValue placeholder="日" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                      {generateDayOptions().map(d => <SelectItem key={d} value={String(d).padStart(2,'0')}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {errors.startPeriod && <p className="text-xs text-red-500">{errors.startPeriod}</p>}
            </div>

            <div className="space-y-2">
                <Label>会计年度起始月份</Label>
                <Select value={formData.fiscalYearStartMonth} onValueChange={(v) => setFormData({...formData, fiscalYearStartMonth: v})}>
                    <SelectTrigger className="bg-white border-blue-200/50"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-[240px]">
                        {Array.from({length: 12}, (_, i) => (<SelectItem key={i+1} value={String(i+1)}>{i+1}月</SelectItem>))}
                    </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-500">中国企业通常为1月。</p>
            </div>
          </div>

          {/* ... 税务与会计准则部分保持不变 ... */}
          <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  税务与会计准则
                  <span className="text-[10px] font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">决定科目体系</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>纳税人类型</Label>
                    <Select value={formData.taxType} onValueChange={(v) => setFormData({...formData, taxType: v as any})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="一般纳税人">一般纳税人</SelectItem>
                            <SelectItem value="小规模纳税人">小规模纳税人</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>默认{formData.taxType === '一般纳税人' ? '增值税率' : '征收率'}</Label>
                    <Select value={formData.defaultTaxRate} onValueChange={(v) => setFormData({...formData, defaultTaxRate: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {(formData.taxType === '一般纳税人' ? TAX_RATES.general : TAX_RATES.small).map(rate => (
                                <SelectItem key={rate.value} value={rate.value}>{rate.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 col-span-2">
                    <Label>会计准则</Label>
                    <Select value={formData.accountingStandard} onValueChange={(v) => setFormData({...formData, accountingStandard: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="小企业会计准则">小企业会计准则 (推荐中小企业使用)</SelectItem>
                            <SelectItem value="企业会计准则">企业会计准则 (上市公司/大型企业)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-2">
                <Label>凭证审核</Label>
                <RadioGroup value={String(formData.requiresAudit)} onValueChange={(v) => setFormData({...formData, requiresAudit: v === 'true'})} className="flex gap-4 pt-1">
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="true" id="audit-yes" />
                        <Label htmlFor="audit-yes" className="font-normal text-sm">需要审核</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="false" id="audit-no" />
                        <Label htmlFor="audit-no" className="font-normal text-sm">不需审核</Label>
                    </div>
                </RadioGroup>
            </div>

            {accountBook && (
                <div className="space-y-2">
                    <Label>启用状态</Label>
                    <RadioGroup 
                        value={formData.isActive ? "true" : "false"} 
                        onValueChange={(v) => setFormData({...formData, isActive: v === 'true'})} 
                        className="flex gap-4 pt-1"
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="true" id="active-yes" />
                            <Label htmlFor="active-yes" className="font-normal text-sm text-green-600 cursor-pointer">已启用</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="false" id="active-no" />
                            <Label htmlFor="active-no" className="font-normal text-sm text-gray-500 cursor-pointer">已停用</Label>
                        </div>
                    </RadioGroup>
                </div>
            )}
          </div>

          <DialogFooter className="gap-2 mt-6">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>取消</Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 min-w-[100px]">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>保存中...</> : '保存配置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}