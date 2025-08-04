import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMaterialsForTask, useMarkMaterialUsed, TaskMaterial } from '@/hooks/useMaterialsForTask';

interface MaterialsTickListProps {
  taskId: string | null;
  onSave: () => void;
  onCancel: () => void;
}

export const MaterialsTickList = ({ taskId, onSave, onCancel }: MaterialsTickListProps) => {
  const { data: materials = [], isLoading } = useMaterialsForTask(taskId);
  const markMaterialUsed = useMarkMaterialUsed();
  const [localChanges, setLocalChanges] = useState<Record<string, boolean>>({});

  const handleToggle = (materialId: string, currentFlag: boolean) => {
    setLocalChanges(prev => ({
      ...prev,
      [materialId]: !currentFlag
    }));
  };

  const handleSave = async () => {
    const updates = Object.entries(localChanges).map(([id, used_flag]) => ({
      id,
      used_flag
    }));

    if (updates.length > 0) {
      await markMaterialUsed.mutateAsync(updates);
    }
    
    onSave();
  };

  const hasChanges = Object.keys(localChanges).length > 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <div className="text-muted-foreground">Loading materials...</div>
        </CardContent>
      </Card>
    );
  }

  if (materials.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <div className="text-muted-foreground">No materials assigned to this task</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Materials Used</CardTitle>
        <p className="text-sm text-muted-foreground">
          Check off materials that were used during this task
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {materials.map((material) => {
            const currentFlag = localChanges[material.id] ?? material.used_flag;
            
            return (
              <div key={material.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{material.materials?.name || 'Unknown Material'}</span>
                    <Badge variant="outline">{material.materials?.sku || 'N/A'}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Planned: {material.planned_qty} {material.materials?.unit || 'units'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Used</span>
                  <Switch
                    checked={currentFlag}
                    onCheckedChange={() => handleToggle(material.id, currentFlag)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={markMaterialUsed.isPending}
            className="flex-1"
          >
            {markMaterialUsed.isPending ? 'Saving...' : 'Save & Continue'}
          </Button>
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={markMaterialUsed.isPending}
          >
            Cancel
          </Button>
        </div>

        {hasChanges && (
          <p className="text-xs text-muted-foreground text-center">
            {Object.keys(localChanges).length} material{Object.keys(localChanges).length === 1 ? '' : 's'} will be updated
          </p>
        )}
      </CardContent>
    </Card>
  );
};