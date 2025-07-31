-- Create table for worker date-specific availability
CREATE TABLE public.worker_date_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT false,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.worker_date_availability ENABLE ROW LEVEL SECURITY;

-- Create policies for worker date availability
CREATE POLICY "Workers can view their own date availability" 
ON public.worker_date_availability 
FOR SELECT 
USING (worker_id = auth.uid());

CREATE POLICY "Workers can create their own date availability" 
ON public.worker_date_availability 
FOR INSERT 
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can update their own date availability" 
ON public.worker_date_availability 
FOR UPDATE 
USING (worker_id = auth.uid())
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Workers can delete their own date availability" 
ON public.worker_date_availability 
FOR DELETE 
USING (worker_id = auth.uid());

CREATE POLICY "Admins can view all date availability" 
ON public.worker_date_availability 
FOR SELECT 
USING (get_current_user_role() = 'admin'::text);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_worker_date_availability_updated_at
BEFORE UPDATE ON public.worker_date_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();