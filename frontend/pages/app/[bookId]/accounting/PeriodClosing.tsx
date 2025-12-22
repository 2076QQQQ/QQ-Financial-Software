import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  ChevronRight, Settings, CheckCircle2, AlertCircle, Loader2, Calculator, 
  Plus, Trash2, Info, Check, RotateCcw, Lock, ArrowDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

import VoucherPreview from '../vouchers/VoucherPreview';
import ClosingTemplateManagement from '@/pages/app/[bookId]/settings/ClosingTemplateManagement';

import { 
  addVoucher, 
  getAccountBooks, 
  getClosingVoucherByType, 
  getSubjectBalanceAsync, 
  getAllSubjects,
  getAllVouchers,
  deleteVoucher,
  updateAccountBook,
  unauditVoucher,
  getAllClosingTemplates 
} from '@/lib/mockData';     

interface ClosingCard {
  id: string; 
  title: string; 
  description: string; 
  amount: number; 
  isGenerated: boolean;
  type: 'standard' | 'custom'; 
  config?: {
      debitCode?: string;  
      creditCode?: string; 
      sourceCode?: string; 
      taxRate?: number;    
  };
  debitSubjectCode?: string; 
  creditSubjectCode?: string; 
  sourceSubjectCode?: string; 
  sourceType?: 'balance' | 'manual'; 
}

interface RuleConfig {
  mainRevenue?: number; 
  transferPercent?: number; 
  inventoryBalance?: number; 
  vatBaseAmount?: number; 
  taxRate?: number; 
  cityTaxRate?: number; 
  educationRate?: number; 
  localEducationRate?: number; 
  yearlyProfit?: number; 
  incomeTaxRate?: number; 
  customAmount?: number;
}

interface CheckItem {
  id: string; 
  label: string; 
  status: 'completed' | 'warning' | 'failed' | 'loading'; 
  message?: string; 
  isBlocker: boolean; 
  details?: string[];
}

interface CustomTemplate {
  id: string; 
  title: string; 
  debitCode?: string; 
  creditCode?: string;
  sourceCode?: string;
  valueType?: 'balance_debit' | 'balance_credit' | 'manual'; 
  lines?: any[]; 
}

const toCents = (val: number | string | undefined) => Math.round(parseFloat(String(val || 0)) * 100);
const fromCents = (cents: number) => (cents / 100).toFixed(2);

export default function PeriodClosing() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = Array.isArray(bookId) ? bookId[0] : (bookId || '');

  const [bookStatus, setBookStatus] = useState<'open' | 'closed'>('open'); 
  const [currentTab, setCurrentTab] = useState<'closing' | 'reverse'>('closing');
  const [currentStep, setCurrentStep] = useState(1);
  const [currentPeriod, setCurrentPeriod] = useState('2025-12'); 
  const [taxType, setTaxType] = useState<string>(''); 
  const [fiscalStartMonth, setFiscalStartMonth] = useState(1); 

  const [isLoading, setIsLoading] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false); 
  const [isClosing, setIsClosing] = useState(false); 
  const [isReversing, setIsReversing] = useState(false);

  const [cards, setCards] = useState<ClosingCard[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]); 
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);

  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [currentCard, setCurrentCard] = useState<ClosingCard | null>(null);
  const [isCalculating, setIsCalculating] = useState(false); 
  const [ruleConfig, setRuleConfig] = useState<RuleConfig>({});
  const [showVoucherPreview, setShowVoucherPreview] = useState(false);
  const [previewVoucher, setPreviewVoucher] = useState<any>(null);
  
  const [isProfitTransferred, setIsProfitTransferred] = useState(false);
  const [isYearProfitTransferred, setIsYearProfitTransferred] = useState(false);
  const [showProfitConfirm, setShowProfitConfirm] = useState(false);

  const [checkItems, setCheckItems] = useState<CheckItem[]>([
    { id: 'step1', label: '期末业务结转', status: 'loading', isBlocker: true },
    { id: 'step2', label: '损益结转', status: 'loading', isBlocker: true },
    { id: 'audit', label: '凭证审核', status: 'loading', isBlocker: true },
  ]);

  const getPeriodEndDate = (period: string) => {
      if (!period) return new Date().toISOString().split('T')[0];
      const [year, month] = period.split('-').map(Number);
      const lastDay = new Date(year, month, 0); 
      const y = lastDay.getFullYear();
      const m = String(lastDay.getMonth() + 1).padStart(2, '0');
      const d = String(lastDay.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  };

  const getPeriodCN = (period: string) => {
      if (!period) return '';
      const [y, m] = period.split('-');
      return `${y}年${parseInt(m)}月`;
  };

  const isFiscalYearEnd = () => {
    if (!currentPeriod) return false;
    const currentMonth = parseInt(currentPeriod.split('-')[1]);
    const endMonth = fiscalStartMonth === 1 ? 12 : fiscalStartMonth - 1;
    return currentMonth === endMonth;
  };

  const findSubjectCode = (allSubjects: any[], keywords: string[], fallbackCode: string) => {
      const exact = allSubjects.find(s => keywords.includes(s.name));
      if (exact) return exact.code;
      const fuzzy = allSubjects.find(s => keywords.some(k => s.name && s.name.includes(k)));
      if (fuzzy) return fuzzy.code;
      return fallbackCode;
  };

  const getSubjectName = (code: string) => {
      if (!code) return '';
      const s = subjects.find(sub => sub.code === code);
      return s ? s.name : '未知科目';
  };

  const getSubjectNameSafe = (code: string, defaultName: string) => {
      const name = getSubjectName(code);
      return name !== '未知科目' ? name : defaultName;
  };

  const initData = async () => {
      setIsLoading(true);
      try {
        const [books, allSubjects, allVouchers, dbTemplates] = await Promise.all([
            getAccountBooks(),
            getAllSubjects(currentBookId),
            getAllVouchers(currentBookId),
            getAllClosingTemplates(currentBookId) 
        ]);
        
        setSubjects(allSubjects || []);
        setCustomTemplates(dbTemplates || []);

        const activeBook = Array.isArray(books) ? books.find((b: any) => b.id === currentBookId) : null;
        if (!activeBook) return;
        
        if (activeBook.currentPeriod) setCurrentPeriod(activeBook.currentPeriod);
        if (activeBook.status) setBookStatus(activeBook.status);
        
        const startMonth = activeBook.fiscalYearStartMonth || 1;
        setFiscalStartMonth(startMonth);

        const currentTaxType = activeBook.taxType || '小规模纳税人';
        setTaxType(currentTaxType);

        if (activeBook.status === 'closed') {
            setIsLoading(false);
            return;
        }

        let standardCards: ClosingCard[] = [];

        // 1. 结转销售成本
        const inventoryCode = findSubjectCode(allSubjects, ['库存商品'], '1405'); 
        const revenueCode = findSubjectCode(allSubjects, ['主营业务收入'], '6001');
        const costCode = findSubjectCode(allSubjects, ['主营业务成本'], '6401');

        standardCards.push({ 
            id: 'cost', 
            title: '结转销售成本', 
            description: '主营业务收入 × 结转比例', 
            amount: 0, 
            isGenerated: false, 
            type: 'standard',
            config: {
                sourceCode: revenueCode, 
                debitCode: costCode,     
                creditCode: inventoryCode 
            }
        });

        // 2. 税金相关
        if (currentTaxType === '一般纳税人') {
            const outputTax = findSubjectCode(allSubjects, ['销项税额'], '22210102');
            const vatTransferOut = findSubjectCode(allSubjects, ['转出未交增值税'], '22210103');
            const unpaidVat = findSubjectCode(allSubjects, ['未交增值税'], '222102');

            standardCards.push(
                { 
                    id: 'vat-transfer', 
                    title: '结转未交增值税', 
                    description: '销项 - 进项 - 留抵', 
                    amount: 0, 
                    isGenerated: false, 
                    type: 'standard',
                    config: {
                        sourceCode: outputTax,
                        debitCode: vatTransferOut,
                        creditCode: unpaidVat
                    }
                },
                { 
                    id: 'surtax', 
                    title: '计提附加税', 
                    description: '应交增值税 × 税率', 
                    amount: 0, 
                    isGenerated: false, 
                    type: 'standard',
                    config: {
                        sourceCode: outputTax,
                        debitCode: findSubjectCode(allSubjects, ['税金及附加'], '6403'),
                    }
                }
            );
        } else {
            // ★ 小规模纳税人 ★
            const revCode = findSubjectCode(allSubjects, ['主营业务收入'], '6001');
            const vatCode = findSubjectCode(allSubjects, ['应交增值税'], '222101'); 
            const unpaidVatCode = findSubjectCode(allSubjects, ['未交增值税'], '222102');
            const taxCostCode = findSubjectCode(allSubjects, ['税金及附加'], '6403');

            standardCards.push(
                { 
                    id: 'simple-tax', 
                    title: '结转应交增值税', // 改个名
                    description: '销售额(不含税) × 征收率', 
                    amount: 0, 
                    isGenerated: false, 
                    type: 'standard',
                    config: {
                        sourceCode: revCode, 
                        // ★★★ 核心修复：借贷方科目调整为“转出未交”模式 ★★★
                        debitCode: vatCode,   // 借：应交税费-应交增值税
                        creditCode: unpaidVatCode, // 贷：应交税费-未交增值税
                        taxRate: 3, 
                    }
                },
                { 
                    id: 'surtax', 
                    title: '计提附加税', 
                    description: '应交增值税 × 税率', 
                    amount: 0, 
                    isGenerated: false, 
                    type: 'standard',
                    config: {
                        sourceCode: vatCode, 
                        debitCode: taxCostCode,
                        creditCode: findSubjectCode(allSubjects, ['应交税费'], '2221') 
                    }
                }
            );
        }

        // 3. 所得税
        const incomeTaxExpense = findSubjectCode(allSubjects, ['所得税费用'], '6801');
        const incomeTaxPayable = findSubjectCode(allSubjects, ['应交所得税', '应交企业所得税'], '222106');
        standardCards.push({ 
            id: 'income-tax', 
            title: '计提所得税', 
            description: '年累计利润 × 税率', 
            amount: 0, 
            isGenerated: false, 
            type: 'standard',
            config: {
                debitCode: incomeTaxExpense,
                creditCode: incomeTaxPayable
            }
        });

        const customCards: ClosingCard[] = (dbTemplates || []).filter((t:any) => t.isEnabled).map((tpl: any) => {
            const debitLine = tpl.lines?.find((l:any) => l.direction === 'debit');
            const creditLine = tpl.lines?.find((l:any) => l.direction === 'credit');
            return {
                id: tpl.id, 
                title: tpl.name, 
                description: '自定义规则自动生成',
                amount: 0, 
                isGenerated: false, 
                type: 'custom', 
                debitSubjectCode: debitLine?.subjectCode, 
                creditSubjectCode: creditLine?.subjectCode,
                sourceSubjectCode: debitLine?.source, 
                sourceType: 'manual' 
            };
        });

        const allCards = [...standardCards, ...customCards];

        const checkedCards = await Promise.all(allCards.map(async (card) => {
            const voucher = await getClosingVoucherByType(currentBookId, currentPeriod, card.id);
            return { ...card, isGenerated: !!voucher, amount: voucher ? voucher.debitTotal : 0 };
        }));

        setCards(checkedCards);

        const profitVoucher = await getClosingVoucherByType(currentBookId, currentPeriod, 'profit');
        setIsProfitTransferred(!!profitVoucher);

        const yearProfitVoucher = await getClosingVoucherByType(currentBookId, currentPeriod, 'year-transfer');
        setIsYearProfitTransferred(!!yearProfitVoucher);

        updateCheckStatus(checkedCards, !!profitVoucher, !!yearProfitVoucher, allVouchers || [], startMonth);

      } catch (e) {
        console.error(e);
        toast.error("数据初始化失败");
      } finally {
        setIsLoading(false);
      }
  };

  useEffect(() => {
    if (router.isReady && currentBookId) {
        initData();
    }
  }, [router.isReady, currentBookId, currentPeriod]);

  useEffect(() => {
      if (!showTemplateManager && currentBookId) {
          initData();
      }
  }, [showTemplateManager]);

  const updateCheckStatus = (
      currentCards: ClosingCard[], 
      profitDone: boolean, 
      yearProfitDone: boolean, 
      allVouchers: any[],
      currentFiscalStartMonth: number 
  ) => {
      const step1Done = currentCards.every(c => c.isGenerated);
      const currentMonthVouchers = allVouchers.filter((v: any) => v.period === currentPeriod);
      
      const unapproved = currentMonthVouchers.filter((v: any) => v.status !== 'approved');
      const unapprovedCodes = unapproved.map((v: any) => `${v.voucherCode}(${v.voucherDate})`);

      const currentMonth = parseInt(currentPeriod.split('-')[1]);
      const endMonth = currentFiscalStartMonth === 1 ? 12 : currentFiscalStartMonth - 1;
      const isYearEndPeriod = currentMonth === endMonth;

      setCheckItems(prev => {
          let newItems = [
              { id: 'step1', label: '期末业务结转', status: step1Done ? 'completed' : 'warning', message: step1Done ? '已完成' : '尚有未生成凭证', isBlocker: true },
              { id: 'step2', label: '损益结转', status: profitDone ? 'completed' : 'warning', message: profitDone ? '已结转' : '未结转', isBlocker: true }
          ] as CheckItem[];

          if (isYearEndPeriod) {
              newItems.push({
                  id: 'step2_year',
                  label: '年度利润结转',
                  status: yearProfitDone ? 'completed' : 'warning',
                  message: yearProfitDone ? '已完成' : '未执行',
                  isBlocker: true
              });
          }

          if (unapproved.length === 0) {
              newItems.push({ id: 'audit', label: '凭证审核', status: 'completed', message: '本期凭证已全部审核', isBlocker: true, details: [] });
          } else {
              newItems.push({ id: 'audit', label: '凭证审核', status: 'warning', message: `检测到 ${unapproved.length} 张未审核凭证`, isBlocker: true, details: unapprovedCodes });
          }
          
          return newItems;
      });
  };

  const calculatePeriodNet = async (subjectCode: string, direction: 'debit' | 'credit') => {
      if (!subjectCode) return 0;
      const vouchers = await getAllVouchers(currentBookId);
      const validVouchers = vouchers.filter((v: any) => 
          v.period === currentPeriod && 
          (v.status === 'approved' || v.maker === '系统自动' || v.closingType !== undefined)
      );

      let debitCents = 0, creditCents = 0;
      validVouchers.forEach((v: any) => {
          v.lines.forEach((l: any) => {
              if (l.subjectCode === subjectCode || l.subjectCode.startsWith(subjectCode)) {
                  debitCents += toCents(l.debitAmount);
                  creditCents += toCents(l.creditAmount);
              }
          });
      });
      const netCents = direction === 'debit' ? (debitCents - creditCents) : (creditCents - debitCents);
      return netCents / 100;
  };

  const calculateYearlyProfit = async () => {
      const vouchers = await getAllVouchers(currentBookId);
      const yearStart = `${currentPeriod.split('-')[0]}-01-01`; 
      const validVouchers = vouchers.filter((v: any) => 
          v.voucherDate >= yearStart && 
          v.period <= currentPeriod &&
          v.closingType !== 'profit' &&
          (v.status === 'approved' || v.maker === '系统自动' || v.closingType !== undefined)
      );

      let profitCents = 0;
      validVouchers.forEach((v: any) => {
          v.lines.forEach((l: any) => {
              const code = String(l.subjectCode);
              if (code.startsWith('6')) {
                  const d = toCents(l.debitAmount);
                  const c = toCents(l.creditAmount);
                  if (['60', '61', '63'].some(p => code.startsWith(p))) {
                      profitCents += (c - d);
                  } else {
                      profitCents -= (d - c);
                  }
              }
          });
      });
      return profitCents / 100;
  };

  const handleCardClick = async (card: ClosingCard) => {
      if (!currentBookId) return;
      setCurrentCard(card);
      setIsCalculating(true);
      setShowRuleDialog(true);
      setRuleConfig({}); 
      
      try {
          const cfg = card.config || {};
          if (card.type === 'custom') {
              let amount = 0;
              if (card.sourceType === 'balance' && card.sourceSubjectCode) {
                  const bal = await getSubjectBalanceAsync(currentBookId, card.sourceSubjectCode, currentPeriod);
                  amount = Math.abs(bal.balance);
              }
              setRuleConfig({ customAmount: amount });
          } else if (card.id === 'cost') {
              const revenue = await calculatePeriodNet(cfg.sourceCode || '6001', 'credit');
              const inventory = await getSubjectBalanceAsync(currentBookId, cfg.creditCode || '1405', currentPeriod);
              setRuleConfig({ mainRevenue: Math.max(0, revenue), inventoryBalance: inventory.balance, transferPercent: 100 });
          } else if (card.id === 'vat-transfer') {
              const output = await calculatePeriodNet(cfg.sourceCode || '22210102', 'credit');
              const input = await calculatePeriodNet('22210101', 'debit');
              setRuleConfig({ vatBaseAmount: Math.max(0, output - input) });
          } else if (card.id === 'simple-tax') {
              const revenue = await calculatePeriodNet(cfg.sourceCode || '6001', 'credit');
              setRuleConfig({ 
                  vatBaseAmount: Math.max(0, revenue), 
                  taxRate: 3 
              });
          } else if (card.id === 'surtax') {
              let base = 0;
              if (taxType === '一般纳税人') {
                  const output = await calculatePeriodNet('22210102', 'credit');
                  const input = await calculatePeriodNet('22210101', 'debit');
                  base = Math.max(0, output - input);
              } else {
                  // 小规模：取应交增值税(222101)的贷方发生额作为基数（或者用计算出的收入*税率）
                  const vatCode = cfg.sourceCode || '222101';
                  // 这里用 'credit' - 'debit' 作为本期净增值税额
                  base = await calculatePeriodNet(vatCode, 'credit');
              }
              setRuleConfig({ vatBaseAmount: Math.max(0, base), cityTaxRate: 7, educationRate: 3, localEducationRate: 2 });
          } else if (card.id === 'income-tax') {
              const profit = await calculateYearlyProfit();
              setRuleConfig({ yearlyProfit: Math.max(0, profit), incomeTaxRate: 25 });
          }
      } catch (e) { toast.error("数据计算异常"); } finally { setIsCalculating(false); }
  };

  const handleGeneratePreview = () => {
      if (!currentCard) return;
      
      let lines: any[] = []; let total = 0;
      const voucherDate = getPeriodEndDate(currentPeriod);
      const cfg = currentCard.config || {};

      if (currentCard.type === 'custom') {
          const amount = ruleConfig.customAmount || 0; total = amount;
          lines = [
              { summary: currentCard.title, subjectCode: currentCard.debitSubjectCode, subjectName: getSubjectName(currentCard.debitSubjectCode||''), debitAmount: amount.toFixed(2), creditAmount: '' }, 
              { summary: currentCard.title, subjectCode: currentCard.creditSubjectCode, subjectName: getSubjectName(currentCard.creditSubjectCode||''), debitAmount: '', creditAmount: amount.toFixed(2) }
          ];
      } else if (currentCard.id === 'cost') {
          const amount = (ruleConfig.mainRevenue || 0) * (ruleConfig.transferPercent || 100) / 100; total = amount;
          lines = [
              { summary: '结转本期销售成本', subjectCode: cfg.debitCode || '6401', subjectName: getSubjectName(cfg.debitCode || '6401'), debitAmount: amount.toFixed(2), creditAmount: '' }, 
              { summary: '结转本期销售成本', subjectCode: cfg.creditCode || '1405', subjectName: getSubjectName(cfg.creditCode || '1405'), debitAmount: '', creditAmount: amount.toFixed(2) }
          ];
      } else if (currentCard.id === 'vat-transfer') {
        const amount = ruleConfig.vatBaseAmount || 0; total = amount;
        if(amount>0) {
            lines = [
                { summary: '转出未交增值税', subjectCode: cfg.debitCode || '22210103', subjectName: getSubjectName(cfg.debitCode||''), debitAmount: amount.toFixed(2), creditAmount: '' }, 
                { summary: '转出未交增值税', subjectCode: cfg.creditCode || '222102', subjectName: getSubjectName(cfg.creditCode||''), debitAmount: '', creditAmount: amount.toFixed(2) }
            ];
        }
      } else if (currentCard.id === 'simple-tax') {
          // ★★★ 核心修复：实现小规模税金生成逻辑 (即使金额为0也生成，方便修改) ★★★
          const revenue = ruleConfig.vatBaseAmount || 0;
          const rate = (ruleConfig.taxRate || 3) / 100;
          const taxAmount = revenue * rate; 
          total = taxAmount;
          
          lines = [
              { 
                  summary: '结转本月应交增值税', 
                  subjectCode: cfg.debitCode || '222101', 
                  subjectName: getSubjectNameSafe(cfg.debitCode || '222101', '应交增值税'), 
                  debitAmount: total.toFixed(2), 
                  creditAmount: '' 
              }, 
              { 
                  summary: '结转本月应交增值税', 
                  subjectCode: cfg.creditCode || '222102', 
                  subjectName: getSubjectNameSafe(cfg.creditCode || '222102', '未交增值税'), 
                  debitAmount: '', 
                  creditAmount: total.toFixed(2) 
              }
          ];
      } else if (currentCard.id === 'surtax') {
          const base = ruleConfig.vatBaseAmount || 0;
          const city = base * (ruleConfig.cityTaxRate||7)/100; 
          const edu = base * (ruleConfig.educationRate||3)/100; 
          const local = base * (ruleConfig.localEducationRate||2)/100;
          total = city+edu+local;
          
          const debitCode = cfg.debitCode || '6403';
          
          if (taxType === '一般纳税人') {
              lines = [
                  { summary: '计提附加税', subjectCode: debitCode, subjectName: getSubjectName(debitCode), debitAmount: total.toFixed(2), creditAmount: '' }, 
                  { summary: '计提城建税', subjectCode: '222108', subjectName: getSubjectNameSafe('222108', '应交城市维护建设税'), debitAmount: '', creditAmount: city.toFixed(2) }, 
                  { summary: '计提教育费附加', subjectCode: '222109', subjectName: getSubjectNameSafe('222109', '应交教育费附加'), debitAmount: '', creditAmount: edu.toFixed(2) }, 
                  { summary: '计提地方教育附加', subjectCode: '222110', subjectName: getSubjectNameSafe('222110', '应交地方教育附加'), debitAmount: '', creditAmount: local.toFixed(2) }
              ];
          } else {
              const code2221 = findSubjectCode(subjects, ['应交税费'], '2221');
              lines = [
                  { summary: '计提附加税', subjectCode: debitCode, subjectName: getSubjectName(debitCode), debitAmount: total.toFixed(2), creditAmount: '' }, 
                  { summary: '计提城建税', subjectCode: findSubjectCode(subjects, ['城建'], code2221), subjectName: getSubjectNameSafe('222108', '应交税费-城建税'), debitAmount: '', creditAmount: city.toFixed(2) }, 
                  { summary: '计提教育费附加', subjectCode: findSubjectCode(subjects, ['教育'], code2221), subjectName: getSubjectNameSafe('222109', '应交税费-教育费'), debitAmount: '', creditAmount: edu.toFixed(2) }, 
                  { summary: '计提地方教育附加', subjectCode: findSubjectCode(subjects, ['地方'], code2221), subjectName: getSubjectNameSafe('222110', '应交税费-地方教育'), debitAmount: '', creditAmount: local.toFixed(2) }
              ];
          }
      } else if (currentCard.id === 'income-tax') {
          const tax = (ruleConfig.yearlyProfit||0) * (ruleConfig.incomeTaxRate||25)/100; total = tax;
          lines = [{ summary: '计提企业所得税', subjectCode: cfg.debitCode || '6801', subjectName: getSubjectName(cfg.debitCode||''), debitAmount: tax.toFixed(2), creditAmount: '' }, { summary: '计提企业所得税', subjectCode: cfg.creditCode || '222106', subjectName: getSubjectName(cfg.creditCode||''), debitAmount: '', creditAmount: tax.toFixed(2) }];
      } 

      // ★★★ 核心修复：在这里关闭 RuleDialog ★★★
      setShowRuleDialog(false); 
      setPreviewVoucher({ voucherDate: voucherDate, voucherType: '转', voucherNumber: '', lines, debitTotal: total.toFixed(2), creditTotal: total.toFixed(2), closingType: currentCard.type==='custom' ? currentCard.id : currentCard.id, maker: '系统自动' });
      setShowVoucherPreview(true);
  };

  const handleSaveVoucher = async (voucher: any) => {
      if (!currentBookId) return;
      const typeId = voucher.closingType || currentCard?.id;
      if (!typeId) return;

      try {
        const allVouchers = await getAllVouchers(currentBookId);
        const oldVoucher = allVouchers.find((v: any) => v.period === currentPeriod && v.closingType === typeId);
        if (oldVoucher) {
          if (oldVoucher.status === 'approved') await unauditVoucher(oldVoucher.id);
          await deleteVoucher(oldVoucher.id);
        }
        const finalVoucher = { ...voucher, period: currentPeriod, closingType: typeId, maker: '系统自动', status: 'approved', auditor: '系统自动', auditedDate: new Date().toISOString(), poster: '系统自动', postedDate: new Date().toISOString() };
        await addVoucher(finalVoucher, currentBookId);
        await initData();
        setShowVoucherPreview(false);
        
        let title = '';
        if (typeId === 'profit') title = '损益结转';
        else if (typeId === 'year-transfer') title = '年度利润结转';
        else title = currentCard?.title || '结转';
        
        toast.success(`【${title}】凭证已生成并自动通过审核`);
      } catch (e: any) { console.error(e); toast.error("保存失败"); }
  };

  // ... (剩余的 handleYearProfitTransfer, handleProfitTransfer 等函数保持不变)
  // ... (为了代码完整性，这里复用你之前的逻辑)
  const handleYearProfitTransfer = async () => {
      if (!currentBookId) return;
      setIsProcessing(true);
      try {
          const profitCode = findSubjectCode(subjects, ['本年利润'], '4103');
          const retainedCode = findSubjectCode(subjects, ['未分配利润', '利润分配'], '4104');
          
          const profitData = await getSubjectBalanceAsync(currentBookId, profitCode, currentPeriod);
          const netCreditBalance = profitData.creditTotal - profitData.debitTotal;

          if (Math.abs(netCreditBalance) < 0.01) {
              toast.info("本年利润科目余额为 0，无需结转");
              setIsProcessing(false);
              return;
          }

          let lines: any[] = [];
          const absAmount = Math.abs(netCreditBalance);
          const formattedAmount = fromCents(Math.round(absAmount * 100));

          if (netCreditBalance > 0) {
              lines = [
                  { summary: '结转全年净利润', subjectCode: profitCode, subjectName: getSubjectName(profitCode), debitAmount: formattedAmount, creditAmount: '' },
                  { summary: '结转全年净利润', subjectCode: retainedCode, subjectName: getSubjectName(retainedCode), debitAmount: '', creditAmount: formattedAmount }
              ];
          } else {
              lines = [
                  { summary: '结转全年亏损', subjectCode: retainedCode, subjectName: getSubjectName(retainedCode), debitAmount: formattedAmount, creditAmount: '' },
                  { summary: '结转全年亏损', subjectCode: profitCode, subjectName: getSubjectName(profitCode), debitAmount: '', creditAmount: formattedAmount }
              ];
          }

          const voucherDate = getPeriodEndDate(currentPeriod);
          setPreviewVoucher({ 
              voucherDate, 
              voucherType: '转', 
              voucherNumber: '', 
              lines, 
              debitTotal: formattedAmount, 
              creditTotal: formattedAmount, 
              closingType: 'year-transfer',
              maker: '系统自动' 
          });
          setShowVoucherPreview(true);

      } catch (e) {
          console.error(e);
          toast.error("获取年度利润数据失败");
      } finally {
          setIsProcessing(false);
      }
  };
  
  const handleUndoYearTransfer = async () => {
    if (!confirm("确定要删除年度利润结转凭证吗？")) return;
    setIsProcessing(true);
    try {
        const allVouchers = await getAllVouchers(currentBookId);
        const v = allVouchers.find((v: any) => v.period === currentPeriod && v.closingType === 'year-transfer');
        if (v) {
            if (v.status === 'approved') await unauditVoucher(v.id);
            await deleteVoucher(v.id);
            toast.success("已重置年度利润结转");
            await initData();
        }
    } catch (e) { console.error(e); toast.error("重置失败"); } finally { setIsProcessing(false); }
  };

  // --- 核心修复：更健壮的损益结转逻辑 ---
  const handleProfitTransfer = async () => {
      if (!currentBookId) return;
      setIsProcessing(true);
      console.log("🚀 [损益结转] 开始执行...");

      try {
          // 1. 获取本期所有凭证
          const allVouchers = await getAllVouchers(currentBookId);
          
          // 2. 筛选有效凭证 (本期、已审核、非结转凭证)
          const validVouchers = allVouchers.filter((v: any) => 
              v.period === currentPeriod && 
              v.status === 'approved' &&
              v.closingType !== 'profit' && 
              v.closingType !== 'year-transfer' 
          );
          
          console.log(`📊 [损益结转] 找到有效凭证 ${validVouchers.length} 张`);

          if (validVouchers.length === 0) {
              toast.warning("本期没有已审核的业务凭证，无法结转损益。");
              setShowProfitConfirm(false);
              return;
          }

          // 3. 汇总损益类科目余额
          // 逻辑：所有 6 开头的科目，借方发生额 - 贷方发生额
          const subjectMap = new Map<string, { name: string, balance: number }>();
          
          validVouchers.forEach((v: any) => {
              v.lines.forEach((line: any) => {
                  const code = String(line.subjectCode);
                  if (code.startsWith('6')) { // 损益类科目
                      const d = parseFloat(line.debitAmount || 0);
                      const c = parseFloat(line.creditAmount || 0);
                      // 计算借方净发生额
                      const currentVal = subjectMap.get(code)?.balance || 0;
                      const currentName = subjectMap.get(code)?.name || line.subjectName;
                      
                      subjectMap.set(code, { 
                          name: currentName, 
                          balance: currentVal + d - c 
                      });
                  }
              });
          });

          // 4. 构建分录
          let lines: any[] = []; 
          let profitTotal = 0; // 本年利润的贷方金额
          const unifiedSummary = `结转${getPeriodCN(currentPeriod)}损益`;

          subjectMap.forEach((val, code) => {
              const balance = val.balance;
              
              // 忽略极小余额
              if (Math.abs(balance) < 0.01) return;

              const finalName = getSubjectName(code) || val.name || '损益科目';

              if (balance > 0) {
                  // 借方有余额 (通常是费用)，需要从贷方转出
                  // 分录：借 本年利润 / 贷 费用科目
                  lines.push({ 
                      summary: unifiedSummary, 
                      subjectCode: code, 
                      subjectName: finalName, 
                      debitAmount: '', 
                      creditAmount: balance.toFixed(2) 
                  });
                  profitTotal -= balance; // 费用导致利润减少
              } else {
                  // 贷方有余额 (通常是收入)，需要从借方转出
                  // 分录：借 收入科目 / 贷 本年利润
                  const absAmount = Math.abs(balance);
                  lines.push({ 
                      summary: unifiedSummary, 
                      subjectCode: code, 
                      subjectName: finalName, 
                      debitAmount: absAmount.toFixed(2), 
                      creditAmount: '' 
                  });
                  profitTotal += absAmount; // 收入导致利润增加
              }
          });

          if (lines.length === 0) { 
              toast.info("本期损益类科目余额均为 0，无需结转。"); 
              setShowProfitConfirm(false); 
              return; 
          }

          // 5. 补齐“本年利润”科目
          // 查找 4103 (本年利润)
          let profitCode = findSubjectCode(subjects, ['本年利润'], '4103');
          // 如果找不到，尝试 3103 (旧准则)
          if (getSubjectName(profitCode) === '未知科目') {
               profitCode = findSubjectCode(subjects, ['本年利润'], '3103');
          }
          const profitName = getSubjectName(profitCode) || '本年利润';

          if (profitTotal > 0) {
              // 盈利：贷记本年利润
              lines.push({ 
                  summary: unifiedSummary, 
                  subjectCode: profitCode, 
                  subjectName: profitName, 
                  debitAmount: '', 
                  creditAmount: profitTotal.toFixed(2) 
              });
          } else if (profitTotal < 0) {
              // 亏损：借记本年利润
              lines.push({ 
                  summary: unifiedSummary, 
                  subjectCode: profitCode, 
                  subjectName: profitName, 
                  debitAmount: Math.abs(profitTotal).toFixed(2), 
                  creditAmount: '' 
              });
          }

          // 6. 排序 (借方在前)
          lines.sort((a, b) => {
              const aIsDebit = !!a.debitAmount;
              const bIsDebit = !!b.debitAmount;
              if (aIsDebit && !bIsDebit) return -1;
              if (!aIsDebit && bIsDebit) return 1;
              return 0;
          });

          // 7. 计算合计并弹窗
          const totalCheck = lines.reduce((sum, l) => sum + Number(l.debitAmount || 0), 0);
          
          const previewObj = { 
              voucherDate: getPeriodEndDate(currentPeriod), 
              voucherType: '转', 
              voucherNumber: '', 
              lines, 
              debitTotal: totalCheck.toFixed(2), 
              creditTotal: totalCheck.toFixed(2), 
              closingType: 'profit', 
              maker: '系统自动' 
          };

          console.log("✅ [损益结转] 生成凭证预览:", previewObj);

          setShowProfitConfirm(false); 
          setPreviewVoucher(previewObj);
          setShowVoucherPreview(true);

      } catch (e) { 
          console.error("❌ [损益结转] 发生错误:", e); 
          toast.error("测算失败，请查看控制台"); 
      } finally { 
          setIsProcessing(false); 
      }
  };

  const handleUndoProfitTransfer = async () => {
    if (!currentBookId) return;
    if (!confirm("确定要重新结转吗？\n\n这将删除已生成的【损益结转】凭证，并将状态重置为未结转。")) return;
    setIsProcessing(true);
    try {
        const allVouchers = await getAllVouchers(currentBookId);
        const profitVoucher = allVouchers.find((v: any) => v.period === currentPeriod && v.closingType === 'profit');
        if (profitVoucher) {
            if (profitVoucher.status === 'approved') await unauditVoucher(profitVoucher.id);
            await deleteVoucher(profitVoucher.id);
            toast.success("旧的损益凭证已清除，请重新测算");
        }
        setIsProfitTransferred(false); await initData(); 
    } catch (e) { console.error(e); toast.error("重置失败"); } finally { setIsProcessing(false); }
  };

  const handleConfirmClose = async () => {
      if (isFiscalYearEnd() && !isYearProfitTransferred) {
          toast.error("当前为会计年度终了月，请先完成【年度利润结转】");
          setCurrentStep(2);
          return;
      }

      if (!currentBookId) return;
      setIsClosing(true);
      try {
          await updateAccountBook({ id: currentBookId, status: 'closed', lastClosedPeriod: currentPeriod });
          setBookStatus('closed'); toast.success(`期间 ${currentPeriod} 已成功关账！`);
      } catch (error) { toast.error("关账失败"); } finally { setIsClosing(false); }
  };

  const handleReverseClose = async () => {
    if (!currentBookId) return;
    if (!confirm("反结账将恢复账套为开启状态，确定要继续吗？")) return;
    setIsReversing(true);
    try {
        const allVouchers = await getAllVouchers(currentBookId);
        const systemVouchers = allVouchers.filter((v: any) => v.period === currentPeriod && v.closingType !== undefined && v.closingType !== null);
        await Promise.all(systemVouchers.map(async (v: any) => {
            try {
                if (v.status === 'approved') await unauditVoucher(v.id);
                await deleteVoucher(v.id);
            } catch (err) {}
        }));
        await updateAccountBook({ id: currentBookId, status: 'open', lastClosedPeriod: '' });
        setBookStatus('open'); setCurrentTab('closing'); setCurrentStep(1); 
        setIsProfitTransferred(false); 
        setIsYearProfitTransferred(false); 
        await initData();
        toast.success("反结账成功");
    } catch (e) { console.error(e); toast.error("反结账失败"); } finally { setIsReversing(false); }
  };

  if (bookStatus === 'closed') {
      return (
        <div className="max-w-[1200px] mx-auto pb-10">
            <div className="bg-white border rounded-lg p-12 text-center shadow-sm mt-10">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-10 h-10 text-green-600"/></div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentPeriod} 已结账</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">本期账务处理已完成。如需修改历史凭证或补充录入，请执行反结账操作。</p>
                <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => router.push('/')}>返回首页</Button>
                    <Button variant="default" onClick={handleReverseClose} disabled={isReversing} className="bg-orange-500 hover:bg-orange-600">
                        {isReversing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <RotateCcw className="w-4 h-4 mr-2"/>} 反结账
                    </Button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="max-w-[1200px] mx-auto pb-10">
        <div className="mb-6 flex items-end justify-between">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">期末结转</h1>
                <p className="text-gray-600 text-sm flex items-center gap-2">
                    会计期间: <Badge variant="outline" className="font-mono bg-white">{currentPeriod}</Badge>
                    纳税性质: <Badge variant="secondary">{taxType}</Badge>
                    {isFiscalYearEnd() && <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">年度终了月</Badge>}
                </p>
            </div>
            <Button variant="outline" onClick={() => setShowTemplateManager(true)}>
                <Settings className="w-4 h-4 mr-2"/> 自定义结转模板
            </Button>
        </div>

        <Tabs value={currentTab} onValueChange={(v: any) => setCurrentTab(v)}>
            <TabsList className="mb-4">
                <TabsTrigger value="closing">月末结转</TabsTrigger>
                <TabsTrigger value="reverse">反结账</TabsTrigger>
            </TabsList>
            <TabsContent value="closing" className="space-y-6">
                
                {currentStep === 1 && (
                    <div className="bg-white border rounded-lg p-6 shadow-sm">
                        <div className="flex justify-between mb-4">
                            <h3 className="font-bold text-lg text-gray-800">1. 期末业务处理</h3>
                            <Button variant="ghost" size="sm" onClick={initData}><Loader2 className={`w-4 h-4 mr-1 ${isLoading?'animate-spin':''}`}/> 刷新</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {cards.map(card => (
                                <div key={card.id} className={`border rounded-lg p-4 transition-all ${card.isGenerated ? 'bg-green-50/50 border-green-200' : 'hover:border-blue-300 hover:shadow-md bg-white'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-gray-800">{card.title}</div>
                                                {card.type === 'custom' && <Badge variant="outline" className="text-[10px] h-5">自定义</Badge>}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-1">{card.description}</div>
                                        </div>
                                        {card.isGenerated ? (
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/> 已生成</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-gray-400">未生成</Badge>
                                        )}
                                    </div>
                                    <div className="mt-4 flex items-end justify-between">
                                        <div className="text-2xl font-mono text-gray-700">
                                            {card.amount > 0 ? `¥ ${card.amount.toLocaleString()}` : '--'}
                                        </div>
                                        <Button size="sm" 
                                        variant={card.isGenerated ? "outline" : "default"} 
                                        className={card.isGenerated ? "border-blue-200 text-blue-600 hover:bg-blue-50" : "bg-blue-600 hover:bg-blue-700"}
                                        onClick={() => {if (card.isGenerated) {
                                             router.push(`/app/${currentBookId}/vouchers/management?period=${currentPeriod}`);
                                            } else {
                                             handleCardClick(card);}
                                       }}
                                            >
                                                {card.isGenerated ? '查看凭证' : '测算生成'}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 flex justify-end">
                            <Button onClick={() => setCurrentStep(2)} className="bg-gray-900 text-white hover:bg-gray-800">下一步：损益结转 <ChevronRight className="w-4 h-4 ml-1"/></Button>
                        </div>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="bg-white border rounded-lg p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-6 text-gray-800">2. 损益与年度结转</h3>

                        <div className={`rounded-lg border p-6 transition-all ${isProfitTransferred ? 'bg-green-50/50 border-green-200' : 'bg-white'}`}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-gray-900 text-lg mb-1">损益自动结转</h4>
                                    <p className="text-sm text-gray-500">将本期损益类科目余额转入“本年利润”</p>
                                </div>
                                {isProfitTransferred ? (
                                    <div className="text-right">
                                        <Badge className="bg-green-100 text-green-700 mb-2"><CheckCircle2 className="w-4 h-4 mr-1"/> 已完成</Badge>
                                        <div><Button variant="link" size="sm" onClick={handleUndoProfitTransfer} className="text-red-500 h-auto p-0 text-xs">重新结转</Button></div>
                                    </div>
                                ) : (
                                    <Button onClick={() => setShowProfitConfirm(true)} className="bg-blue-600 hover:bg-blue-700">立即结转</Button>
                                )}
                            </div>
                        </div>

                        {isFiscalYearEnd() && (
                            <div className="mt-6">
                                <div className="flex justify-center mb-4"><ArrowDown className="text-gray-300"/></div>
                                
                                <div className={`rounded-lg border p-6 transition-all ${!isProfitTransferred ? 'opacity-50 grayscale' : ''} ${isYearProfitTransferred ? 'bg-green-50/50 border-green-200' : 'bg-white'}`}>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-gray-900 text-lg mb-1">年度利润结转</h4>
                                                <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">年终专用</Badge>
                                            </div>
                                            <p className="text-sm text-gray-500">将“本年利润”余额转入“未分配利润” (4103 → 4104)</p>
                                        </div>
                                        
                                        {!isProfitTransferred ? (
                                            <Button disabled variant="outline">请先完成损益结转</Button>
                                        ) : isYearProfitTransferred ? (
                                            <div className="text-right">
                                                <Badge className="bg-green-100 text-green-700 mb-2"><CheckCircle2 className="w-4 h-4 mr-1"/> 已完成</Badge>
                                                <div><Button variant="link" size="sm" onClick={handleUndoYearTransfer} className="text-red-500 h-auto p-0 text-xs">撤销年度结转</Button></div>
                                            </div>
                                        ) : (
                                            <Button onClick={handleYearProfitTransfer} className="bg-indigo-600 hover:bg-indigo-700">
                                                生成年度利润分配凭证
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between border-t pt-6 mt-8">
                            <Button variant="outline" onClick={() => setCurrentStep(1)}>上一步</Button>
                            <Button 
                                onClick={() => setCurrentStep(3)} 
                                disabled={!isProfitTransferred || (isFiscalYearEnd() && !isYearProfitTransferred)} 
                                className="bg-gray-900 text-white"
                            >
                                下一步：关账
                            </Button>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="bg-white border rounded-lg p-6 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 text-gray-800">3. 期末关账检查</h3>
                        <div className="space-y-3 mb-8">
                            {checkItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded border">
                                    <div className="flex items-center gap-3">
                                        {item.status === 'completed' ? <CheckCircle2 className="text-green-600 w-5 h-5"/> : <Loader2 className="animate-spin text-gray-400 w-5 h-5"/>}
                                        <span className="font-medium text-gray-700">{item.label}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm ${item.status === 'completed' ? 'text-green-600' : 'text-red-500 font-bold'}`}>{item.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between">
                            <Button variant="outline" onClick={() => setCurrentStep(2)}>上一步</Button>
                            <Button variant="destructive" className="bg-red-600 hover:bg-red-700 shadow-lg shadow-red-100" disabled={checkItems.some(i => i.isBlocker && i.status !== 'completed') || isClosing} onClick={handleConfirmClose}>
                                {isClosing ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : null} 确认关账
                            </Button>
                        </div>
                    </div>
                )}
            </TabsContent>
            <TabsContent value="reverse"><div className="p-12 text-center text-gray-500 bg-white border rounded-lg shadow-sm"><Info className="w-10 h-10 mx-auto mb-3 text-gray-300"/><p>反结账功能已移至“已关账”界面，请先确保本期已关账。</p></div></TabsContent>
        </Tabs>

        {/* Dialogs */}
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>凭证测算: {currentCard?.title}</DialogTitle><DialogDescription>请确认以下计算参数</DialogDescription></DialogHeader>
                {isCalculating ? (
                    <div className="py-10 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>
                ) : (
                    <div className="space-y-4 py-4">
                        {/* 动态渲染规则配置输入框 */}
                        {currentCard?.id === 'cost' && (
                            <>
                                <div className="space-y-1"><Label>主营业务收入 ({currentCard.config?.sourceCode})</Label><Input value={ruleConfig.mainRevenue?.toFixed(2)} readOnly className="bg-gray-100"/></div>
                                <div className="space-y-1"><Label>结转比例 (%)</Label><Input type="number" value={ruleConfig.transferPercent} onChange={e=>setRuleConfig({...ruleConfig, transferPercent: Number(e.target.value)})}/></div>
                            </>
                        )}
                        {currentCard?.type === 'custom' && (
                            <div className="space-y-1"><Label>本期金额</Label><Input type="number" value={ruleConfig.customAmount} onChange={e=>setRuleConfig({...ruleConfig, customAmount: Number(e.target.value)})}/></div>
                        )}
                        {(currentCard?.id === 'surtax' || currentCard?.id === 'vat-transfer' || currentCard?.id === 'simple-tax') && (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label>测算基数 (收入或税额)</Label>
                                    <Input value={ruleConfig.vatBaseAmount?.toFixed(2)} readOnly className="bg-gray-100 font-mono text-blue-600" />
                                </div>
                                {currentCard?.id === 'surtax' && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="space-y-1"><Label className="text-xs">城建税率%</Label><Input type="number" value={ruleConfig.cityTaxRate} onChange={e=>setRuleConfig({...ruleConfig, cityTaxRate: Number(e.target.value)})}/></div>
                                        <div className="space-y-1"><Label className="text-xs">教育费%</Label><Input type="number" value={ruleConfig.educationRate} onChange={e=>setRuleConfig({...ruleConfig, educationRate: Number(e.target.value)})}/></div>
                                        <div className="space-y-1"><Label className="text-xs">地方教育%</Label><Input type="number" value={ruleConfig.localEducationRate} onChange={e=>setRuleConfig({...ruleConfig, localEducationRate: Number(e.target.value)})}/></div>
                                    </div>
                                )}
                                {currentCard?.id === 'simple-tax' && (
                                    <div className="space-y-1"><Label>征收率 (%)</Label><Input type="number" value={ruleConfig.taxRate} onChange={e=>setRuleConfig({...ruleConfig, taxRate: Number(e.target.value)})}/></div>
                                )}
                            </div>
                        )}
                        {currentCard?.id === 'income-tax' && (
                            <div className="space-y-4">
                                <div className="space-y-1"><Label>本年累计利润</Label><Input value={ruleConfig.yearlyProfit?.toFixed(2)} readOnly className="bg-gray-100 font-mono text-green-600" /></div>
                                <div className="space-y-1"><Label>所得税税率 (%)</Label><Input type="number" value={ruleConfig.incomeTaxRate} onChange={e=>setRuleConfig({...ruleConfig, incomeTaxRate: Number(e.target.value)})}/></div>
                            </div>
                        )}
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowRuleDialog(false)}>取消</Button>
                    <Button onClick={handleGeneratePreview} disabled={isCalculating} className="bg-blue-600 hover:bg-blue-700">生成凭证预演</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
            <DialogContent className="max-w-[800px] h-[80vh] flex flex-col">
                <DialogHeader><DialogTitle>自定义结转模板</DialogTitle></DialogHeader>
                <div className="flex-1 overflow-y-auto pr-2"><ClosingTemplateManagement /></div>
            </DialogContent>
        </Dialog>

        {showVoucherPreview && previewVoucher && (
            <VoucherPreview voucher={previewVoucher} onSave={handleSaveVoucher} onCancel={() => setShowVoucherPreview(false)} />
        )}

        <AlertDialog open={showProfitConfirm} onOpenChange={setShowProfitConfirm}>
            <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>确认结转损益？</AlertDialogTitle><AlertDialogDescription>系统将检查本期所有“已审核”的损益类科目，并将其余额转入“本年利润”。</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isProcessing}>取消</AlertDialogCancel>
                    <Button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleProfitTransfer(); }} disabled={isProcessing} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null} 开始测算
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}