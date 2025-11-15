import { useState, useEffect } from 'react';
import { ChevronRight, Settings, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import VoucherPreview from '@/vouchers/VoucherPreview';
import ClosingTemplateManagement from '../settings/ClosingTemplateManagement';
import { 
  getAllVouchers, 
  addVoucher, 
  getSubjectBalance, 
  getProfitLossSubjects,
  lockPeriod,
  unlockPeriod,
  isPeriodLocked,
  checkVoucherNumberGaps,
  hasUnapprovedVouchers,
  getClosingVoucherByType,
  getEnabledClosingTemplates
} from '@/lib/mockData';    

// 结转卡片类型
interface ClosingCard {
  id: string;
  title: string;
  amount: number;
  isGenerated: boolean;
  type: 'standard' | 'custom';
  templateId?: string;
}

// 规则配置
interface RuleConfig {
  salesRevenue?: number;
  transferPercent?: number;
  inventoryBalance?: number;
  vatAmount?: number;
  cityTaxRate?: number;
  educationRate?: number;
  localEducationRate?: number;
  yearlyProfit?: number;
  incomeTaxRate?: number;
  accumulatedTax?: number;
}

// 检查项状态
interface CheckItem {
  id: string;
  label: string;
  status: 'completed' | 'warning' | 'failed';
  message?: string;
  link?: string;
  isBlocker: boolean;
}

export default function PeriodClosing() {
  // 当前Tab
  const [currentTab, setCurrentTab] = useState<'closing' | 'reverse'>('closing');
  
  // 当前步骤
  const [currentStep, setCurrentStep] = useState(1);
  
  // 当前会计期间
  const [currentPeriod, setCurrentPeriod] = useState('2025-11');
  
  // 卡片数据 - 初始化时检查是否已生成
  const initializeCards = () => {
    const standardCards = [
      { id: 'cost', title: '结转销售成本' },
      { id: 'tax', title: '计提税金' },
      { id: 'income-tax', title: '计提所得税' },
      { id: 'vat', title: '结转未交增值税' }
    ];
    
    // 获取已启用的自定义模板
    const enabledTemplates = getEnabledClosingTemplates();
    
    // 合并标准卡片和自定义模板
    const allCards = [
      ...standardCards.map(card => {
        const existingVoucher = getClosingVoucherByType(currentPeriod, card.id);
        return {
          id: card.id,
          title: card.title,
          amount: existingVoucher ? existingVoucher.debitTotal : 0,
          isGenerated: !!existingVoucher,
          type: 'standard' as const
        };
      }),
      ...enabledTemplates.map(template => {
        const existingVoucher = getClosingVoucherByType(currentPeriod, template.id);
        return {
          id: template.id,
          title: template.name,
          amount: existingVoucher ? existingVoucher.debitTotal : 0,
          isGenerated: !!existingVoucher,
          type: 'custom' as const,
          templateId: template.id
        };
      })
    ];
    
    return allCards;
  };
  
  const [cards, setCards] = useState<ClosingCard[]>(initializeCards());
  
  // 规则弹窗
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [currentCard, setCurrentCard] = useState<ClosingCard | null>(null);
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({
    transferPercent: 80,
    cityTaxRate: 7,
    educationRate: 3,
    localEducationRate: 2,
    incomeTaxRate: 25
  });
  
  // 凭证预览
  const [showVoucherPreview, setShowVoucherPreview] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState<any>(null);
  
  // 自定义模板管理
  const [showTemplateManagement, setShowTemplateManagement] = useState(false);
  
  // Step 2 状态
  const [isProfitTransferred, setIsProfitTransferred] = useState(false);
  const [isRetainedEarningsTransferred, setIsRetainedEarningsTransferred] = useState(false);
  const [showProfitVoucher, setShowProfitVoucher] = useState(false);
  const [showRetainedEarningsVoucher, setShowRetainedEarningsVoucher] = useState(false);
  
  // Step 3 检查项（会在useEffect中动态更新）
  const [checkItems, setCheckItems] = useState<CheckItem[]>([
    { id: 'step1', label: '期末检查', status: 'failed', isBlocker: true },
    { id: 'step2', label: '结转损益', status: 'failed', isBlocker: true },
    { id: 'voucher-audit', label: '凭证审核', status: 'completed', message: '已启用', isBlocker: true },
    { id: 'voucher-number', label: '断号检查', status: 'completed', isBlocker: true },
    { id: 'report', label: '报表检查', status: 'completed', isBlocker: true },
    { id: 'fund', label: '资金检查', status: 'completed', isBlocker: false },
    { id: 'asset', label: '资产检查', status: 'warning', message: '资产模块未进行折旧', isBlocker: false }
  ]);
  
  // 结账确认
  const [showClosingConfirm, setShowClosingConfirm] = useState(false);
  const [isPeriodClosed, setIsPeriodClosed] = useState(false);
  const [isYearEnd, setIsYearEnd] = useState(false);
  
  // 检查是否是年末
  useEffect(() => {
    const month = currentPeriod.split('-')[1];
    setIsYearEnd(month === '12');
  }, [currentPeriod]);
  
  // 组件加载时检查已生成的凭证，恢复状态
  useEffect(() => {
    // 检查Step 1的卡片
    const updatedCards = cards.map(card => {
      const existingVoucher = getClosingVoucherByType(currentPeriod, card.id);
      if (existingVoucher) {
        return {
          ...card,
          isGenerated: true,
          amount: existingVoucher.debitTotal || 0
        };
      }
      return card;
    });
    setCards(updatedCards);
    
    // 检查Step 2的结转损益凭证
    const profitVoucher = getClosingVoucherByType(currentPeriod, 'profit');
    if (profitVoucher) {
      setIsProfitTransferred(true);
    }
    
    // 检查Step 2.5的结转未分配利润凭证（年末）
    const retainedEarningsVoucher = getClosingVoucherByType(currentPeriod, 'retained-earnings');
    if (retainedEarningsVoucher) {
      setIsRetainedEarningsTransferred(true);
    }
    
    // 检查期间是否已锁定
    const locked = isPeriodLocked(currentPeriod);
    setIsPeriodClosed(locked);
    
    // 动态更新检查项状态
    updateCheckItemsStatus(updatedCards, profitVoucher !== null);
  }, [currentPeriod]);
  
  // 动态更新检查项状态
  const updateCheckItemsStatus = (currentCards: ClosingCard[], isProfitDone: boolean) => {
    // 检查Step 1是否全部完成
    const allStep1Generated = currentCards.every(c => c.isGenerated);
    
    // 检查凭证断号
    const hasGaps = checkVoucherNumberGaps(currentPeriod);
    
    // 检查未审核凭证
    const hasUnapproved = hasUnapprovedVouchers(currentPeriod);
    
    setCheckItems(prevItems => prevItems.map(item => {
      if (item.id === 'step1') {
        return { 
          ...item, 
          status: allStep1Generated ? 'completed' : 'failed',
          message: allStep1Generated ? undefined : '期末检查尚未完成'
        };
      }
      if (item.id === 'step2') {
        return { 
          ...item, 
          status: isProfitDone ? 'completed' : 'failed',
          message: isProfitDone ? undefined : '结转损益尚未完成'
        };
      }
      if (item.id === 'voucher-audit') {
        return {
          ...item,
          status: hasUnapproved ? 'failed' : 'completed',
          message: hasUnapproved ? '存在未审核凭证' : '已启用'
        };
      }
      if (item.id === 'voucher-number') {
        return {
          ...item,
          status: hasGaps ? 'warning' : 'completed',
          message: hasGaps ? '凭证编号存在断号' : undefined
        };
      }
      if (item.id === 'fund') {
        // 这里可以从ReconciliationReport读取实际的平衡状态
        // 暂时简化为已完成
        return {
          ...item,
          status: 'completed',
          message: undefined
        };
      }
      return item;
    }));
  };
  
  // 处理生成凭证点击
  const handleGenerateVoucher = (card: ClosingCard) => {
    setCurrentCard(card);
    
    if (card.type === 'standard') {
      // 标准卡片：先从总分类账读取数据，填充到规则配置
      loadDataForRuleDialog(card);
      setShowRuleDialog(true);
    } else {
      // 自定义卡片：直接生成凭证
      generateVoucherForCustomCard(card);
    }
  };
  
  // 从总分类账加载数据（数据流入）
  const loadDataForRuleDialog = (card: ClosingCard) => {
    switch (card.id) {
      case 'cost':
        // 结转销售成本：读取主营业务收入和库存商品余额
        const revenueData = getSubjectBalance('6001', currentPeriod);
        const inventoryData = getSubjectBalance('1405', currentPeriod);
        setRuleConfig({
          ...ruleConfig,
          salesRevenue: Math.abs(revenueData.creditTotal - revenueData.debitTotal),
          inventoryBalance: Math.abs(inventoryData.balance)
        });
        break;
        
      case 'tax':
        // 计提税金：读取应交增值税
        const vatData = getSubjectBalance('2201', currentPeriod);
        setRuleConfig({
          ...ruleConfig,
          vatAmount: Math.abs(vatData.balance)
        });
        break;
        
      case 'income-tax':
        // 计提所得税：读取本年累计利润
        const profitSubjects = getProfitLossSubjects();
        let yearlyProfit = 0;
        
        profitSubjects.forEach(subject => {
          const balance = getSubjectBalance(subject.code, currentPeriod.split('-')[0]); // 使用年份查询全年数据
          // 收入类科目：贷方-借方为正
          if (['6001', '6051', '6901'].includes(subject.code)) {
            yearlyProfit += (balance.creditTotal - balance.debitTotal);
          }
          // 成本费用类：借方-贷方为正（支出）
          else {
            yearlyProfit -= (balance.debitTotal - balance.creditTotal);
          }
        });
        
        setRuleConfig({
          ...ruleConfig,
          yearlyProfit: Math.max(0, yearlyProfit)
        });
        break;
        
      case 'vat':
        // 结转未交增值税：读取应交增值税
        const vatTransferData = getSubjectBalance('2201', currentPeriod);
        setRuleConfig({
          ...ruleConfig,
          vatAmount: Math.abs(vatTransferData.balance)
        });
        break;
    }
  };
  
  // 规则确认后生成凭证
  const handleRuleConfirm = () => {
    setShowRuleDialog(false);
    
    if (!currentCard) return;
    
    // 根据不同卡片类型生成不同的凭证
    const voucher = generateVoucherByCardType(currentCard);
    setPreviewVoucher(voucher);
    setShowVoucherPreview(true);
  };
  
  // 根据卡片类型生成凭证
  const generateVoucherByCardType = (card: ClosingCard) => {
    const voucherNumber = String(getAllVouchers().length + 1).padStart(3, '0');
    const baseVoucher = {
      id: `v${Date.now()}`,
      voucherDate: `${currentPeriod}-30`,
      voucherType: '记',
      voucherNumber: voucherNumber,
      voucherCode: `记-${voucherNumber}`,
      attachments: 0,
      status: 'draft' as const,
      maker: 'QQ',
      isExpanded: false,
      createdAt: new Date().toLocaleString('zh-CN'),
      updatedAt: new Date().toLocaleString('zh-CN'),
      lines: [] as any[]
    };
    
    switch (card.id) {
      case 'cost':
        // 结转销售成本
        const costAmount = (ruleConfig.salesRevenue || 0) * (ruleConfig.transferPercent || 80) / 100;
        baseVoucher.lines = [
          {
            id: `l1`,
            summary: '结转本月销售成本',
            subjectId: 's5001',
            subjectCode: '5001',
            subjectName: '主营业务成本',
            debitAmount: costAmount.toFixed(2),
            creditAmount: ''
          },
          {
            id: `l2`,
            summary: '结转本月销售成本',
            subjectId: 's1405',
            subjectCode: '1405',
            subjectName: '库存商品',
            debitAmount: '',
            creditAmount: costAmount.toFixed(2)
          }
        ];
        return { ...baseVoucher, debitTotal: costAmount, creditTotal: costAmount };
        
      case 'tax':
        // 计提税金
        const vatBase = ruleConfig.vatAmount || 0;
        const cityTax = vatBase * (ruleConfig.cityTaxRate || 7) / 100;
        const educationTax = vatBase * (ruleConfig.educationRate || 3) / 100;
        const localEducationTax = vatBase * (ruleConfig.localEducationRate || 2) / 100;
        const totalTax = cityTax + educationTax + localEducationTax;
        
        baseVoucher.lines = [
          {
            id: `l1`,
            summary: '计提本月税金',
            subjectId: 's5401',
            subjectCode: '5401',
            subjectName: '税金及附加',
            debitAmount: totalTax.toFixed(2),
            creditAmount: ''
          },
          {
            id: `l2`,
            summary: '计提本月税金',
            subjectId: 's2211',
            subjectCode: '2211',
            subjectName: '应交税费-应交城市维护建设税',
            debitAmount: '',
            creditAmount: cityTax.toFixed(2)
          },
          {
            id: `l3`,
            summary: '计提本月税金',
            subjectId: 's2212',
            subjectCode: '2212',
            subjectName: '应交税费-应交教育费附加',
            debitAmount: '',
            creditAmount: educationTax.toFixed(2)
          },
          {
            id: `l4`,
            summary: '计提本月税金',
            subjectId: 's2213',
            subjectCode: '2213',
            subjectName: '应交税费-应交地方教育费附加',
            debitAmount: '',
            creditAmount: localEducationTax.toFixed(2)
          }
        ];
        return { ...baseVoucher, debitTotal: totalTax, creditTotal: totalTax };
        
      case 'income-tax':
        // 计提所得税
        const incomeTaxAmount = (ruleConfig.yearlyProfit || 0) * (ruleConfig.incomeTaxRate || 25) / 100;
        baseVoucher.lines = [
          {
            id: `l1`,
            summary: '计提所得税',
            subjectId: 's5801',
            subjectCode: '5801',
            subjectName: '所得税费用',
            debitAmount: incomeTaxAmount.toFixed(2),
            creditAmount: ''
          },
          {
            id: `l2`,
            summary: '计提所得税',
            subjectId: 's2221',
            subjectCode: '2221',
            subjectName: '应交税费-应交所得税',
            debitAmount: '',
            creditAmount: incomeTaxAmount.toFixed(2)
          }
        ];
        return { ...baseVoucher, debitTotal: incomeTaxAmount, creditTotal: incomeTaxAmount };
        
      case 'vat':
        // 结转未交增值税
        const vatTransferAmount = ruleConfig.vatAmount || 0;
        baseVoucher.lines = [
          {
            id: `l1`,
            summary: '结转未交增值税',
            subjectId: 's22010101',
            subjectCode: '22010101',
            subjectName: '应交税费-应交增值税-转出未交增值税',
            debitAmount: vatTransferAmount.toFixed(2),
            creditAmount: ''
          },
          {
            id: `l2`,
            summary: '结转未交增值税',
            subjectId: 's220103',
            subjectCode: '220103',
            subjectName: '应交税费-未交增值税',
            debitAmount: '',
            creditAmount: vatTransferAmount.toFixed(2)
          }
        ];
        return { ...baseVoucher, debitTotal: vatTransferAmount, creditTotal: vatTransferAmount };
        
      default:
        return baseVoucher;
    }
  };
  
  // 自定义卡片生成凭证
  const generateVoucherForCustomCard = (card: ClosingCard) => {
    // TODO: 根据自定义模板生成凭证
    alert('自定义卡片凭证生成功能待实现');
  };
  
  // 保存凭证
  const handleSaveVoucher = (voucher: any) => {
    // 保存凭证并自动审核，添加期末结转标识
    const savedVoucher = {
      ...voucher,
      status: 'approved' as const,
      period: currentPeriod,
      closingType: currentCard?.id,
      isClosingVoucher: true
    };
    
    addVoucher(savedVoucher);
    
    // 更新卡片状态
    if (currentCard) {
      setCards(cards.map(c => 
        c.id === currentCard.id 
          ? { ...c, isGenerated: true, amount: savedVoucher.debitTotal } 
          : c
      ));
    }
    
    setShowVoucherPreview(false);
    setCurrentCard(null);
  };
  
  // 生成结转损益凭证
  const generateProfitVoucher = () => {
    // 从总分类账读取所有损益类科目的本期余额
    const profitSubjects = getProfitLossSubjects();
    const lines: any[] = [];
    let totalIncome = 0; // 收入类总额（贷方余额）
    let totalExpense = 0; // 费用类总额（借方余额）
    
    // 遍历所有损益类科目，读取余额
    profitSubjects.forEach(subject => {
      const balance = getSubjectBalance(subject.code, currentPeriod);
      const netBalance = balance.creditTotal - balance.debitTotal;
      
      // 如果有余额，生成结转分录
      if (Math.abs(netBalance) > 0.01) {
        // 收入类科目（贷方余额为正）：借记收入科目，贷记本年利润
        if (['6001', '6051', '6901'].includes(subject.code) && netBalance > 0) {
          totalIncome += netBalance;
          lines.push({
            id: `l${lines.length + 1}`,
            summary: '结转本期损益',
            subjectId: `s${subject.code}`,
            subjectCode: subject.code,
            subjectName: subject.name,
            debitAmount: netBalance.toFixed(2),
            creditAmount: ''
          });
        }
        // 费用成本类科目（借方余额为正）：贷记费用科目，借记本年利润
        else if (netBalance < 0) {
          totalExpense += Math.abs(netBalance);
          lines.push({
            id: `l${lines.length + 1}`,
            summary: '结转本期损益',
            subjectId: `s${subject.code}`,
            subjectCode: subject.code,
            subjectName: subject.name,
            debitAmount: '',
            creditAmount: Math.abs(netBalance).toFixed(2)
          });
        }
      }
    });
    
    // 计算本期净利润
    const netProfit = totalIncome - totalExpense;
    
    // 添加"本年利润"科目的结转分录
    if (netProfit > 0) {
      // 盈利：贷记本年利润
      lines.push({
        id: `l${lines.length + 1}`,
        summary: '结转本期损益',
        subjectId: 's4103',
        subjectCode: '4103',
        subjectName: '本年利润',
        debitAmount: '',
        creditAmount: netProfit.toFixed(2)
      });
    } else if (netProfit < 0) {
      // 亏损：借记本年利润
      lines.push({
        id: `l${lines.length + 1}`,
        summary: '结转本期损益',
        subjectId: 's4103',
        subjectCode: '4103',
        subjectName: '本年利润',
        debitAmount: Math.abs(netProfit).toFixed(2),
        creditAmount: ''
      });
    }
    
    // 如果没有任何损益类科目有余额，提示用户
    if (lines.length === 0) {
      alert('当前期间没有损益类科目余额，无需结转。');
      return;
    }
    
    // 计算借贷合计
    const debitTotal = lines.reduce((sum, line) => sum + (parseFloat(line.debitAmount) || 0), 0);
    const creditTotal = lines.reduce((sum, line) => sum + (parseFloat(line.creditAmount) || 0), 0);
    
    // 生成凭证
    const voucherNumber = String(getAllVouchers().length + 1).padStart(3, '0');
    const voucher = {
      id: `v${Date.now()}`,
      voucherDate: `${currentPeriod}-30`,
      voucherType: '记',
      voucherNumber: voucherNumber,
      voucherCode: `记-${voucherNumber}`,
      attachments: 0,
      lines: lines,
      debitTotal: debitTotal,
      creditTotal: creditTotal,
      status: 'approved', // 自动审核
      maker: 'System',
      reviewer: 'System',
      isExpanded: false,
      createdAt: new Date().toLocaleString('zh-CN'),
      updatedAt: new Date().toLocaleString('zh-CN'),
      period: currentPeriod,
      closingType: 'profit',
      isClosingVoucher: true
    };
    
    addVoucher(voucher);
    setIsProfitTransferred(true);
    setShowProfitVoucher(false);
    
    alert(`结转损益凭证已生成！\n本期净利润：¥${netProfit.toFixed(2)}`);
  };
  
  // 生成结转未分配利润凭证
  const generateRetainedEarningsVoucher = () => {
    const voucherNumber = String(getAllVouchers().length + 1).padStart(3, '0');
    const voucher = {
      id: `v${Date.now()}`,
      voucherDate: `${currentPeriod}-31`,
      voucherType: '记',
      voucherNumber: voucherNumber,
      voucherCode: `记-${voucherNumber}`,
      attachments: 0,
      status: 'approved' as const,
      maker: 'QQ',
      isExpanded: false,
      createdAt: new Date().toLocaleString('zh-CN'),
      updatedAt: new Date().toLocaleString('zh-CN'),
      lines: [
        {
          id: `l1`,
          summary: '结转本年利润',
          subjectId: 's4103',
          subjectCode: '4103',
          subjectName: '本年润',
          debitAmount: '100000.00',
          creditAmount: ''
        },
        {
          id: `l2`,
          summary: '结转本年利润',
          subjectId: 's410301',
          subjectCode: '410301',
          subjectName: '利润分配-未分配利润',
          debitAmount: '',
          creditAmount: '100000.00'
        }
      ],
      debitTotal: 100000,
      creditTotal: 100000,
      period: currentPeriod,
      closingType: 'retained-earnings',
      isClosingVoucher: true
    };
    
    addVoucher(voucher);
    setIsRetainedEarningsTransferred(true);
    setShowRetainedEarningsVoucher(false);
  };
  
  // 重新检查
  const handleRecheck = () => {
    // 重新加载卡片状态
    const updatedCards = cards.map(card => {
      const existingVoucher = getClosingVoucherByType(currentPeriod, card.id);
      if (existingVoucher) {
        return {
          ...card,
          isGenerated: true,
          amount: existingVoucher.debitTotal || 0
        };
      }
      return card;
    });
    setCards(updatedCards);
    
    // 检查结转损益
    const profitVoucher = getClosingVoucherByType(currentPeriod, 'profit');
    const profitDone = profitVoucher !== null;
    setIsProfitTransferred(profitDone);
    
    // 更新检查项状态
    updateCheckItemsStatus(updatedCards, profitDone);
    
    alert('已重新检查，请查看最新状态');
  };
  
  // 执行结账
  const handleClosePeriod = () => {
    setShowClosingConfirm(true);
  };
  
  const confirmClosePeriod = () => {
    setIsPeriodClosed(true);
    setShowClosingConfirm(false);
    alert('结账成功！本期已锁定，无法进行任何修改。');
  };
  
  // 检查是否可以结账
  const canClose = checkItems.filter(item => item.isBlocker).every(item => item.status === 'completed');
  
  // 检查Step 1是否全部完成
  const isStep1Completed = cards.every(c => c.isGenerated);
  
  return (
    <div className="max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">期末结转</h1>
        <p className="text-gray-600">
          向导式引导完成月末/年末结转工作，并锁定会计期间
        </p>
      </div>
      
      {/* Tab切换 */}
      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as 'closing' | 'reverse')}>
        <TabsList className="mb-4">
          <TabsTrigger value="closing">期末处理</TabsTrigger>
          <TabsTrigger value="reverse">反结账</TabsTrigger>
        </TabsList>
        
        {/* 期末处理Tab */}
        <TabsContent value="closing">
          {/* Step 1: 期末检查 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl text-gray-900">第 1 步：期末检查</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      *请检查是否有需要生成的凭证，如无需，点击下一步即可！
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowTemplateManagement(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    自定义结转模板
                  </Button>
                </div>
                
                {/* 卡片列表 - 添加滚动容器 */}
                <div className="max-h-[500px] overflow-y-auto mb-6">
                  <div className="grid grid-cols-2 gap-4">
                  {cards.map(card => (
                    <div 
                      key={card.id}
                      className={`border rounded-lg p-4 ${
                        card.isGenerated ? 'bg-green-50 border-green-200' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-gray-900">{card.title}</h3>
                        {card.isGenerated && (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div className="text-2xl text-blue-600 mb-3">
                        ¥ {card.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </div>
                      <Button
                        onClick={() => handleGenerateVoucher(card)}
                        disabled={card.isGenerated}
                        className="w-full"
                        variant={card.isGenerated ? 'outline' : 'default'}
                      >
                        {card.isGenerated ? '已生成' : '生成凭证'}
                      </Button>
                    </div>
                  ))}
                  </div>
                </div>
                
                {/* 底部导航 */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" disabled>
                    上一步
                  </Button>
                  <Button onClick={() => setCurrentStep(2)}>
                    下一步
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 2: 结转损益 */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-6">
                <div className="mb-6">
                  <h2 className="text-xl text-gray-900">第 2 步：结转损益</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    系统已自动汇总所有损益类科目，请确认后生成结转凭证
                  </p>
                </div>
                
                {/* 损益汇总预览 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-600 mb-2">
                    系统将自动生成以下凭证分录：
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>借：主营业务收入</span>
                      <span className="text-green-600">¥ 100,000.00</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="ml-4">贷：本年利润</span>
                      <span className="text-red-600">¥ 100,000.00</span>
                    </div>
                  </div>
                </div>
                
                <div className="mb-6">
                  <Button
                    onClick={() => setShowProfitVoucher(true)}
                    disabled={isProfitTransferred}
                    className="w-full"
                  >
                    {isProfitTransferred ? '已结转损益' : '结转损益'}
                  </Button>
                </div>
                
                {/* 年末额外步骤：结转未分配利润 */}
                {isYearEnd && isProfitTransferred && (
                  <div className="border-t pt-4">
                    <div className="mb-4">
                      <h3 className="text-gray-900 mb-2">结转未分配利润（年末）</h3>
                      <p className="text-sm text-gray-600">
                        将本年利润结转至利润分配-未分配利润
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span>借：本年利润</span>
                          <span className="text-green-600">¥ 100,000.00</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="ml-4">贷：利润分配-未分配利润</span>
                          <span className="text-red-600">¥ 100,000.00</span>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => setShowRetainedEarningsVoucher(true)}
                      disabled={isRetainedEarningsTransferred}
                      className="w-full"
                    >
                      {isRetainedEarningsTransferred ? '已新增凭证' : '新增凭证'}
                    </Button>
                  </div>
                )}
                
                {/* 底部导航 */}
                <div className="flex items-center justify-between pt-4 border-t mt-6">
                  <Button variant="outline" onClick={() => setCurrentStep(1)}>
                    上一步
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep(3)}
                    disabled={!isProfitTransferred || (isYearEnd && !isRetainedEarningsTransferred)}
                  >
                    下一步
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 3: 结账 */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-white rounded-lg border p-6">
                <div className="mb-6">
                  <h2 className="text-xl text-gray-900">第 3 步：结账</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    请确认所有检查项通过后执行结账
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* 左栏：影响结账检查 */}
                  <div>
                    <h3 className="text-gray-900 mb-3">影响结账检查</h3>
                    <div className="space-y-2">
                      {checkItems.filter(item => item.isBlocker).map(item => (
                        <div 
                          key={item.id}
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            item.status === 'completed' ? 'bg-green-50 border-green-200' :
                            item.status === 'failed' ? 'bg-red-50 border-red-200' :
                            'bg-yellow-50 border-yellow-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {item.status === 'completed' && (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            )}
                            {item.status === 'failed' && (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                            {item.status === 'warning' && (
                              <AlertCircle className="w-5 h-5 text-yellow-600" />
                            )}
                            <span className="text-sm">{item.label}</span>
                          </div>
                          {item.message && (
                            <span className="text-xs text-gray-600">{item.message}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* 右栏：仅提示类检查 */}
                  <div>
                    <h3 className="text-gray-900 mb-3">仅提示类检查</h3>
                    <div className="space-y-2">
                      {checkItems.filter(item => !item.isBlocker).map(item => (
                        <div 
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50 border-yellow-200"
                        >
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <div>
                              <div className="text-sm">{item.label}</div>
                              {item.message && (
                                <div className="text-xs text-gray-600">{item.message}</div>
                              )}
                            </div>
                          </div>
                          {item.link && (
                            <Button 
                              variant="link"
                              size="sm"
                              className="text-xs h-auto p-0"
                              onClick={() => {
                                // 跳转到总账核对页面
                                window.location.hash = item.link;
                              }}
                            >
                              点击查看
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* 底部导航 */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setCurrentStep(2)}>
                      上一步
                    </Button>
                    <Button variant="outline" onClick={handleRecheck}>
                      重新检查
                    </Button>
                  </div>
                  <Button 
                    onClick={handleClosePeriod}
                    disabled={!canClose || isPeriodClosed}
                  >
                    {isPeriodClosed ? '已结账' : '结账'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* 反结账Tab */}
        <TabsContent value="reverse">
          <div className="bg-white rounded-lg border p-6">
            <div className="text-center py-12">
              <h2 className="text-xl text-gray-900 mb-2">反结账向导</h2>
              <p className="text-gray-600 mb-6">
                此功能用于解锁已结账的期间，需要严格按照逆序操作
              </p>
              <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="text-sm text-gray-900 mb-1">反结账顺序：</div>
                      <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                        <li>检查下一期间是否已结账（如已结账则禁止操作）</li>
                        <li>反结账本期（解锁期间状态）</li>
                        <li>反结转未分配利润（如果存在）</li>
                        <li>反结转损益</li>
                        <li>反结转期末检查凭证</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="destructive"
                  onClick={() => alert('反结账功能待实现')}
                  disabled={!isPeriodClosed}
                >
                  开始反结账
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      {/* 规则确认弹窗 */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{currentCard?.title} - 计算规则</DialogTitle>
            <DialogDescription>
              请确认或修改计算参数
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 结转销售成本 */}
            {currentCard?.id === 'cost' && (
              <>
                <div className="space-y-2">
                  <Label>本期主营业务收入（只读）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.salesRevenue || 0}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>结转百分比（%）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.transferPercent}
                    onChange={(e) => setRuleConfig({...ruleConfig, transferPercent: Number(e.target.value)})}
                    className="bg-yellow-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>库存商品余额（只读）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.inventoryBalance || 0}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>综合计算结果（只读）</Label>
                  <Input
                    type="number"
                    value={((ruleConfig.salesRevenue || 0) * (ruleConfig.transferPercent || 80) / 100).toFixed(2)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </>
            )}
            
            {/* 计提税金 */}
            {currentCard?.id === 'tax' && (
              <>
                <div className="space-y-2">
                  <Label>本期应交增值税（只读）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.vatAmount || 0}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>应交城市维护建设税税率（%）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.cityTaxRate}
                    onChange={(e) => setRuleConfig({...ruleConfig, cityTaxRate: Number(e.target.value)})}
                    className="bg-yellow-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>教育费附加税率（%）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.educationRate}
                    onChange={(e) => setRuleConfig({...ruleConfig, educationRate: Number(e.target.value)})}
                    className="bg-yellow-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>地方教育费附加税率（%）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.localEducationRate}
                    onChange={(e) => setRuleConfig({...ruleConfig, localEducationRate: Number(e.target.value)})}
                    className="bg-yellow-50"
                  />
                </div>
              </>
            )}
            
            {/* 计提所得税 */}
            {currentCard?.id === 'income-tax' && (
              <>
                <div className="space-y-2">
                  <Label>本年累计利润总额（只读）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.yearlyProfit || 0}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>税率（%）</Label>
                  <Input
                    type="number"
                    value={ruleConfig.incomeTaxRate}
                    onChange={(e) => setRuleConfig({...ruleConfig, incomeTaxRate: Number(e.target.value)})}
                    className="bg-yellow-50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>应交所得税贷方累计（只读）</Label>
                  <Input
                    type="number"
                    value={((ruleConfig.yearlyProfit || 0) * (ruleConfig.incomeTaxRate || 25) / 100).toFixed(2)}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
              </>
            )}
            
            {/* 结转未交增值税 */}
            {currentCard?.id === 'vat' && (
              <div className="space-y-2">
                <Label>本期应交增值税（只读）</Label>
                <Input
                  type="number"
                  value={ruleConfig.vatAmount || 0}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
              取消
            </Button>
            <Button onClick={handleRuleConfirm}>
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 凭证预览对话框 */}
      {showVoucherPreview && previewVoucher && (
        <VoucherPreview
          voucher={previewVoucher}
          onSave={handleSaveVoucher}
          onCancel={() => {
            setShowVoucherPreview(false);
            setCurrentCard(null);
          }}
        />
      )}
      
      {/* 结转损益凭证预览 */}
      <AlertDialog open={showProfitVoucher} onOpenChange={setShowProfitVoucher}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结转损益</AlertDialogTitle>
            <AlertDialogDescription>
              系统将自动生成结转损益凭证并审核，确认继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={generateProfitVoucher}>
              确认生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 结转未分配利润凭证预览 */}
      <AlertDialog open={showRetainedEarningsVoucher} onOpenChange={setShowRetainedEarningsVoucher}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结转未分配利润</AlertDialogTitle>
            <AlertDialogDescription>
              系统将自动生成结转未分配利润凭证并审核，确认继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={generateRetainedEarningsVoucher}>
              确认生成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 结账确认 */}
      <AlertDialog open={showClosingConfirm} onOpenChange={setShowClosingConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认结账</AlertDialogTitle>
            <AlertDialogDescription>
              结账后本期将无法进行任何凭证修改，是否确认结账？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClosePeriod} className="bg-red-600 hover:bg-red-700">
              确认结账
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* 自定义结转模板管理 */}
      <Dialog open={showTemplateManagement} onOpenChange={setShowTemplateManagement}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>自定义结转模板</DialogTitle>
            <DialogDescription>
              管理您的自定义结转规则，启用后将在期末检查中显示为卡片
            </DialogDescription>
          </DialogHeader>
          <ClosingTemplateManagement />
          <DialogFooter>
            <Button onClick={() => setShowTemplateManagement(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}