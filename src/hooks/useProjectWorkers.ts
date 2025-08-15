import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Worker {
  id: string;
  name: string;
  email: string;
}

export function useProjectWorkers(projectId?: string) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      const { data, error } = await supabase
        .from('user_project_role')
        .select(`
          user_id,
          profiles!inner(id, full_name)
        `)
        .eq('project_id', projectId)
        .in('role', ['worker','manager','admin'])
        .order('user_id'); // stable order

      if (!cancelled) {
        if (error) {
          setError(error.message);
        } else {
          setWorkers((data ?? []).map((r: any) => ({
            id: r.user_id,
            name: r.profiles?.full_name ?? r.user_id,
            email: '' // Email not directly accessible via API for security
          })));
        }
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  return { workers, loading, error };
}

export async function grantProjectAccess(projectId: string, userIds: string[]) {
  const rows = userIds.map(id => ({ project_id: projectId, user_id: id, role: 'worker' }));
  const { error } = await supabase.from('user_project_role').upsert(rows, { onConflict: 'project_id,user_id' });
  if (error) throw error;
}