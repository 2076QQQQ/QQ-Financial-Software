import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
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
  ClosingTemplate as ClosingTemplateType
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

// 模板行类型已在mockData中定义，无需重复定义

export default function ClosingTemplateManagement() {
  // 模板列表 - 从mockData加载
  const [templates, setTemplates] = useState<ClosingTemplateType[]>([]);
  
  // 加载模板数据
  useEffect(() => {
    setTemplates(getAllClosingTemplates());
  }, []);
  
  // 对话框状态
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<ClosingTemplateType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClosingTemplateType | null>(null);
  
  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    lines: [] as ClosingTemplateLine[]
  });
  
  // 新增
  const handleAdd = () => {
    setEditTarget(null);
    setFormData({
      name: '',
      lines: [
        {
          id: `l1`,
          subjectCode: '',
          subjectName: '',
          source: '',
          direction: 'debit' as const
        },
        {
          id: `l2`,
          subjectCode: '',
          subjectName: '',
          source: '',
          direction: 'credit' as const
        }
      ]
    });
    setShowEditDialog(true);
  };
  
  // 编辑
  const handleEdit = (template: ClosingTemplateType) => {
    setEditTarget(template);
    setFormData({
      name: template.name,
      lines: [...template.lines]
    });
    setShowEditDialog(true);
  };
  
  // 删除
  const handleDelete = (template: ClosingTemplateType) => {
    setDeleteTarget(template);
  };
  
  const confirmDelete = () => {
    if (!deleteTarget) return;
    
    deleteClosingTemplate(deleteTarget.id);
    setTemplates(getAllClosingTemplates());
    setDeleteTarget(null);
  };
  
  // 切换启用状态
  const toggleEnabled = (id: string) => {
    toggleClosingTemplateEnabled(id);
    setTemplates(getAllClosingTemplates());
  };
  
  // 添加分录行
  const addLine = () => {
    const newLine = {
      id: `l${Date.now()}`,
      subjectCode: '',
      subjectName: '',
      source: '',
      direction: 'debit' as 'debit' | 'credit'
    };
    setFormData({
      ...formData,
      lines: [...formData.lines, newLine]
    });
  };
  
  // 删除分录行
  const removeLine = (lineId: string) => {
    setFormData({
      ...formData,
      lines: formData.lines.filter(l => l.id !== lineId)
    });
  };
  
  // 更新分录行
  const updateLine = (lineId: string, field: keyof TemplateLine, value: any) => {
    setFormData({
      ...formData,
      lines: formData.lines.map(l => 
        l.id === lineId ? { ...l, [field]: value } : l
      )
    });
  };
  
  // 保存
  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('请输入模板名称');
      return;
    }
    
    if (formData.lines.length < 2) {
      alert('至少需要2行分录（借方和贷方）');
      return;
    }
    
    if (editTarget) {
      // 编辑模式
      updateClosingTemplate(editTarget.id, {
        name: formData.name,
        lines: formData.lines
      });
    } else {
      // 新增模式
      const newTemplate: ClosingTemplateType = {
        id: `t${Date.now()}`,
        name: formData.name,
        isEnabled: false,
        lines: formData.lines
      };
      addClosingTemplate(newTemplate);
    }
    
    setTemplates(getAllClosingTemplates());
    setShowEditDialog(false);
  };
  
  return (
    <div className="space-y-4">
      {/* 操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          启用的模板将在期末检查中显示为卡片
        </div>
        <Button onClick={handleAdd} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          新增模板
        </Button>
      </div>
      
      {/* 模板列表 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">启用</TableHead>
              <TableHead>摘要（模板名称）</TableHead>
              <TableHead>会计科目</TableHead>
              <TableHead>取值</TableHead>
              <TableHead>方向</TableHead>
              <TableHead className="w-[120px] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                  暂无自定义模板，点击"新增模板"创建
                </TableCell>
              </TableRow>
            ) : (
              templates.map(template => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Switch
                      checked={template.isEnabled}
                      onCheckedChange={() => toggleEnabled(template.id)}
                    />
                  </TableCell>
                  <TableCell>{template.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {template.lines.map(line => (
                        <div key={line.id} className="text-sm">
                          {line.subjectCode} {line.subjectName}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {template.lines.map(line => (
                        <div key={line.id} className="text-sm text-gray-600">
                          {line.source || '-'}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {template.lines.map(line => (
                        <div key={line.id}>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            line.direction === 'debit'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {line.direction === 'debit' ? '借' : '贷'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(template)}
                        className="h-7 w-7 p-0"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template)}
                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* 新增/编辑对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{editTarget ? '编辑结转模板' : '新增结转模板'}</DialogTitle>
            <DialogDescription>
              定义凭证的分录规则（科目、取值、方向）
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模板名称（摘要） <span className="text-red-500">*</span></Label>
              <Input
                placeholder="例如：结转制造费用"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>凭证分录</Label>
                <Button onClick={addLine} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  添加行
                </Button>
              </div>
              
              <div className="border rounded-lg divide-y">
                {formData.lines.map((line, index) => (
                  <div key={line.id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">分录 {index + 1}</span>
                      {formData.lines.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(line.id)}
                          className="h-6 text-red-600"
                        >
                          删除
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">科目代码</Label>
                        <Input
                          placeholder="例如：4001"
                          value={line.subjectCode}
                          onChange={(e) => updateLine(line.id, 'subjectCode', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">科目名称</Label>
                        <Input
                          placeholder="例如：生产成本"
                          value={line.subjectName}
                          onChange={(e) => updateLine(line.id, 'subjectName', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">取值来源</Label>
                        <Input
                          placeholder="例如：4101制造费用"
                          value={line.source}
                          onChange={(e) => updateLine(line.id, 'source', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">方向</Label>
                        <Select
                          value={line.direction}
                          onValueChange={(v) => updateLine(line.id, 'direction', v as 'debit' | 'credit')}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="debit">借方</SelectItem>
                            <SelectItem value="credit">贷方</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 删除确认对话框 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板"{deleteTarget?.name}"吗？此操作不可逆。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
