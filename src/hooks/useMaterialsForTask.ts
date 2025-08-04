import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface TaskMaterial {
  id: string;
  task_id: string;
  material_id: string;
  planned_qty: number;
  used_flag: boolean;
  materials: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  } | null;
}

export const useMaterialsForTask = (taskId: string | null) => {
  return useQuery({
    queryKey: ['task-materials', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('project_materials')
        .select(`
          id,
          task_id,
          material_id,
          planned_qty,
          used_flag,
          materials:material_id(
            id,
            name,
            sku,
            unit
          )
        `)
        .eq('task_id', taskId)
        .order('materials(name)');

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        materials: Array.isArray(item.materials) ? item.materials[0] : item.materials
      })).filter(item => item.materials) as TaskMaterial[];
    },
    enabled: !!taskId,
  });
};

export const useMarkMaterialUsed = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; used_flag: boolean }[]) => {
      const promises = updates.map(({ id, used_flag }) =>
        supabase
          .from('project_materials')
          .update({ used_flag })
          .eq('id', id)
      );

      const results = await Promise.all(promises);
      
      // Check for any errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw new Error(`Failed to update ${errors.length} materials`);
      }

      return results;
    },
    onSuccess: (_, variables) => {
      // Invalidate materials queries for affected tasks
      const taskIds = new Set<string>();
      variables.forEach(() => {
        // We'll invalidate all task-materials queries since we don't have task_id in the update
        queryClient.invalidateQueries({ queryKey: ['task-materials'] });
      });

      toast({
        title: "Materials updated",
        description: `Updated ${variables.length} material${variables.length === 1 ? '' : 's'}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating materials",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};