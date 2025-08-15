import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useProjectWorkers, grantProjectAccess } from '@/hooks/useProjectWorkers'
import { Users, Plus, Trash2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

interface WorkerManagementDialogProps {
  projectId: string
  trigger?: React.ReactNode
}

interface User {
  id: string
  full_name: string | null
  email?: string
}

export function WorkerManagementDialog({ projectId, trigger }: WorkerManagementDialogProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState<'worker' | 'manager' | 'admin'>('worker')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { workers, loading: workersLoading, error: workersError } = useProjectWorkers(projectId)

  // Search for users to add to the project
  const { data: availableUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['available-users', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return []
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .or(`full_name.ilike.%${searchTerm}%, id.ilike.%${searchTerm}%`)
        .limit(20)

      if (error) throw error

      // Filter out users already on the project
      const currentWorkerIds = workers.map(w => w.id)
      return data?.filter(user => !currentWorkerIds.includes(user.id)) || []
    },
    enabled: searchTerm.length >= 2
  })

  const addWorkersMutation = useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[], role: string }) => {
      const rows = userIds.map(id => ({ 
        project_id: projectId, 
        user_id: id, 
        role: role 
      }))
      
      const { error } = await supabase
        .from('user_project_role')
        .upsert(rows, { onConflict: 'project_id,user_id' })
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-workers', projectId] })
      setSelectedUsers([])
      setSearchTerm('')
      toast({
        title: 'Workers Added',
        description: `Successfully added ${selectedUsers.length} worker(s) to the project`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to add workers: ${error.message}`,
        variant: 'destructive',
      })
    }
  })

  const removeWorkerMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_project_role')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-workers', projectId] })
      toast({
        title: 'Worker Removed',
        description: 'Worker has been removed from the project',
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to remove worker: ${error.message}`,
        variant: 'destructive',
      })
    }
  })

  const handleAddWorkers = () => {
    if (selectedUsers.length === 0) return
    addWorkersMutation.mutate({ userIds: selectedUsers, role: selectedRole })
  }

  const handleRemoveWorker = (userId: string) => {
    removeWorkerMutation.mutate(userId)
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Users className="h-4 w-4 mr-2" />
      Manage Workers
    </Button>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Manage Project Workers</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Current Workers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Current Workers ({workers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {workersLoading ? (
                <div className="text-sm text-muted-foreground">Loading workers...</div>
              ) : workersError ? (
                <div className="text-sm text-destructive">Error loading workers</div>
              ) : workers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No workers assigned to this project</div>
              ) : (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-2">
                    {workers.map((worker) => (
                      <div key={worker.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{worker.name}</div>
                          {worker.email && (
                            <div className="text-xs text-muted-foreground">{worker.email}</div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveWorker(worker.id)}
                          disabled={removeWorkerMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Add New Workers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Add Workers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Users</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or ID..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={selectedRole} onValueChange={(value: 'worker' | 'manager' | 'admin') => setSelectedRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="worker">Worker</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Selection */}
              {searchTerm.length >= 2 && (
                <div className="space-y-2">
                  <Label>Available Users</Label>
                  <ScrollArea className="max-h-[150px] border rounded p-2">
                    {usersLoading ? (
                      <div className="text-sm text-muted-foreground">Searching...</div>
                    ) : availableUsers?.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No users found</div>
                    ) : (
                      <div className="space-y-1">
                        {availableUsers?.map((user) => (
                          <div
                            key={user.id}
                            className={`p-2 rounded cursor-pointer text-sm ${
                              selectedUsers.includes(user.id)
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => {
                              setSelectedUsers(prev =>
                                prev.includes(user.id)
                                  ? prev.filter(id => id !== user.id)
                                  : [...prev, user.id]
                              )
                            }}
                          >
                            <div className="font-medium">{user.full_name || user.id}</div>
                            <div className="text-xs opacity-75">{user.id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              {/* Selected Users */}
              {selectedUsers.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Users ({selectedUsers.length})</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedUsers.map((userId) => {
                      const user = availableUsers?.find(u => u.id === userId)
                      return (
                        <Badge
                          key={userId}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                        >
                          {user?.full_name || userId} ×
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}

              <Button
                onClick={handleAddWorkers}
                disabled={selectedUsers.length === 0 || addWorkersMutation.isPending}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {addWorkersMutation.isPending ? 'Adding...' : `Assign ${selectedUsers.length} Worker(s)`}
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}