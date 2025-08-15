
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useProjectWorkers } from '@/hooks/useProjectWorkers'
import { Plus } from 'lucide-react'
import { taskValidationSchema, sanitizeText } from '@/lib/security'

interface AddTaskDialogProps {
  trigger?: React.ReactNode
  onClose?: () => void
  defaultListId?: string
  open?: boolean
  projectId?: string
}

export function AddTaskDialog({ trigger, onClose, defaultListId, open: externalOpen, projectId }: AddTaskDialogProps) {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [listId, setListId] = useState(defaultListId || '')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const { toast } = useToast()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { workers, loading: workersLoading } = useProjectWorkers(projectId)

  // Use external open state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = externalOpen !== undefined ? 
    (value: boolean) => {
      if (!value) onClose?.()
    } : 
    setInternalOpen

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { title: string; description?: string; priority: string; assigneeId?: string }) => {
      console.log('Creating task with data:', taskData)
      
      const taskToInsert = {
        title: taskData.title,
        description: taskData.description || null,
        priority: taskData.priority,
        assignee: taskData.assigneeId || user?.id,
        status: 'todo',
        project_id: projectId || null,
        phase_id: null,
        list_id: listId || null,
      }

      console.log('Inserting task:', taskToInsert)

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskToInsert)
        .select()
      
      if (error) {
        console.error('Task creation error:', error)
        throw error
      }
      
      console.log('Task created successfully:', data)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['taskLists'] })
      toast({
        title: t('today.taskCompleted'),
        description: 'Task created successfully',
      })
      
      // Reset form and close dialog
      setTitle('')
      setDescription('')
      setPriority('medium')
      setAssigneeId('')
      setListId(defaultListId || '')
      setOpen(false)
      onClose?.()
    },
    onError: (error) => {
      console.error('Task creation error:', error)
      toast({
        title: t('profile.error'),
        description: `Failed to create task: ${error.message}`,
        variant: 'destructive',
      })
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: t('profile.error'),
        description: 'You must be logged in to create tasks',
        variant: 'destructive',
      })
      return
    }

    // Check rate limiting before proceeding
    const { validateOperation } = await import('@/lib/security')
    const isAllowed = await validateOperation('task_creation', user.id)
    
    if (!isAllowed) {
      toast({
        title: 'Rate limit exceeded',
        description: 'Please wait before creating more tasks',
        variant: 'destructive',
      })
      return
    }

    // Validate and sanitize input
    const validation = taskValidationSchema.safeParse({
      title: title.trim(),
      description: description.trim(),
      priority: priority as 'low' | 'medium' | 'high'
    })

    if (!validation.success) {
      toast({
        title: t('profile.validationError'),
        description: validation.error.errors[0]?.message || "Invalid input",
        variant: "destructive",
      })
      return
    }

    const sanitizedData = {
      title: sanitizeText(validation.data.title),
      description: validation.data.description ? sanitizeText(validation.data.description) : undefined,
      priority: validation.data.priority,
      assigneeId: assigneeId
    }

    createTaskMutation.mutate(sanitizedData)
  }

  const defaultTrigger = (
    <Button
      className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-construction-yellow hover:bg-construction-yellow/90 text-construction-yellow-foreground shadow-lg hover:shadow-xl transition-all duration-200 z-40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brandBlue"
      size="icon"
    >
      <Plus className="w-6 h-6" />
      <span className="sr-only">{t('today.addTask')}</span>
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('today.addTask')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description..."
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(value: 'low' | 'medium' | 'high') => setPriority(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t('today.priority.low')}</SelectItem>
                <SelectItem value="medium">{t('today.priority.medium')}</SelectItem>
                <SelectItem value="high">{t('today.priority.high')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {projectId && (
            <div className="space-y-2">
              <Label htmlFor="assignee">Assignee</Label>
              {workersLoading ? (
                <div className="text-sm text-muted-foreground">Loading workers...</div>
              ) : workers.length > 0 ? (
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {workers.map((worker) => (
                      <SelectItem key={worker.id} value={worker.id}>
                        {worker.name} {worker.email && `(${worker.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No workers found for this project. Grant project access to users first.
                </div>
              )}
            </div>
          )}
          
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={createTaskMutation.isPending || !title.trim()}
              className="flex-1"
            >
              {createTaskMutation.isPending ? 'Creating...' : t('common.add')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
