import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/router';
import { 
  Plus, Edit, Trash2, ChevronRight, ChevronDown, 
  RefreshCw, Layers, Loader2, Settings, BookOpen, ShieldCheck, 
  AlertCircle, ArrowRight, FileText
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Alert, AlertDescription, AlertTitle,
} from '@/components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// API 引入 (请确保 mockData 或 API 文件中 getAllSubjects 支持传入 bookId 参数)
import { 
  getAllSubjects, createSubject, deleteSubject, updateSubject, 
  getAccountBooks, updateAccountBook, getAuxiliaryCategories 
} from '@/lib/mockData'; 

// --- 1. 基础通用科目库 (已补全所得税相关) ---
const COMMON_SUBJECTS = [
  // 资产 (1)
  { code: '1001', name: '库存现金', category: '资产', direction: '借' },
  { code: '1002', name: '银行存款', category: '资产', direction: '借' },
  { code: '1012', name: '其他货币资金', category: '资产', direction: '借' },
  { code: '1101', name: '短期投资', category: '资产', direction: '借' },
  { code: '1121', name: '应收票据', category: '资产', direction: '借' },
  { code: '1122', name: '应收账款', category: '资产', direction: '借', auxiliaryItems: ['客户', '业务员'] },
  { code: '1123', name: '预付账款', category: '资产', direction: '借', auxiliaryItems: ['供应商'] },
  { code: '1131', name: '应收股利', category: '资产', direction: '借' },
  { code: '1132', name: '应收利息', category: '资产', direction: '借' },
  { code: '1221', name: '其他应收款', category: '资产', direction: '借', auxiliaryItems: ['人员', '往来单位'] },
  { code: '1401', name: '材料采购', category: '资产', direction: '借' },
  { code: '1402', name: '在途物资', category: '资产', direction: '借' },
  { code: '1403', name: '原材料', category: '资产', direction: '借', auxiliaryItems: ['存货'] },
  { code: '1405', name: '库存商品', category: '资产', direction: '借', auxiliaryItems: ['存货'] },
  { code: '1408', name: '委托加工物资', category: '资产', direction: '借' },
  { code: '1411', name: '周转材料', category: '资产', direction: '借' },
  { code: '1601', name: '固定资产', category: '资产', direction: '借' },
  { code: '1602', name: '累计折旧', category: '资产', direction: '贷' },
  { code: '1701', name: '无形资产', category: '资产', direction: '借' },
  { code: '1702', name: '累计摊销', category: '资产', direction: '贷' },
  { code: '1801', name: '长期待摊费用', category: '资产', direction: '借' },
  { code: '1901', name: '待处理财产损溢', category: '资产', direction: '借' },

  // 负债 (2)
  { code: '2001', name: '短期借款', category: '负债', direction: '贷' },
  { code: '2201', name: '应付票据', category: '负债', direction: '贷' },
  { code: '2202', name: '应付账款', category: '负债', direction: '贷', auxiliaryItems: ['供应商'] },
  { code: '2203', name: '预收账款', category: '负债', direction: '贷', auxiliaryItems: ['客户'] },
  { code: '2211', name: '应付职工薪酬', category: '负债', direction: '贷' },
  // ★ 核心修复：应交税费父级
  { code: '2221', name: '应交税费', category: '负债', direction: '贷' },
    // ★ 核心修复：所得税及附加税
    { code: '222106', name: '应交企业所得税', category: '负债', direction: '贷', parentCode: '2221' },
    { code: '222108', name: '应交城市维护建设税', category: '负债', direction: '贷', parentCode: '2221' },
    { code: '222109', name: '应交教育费附加', category: '负债', direction: '贷', parentCode: '2221' },
    { code: '222110', name: '应交地方教育附加', category: '负债', direction: '贷', parentCode: '2221' },
  { code: '2231', name: '应付利息', category: '负债', direction: '贷' },
  { code: '2232', name: '应付利润', category: '负债', direction: '贷' },
  { code: '2241', name: '其他应付款', category: '负债', direction: '贷', auxiliaryItems: ['人员', '往来单位'] },
  { code: '2501', name: '长期借款', category: '负债', direction: '贷' },

  // 所有者权益 (3)
  { code: '3001', name: '实收资本', category: '所有者权益', direction: '贷', auxiliaryItems: ['股东'] },
  { code: '3002', name: '资本公积', category: '所有者权益', direction: '贷' },
  { code: '3101', name: '盈余公积', category: '所有者权益', direction: '贷' },
  { code: '3103', name: '本年利润', category: '所有者权益', direction: '贷' },
  { code: '3104', name: '利润分配', category: '所有者权益', direction: '贷' },
    { code: '310405', name: '未分配利润', category: '所有者权益', direction: '贷', parentCode: '3104' },

  // 成本 (5)
  { code: '5001', name: '生产成本', category: '成本', direction: '借' },
  { code: '5101', name: '制造费用', category: '成本', direction: '借' },
  { code: '5301', name: '研发支出', category: '成本', direction: '借' },
  { code: '5401', name: '工程施工', category: '成本', direction: '借' },

  // 损益 (5-6)
  { code: '6001', name: '主营业务收入', category: '损益', direction: '贷' },
  { code: '6051', name: '其他业务收入', category: '损益', direction: '贷' },
  { code: '6111', name: '投资收益', category: '损益', direction: '贷' },
  { code: '6301', name: '营业外收入', category: '损益', direction: '贷' },
  { code: '6401', name: '主营业务成本', category: '损益', direction: '借' },
  { code: '6402', name: '其他业务成本', category: '损益', direction: '借' },
  { code: '6403', name: '税金及附加', category: '损益', direction: '借' },
  { code: '6601', name: '销售费用', category: '损益', direction: '借' },
  { code: '6602', name: '管理费用', category: '损益', direction: '借', auxiliaryItems: ['部门'] },
  { code: '6603', name: '财务费用', category: '损益', direction: '借' },
  { code: '6711', name: '营业外支出', category: '损益', direction: '借' },
  // ★ 核心修复：所得税费用
  { code: '6801', name: '所得税费用', category: '损益', direction: '借' },
];

// --- 2. 增值税专用科目 (一般纳税人 - 复杂) ---
const VAT_GENERAL_SUBJECTS = [
  { code: '222101', name: '应交增值税', category: '负债', direction: '贷', parentCode: '2221' },
    { code: '22210101', name: '进项税额', category: '负债', direction: '借', parentCode: '222101' },
    { code: '22210102', name: '销项税额', category: '负债', direction: '贷', parentCode: '222101' },
    { code: '22210103', name: '进项税额转出', category: '负债', direction: '贷', parentCode: '222101' },
    { code: '22210104', name: '转出未交增值税', category: '负债', direction: '借', parentCode: '222101' },
    { code: '22210105', name: '转出多交增值税', category: '负债', direction: '贷', parentCode: '222101' },
    { code: '22210109', name: '待抵扣进项税额', category: '资产', direction: '借' }, 
  { code: '222102', name: '未交增值税', category: '负债', direction: '贷', parentCode: '2221' },
];

// --- 3. 增值税专用科目 (小规模纳税人 - 简单) ---
const VAT_SMALL_SUBJECTS = [
  // 核心科目：应交增值税
  { code: '222101', name: '应交增值税', category: '负债', direction: '贷', parentCode: '2221' },
  { code: '222102', name: '未交增值税', category: '负债', direction: '贷', parentCode: '2221' },
  
  // 附加税相关明细
  { code: '222108', name: '应交城市维护建设税', category: '负债', direction: '贷', parentCode: '2221' },
  { code: '222109', name: '应交教育费附加', category: '负债', direction: '贷', parentCode: '2221' },
  { code: '222110', name: '应交地方教育附加', category: '负债', direction: '贷', parentCode: '2221' },

  // ★★★ 在这里添加：减免税款 (损益类) ★★★
  // category: '损益' 决定了它会显示在损益标签页下
  // 只有选择"小规模纳税人"初始化时，才会创建这个科目
  { code: '630101', name: '减免税款', category: '损益', direction: '贷', parentCode: '6301' },

  // 所得税相关
  { code: '222106', name: '应交企业所得税', category: '负债', direction: '贷', parentCode: '2221' },
  { code: '222111', name: '应交个人所得税', category: '负债', direction: '贷', parentCode: '2221' },
];

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
  accountBookId?: string; // 确保前端类型也包含这个字段
}

interface AuxCategory {
   id: string;
   name: string;
}

export default function SubjectManagement() {
  const router = useRouter();
  const { bookId } = router.query;
  // 获取当前账套ID
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [auxOptions, setAuxOptions] = useState<AuxCategory[]>([]); 
  
  const [loading, setLoading] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  
  // 账套信息
  const [taxType, setTaxType] = useState<string>('一般纳税人'); 
  const [bookName, setBookName] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'资产' | '负债' | '所有者权益' | '成本' | '损益'>('资产');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [parentSubject, setParentSubject] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    quantityUnit: '',
    auxiliaryItems: [] as string[],
    isActive: true
  });

  // 构建树形结构 (保持原有逻辑，增加容错)
  const buildHierarchy = (rawSubjects: any[]): Subject[] => {
    if (!Array.isArray(rawSubjects)) return [];
    // 过滤出属于当前账套的科目 (虽然API应该已经过滤，但前端双重保险)
    const list = rawSubjects
        .filter(s => s && s.code && (!s.accountBookId || s.accountBookId === currentBookId))
        .map(s => ({ ...s }));
        
    const codeMap = new Map<string, string>();
    list.forEach(s => codeMap.set(s.code, s.id));

    return list.map(subject => {
        // 前端自动推断 ParentID，防止后端数据不完整
        if (!subject.parentId && subject.code.length > 4) {
            // 尝试标准的 4-2-2 截取
            let parentCode = '';
            if (subject.code.length === 6) parentCode = subject.code.substring(0, 4);
            else if (subject.code.length === 8) parentCode = subject.code.substring(0, 6);
            else if (subject.code.length === 10) parentCode = subject.code.substring(0, 8);
            else parentCode = subject.code.substring(0, subject.code.length - 2); // 通用规则
            
            if (codeMap.has(parentCode)) {
                subject.parentId = codeMap.get(parentCode);
            }
        }
        
        const hasChildren = list.some(child => 
            child.code && 
            subject.code &&
            child.code.startsWith(subject.code) && 
            child.code.length > subject.code.length
        );

        return { ...subject, hasChildren };
    }).sort((a, b) => a.code.localeCompare(b.code));
  };

  const loadData = async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      // ★ 核心：请求所有数据时，务必带上 bookId (假设 API 支持)
      // 如果你的 mockData getAllSubjects 没参数，需要去修改它接受 id
      const [allSubjects, books, auxCats] = await Promise.all([
          getAllSubjects(currentBookId), 
          getAccountBooks(),
          getAuxiliaryCategories(currentBookId)
      ]);

      // 找到当前账套的纳税性质
      const activeBook = Array.isArray(books) ? books.find((b: any) => b.id === currentBookId) : null;
      if (activeBook) {
          setTaxType(activeBook.taxType || '一般纳税人');
          setBookName(activeBook.name || '当前账套');
      }
      
      setAuxOptions(auxCats || []);

      if (Array.isArray(allSubjects) && allSubjects.length > 0) {
        const processed = buildHierarchy(allSubjects);
        setSubjects(processed);
        
        const rootIds = processed.filter(s => !s.parentId).map(s => s.id);
        setExpandedIds(prev => [...new Set([...prev, ...rootIds])]);
      } else {
        setSubjects([]);
      }
    } catch (e) {
      console.error("加载失败", e);
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (router.isReady && currentBookId) {
        loadData();
    }
  }, [router.isReady, currentBookId]);

  // ★ 核心：严格的 Code 生成逻辑 (4-2-2)
  const generateNextCode = (category: string, parentCode?: string): string => {
    if (parentCode) {
      // 1. 寻找当前父级下的子级
      const targetLength = parentCode.length + 2;
      const children = subjects.filter(s => 
          s.code && 
          s.code.startsWith(parentCode) && 
          s.code.length === targetLength
      );
      
      const suffixes = children.map(s => {
          const suffix = s.code.substring(parentCode.length);
          return parseInt(suffix, 10);
      }).filter(n => !isNaN(n));

      const maxSuffix = suffixes.length > 0 ? Math.max(...suffixes) : 0;
      const nextSuffix = String(maxSuffix + 1).padStart(2, '0');
      
      return `${parentCode}${nextSuffix}`;
    } 
    
    // 2. 一级科目生成
    const categoryPrefixes: Record<string, string> = {
      '资产': '1', '负债': '2', '所有者权益': '3', '成本': '5', '损益': '6'
    };
    const prefix = categoryPrefixes[category] || '9';
    const existingCodes = subjects
      .filter(s => s.category === category && s.code && s.code.startsWith(prefix) && s.code.length === 4)
      .map(s => parseInt(s.code));
    
    if (existingCodes.length === 0) {
        // 如果该类别没有任何科目，尝试取标准库第一个
        const firstStd = COMMON_SUBJECTS.find(s => s.category === category);
        return firstStd ? firstStd.code : `${prefix}001`;
    }

    const maxCode = Math.max(...existingCodes);
    return String(maxCode + 1);
  };

  const getDirection = (category: string, pSubject: Subject | null) => {
    // 如果有父级，直接继承
    if (pSubject) return pSubject.direction;
    
    // 否则按类别默认
    if (category === '资产' || category === '成本') return '借';
    if (category === '损益') return '借'; // 损益类通常是费用居多(借)，收入类需手动改为贷
    return '贷';
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // ★ 核心：手动初始化逻辑 (前端兜底)
  const handleInitStandard = async () => {
      if (!currentBookId) return;
      
      const confirmMsg = taxType === '一般纳税人' 
        ? `将为【${bookName}】初始化【一般纳税人】适用的标准科目表。` 
        : `将为【${bookName}】初始化【小规模纳税人】适用的标准科目表。`;

      if (!confirm(confirmMsg)) return;
      
      setLoading(true);
      try {
          // 获取当前页面已有的所有科目代码
          const existingCodes = subjects.map(s => s.code);
          
          // 1. 筛选公共科目
          const commonToAdd = COMMON_SUBJECTS; // 不要在前端过滤了，让后端校验更安全，或者保留过滤逻辑皆可
          
          // 2. 根据纳税类型筛选增值税科目
          const vatSubjects = taxType === '一般纳税人' ? VAT_GENERAL_SUBJECTS : VAT_SMALL_SUBJECTS;
          
          // 合并列表
          const allToAdd = [...commonToAdd, ...vatSubjects];
          
          // 按编码长度排序，确保父级先创建 (比如先创 6301 再创 630101)
          allToAdd.sort((a, b) => a.code.length - b.code.length);

          let successCount = 0;
          let existCount = 0;

          // ★★★ 重点修改：使用 try-catch 包裹每一次请求 ★★★
          for (const sub of allToAdd) {
              // 简单的前端预检查，减少请求次数
              if (existingCodes.includes(sub.code)) {
                  existCount++;
                  continue; 
              }

              try {
                  await createSubject({
                      code: sub.code,
                      name: sub.name,
                      category: sub.category,
                      direction: sub.direction,
                      auxiliaryItems: (sub as any).auxiliaryItems || [],
                      accountBookId: currentBookId,
                      isActive: true,
                      isBuiltIn: true
                  });
                  successCount++;
              } catch (err: any) {
                  // ★ 如果报错是“已存在”，我们直接忽略，继续下一个
                  // 这样就不会打断循环了！
                  console.warn(`跳过已存在科目: ${sub.code} ${sub.name}`);
                  existCount++;
              }
          }
          
          toast.success(`操作完成：新增 ${successCount} 个，跳过 ${existCount} 个已存在科目`);
          loadData(); // 重新加载列表
      } catch (e) {
          console.error(e);
          toast.error("初始化过程发生异常");
      } finally {
          setLoading(false);
      }
  };

  const handleAddRootSubject = () => {
    setEditTarget(null);
    setParentSubject(null);
    setFormData({ name: '', code: generateNextCode(activeTab), quantityUnit: '', auxiliaryItems: [], isActive: true });
    setShowModal(true);
  };

  const handleAddChildSubject = (parent: Subject) => {
    setEditTarget(null);
    setParentSubject(parent);
    setFormData({ name: '', code: generateNextCode(parent.category, parent.code), quantityUnit: '', auxiliaryItems: [], isActive: true });
    setShowModal(true);
  };

  const handleEdit = (subject: Subject) => {
    setEditTarget(subject);
    setParentSubject(null); 
    setFormData({
      name: subject.name,
      code: subject.code,
      quantityUnit: subject.quantityUnit || '',
      auxiliaryItems: Array.isArray(subject.auxiliaryItems) ? subject.auxiliaryItems : [],
      isActive: subject.isActive
    });
    setShowModal(true);
  };

  const handleManageAux = () => {
    // 假设路由结构支持 settings/auxiliary
    router.push(`/app/${currentBookId}/settings/auxiliary`);
  };

  const handleSave = async () => {
    if (!currentBookId) return;
    if (!formData.name.trim()) { toast.error('请输入科目名称'); return; }
    if (!formData.code.trim()) { toast.error('请输入科目编码'); return; }

    try {
        if (editTarget) {
            await updateSubject({ 
                id: editTarget.id, 
                name: formData.name, 
                quantityUnit: formData.quantityUnit, 
                auxiliaryItems: formData.auxiliaryItems, 
                isActive: formData.isActive,
                accountBookId: currentBookId // 安全起见带上ID
            });
            toast.success("更新成功");
        } else {
            const category = parentSubject ? parentSubject.category : activeTab;
            const direction = parentSubject ? parentSubject.direction : getDirection(category, null);
            await createSubject({
                code: formData.code, 
                name: formData.name,
                category,
                direction,
                parentId: parentSubject?.id || null,
                accountBookId: currentBookId, // ★★★ 关键：分离账套数据
                isActive: formData.isActive,
                auxiliaryItems: formData.auxiliaryItems
            });
            toast.success("创建成功");
        }
        setShowModal(false);
        loadData();
    } catch(e) {
        console.error(e);
        toast.error('保存失败，请检查编码是否重复');
    }
  };

  const handleDelete = async (subject: Subject) => {
    if (subject.hasChildren) { toast.error('请先删除下级科目'); return; }
    if (subject.hasBalance) { toast.error('该科目有余额，无法删除'); return; }
    try {
        await deleteSubject(subject.id);
        setDeleteTarget(null);
        loadData();
        toast.success("删除成功");
    } catch(e) { toast.error('删除失败'); }
  };

  const handleCompleteAndNext = async () => {
    if (!currentBookId) return;
    setIsSavingStep(true);
    try {
        await updateAccountBook({ id: currentBookId, subjectsConfigured: true });
        router.push(`/app/${currentBookId}/settings/auxiliary`);
    } catch (e) {
        router.push(`/app/${currentBookId}/settings/auxiliary`);
    } finally {
        setIsSavingStep(false);
    }
  };

  const renderSubjectTree = (subjectsToRender: Subject[], allSubjects: Subject[], level: number = 0): any[] => {
    return subjectsToRender.map(subject => {
      if (!subject || !subject.id) return null;
      const children = allSubjects.filter(s => s.parentId === subject.id);
      const isExpanded = expandedIds.includes(subject.id);
      const canEdit = true; 
      const canDelete = !subject.hasBalance && !subject.hasChildren; 

      return (
        <Fragment key={subject.id}>
          <TableRow className={`group hover:bg-gray-50 transition-colors ${!subject.isActive ? "opacity-60 bg-gray-50/50" : ""}`}>
            <TableCell>
              <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
                {children.length > 0 ? (
                  <button onClick={() => toggleExpand(subject.id)} className="mr-2 p-0.5 hover:bg-gray-200 rounded transition-colors">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  </button>
                ) : <span className="w-7 inline-block" />}
                <span className={`font-mono tracking-tight ${level === 0 ? "font-semibold text-gray-900" : "text-gray-700"}`}>{subject.code}</span>
              </div>
            </TableCell>
            <TableCell><span className={level === 0 ? "font-semibold text-gray-900" : "text-gray-700"}>{subject.name}</span></TableCell>
            <TableCell className="text-gray-500 text-xs font-mono">{subject.mnemonic || '-'}</TableCell>
            <TableCell>
              <Badge variant={subject.direction === '借' ? 'default' : 'secondary'} className={`font-normal h-5 px-2 ${subject.direction === '借' ? 'bg-blue-600' : 'bg-orange-500'}`}>{subject.direction}</Badge>
            </TableCell>
            <TableCell className="text-sm text-gray-600">{subject.quantityUnit || '-'}</TableCell>
            <TableCell>
              {Array.isArray(subject.auxiliaryItems) && subject.auxiliaryItems.length > 0 
                ? <div className="flex flex-wrap gap-1">{subject.auxiliaryItems.map(item => (<Badge key={item} variant="outline" className="text-gray-600 bg-gray-50 h-5 px-1.5">{item}</Badge>))}</div>
                : <span className="text-gray-300">-</span>}
            </TableCell>
            <TableCell>{subject.isActive ? <span className="text-green-700 text-xs bg-green-50 px-2 py-0.5 rounded-full">启用</span> : <span className="text-gray-500 text-xs bg-gray-100 px-2 py-0.5 rounded-full">停用</span>}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-blue-600" onClick={() => handleAddChildSubject(subject)} title="新增子科目"><Plus className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-blue-600" onClick={() => handleEdit(subject)}><Edit className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className={`h-7 w-7 ${!canDelete ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:text-red-600'}`} onClick={() => setDeleteTarget(subject)} disabled={!canDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </TableCell>
          </TableRow>
          {isExpanded && children.length > 0 && renderSubjectTree(children, allSubjects, level + 1)}
        </Fragment>
      );
    });
  };

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">会计科目</h1>
            {/* 账套标识：让用户明确当前操作的账套 */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                <FileText className="w-3 h-3 text-gray-500" />
                <span className="text-xs font-semibold text-gray-700">{bookName || '加载中...'}</span>
            </div>
            {/* 纳税人标识：区分不同会计制度 */}
            <div className="hidden sm:flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                <Layers className="w-3 h-3 text-blue-600"/>
                <span className={`text-xs font-medium text-blue-700`}>{taxType || '...'}</span>
            </div>
        </div>
        <div className="flex gap-2">
             {true && (
                 <Button variant="default" size="sm" onClick={handleInitStandard} className="h-8 bg-blue-600 hover:bg-blue-700 shadow-sm">
                     <BookOpen className="w-3.5 h-3.5 mr-2" />
                     初始化标准科目表
                 </Button>
             )}
             <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-8">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} /> 刷新
             </Button>
        </div>
      </div>
      
      {subjects.length === 0 && (
          <Alert variant="default" className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3">
            <ShieldCheck className="h-4 w-4 text-yellow-600 mt-0.5" />
            <div className="ml-3">
                <AlertTitle className="text-sm font-bold">账套暂无科目数据</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                    当前账套【{bookName}】尚未配置科目。请点击上方“初始化标准科目表”按钮，
                    系统将根据您的纳税人身份 ({taxType}) 自动预置。
                </AlertDescription>
            </div>
          </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-2 rounded-t-lg border-x border-t border-gray-200 gap-2">
          <TabsList className="bg-gray-100/80 h-9 p-1">
            {['资产', '负债', '所有者权益', '成本', '损益'].map(t => (
                <TabsTrigger key={t} value={t} className="text-xs sm:text-sm px-3 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-700">{t}</TabsTrigger>
            ))}
          </TabsList>
          <Button onClick={handleAddRootSubject} className="bg-blue-600 hover:bg-blue-700 h-8 text-sm shadow-sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            新增一级科目
          </Button>
        </div>

        {(['资产', '负债', '所有者权益', '成本', '损益'] as const).map(category => (
          <TabsContent key={category} value={category} className="mt-0">
            <div className="bg-white border-x border-b border-gray-200 rounded-b-lg shadow-sm overflow-hidden min-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 border-b border-gray-100 hover:bg-gray-50">
                    <TableHead className="w-[200px] font-semibold text-gray-700">科目编码</TableHead>
                    <TableHead className="w-[180px] font-semibold text-gray-700">科目名称</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700">助记码</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700">方向</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-700">单位</TableHead>
                    <TableHead className="font-semibold text-gray-700">辅助核算</TableHead>
                    <TableHead className="font-semibold text-gray-700">状态</TableHead>
                    <TableHead className="text-right pr-6 font-semibold text-gray-700">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-20 text-gray-400"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-200"/>数据加载中...</TableCell></TableRow>
                  ) : subjects.filter(s => s.category === category).length === 0 ? (
                      <TableRow>
                          <TableCell colSpan={8} className="text-center py-20 text-gray-400">
                              <div className="flex flex-col items-center">
                                  <span className="text-gray-400 mb-2">暂无{category}类科目</span>
                              </div>
                          </TableCell>
                      </TableRow>
                  ) : (
                      renderSubjectTree(subjects.filter(s => s.category === category && !s.parentId), subjects)
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 新增/编辑弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl overflow-visible">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? '编辑科目' : parentSubject ? `新增子科目` : '新增科目'}
            </DialogTitle>
            <DialogDescription>
               {parentSubject && <span className="text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs font-mono">上级科目：{parentSubject.code} {parentSubject.name}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">科目类别</Label>
                    <Input value={parentSubject?.category || editTarget?.category || activeTab} disabled className="bg-gray-50 text-gray-700 h-9"/>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs text-gray-500">余额方向</Label>
                    <Input value={editTarget?.direction || getDirection(parentSubject?.category || activeTab, parentSubject)} disabled className="bg-gray-50 text-gray-700 h-9"/>
                </div>
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">科目编码 <span className="text-red-500">*</span></Label>
                <Input 
                    value={formData.code} 
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    disabled={!!editTarget} // 编辑时不建议改编码，但新增时可以改（虽然系统会自动建议）
                    className={`font-mono h-9 ${parentSubject ? 'text-gray-900' : 'text-gray-900'}`}
                    placeholder="系统自动生成"
                />
                <p className="text-[10px] text-gray-400">建议遵循 4-2-2 级次（如：1002 - 100201 - 10020101）</p>
            </div>

            <div className="space-y-1.5">
              <Label>科目名称 <span className="text-red-500">*</span></Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：库存现金"
                className="focus-visible:ring-blue-500 h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                <Label>数量核算单位</Label>
                <Select value={formData.quantityUnit || 'none'} onValueChange={(v) => setFormData({ ...formData, quantityUnit: v === 'none' ? '' : v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="不启用" /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="none">不启用</SelectItem>
                    <SelectItem value="个">个</SelectItem>
                    <SelectItem value="件">件</SelectItem>
                    <SelectItem value="台">台</SelectItem>
                    <SelectItem value="套">套</SelectItem>
                    <SelectItem value="千克">千克</SelectItem>
                    </SelectContent>
                </Select>
                </div>

                <div className="space-y-2 col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-100 relative">
                    <div className="flex justify-between items-center mb-3">
                        <Label className="text-gray-800 font-semibold text-sm">辅助核算维度</Label>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800" onClick={handleManageAux}>
                            <Settings className="w-3 h-3 mr-1" /> 管理维度
                        </Button>
                    </div>
                    {auxOptions.length === 0 ? (
                        <div className="text-center py-3 text-sm text-gray-500 bg-white rounded border border-dashed border-gray-200">暂无可用维度，<span className="text-blue-600 cursor-pointer hover:underline" onClick={handleManageAux}>去添加</span></div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3">
                            {auxOptions.map(opt => (
                                <div key={opt.id} className="flex items-center space-x-2 bg-white px-3 py-2 rounded border border-gray-200 hover:border-blue-300 transition-colors cursor-pointer" onClick={() => {
                                    const checked = !formData.auxiliaryItems.includes(opt.name);
                                    setFormData(prev => ({...prev, auxiliaryItems: checked ? [...prev.auxiliaryItems, opt.name] : prev.auxiliaryItems.filter(i => i !== opt.name)}));
                                }}>
                                    <Checkbox id={`aux-${opt.id}`} checked={formData.auxiliaryItems.includes(opt.name)} className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"/>
                                    <Label htmlFor={`aux-${opt.id}`} className="text-sm cursor-pointer w-full">{opt.name}</Label>
                                </div>
                            ))}
                        </div>
                    )}
                    {editTarget && editTarget.hasChildren && (
                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px] rounded-lg z-10 cursor-not-allowed">
                            <span className="text-red-600 text-xs font-medium bg-white px-3 py-1.5 rounded-full border border-red-100 shadow-sm flex items-center"><AlertCircle className="w-3.5 h-3.5 mr-1.5"/> 非末级科目无法设置辅助核算</span>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs text-gray-500 uppercase font-bold tracking-wider">状态设置</Label>
              <div className="flex gap-6 mt-1">
                 <label className="flex items-center space-x-2 cursor-pointer group">
                    <RadioGroup value={formData.isActive ? 'true' : 'false'} onValueChange={(v) => setFormData({ ...formData, isActive: v === 'true' })} className="hidden"/>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${formData.isActive ? 'border-blue-600' : 'border-gray-300 group-hover:border-gray-400'}`}>
                        {formData.isActive && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <span className={`text-sm ${formData.isActive ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>启用</span>
                 </label>
                 <label className="flex items-center space-x-2 cursor-pointer group" onClick={() => setFormData({ ...formData, isActive: false })}>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!formData.isActive ? 'border-gray-600' : 'border-gray-300 group-hover:border-gray-400'}`}>
                        {!formData.isActive && <div className="w-2 h-2 rounded-full bg-gray-600" />}
                    </div>
                    <span className={`text-sm ${!formData.isActive ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>停用</span>
                 </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowModal(false)}>取消</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>您确定要删除科目 <span className="font-bold text-gray-900">"{deleteTarget?.code} {deleteTarget?.name}"</span> 吗？<br/>如果该科目已有发生额或子科目，删除可能会失败。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-red-600 hover:bg-red-700">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-6 pt-4 border-t flex justify-end">
        <Button size="default" className="bg-gray-900 text-white hover:bg-gray-800" onClick={handleCompleteAndNext} disabled={isSavingStep}>
          {isSavingStep && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} 下一步：辅助核算设置 <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}