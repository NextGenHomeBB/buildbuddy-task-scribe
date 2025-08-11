describe('Multi-Organization Flow', () => {
  beforeEach(() => {
    // Clear local storage before each test
    cy.clearAllLocalStorage()
  })

  it('should handle organization selection and invite flow', () => {
    // Mock user authentication
    cy.visit('/login')
    
    // Login with test credentials
    cy.get('[data-testid="email-input"]').type('worker@test.com')
    cy.get('[data-testid="password-input"]').type('password123')
    cy.get('[data-testid="login-button"]').click()
    
    // Should redirect to organization picker if no valid org
    cy.url().should('include', '/today')
    
    // Should show organization picker if no org selected
    cy.contains('Select Organization').should('be.visible')
    
    // Mock organization selection
    cy.window().then((win) => {
      win.localStorage.setItem('bb.current_org_id', 'test-org-id')
    })
    
    // Refresh to load with organization
    cy.reload()
    
    // Should now show the today page with shift tracker
    cy.contains('Shift Tracker').should('be.visible')
    cy.contains('Start Shift').should('be.visible')
    
    // Test shift tracking
    cy.get('[data-testid="start-shift-button"]').click()
    cy.contains('Active').should('be.visible')
    cy.contains('End Shift').should('be.visible')
    
    // End shift
    cy.get('[data-testid="end-shift-button"]').click()
    cy.contains('Not Started').should('be.visible')
  })

  it('should handle invite acceptance flow', () => {
    const testToken = 'test-invite-token-123'
    
    // Visit invite link directly
    cy.visit(`/invite/${testToken}`)
    
    // Should redirect to login if not authenticated
    cy.url().should('include', '/login')
    cy.url().should('include', `redirect=${encodeURIComponent(`/invite/${testToken}`)}`)
    
    // Login
    cy.get('[data-testid="email-input"]').type('worker@test.com')
    cy.get('[data-testid="password-input"]').type('password123')
    cy.get('[data-testid="login-button"]').click()
    
    // Should return to invite page after login
    cy.url().should('include', `/invite/${testToken}`)
    
    // Mock successful invite acceptance
    cy.intercept('POST', '**/rpc/accept_invite', {
      statusCode: 200,
      body: {
        success: true,
        org_id: 'new-org-id',
        role: 'worker'
      }
    }).as('acceptInvite')
    
    // Should show processing message
    cy.contains('Processing Invitation').should('be.visible')
    
    // Wait for invite acceptance
    cy.wait('@acceptInvite')
    
    // Should show success message
    cy.contains('Invitation Accepted!').should('be.visible')
    cy.contains('Switch to this organization').should('be.visible')
    
    // Click switch to new org
    cy.contains('Switch to this organization').click()
    
    // Should redirect to today page
    cy.url().should('include', '/today')
  })

  it('should show expiring membership warnings', () => {
    // Mock organization with expiring membership
    const expiringDate = new Date()
    expiringDate.setDate(expiringDate.getDate() + 3) // 3 days from now
    
    cy.window().then((win) => {
      // Mock organizations data with expiring membership
      const mockOrganizations = [{
        org_id: 'test-org-id',
        role: 'worker',
        status: 'active',
        expires_at: expiringDate.toISOString(),
        organization: {
          id: 'test-org-id',
          name: 'Test Organization'
        }
      }]
      
      // Store in local context for the org switcher
      win.localStorage.setItem('bb.current_org_id', 'test-org-id')
    })
    
    cy.visit('/today')
    
    // Click on organization switcher
    cy.get('[data-testid="org-switcher"]').click()
    
    // Should show expiring soon badge
    cy.contains('Expiring Soon').should('be.visible')
  })

  it('should handle access expired scenario', () => {
    // Set expired organization
    cy.window().then((win) => {
      const expiredDate = new Date()
      expiredDate.setDate(expiredDate.getDate() - 1) // Yesterday
      
      win.localStorage.setItem('bb.current_org_id', 'expired-org-id')
    })
    
    // Mock expired membership response
    cy.intercept('GET', '**/organization_members*', {
      statusCode: 200,
      body: [] // No active memberships
    }).as('getOrganizations')
    
    cy.visit('/today')
    
    // Should show organization picker due to no valid orgs
    cy.contains('No Organizations').should('be.visible')
    cy.contains('contact your administrator').should('be.visible')
  })
})