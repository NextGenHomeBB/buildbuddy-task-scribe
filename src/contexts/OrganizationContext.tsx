import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface OrganizationMembership {
  org_id: string
  role: string
  status: string
  organization: {
    id: string
    name: string
  }
}

interface OrganizationContextType {
  currentOrgId: string | null
  organizations: OrganizationMembership[]
  isLoading: boolean
  switchOrganization: (orgId: string) => void
  refreshMemberships: () => Promise<void>
  acceptInvite: (token: string) => Promise<{ success: boolean; error?: string; orgId?: string }>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load organizations and set current org from localStorage or default
  useEffect(() => {
    if (user) {
      loadOrganizations()
    } else {
      setIsLoading(false)
    }
  }, [user])

  // Load current org from localStorage on mount

  const loadOrganizations = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          org_id,
          role,
          status,
          organizations!inner (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (error) throw error

      const memberships = (data || []).map(item => ({
        org_id: item.org_id,
        role: item.role,
        status: item.status,
        organization: {
          id: (item.organizations as any).id,
          name: (item.organizations as any).name
        }
      }))

      setOrganizations(memberships)

      // Set current org from localStorage or default to first org
      const savedOrgId = localStorage.getItem('currentOrgId')
      if (savedOrgId && memberships.find(m => m.org_id === savedOrgId)) {
        setCurrentOrgId(savedOrgId)
      } else if (memberships.length > 0) {
        const defaultOrgId = memberships[0].org_id
        setCurrentOrgId(defaultOrgId)
        localStorage.setItem('currentOrgId', defaultOrgId)
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
      toast({
        title: 'Error',
        description: 'Failed to load organizations',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const switchOrganization = (orgId: string) => {
    const org = organizations.find(o => o.org_id === orgId)
    if (org) {
      setCurrentOrgId(orgId)
      localStorage.setItem('currentOrgId', orgId)
      toast({
        title: 'Organization Switched',
        description: `Switched to ${org.organization.name}`,
      })
    }
  }

  const refreshMemberships = async () => {
    await loadOrganizations()
  }

  const acceptInvite = async (token: string): Promise<{ success: boolean; error?: string; orgId?: string }> => {
    try {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token })

      if (error) throw error

      if (data.success) {
        // Refresh memberships to include the new organization
        await refreshMemberships()
        
        return {
          success: true,
          orgId: data.org_id
        }
      } else {
        return {
          success: false,
          error: data.error || 'Failed to accept invitation'
        }
      }
    } catch (error: any) {
      console.error('Error accepting invite:', error)
      return {
        success: false,
        error: error.message || 'Failed to accept invitation'
      }
    }
  }

  const value = {
    currentOrgId,
    organizations,
    isLoading,
    switchOrganization,
    refreshMemberships,
    acceptInvite,
  }

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}