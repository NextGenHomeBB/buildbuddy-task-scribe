import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MaterialsTickList } from './MaterialsTickList';

interface MaterialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  onSave: () => void;
}

export const MaterialsModal = ({ 
  open, 
  onOpenChange, 
  taskId, 
  onSave 
}: MaterialsModalProps) => {
  const handleSave = () => {
    onSave();
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Task Materials</DialogTitle>
        </DialogHeader>
        <MaterialsTickList
          taskId={taskId}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
};