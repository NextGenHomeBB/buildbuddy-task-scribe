-- Phase 1: Clean Up Duplicate Triggers
-- Remove duplicate audit triggers from user_project_role table
DROP TRIGGER IF EXISTS audit_user_project_role ON public.user_project_role;
DROP TRIGGER IF EXISTS audit_user_project_role_changes ON public.user_project_role;
DROP TRIGGER IF EXISTS enhanced_audit_trigger_user_project_role ON public.user_project_role;
DROP TRIGGER IF EXISTS enhanced_audit_user_project_role ON public.user_project_role;

-- Keep only the essential enhanced_audit_trigger and update_project_workers_trigger
-- Note: These should already exist, just ensuring they're properly set up

-- Phase 2: Fix Data Synchronization
-- Create function to repair assigned_workers data
CREATE OR REPLACE FUNCTION public.repair_assigned_workers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  project_record RECORD;
  worker_ids uuid[];
BEGIN
  -- Loop through all projects and fix assigned_workers
  FOR project_record IN SELECT id FROM public.projects LOOP
    -- Get all active worker IDs for this project
    SELECT ARRAY_AGG(upr.user_id) INTO worker_ids
    FROM public.user_project_role upr
    WHERE upr.project_id = project_record.id
      AND upr.role = 'worker';
    
    -- Update the project's assigned_workers field
    UPDATE public.projects 
    SET assigned_workers = COALESCE(worker_ids, '[]'::uuid[])::jsonb
    WHERE id = project_record.id;
  END LOOP;
  
  RAISE NOTICE 'Assigned workers data repaired for all projects';
END;
$$;

-- Run the repair function
SELECT public.repair_assigned_workers();

-- Improve the update_project_assigned_workers function
CREATE OR REPLACE FUNCTION public.update_project_assigned_workers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  worker_ids uuid[];
  project_uuid uuid;
BEGIN
  -- Determine which project to update
  project_uuid := COALESCE(NEW.project_id, OLD.project_id);
  
  -- Skip if no project or if this is a system operation
  IF project_uuid IS NULL OR current_setting('app.skip_worker_sync', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get all active worker IDs for this project
  SELECT ARRAY_AGG(upr.user_id) INTO worker_ids
  FROM public.user_project_role upr
  WHERE upr.project_id = project_uuid
    AND upr.role = 'worker';
  
  -- Update the project's assigned_workers field (with sync prevention)
  PERFORM set_config('app.skip_worker_sync', 'true', true);
  
  UPDATE public.projects 
  SET assigned_workers = COALESCE(worker_ids, '[]'::uuid[])::jsonb
  WHERE id = project_uuid;
  
  PERFORM set_config('app.skip_worker_sync', 'false', true);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS update_project_workers_trigger ON public.user_project_role;
CREATE TRIGGER update_project_workers_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_project_role
  FOR EACH ROW
  EXECUTE FUNCTION public.update_project_assigned_workers();

-- Phase 3: Add monitoring function to detect inconsistencies
CREATE OR REPLACE FUNCTION public.check_worker_data_consistency()
RETURNS TABLE(
  project_id uuid,
  project_name text,
  assigned_workers_count int,
  user_project_role_count int,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as project_id,
    p.name as project_name,
    COALESCE(jsonb_array_length(p.assigned_workers), 0) as assigned_workers_count,
    COALESCE(upr_count.count, 0)::int as user_project_role_count,
    CASE 
      WHEN COALESCE(jsonb_array_length(p.assigned_workers), 0) = COALESCE(upr_count.count, 0) 
      THEN 'CONSISTENT'
      ELSE 'INCONSISTENT'
    END as status
  FROM public.projects p
  LEFT JOIN (
    SELECT 
      project_id,
      COUNT(*) as count
    FROM public.user_project_role 
    WHERE role = 'worker'
    GROUP BY project_id
  ) upr_count ON p.id = upr_count.project_id
  ORDER BY p.name;
END;
$$;

-- Phase 4: Add constraint to prevent future trigger duplication issues
-- Create a function to validate trigger setup
CREATE OR REPLACE FUNCTION public.validate_trigger_setup()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trigger_count int;
BEGIN
  -- Count audit triggers on user_project_role
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'user_project_role'
    AND trigger_name LIKE '%audit%';
  
  -- Should have only 1 audit trigger
  IF trigger_count > 1 THEN
    RAISE WARNING 'Multiple audit triggers detected on user_project_role: %', trigger_count;
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;