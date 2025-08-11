import { Building2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/contexts/OrganizationContext'

export function OrganizationPicker() {
  const { organizations, switchOrganization, isExpiringSoon } = useOrganization()

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>No Organizations</CardTitle>
            <CardDescription>
              You are not a member of any organizations yet. Please contact your administrator to get invited.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Building2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle>Select Organization</CardTitle>
          <CardDescription>
            Choose an organization to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {organizations.map((org) => (
            <Button
              key={org.org_id}
              variant="outline"
              onClick={() => switchOrganization(org.org_id)}
              className="w-full h-auto p-4 flex flex-col items-start gap-2"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-medium text-left">{org.organization.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">
                    {org.role}
                  </Badge>
                  {isExpiringSoon(org.expires_at) && (
                    <Badge variant="destructive" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      Expiring Soon
                    </Badge>
                  )}
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}