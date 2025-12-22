import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles } from 'lucide-react'; // 引入 Sparkles 增加一点氛围感

interface WelcomeModalProps {
  open: boolean;
  onClose: () => void;
  onCreateClick: () => void; // ✅ 核心：点击后触发父组件的新建逻辑
}

export default function WelcomeModal({ open, onClose, onCreateClick }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto bg-blue-100 p-3 rounded-full mb-2">
             <Sparkles className="w-6 h-6 text-blue-600" />
          </div>
          <DialogTitle className="text-center text-xl">欢迎使用财务系统</DialogTitle>
          <DialogDescription className="text-center pt-2">
            您还没有创建任何账套。
            <br/>
            请先建立您的第一个会计账套以开始记账。
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 flex flex-col items-center justify-center space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-200 w-full text-center">
            <p className="text-sm text-gray-500">
              💡 账套是您管理财务数据的基本单位，包含会计年度、纳税性质（一般纳税人/小规模）等关键信息。
            </p>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button 
            onClick={() => {
                onCreateClick();
                // 可选：点击后自动关闭欢迎弹窗，虽然后续会有新弹窗覆盖
                onClose(); 
            }} 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 min-w-[200px]"
          >
            <Plus className="w-4 h-4 mr-2" />
            立即创建第一个账套
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}