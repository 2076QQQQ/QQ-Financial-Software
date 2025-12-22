import { useState } from 'react';
import Decimal from 'decimal.js';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'; 
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VoucherPreviewProps {
  voucher: any;
  onSave: (voucher: any) => void;
  onCancel: () => void;
}

export default function VoucherPreview({ voucher, onSave, onCancel }: VoucherPreviewProps) {
  const [editedVoucher, setEditedVoucher] = useState(voucher);
  
  // 更新分录行
  const updateLine = (lineId: string, field: string, value: any) => {
    const updatedLines = editedVoucher.lines.map((line: any) => 
      line.id === lineId ? { ...line, [field]: value } : line
    );
    
    // 重新计算合计
    const debitTotal = updatedLines.reduce((sum: number, line: any) => 
      new Decimal(sum).plus(line.debitAmount || 0).toNumber(), 0
    );
    const creditTotal = updatedLines.reduce((sum: number, line: any) => 
      new Decimal(sum).plus(line.creditAmount || 0).toNumber(), 0
    );
    
    setEditedVoucher({
      ...editedVoucher,
      lines: updatedLines,
      debitTotal,
      creditTotal
    });
  };
  
  // 检查是否平衡
  const isBalanced = Math.abs(editedVoucher.debitTotal - editedVoucher.creditTotal) < 0.01;
  
  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>凭证预览</DialogTitle>
          <DialogDescription>
            系统已自动填入分录，请确认无误后保存
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 凭证头 */}
          <div className="grid grid-cols-6 gap-3">
            <div className="space-y-2">
              <Label>凭证字</Label>
              <Select value={editedVoucher.voucherType} disabled>
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
            <div className="space-y-2">
              <Label>凭证号</Label>
              <Input value={editedVoucher.voucherNumber} readOnly />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>日期</Label>
              <Input type="date" value={editedVoucher.voucherDate} readOnly />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>附件数</Label>
              <Input type="number" value={editedVoucher.attachments} readOnly />
            </div>
          </div>
          
          {/* 凭证体 */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">序号</TableHead>
                  <TableHead className="w-[200px]">摘要</TableHead>
                  <TableHead className="w-[200px]">会计科目</TableHead>
                  <TableHead className="text-right w-[140px]">借方金额</TableHead>
                  <TableHead className="text-right w-[140px]">贷方金额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedVoucher.lines.map((line: any, index: number) => (
                  <TableRow key={line.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Input
                        value={line.summary}
                        onChange={(e) => updateLine(line.id, 'summary', e.target.value)}
                        className="border-0 bg-yellow-50"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {line.subjectCode} {line.subjectName}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.debitAmount}
                        onChange={(e) => updateLine(line.id, 'debitAmount', e.target.value)}
                        className="text-right border-0 bg-yellow-50"
                        disabled={!!line.creditAmount}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.creditAmount}
                        onChange={(e) => updateLine(line.id, 'creditAmount', e.target.value)}
                        className="text-right border-0 bg-yellow-50"
                        disabled={!!line.debitAmount}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* 合计行 */}
                <TableRow className="bg-gray-50">
                  <TableCell colSpan={3} className="text-center text-gray-900">
                    合计
                  </TableCell>
                  <TableCell className={`text-right ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    ¥ {editedVoucher.debitTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={`text-right ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    ¥ {editedVoucher.creditTotal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          
          {/* 凭证尾 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>制单人</Label>
              <Input value={editedVoucher.maker} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Input value="待保存" readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>平衡状态</Label>
              <Input 
                value={isBalanced ? '✓ 借贷平衡' : '✗ 借贷不平'} 
                readOnly 
                className={isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}
              />
            </div>
          </div>
          
          {!isBalanced && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-700">
                ⚠️ 凭证借贷不平衡，请检查金额是否正确
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button 
            onClick={() => onSave(editedVoucher)}
            disabled={!isBalanced}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
