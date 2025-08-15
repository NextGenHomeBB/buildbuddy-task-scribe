import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

interface Project {
  id: string
  name: string
  status: string
}

interface ProjectSelectorProps {
  value?: string
  onValueChange: (projectId: string) => void
  label?: string
  placeholder?: string
}

export function ProjectSelector({ value, onValueChange, label = "Project", placeholder = "Select project" }: ProjectSelectorProps) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects-for-selection'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status')
        .order('name')

      if (error) throw error
      return data as Project[]
    }
  })

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange} disabled={isLoading}>
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? "Loading projects..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {projects?.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name} ({project.status})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}