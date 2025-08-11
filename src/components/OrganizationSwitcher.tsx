import { ChevronDown, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useOrganization } from '@/contexts/OrganizationContext'
import { Badge } from '@/components/ui/badge'

export function OrganizationSwitcher() {
  const { currentOrgId, organizations, switchOrganization, isLoading, isExpiringSoon } = useOrganization()

  if (isLoading || organizations.length === 0) {
    return null
  }

  const currentOrg = organizations.find(org => org.org_id === currentOrgId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 max-w-[200px]"
          data-testid="org-switcher"
        >
          <Building2 className="h-4 w-4" />
          <span className="truncate">{currentOrg?.organization.name || 'Select Organization'}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="p-2">
          <p className="text-xs text-muted-foreground mb-2">Switch Organization</p>
        </div>
        <DropdownMenuSeparator />
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.org_id}
            onClick={() => switchOrganization(org.org_id)}
            className="flex items-center justify-between p-3"
          >
            <div className="flex flex-col gap-1">
              <span className="font-medium">{org.organization.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">
                  {org.role}
                </Badge>
                {isExpiringSoon(org.expires_at) && (
                  <Badge variant="destructive" className="text-xs">
                    Expiring Soon
                  </Badge>
                )}
              </div>
            </div>
            {org.org_id === currentOrgId && (
              <Badge variant="secondary" className="text-xs">Current</Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}