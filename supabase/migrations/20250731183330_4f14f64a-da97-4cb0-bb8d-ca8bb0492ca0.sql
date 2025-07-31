-- Create worker_availability table
CREATE TABLE public.worker_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  is_available BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,
  end_time TIME,
  max_hours NUMERIC CHECK (max_hours > 0 AND max_hours <= 24),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, day_of_week)
);

-- Enable Row Level Security
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

-- Create policies for worker availability
CREATE POLICY "Workers can view their own availability" 
ON public.worker_availability 
FOR SELECT 
USING (worker_id = auth.uid());

CREATE POLICY "Workers can create their own availability" 
ON public.worker_availability 
FOR INSERT 
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update their own availability" 
ON public.worker_availability 
FOR UPDATE 
USING (worker_id = auth.uid())
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can delete their own availability" 
ON public.worker_availability 
FOR DELETE 
USING (worker_id = auth.uid());

CREATE POLICY "Admins can view all availability" 
ON public.worker_availability 
FOR SELECT 
USING (get_current_user_role() = 'admin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_worker_availability_updated_at
BEFORE UPDATE ON public.worker_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();