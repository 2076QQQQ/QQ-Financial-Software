import { useState, useEffect, Fragment } from 'react';
import { ChevronRight, ChevronDown, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { 
  updateInitialBalances, 
  batchUpdateInitialBalances,
  getAllFundAccounts,
  updateFundAccount,
  getSubjectInitialBalance,
  getAllSubjects
} from '../../lib/mockData';
import { completeAccountBook } from '@/lib/api/auth';

// 科目数据结构
interface Subject {
  id: string;
  code: string;
  name: string;
  category: '资产' | '负债' | '所有者权益' | '成本' | '损益';
  direction: '借' | '贷';
  hasAuxiliary: boolean;
  auxiliaryType?: string; // 客户、供应商等
  parentId?: string;
  initialBalance?: number;
  debitAccumulated?: number;
  creditAccumulated?: number;
  yearBeginBalance?: number;
  updatedAt?: string;
  updatedBy?: string;
}

// 辅助核算项
interface AuxiliaryItem {
  id: string;
  subjectId: string;
  name: string; // 张三、李四等
  initialBalance?: number;
  debitAccumulated?: number;
  creditAccumulated?: number;
  yearBeginBalance?: number;
}

// 从会计科目管理获取最新科目列表

// 从会计科目管理加载辅助核算项目
const loadAuxiliaryItems = (): AuxiliaryItem[] => {
  const allSubjects = getAllSubjects();
  const items: AuxiliaryItem[] = [];
  
  allSubjects.forEach(subject => {
    if (subject.auxiliaryItems && subject.auxiliaryItems.length > 1) {
      // auxiliaryItems[0]是辅助类型（如"客户"、"供应商"）
      // 从auxiliaryItems[1]开始是实际的辅助项（如"张三公司"）
      for (let i = 1; i < subject.auxiliaryItems.length; i++) {
        items.push({
          id: `aux-${subject.id}-${i}`,
          subjectId: subject.id,
          name: subject.auxiliaryItems[i],
          initialBalance: 0,
          debitAccumulated: 0,
          creditAccumulated: 0,
          yearBeginBalance: 0
        });
      }
    }
  });
  
  return items;
};

interface InitialDataEntryProps {
  onComplete?: () => void;
  onInitialDataComplete?: () => void;
}

export default function InitialDataEntry({ onComplete, onInitialDataComplete }: InitialDataEntryProps = {}) {
  const [activeTab, setActiveTab] = useState<'资产' | '负债' | '所有者权益' | '成本' | '损益'>('资产');
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    // 从会计科目管理获取最新的科目列表
    const allSubjects = getAllSubjects();
    const fundAccounts = getAllFundAccounts();
    
    // 将会计科目转换为期初数据格式
    const initialSubjects = allSubjects
      .filter(s => s.isActive) // 只显示启用的科目
      .map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        category: s.category as '资产' | '负债' | '所有者权益' | '成本' | '损益',
        direction: s.direction,
        hasAuxiliary: (s.auxiliaryItems && s.auxiliaryItems.length > 0) || false,
        auxiliaryType: s.auxiliaryItems?.[0] || undefined,
        parentId: s.parentId,
        initialBalance: 0,
        debitAccumulated: 0,
        creditAccumulated: 0,
        yearBeginBalance: 0
      }));
    
    // 汇总资金账户的期初余额
    const cashAccounts = fundAccounts.filter(a => a.relatedSubjectCode === '1001');
    const totalCash = cashAccounts.reduce((sum, a) => sum + a.initialBalance, 0);
    const cashSubject = initialSubjects.find(s => s.code === '1001');
    if (cashSubject) {
      cashSubject.initialBalance = totalCash;
      cashSubject.yearBeginBalance = totalCash;
    }
    
    const bankAccounts = fundAccounts.filter(a => a.relatedSubjectCode === '1002');
    const totalBank = bankAccounts.reduce((sum, a) => sum + a.initialBalance, 0);
    const bankSubject = initialSubjects.find(s => s.code === '1002');
    if (bankSubject) {
      bankSubject.initialBalance = totalBank;
      bankSubject.yearBeginBalance = totalBank;
    }
    
    return initialSubjects;
  });
  const [auxiliaryItems, setAuxiliaryItems] = useState<AuxiliaryItem[]>(() => loadAuxiliaryItems());
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 监听会计科目和资金账户变化
  useEffect(() => {
    // 从会计科目管理重新加载科目列表
    const allSubjects = getAllSubjects();
    const fundAccounts = getAllFundAccounts();
    
    const updatedSubjects = allSubjects
      .filter(s => s.isActive)
      .map(s => {
        // 查找是否已有期初数据
        const existingSubject = subjects.find(old => old.code === s.code);
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          category: s.category as '资产' | '负债' | '所有者权益' | '成本' | '损益',
          direction: s.direction,
          hasAuxiliary: (s.auxiliaryItems && s.auxiliaryItems.length > 0) || false,
          auxiliaryType: s.auxiliaryItems?.[0] || undefined,
          parentId: s.parentId,
          // 保留已录入的期初数据
          initialBalance: existingSubject?.initialBalance || 0,
          debitAccumulated: existingSubject?.debitAccumulated || 0,
          creditAccumulated: existingSubject?.creditAccumulated || 0,
          yearBeginBalance: existingSubject?.yearBeginBalance || 0,
          updatedAt: existingSubject?.updatedAt,
          updatedBy: existingSubject?.updatedBy
        };
      });
    
    // 同步资金账户的期初余额（包括子科目）
    fundAccounts.forEach(account => {
      // 找到资金账户关联的科目
      const relatedSubject = updatedSubjects.find(s => s.code === account.relatedSubjectCode);
      if (relatedSubject) {
        // 如果科目有子科目，同步到对应的子科目
        // 如果科目没有子科目，直接更新科目本身
        const hasChildren = updatedSubjects.some(s => s.parentId === relatedSubject.id);
        
        if (!hasChildren) {
          // 没有子科目，直接更新
          relatedSubject.initialBalance = account.initialBalance;
          relatedSubject.yearBeginBalance = account.initialBalance;
        } else {
          // 有子科目，需要根据账户名称找到对应的子科目
          // 资金账户的名称应该匹配子科目的名称
          const matchingChild = updatedSubjects.find(s => 
            s.parentId === relatedSubject.id && s.name === (account as any).name
          );
          if (matchingChild) {
            matchingChild.initialBalance = account.initialBalance;
            matchingChild.yearBeginBalance = account.initialBalance;
          }
        }
      }
    });
    
    // 计算父科目的合计（如果有子科目）
    updatedSubjects.forEach(parent => {
      const children = updatedSubjects.filter(s => s.parentId === parent.id);
      if (children.length > 0) {
        parent.initialBalance = children.reduce((sum, c) => sum + (c.initialBalance || 0), 0);
        parent.yearBeginBalance = children.reduce((sum, c) => sum + (c.yearBeginBalance || 0), 0);
      }
    });
    
    setSubjects(updatedSubjects);
    
    // 重新加载辅助核算项目
    setAuxiliaryItems(loadAuxiliaryItems());
  }, []); // 只在初始加载时执行一次

  // 切换展开/收起
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // 计算年初余额：年初余额 = 期初余额 - 借方累计 + 贷方累计
  const calculateYearBegin = (initial: number, debit: number, credit: number): number => {
    return initial - debit + credit;
  };

  // 更新科目数据
  const updateSubjectData = (
    subjectId: string, 
    field: 'initialBalance' | 'debitAccumulated' | 'creditAccumulated', 
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    
    setSubjects(subjects.map(s => {
      if (s.id === subjectId) {
        const updated = { ...s, [field]: numValue };
        // 实时计算年初余额
        updated.yearBeginBalance = calculateYearBegin(
          updated.initialBalance || 0,
          updated.debitAccumulated || 0,
          updated.creditAccumulated || 0
        );
        updated.updatedAt = new Date().toLocaleString('zh-CN');
        updated.updatedBy = '当前用户';
        
        // 如果修改的是期初余额，且是资金类科目（1001库存现金或1002银行存款），需要同步到资金账户
        if (field === 'initialBalance' && (s.code === '1001' || s.code === '1002')) {
          syncToFundAccounts(s.code, numValue);
        }
        
        return updated;
      }
      return s;
    }));
  };

  // 同步期初余额到资金账户
  const syncToFundAccounts = (subjectCode: string, totalInitialBalance: number) => {
    const fundAccounts = getAllFundAccounts();
    
    // 找到所有关联该科目的资金账户
    const relatedAccounts = fundAccounts.filter(account => account.relatedSubjectCode === subjectCode);
    
    if (relatedAccounts.length === 0) {
      // 没有关联的资金账户，无需同步
      return;
    } else if (relatedAccounts.length === 1) {
      // 只有一个资金账户，直接更新
      updateFundAccount(relatedAccounts[0].id, {
        initialBalance: totalInitialBalance
      });
    } else {
      // 多个资金账户的情况：
      // 为了避免循环更新，只在用户主动修改期初数据时才同步
      // 此处暂不处理，因为多账户的余额分配逻辑需要用户手动在资金账户管理中设置
      console.warn(`科目 ${subjectCode} 关联了多个资金账户，请在资金账户管理中分别设置期初余额`);
    }
  };

  // 更新辅助核算数据
  const updateAuxiliaryData = (
    auxId: string,
    field: 'initialBalance' | 'debitAccumulated' | 'creditAccumulated',
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    
    setAuxiliaryItems(auxiliaryItems.map(item => {
      if (item.id === auxId) {
        const updated = { ...item, [field]: numValue };
        updated.yearBeginBalance = calculateYearBegin(
          updated.initialBalance || 0,
          updated.debitAccumulated || 0,
          updated.creditAccumulated || 0
        );
        return updated;
      }
      return item;
    }));
  };

  // 计算父科目的汇总值
  const getSubjectTotal = (subjectId: string, field: 'initialBalance' | 'debitAccumulated' | 'creditAccumulated' | 'yearBeginBalance'): number => {
    const items = auxiliaryItems.filter(item => item.subjectId === subjectId);
    return items.reduce((sum, item) => sum + (item[field] || 0), 0);
  };

  // 保存并试算
  const handleSaveAndCheck = async () => {
    setIsSaving(true);
    
    // 模拟保存延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 试算平衡：资产期初余额 = 负债期初余额 + 所有者权益期初余额
    // 只计算一级科目（parentId为空或undefined的科目）
    const assetTotal = subjects
      .filter(s => s.category === '资产' && !s.parentId)
      .reduce((sum, s) => {
        if (s.hasAuxiliary) {
          return sum + getSubjectTotal(s.id, 'initialBalance');
        }
        return sum + (s.initialBalance || 0);
      }, 0);
    
    const liabilityTotal = subjects
      .filter(s => s.category === '负债' && !s.parentId)
      .reduce((sum, s) => {
        if (s.hasAuxiliary) {
          return sum + getSubjectTotal(s.id, 'initialBalance');
        }
        return sum + (s.initialBalance || 0);
      }, 0);
    
    const equityTotal = subjects
      .filter(s => s.category === '所有者权益' && !s.parentId)
      .reduce((sum, s) => {
        if (s.hasAuxiliary) {
          return sum + getSubjectTotal(s.id, 'initialBalance');
        }
        return sum + (s.initialBalance || 0);
      }, 0);
    
    const difference = assetTotal - (liabilityTotal + equityTotal);
    
    // 获取资金账户期初余额（1001库存现金 + 1002银行存款）
    const cashBalance = subjects.find(s => s.code === '1001')?.initialBalance || 0;
    const bankBalance = subjects.find(s => s.code === '1002')?.initialBalance || 0;
    
    // 更新全局数据（用于首页显示）
    updateInitialBalances({
      cash: cashBalance,
      bankDeposit: bankBalance
    });
    
    // 批量更新所有科目的期初余额到新的数据结构
    const allInitialBalances = subjects.map(s => {
      const direction = s.direction;
      const balance = s.initialBalance || 0;
      
      // 根据科目余额方向确定借贷方
      if (direction === '借') {
        return {
          subjectCode: s.code,
          subjectName: s.name,
          debitBalance: balance > 0 ? balance : 0,
          creditBalance: balance < 0 ? -balance : 0
        };
      } else {
        return {
          subjectCode: s.code,
          subjectName: s.name,
          debitBalance: balance < 0 ? -balance : 0,
          creditBalance: balance > 0 ? balance : 0
        };
      }
    });
    
    batchUpdateInitialBalances(allInitialBalances);
    
    setIsSaving(false);
    
    if (Math.abs(difference) < 0.01) {
      // 试算平衡
      setShowSuccessDialog(true);
    } else {
      // 试算不平衡
      alert(`试算不平衡！\n\n资产类期初余额：${assetTotal.toFixed(2)} 元\n负债+权益期初余额：${(liabilityTotal + equityTotal).toFixed(2)} 元\n差异金额：${difference.toFixed(2)} 元\n\n请检查并修改数据。`);
    }
  };

  // 确认完成初始化
  const handleConfirmComplete = async () => {
    setShowSuccessDialog(false);
    try { await completeAccountBook(); } catch {}
    if (onInitialDataComplete) onInitialDataComplete();
    if (onComplete) onComplete();
  };

  // 计算子科目合计
  const getChildrenTotal = (parentId: string, field: 'initialBalance' | 'debitAccumulated' | 'creditAccumulated'): number => {
    return subjects
      .filter(s => s.parentId === parentId)
      .reduce((sum, child) => sum + (child[field] || 0), 0);
  };
  
  // 检查是否有子科目
  const hasChildren = (subjectId: string): boolean => {
    return subjects.some(s => s.parentId === subjectId);
  };

  // 渲染树状表格
  const renderSubjectRows = (categorySubjects: Subject[]): any[] => {
    const rows: any[] = [];
    
    // 只渲染顶级科目（没有parentId的）
    const topLevelSubjects = categorySubjects.filter(s => !s.parentId);
    
    topLevelSubjects.forEach(subject => {
      const auxItems = auxiliaryItems.filter(item => item.subjectId === subject.id);
      const isExpanded = expandedIds.includes(subject.id);
      const hasAux = subject.hasAuxiliary && auxItems.length > 0;
      const hasChild = hasChildren(subject.id);
      const childSubjects = subjects.filter(s => s.parentId === subject.id);
      
      // 父级科目行
      rows.push(
        <TableRow key={subject.id}>
          <TableCell>
            <div className="flex items-center">
              {(hasAux || hasChild) ? (
                <button
                  onClick={() => toggleExpand(subject.id)}
                  className="mr-2 p-1 hover:bg-gray-100 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              ) : (
                <span className="w-8 inline-block" />
              )}
              {subject.code}
            </div>
          </TableCell>
          <TableCell>
            {subject.name}
            {subject.hasAuxiliary && (
              <Badge variant="outline" className="ml-2 text-xs">
                {subject.auxiliaryType}
              </Badge>
            )}
          </TableCell>
          <TableCell>
            <Badge variant={subject.direction === '借' ? 'default' : 'secondary'}>
              {subject.direction}
            </Badge>
          </TableCell>
          <TableCell>
            <Input
              type="number"
              step="0.01"
              value={(hasAux || hasChild) ? (hasAux ? getSubjectTotal(subject.id, 'initialBalance') : getChildrenTotal(subject.id, 'initialBalance')).toFixed(2) : (subject.initialBalance || '')}
              onChange={(e) => !(hasAux || hasChild) && updateSubjectData(subject.id, 'initialBalance', e.target.value)}
              disabled={hasAux || hasChild}
              className={(hasAux || hasChild) ? 'bg-gray-50 text-gray-500' : ''}
              placeholder="0.00"
            />
          </TableCell>
          <TableCell>
            <Input
              type="number"
              step="0.01"
              value={(hasAux || hasChild) ? (hasAux ? getSubjectTotal(subject.id, 'debitAccumulated') : getChildrenTotal(subject.id, 'debitAccumulated')).toFixed(2) : (subject.debitAccumulated || '')}
              onChange={(e) => !(hasAux || hasChild) && updateSubjectData(subject.id, 'debitAccumulated', e.target.value)}
              disabled={hasAux || hasChild}
              className={(hasAux || hasChild) ? 'bg-gray-50 text-gray-500' : ''}
              placeholder="0.00"
            />
          </TableCell>
          <TableCell>
            <Input
              type="number"
              step="0.01"
              value={(hasAux || hasChild) ? (hasAux ? getSubjectTotal(subject.id, 'creditAccumulated') : getChildrenTotal(subject.id, 'creditAccumulated')).toFixed(2) : (subject.creditAccumulated || '')}
              onChange={(e) => !(hasAux || hasChild) && updateSubjectData(subject.id, 'creditAccumulated', e.target.value)}
              disabled={hasAux || hasChild}
              className={(hasAux || hasChild) ? 'bg-gray-50 text-gray-500' : ''}
              placeholder="0.00"
            />
          </TableCell>
          <TableCell>
            <span className="text-gray-700">
              {hasAux 
                ? getSubjectTotal(subject.id, 'yearBeginBalance').toFixed(2)
                : hasChild
                  ? childSubjects.reduce((sum, child) => sum + (child.yearBeginBalance || 0), 0).toFixed(2)
                  : (subject.yearBeginBalance || 0).toFixed(2)
              }
            </span>
          </TableCell>
          <TableCell className="text-sm text-gray-500">{subject.updatedAt || '-'}</TableCell>
          <TableCell className="text-sm text-gray-500">{subject.updatedBy || '-'}</TableCell>
        </TableRow>
      );
      
      // 子科目行
      if (isExpanded && hasChild) {
        childSubjects.forEach(child => {
          rows.push(
            <TableRow key={child.id} className="bg-gray-50">
              <TableCell>
                <div className="pl-12 text-gray-600">{child.code}</div>
              </TableCell>
              <TableCell className="text-gray-700">{child.name}</TableCell>
              <TableCell>
                <Badge variant={child.direction === '借' ? 'default' : 'secondary'} className="opacity-70">
                  {child.direction}
                </Badge>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={child.initialBalance || ''}
                  onChange={(e) => updateSubjectData(child.id, 'initialBalance', e.target.value)}
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={child.debitAccumulated || ''}
                  onChange={(e) => updateSubjectData(child.id, 'debitAccumulated', e.target.value)}
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={child.creditAccumulated || ''}
                  onChange={(e) => updateSubjectData(child.id, 'creditAccumulated', e.target.value)}
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <span className="text-gray-700">
                  {(child.yearBeginBalance || 0).toFixed(2)}
                </span>
              </TableCell>
              <TableCell className="text-sm text-gray-500">{child.updatedAt || '-'}</TableCell>
              <TableCell className="text-sm text-gray-500">{child.updatedBy || '-'}</TableCell>
            </TableRow>
          );
        });
      }
      
      // 辅助核算子项行
      if (isExpanded && hasAux) {
        auxItems.forEach(auxItem => {
          rows.push(
            <TableRow key={auxItem.id} className="bg-blue-50">
              <TableCell>
                <div className="pl-12 text-gray-600">{subject.code}-{auxItem.id.slice(-2)}</div>
              </TableCell>
              <TableCell className="text-gray-700">{auxItem.name}</TableCell>
              <TableCell>
                <Badge variant={subject.direction === '借' ? 'default' : 'secondary'} className="opacity-70">
                  {subject.direction}
                </Badge>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={auxItem.initialBalance || ''}
                  onChange={(e) => updateAuxiliaryData(auxItem.id, 'initialBalance', e.target.value)}
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={auxItem.debitAccumulated || ''}
                  onChange={(e) => updateAuxiliaryData(auxItem.id, 'debitAccumulated', e.target.value)}
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={auxItem.creditAccumulated || ''}
                  onChange={(e) => updateAuxiliaryData(auxItem.id, 'creditAccumulated', e.target.value)}
                  placeholder="0.00"
                />
              </TableCell>
              <TableCell>
                <span className="text-gray-700">
                  {(auxItem.yearBeginBalance || 0).toFixed(2)}
                </span>
              </TableCell>
              <TableCell className="text-sm text-gray-500">-</TableCell>
              <TableCell className="text-sm text-gray-500">-</TableCell>
            </TableRow>
          );
        });
      }
    });
    
    return rows;
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-gray-900 mb-1">期初数据录入</h1>
        <p className="text-gray-600">录入新账套启用日前的期初余额数据，并确保试算平衡</p>
      </div>

      {/* Tab 导航 + 保存按钮 */}
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="资产">资产</TabsTrigger>
            <TabsTrigger value="负债">负债</TabsTrigger>
            <TabsTrigger value="所有者权益">所有者权益</TabsTrigger>
            <TabsTrigger value="成本">成本</TabsTrigger>
            <TabsTrigger value="损益">损益</TabsTrigger>
          </TabsList>
          <Button onClick={handleSaveAndCheck} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? '保存中...' : '保存并试算'}
          </Button>
        </div>

        {/* 数据表格 */}
        {(['资产', '负债', '所有者权益', '成本', '损益'] as const).map(category => (
          <TabsContent key={category} value={category} className="mt-0">
            <div className="bg-white rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>科目编码</TableHead>
                    <TableHead>科目名称</TableHead>
                    <TableHead>余额方向</TableHead>
                    <TableHead>期初余额</TableHead>
                    <TableHead>借方累计</TableHead>
                    <TableHead>贷方累计</TableHead>
                    <TableHead>年初余额</TableHead>
                    <TableHead>更新时间</TableHead>
                    <TableHead>更新人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renderSubjectRows(subjects.filter(s => s.category === category))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* 试算平衡成功对话框 */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              试算平衡成功！
            </DialogTitle>
            <DialogDescription>
              恭喜您，期初数据已通过试算平衡校验。资产类期初余额等于负债类和所有者权益类期初余额之和。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              点击下方按钮确认完成期初数据初始化，系统将为您开启所有业务功能。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>
              继续修改
            </Button>
            <Button onClick={handleConfirmComplete} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              确认完成期初初始化
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}