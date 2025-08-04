-- Create time_logs table for timer tracking
CREATE TABLE public.time_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  task_id UUID REFERENCES public.tasks(id),
  start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_at TIMESTAMP WITH TIME ZONE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own time logs" 
ON public.time_logs 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own time logs" 
ON public.time_logs 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own time logs" 
ON public.time_logs 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own time logs" 
ON public.time_logs 
FOR DELETE 
USING (user_id = auth.uid());

-- Admins can manage all time logs
CREATE POLICY "Admins can manage all time logs" 
ON public.time_logs 
FOR ALL 
USING (get_current_user_role() = 'admin');

-- Create function to validate no overlapping timers
CREATE OR REPLACE FUNCTION public.check_timer_overlap(
  p_user_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if user has any open timer (end_at IS NULL)
  IF EXISTS (
    SELECT 1 
    FROM public.time_logs 
    WHERE user_id = p_user_id 
      AND end_at IS NULL 
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
  ) THEN
    RETURN FALSE; -- Overlap found
  END IF;
  
  RETURN TRUE; -- No overlap
END;
$$;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_time_logs_updated_at
  BEFORE UPDATE ON public.time_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();