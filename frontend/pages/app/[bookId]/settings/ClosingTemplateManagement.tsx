import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Plus, Edit, Trash2, Loader2, RefreshCw, FileText } from 'lucide-react'; // 增加 FileText 图标
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';     
import {
  getAllClosingTemplates,
  addClosingTemplate,
  updateClosingTemplate,
  deleteClosingTemplate,
  toggleClosingTemplateEnabled,
  getAllSubjects, 
  ClosingTemplate,       
  ClosingTemplateLine    
} from '@/lib/mockData';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from 'sonner';

// 定义接口以确保包含 accountBookId
interface ExtendedClosingTemplate extends ClosingTemplate {
  accountBookId?: string;
}

export default function ClosingTemplateManagement() {
  const router = useRouter();
  const { bookId } = router.query;
  const currentBookId = router.isReady ? (Array.isArray(bookId) ? bookId[0] : bookId) : null;
  
  const [templates, setTemplates] = useState<ExtendedClosingTemplate[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  
  const loadData = async () => {
    if (!currentBookId) return;
    setLoading(true);
    try {
      const [templatesData, allSubjectsRaw] = await Promise.all([
          getAllClosingTemplates(currentBookId),
          getAllSubjects(currentBookId)
      ]);
      
      // ★ 核心修复 1：严格过滤，确保只显示当前账套的数据
      const filteredTemplates = (templatesData || []).filter((t: any) => t.accountBookId === currentBookId);
      setTemplates(filteredTemplates);

      // ★ 核心修复 2：科目也需要过滤账套
      const rawSubjects = (allSubjectsRaw || []).filter((s: any) => s.accountBookId === currentBookId);
      
      setSubjects(rawSubjects); 

    } catch (error) {
      console.error("加载数据失败", error);
      toast.error("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentBookId) {
        loadData();
    }
  }, [currentBookId]);
  
  // 名称查找器
  const getSubjectName = (code: string) => {
      const s = subjects.find(sub => sub.code === code);
      return s ? s.name : '未知科目';
  };

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<ExtendedClosingTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExtendedClosingTemplate | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    lines: [] as ClosingTemplateLine[]
  });
  
  const handleAdd = () => {
    setEditTarget(null);
    setFormData({
      name: '',
      lines: [
        { id: `l${Date.now()}-1`, subjectCode: '', subjectName: '', source: '', direction: 'debit' },
        { id: `l${Date.now()}-2`, subjectCode: '', subjectName: '', source: '', direction: 'credit' }
      ]
    });
    setShowEditDialog(true);
  };
  
  const handleEdit = (template: ExtendedClosingTemplate) => {
    setEditTarget(template);
    setFormData({
      name: template.name,
      lines: JSON.parse(JSON.stringify(template.lines)) 
    });
    setShowEditDialog(true);
  };
  
  const handleDelete = (template: ExtendedClosingTemplate) => {
    setDeleteTarget(template);
  };
  
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
        await deleteClosingTemplate(deleteTarget.id);
        toast.success("模板已删除");
        await loadData(); 
    } catch (error) {
        toast.error("删除失败");
    }
    setDeleteTarget(null);
  };
  
  const toggleEnabled = async (template: ExtendedClosingTemplate) => {
    const newValue = !template.isEnabled;
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, isEnabled: newValue } : t));
    try {
       await toggleClosingTemplateEnabled(template.id, newValue);
       toast.success(newValue ? "已启用" : "已禁用");
    } catch (e) {
       toast.error("操作失败");
       loadData(); 
    }
  };
  
  const addLine = () => {
    const newLine: ClosingTemplateLine = {
      id: `l${Date.now()}`,
      subjectCode: '',
      subjectName: '',
      source: '',
      direction: 'debit'
    };
    setFormData({ ...formData, lines: [...formData.lines, newLine] });
  };
  
  const removeLine = (lineId: string) => {
    setFormData({ ...formData, lines: formData.lines.filter(l => l.id !== lineId) });
  };
  
  const updateLine = (lineId: string, field: keyof ClosingTemplateLine, value: any) => {
    setFormData({
      ...formData,
      lines: formData.lines.map(l => l.id === lineId ? { ...l, [field]: value } : l)
    });
  };

  const handleSubjectChange = (lineId: string, subjectCode: string) => {
      const subject = subjects.find(s => s.code === subjectCode);
      if (subject) {
          setFormData(prev => ({
              ...prev,
              lines: prev.lines.map(l => 
                  l.id === lineId ? { 
                      ...l, 
                      subjectCode: subject.code, 
                      subjectName: subject.name 
                  } : l
              )
          }));
      }
  };
  
  const handleSave = async () => {
    if (!currentBookId) {
        toast.error("账套信息缺失");
        return;
    }
    if (!formData.name.trim()) {
      toast.error('请输入模板名称');
      return;
    }
    if (formData.lines.length < 2) {
      toast.error('至少需要2行分录');
      return;
    }
    if (formData.lines.some(l => !l.subjectCode)) {
        toast.error('请为所有分录行选择会计科目');
        return;
    }
    
    try {
        if (editTarget) {
          // 编辑模式
          await updateClosingTemplate(editTarget.id, {
            name: formData.name,
            lines: formData.lines,
            accountBookId: currentBookId // 确保ID归属
          });
          toast.success("更新成功");
        } else {
          // ★ 核心修复 3：新增时显式写入 accountBookId
          const newTemplate = {
            id: `t${Date.now()}`, 
            name: formData.name,
            isEnabled: true, 
            lines: formData.lines,
            accountBookId: currentBookId // ★ 关键修复
          };
          await addClosingTemplate(newTemplate, currentBookId);
          toast.success("创建成功");
        }
        await loadData(); 
        setShowEditDialog(false);
    } catch (e) {
        console.error("保存失败", e);
        toast.error("保存失败，请重试");
    }
  };
  
  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      {/* ★ 修复 4：添加页面标题区域 ★ */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600"/>
            结转模板
        </h1>
        <p className="text-sm text-gray-500 mt-1">
            配置期末自动结转的规则（如：计提折旧、结转损益），系统将在期末结账时自动生成对应凭证。
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <span>下表为当前账套已配置的模板：</span>
          {loading && <Loader2 className="w-3 h-3 animate-spin"/>}
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="h-8">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
            </Button>
            <Button onClick={handleAdd} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8">
            <Plus className="w-3.5 h-3.5 mr-2" />
            新增模板
            </Button>
        </div>
      </div>
      
      <div className="border rounded-lg bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="w-[80px]">启用</TableHead>
              <TableHead>摘要（模板名称）</TableHead>
              <TableHead>会计科目</TableHead>
              <TableHead>取值说明</TableHead>
              <TableHead>方向</TableHead>
              <TableHead className="w-[120px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && templates.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400"/></TableCell></TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-12">
                  <div className="flex flex-col items-center gap-2">
                    <p>当前账套暂无自定义模板</p>
                    <Button variant="link" onClick={handleAdd}>点击创建第一个模板</Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              templates.map(template => (
                <TableRow key={template.id} className="hover:bg-slate-50">
                  <TableCell>
                    <Switch
                      checked={template.isEnabled}
                      onCheckedChange={() => toggleEnabled(template)}
                      className="data-[state=checked]:bg-blue-600"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-gray-900 align-top py-4">{template.name}</TableCell>
                  <TableCell className="align-top py-4">
                    <div className="space-y-2">
                      {template.lines.map(line => (
                        <div key={line.id} className="text-sm text-gray-700 font-mono flex items-center">
                          <span className="font-semibold mr-2">{line.subjectCode}</span>
                          {/* 动态显示名称 */}
                          <span className="text-gray-600 truncate max-w-[150px]">
                              {getSubjectName(line.subjectCode) || line.subjectName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top py-4">
                    <div className="space-y-2">
                      {template.lines.map(line => (
                        <div key={line.id} className="text-sm text-gray-500 h-5 flex items-center">
                          {line.source || <span className="text-gray-300">-</span>}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top py-4">
                    <div className="space-y-2">
                      {template.lines.map(line => (
                        <div key={line.id} className="h-5 flex items-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                            line.direction === 'debit' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'
                          }`}>
                            {line.direction === 'debit' ? '借方' : '贷方'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top py-4">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(template)} className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600"><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(template)} className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? '编辑结转模板' : '新增结转模板'}</DialogTitle>
            <DialogDescription>定义凭证的分录规则。</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>模板名称 <span className="text-red-500">*</span></Label>
              <Input placeholder="例如：计提本月制造费用" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}/>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>凭证分录设置</Label>
                <Button onClick={addLine} size="sm" variant="outline" className="h-8 border-dashed"><Plus className="w-3.5 h-3.5 mr-1" />添加分录行</Button>
              </div>
              
              <div className="border rounded-lg divide-y bg-gray-50/50 overflow-hidden">
                {formData.lines.map((line, index) => (
                  <div key={line.id} className="p-4 space-y-3 hover:bg-white transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">分录行 {index + 1}</span>
                      {formData.lines.length > 2 && <Button variant="ghost" size="sm" onClick={() => removeLine(line.id)} className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50 p-0 px-2 text-xs">删除此行</Button>}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs font-normal text-gray-500">会计科目 <span className="text-red-500">*</span></Label>
                        <Select value={line.subjectCode} onValueChange={(val) => handleSubjectChange(line.id, val)}>
                            <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="请选择科目..." /></SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {/* 过滤逻辑：确保是当前账套的科目（subjects已过滤），且没有子级 */}
                                {subjects.filter(s => !subjects.some(child => String(child.code).startsWith(String(s.code)) && child.code !== s.code)).map((s) => (
                                    <SelectItem key={s.id} value={s.code}>
                                        <span className="font-mono font-medium mr-2">{s.code}</span>{s.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-1.5">
                        <Label className="text-xs font-normal text-gray-500">取值说明 (备注)</Label>
                        <Input className="h-8 text-sm bg-white" placeholder="例如：按工资总额2%计提" value={line.source} onChange={(e) => updateLine(line.id, 'source', e.target.value)}/>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-normal text-gray-500">借贷方向</Label>
                        <Select value={line.direction} onValueChange={(v) => updateLine(line.id, 'direction', v as 'debit' | 'credit')}>
                          <SelectTrigger className="h-8 bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="debit">借方</SelectItem><SelectItem value="credit">贷方</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除模板？</AlertDialogTitle>
            <AlertDialogDescription>删除后，期末结账时将无法自动生成该凭证。此操作不可逆。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">确认删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}