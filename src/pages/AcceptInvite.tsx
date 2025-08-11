import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Building2 } from 'lucide-react'

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { acceptInvite, switchOrganization, organizations } = useOrganization()
  
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<{
    success: boolean
    error?: string
    orgId?: string
    orgName?: string
  } | null>(null)

  useEffect(() => {
    if (!user) {
      // Redirect to login with the invite token preserved
      navigate(`/login?redirect=${encodeURIComponent(`/accept-invite/${token}`)}`)
      return
    }

    if (token) {
      handleAcceptInvite()
    }
  }, [token, user])

  const handleAcceptInvite = async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const response = await acceptInvite(token)
      
      if (response.success && response.orgId) {
        // Find the organization name from the updated memberships
        const org = organizations.find(o => o.org_id === response.orgId)
        setResult({
          success: true,
          orgId: response.orgId,
          orgName: org?.organization.name || 'Organization'
        })
      } else {
        setResult({
          success: false,
          error: response.error
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: error.message || 'Failed to accept invitation'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchToNewOrg = () => {
    if (result?.orgId) {
      switchOrganization(result.orgId)
      navigate('/today')
    }
  }

  const handleGoToToday = () => {
    navigate('/today')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">
              Please wait while we process your invitation...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              This invitation link is invalid or has expired.
            </p>
            <Button onClick={handleGoToToday}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (result.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Invitation Accepted!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-lg font-medium">
                <Building2 className="h-5 w-5" />
                {result.orgName}
              </div>
              <p className="text-muted-foreground">
                You have successfully joined this organization.
              </p>
            </div>
            
            <div className="space-y-2">
              <Button onClick={handleSwitchToNewOrg} className="w-full">
                Switch to {result.orgName}
              </Button>
              <Button variant="outline" onClick={handleGoToToday} className="w-full">
                Stay with Current Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Invitation Failed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            {result.error || 'Failed to accept the invitation. Please try again or contact support.'}
          </p>
          <Button onClick={handleGoToToday}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}