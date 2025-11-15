import { BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

interface WelcomeModalProps {
  open: boolean;
  onCreateAccountBook: () => void;
}

export default function WelcomeModal({ open, onCreateAccountBook }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <BookOpen className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <DialogTitle className="text-center">欢迎！请先创建您的账套</DialogTitle>
          <DialogDescription className="text-center">
            您必须至少创建一个账套才能开始使用本系统。
            <br />
            账套是一个独立的会计核算单元，用于管理特定期间的财务数据。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:justify-center">
          <Button onClick={onCreateAccountBook} className="w-full sm:w-auto">
            <BookOpen className="w-4 h-4 mr-2" />
            立即创建账套
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
