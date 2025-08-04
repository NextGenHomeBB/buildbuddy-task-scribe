-- Add required columns to project_materials table for task-level material tracking
ALTER TABLE public.project_materials 
ADD COLUMN task_id uuid REFERENCES public.tasks(id),
ADD COLUMN planned_qty numeric DEFAULT 1,
ADD COLUMN used_flag boolean DEFAULT false;

-- Add index for efficient task-based material queries
CREATE INDEX idx_project_materials_task_id ON public.project_materials(task_id);

-- Update RLS policies to include task-level access
DROP POLICY IF EXISTS "Admin only access to project_materials" ON public.project_materials;

CREATE POLICY "Admins can manage all project materials" 
ON public.project_materials FOR ALL 
USING (get_current_user_role() = 'admin');

CREATE POLICY "Users can view materials for their assigned tasks"
ON public.project_materials FOR SELECT
USING (
  get_current_user_role() = 'admin' OR
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = project_materials.task_id 
    AND t.assignee = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.user_project_role upr
    WHERE upr.user_id = auth.uid() 
    AND upr.project_id = project_materials.project_id
  )
);

CREATE POLICY "Users can update material usage for their assigned tasks"
ON public.project_materials FOR UPDATE
USING (
  get_current_user_role() = 'admin' OR
  EXISTS (
    SELECT 1 FROM public.tasks t 
    WHERE t.id = project_materials.task_id 
    AND t.assignee = auth.uid()
  )
);