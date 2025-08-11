import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

interface OrganizationMembership {
  org_id: string
  role: string
  status: string
  expires_at: string | null
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
  acceptInvite: (token: string) => Promise<{ success: boolean; error?: string; orgId?: string; orgName?: string }>
  isExpiringSoon: (expiresAt: string | null) => boolean
  hasValidOrganization: boolean
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
      setCurrentOrgId(null)
      setOrganizations([])
    }
  }, [user])

  // Check for expired memberships periodically
  useEffect(() => {
    if (!user || organizations.length === 0) return

    const checkExpiredMemberships = () => {
      const now = new Date()
      const expiredOrgs = organizations.filter(org => 
        org.expires_at && new Date(org.expires_at) <= now
      )

      if (expiredOrgs.length > 0) {
        // Remove expired orgs from list
        setOrganizations(prev => prev.filter(org => 
          !org.expires_at || new Date(org.expires_at) > now
        ))

        // If current org expired, clear it
        if (currentOrgId && expiredOrgs.some(org => org.org_id === currentOrgId)) {
          setCurrentOrgId(null)
          localStorage.removeItem('bb.current_org_id')
          toast({
            title: 'Access Expired',
            description: 'Your access to the current organization has expired.',
            variant: 'destructive',
          })
        }

        // Show toast for expired memberships
        expiredOrgs.forEach(org => {
          toast({
            title: 'Membership Expired',
            description: `Your membership in ${org.organization.name} has expired.`,
            variant: 'destructive',
          })
        })
      }
    }

    // Check immediately and then every minute
    checkExpiredMemberships()
    const interval = setInterval(checkExpiredMemberships, 60000)
    return () => clearInterval(interval)
  }, [organizations, currentOrgId, user, toast])

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
          expires_at,
          organizations!inner (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('created_at', { ascending: false })

      if (error) throw error

      const memberships = (data || []).map(item => ({
        org_id: item.org_id,
        role: item.role,
        status: item.status,
        expires_at: item.expires_at,
        organization: {
          id: (item.organizations as any).id,
          name: (item.organizations as any).name
        }
      }))

      setOrganizations(memberships)

      // Set current org from localStorage or default to first org
      const savedOrgId = localStorage.getItem('bb.current_org_id')
      const validSavedOrg = savedOrgId && memberships.find(m => m.org_id === savedOrgId)
      
      if (validSavedOrg) {
        // Validate saved org hasn't expired
        if (!validSavedOrg.expires_at || new Date(validSavedOrg.expires_at) > new Date()) {
          setCurrentOrgId(savedOrgId)
        } else {
          // Saved org expired, clear it
          localStorage.removeItem('bb.current_org_id')
          setCurrentOrgId(null)
        }
      }
      
      if (!currentOrgId && memberships.length > 0) {
        const defaultOrgId = memberships[0].org_id
        setCurrentOrgId(defaultOrgId)
        localStorage.setItem('bb.current_org_id', defaultOrgId)
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
      localStorage.setItem('bb.current_org_id', orgId)
      toast({
        title: 'Organization Switched',
        description: `Switched to ${org.organization.name}`,
      })
    }
  }

  const refreshMemberships = async () => {
    await loadOrganizations()
  }

  const acceptInvite = async (token: string): Promise<{ success: boolean; error?: string; orgId?: string; orgName?: string }> => {
    try {
      const { data, error } = await supabase.rpc('accept_invite', { p_token: token })

      if (error) throw error

      if (data.success) {
        // Refresh memberships to include the new organization
        await refreshMemberships()
        
        // Get org name for the accepted invitation
        const newOrg = organizations.find(org => org.org_id === data.org_id)
        
        return {
          success: true,
          orgId: data.org_id,
          orgName: newOrg?.organization.name || 'Organization'
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

  const isExpiringSoon = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false
    const expiryDate = new Date(expiresAt)
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    return expiryDate <= sevenDaysFromNow
  }

  const hasValidOrganization = currentOrgId !== null && organizations.some(org => org.org_id === currentOrgId)

  const value = {
    currentOrgId,
    organizations,
    isLoading,
    switchOrganization,
    refreshMemberships,
    acceptInvite,
    isExpiringSoon,
    hasValidOrganization,
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