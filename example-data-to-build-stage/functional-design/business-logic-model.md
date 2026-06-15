# Backend Unit - Business Logic Model

## Overview
This document defines the comprehensive business logic model for the Backend Unit, including all business rules, workflows, algorithms, and decision logic based on the approved functional design approach.

---

## 1. Authentication Component Business Logic

### Authentication Workflow Logic
```typescript
// Core authentication business rules
class AuthenticationLogic {
  // Login attempt validation with security measures
  validateLoginAttempt(username: string, password: string, ipAddress: string): AuthResult {
    // Business Rule: Check account lock status first
    if (this.isAccountLocked(username)) {
      return { success: false, reason: "ACCOUNT_LOCKED", lockDuration: this.getLockDuration(username) }
    }
    
    // Business Rule: Validate credentials
    const user = this.getUserByUsername(username)
    if (!user || !this.validatePassword(password, user.hashedPassword)) {
      this.incrementFailedAttempts(username, ipAddress)
      
      // Business Rule: Lock account after 5 failed attempts
      if (this.getFailedAttemptCount(username) >= 5) {
        this.lockAccount(username, "EXCESSIVE_FAILED_ATTEMPTS")
      }
      
      return { success: false, reason: "INVALID_CREDENTIALS" }
    }
    
    // Business Rule: Reset failed attempts on successful login
    this.resetFailedAttempts(username)
    return { success: true, user: user }
  }
  
  // Session management business rules
  createUserSession(userId: string): SessionInfo {
    // Business Rule: Session timeout of 8 hours for regular users, 4 hours for admins
    const user = this.getUserById(userId)
    const timeoutMinutes = user.role === 'Administrator' ? 240 : 480
    
    return {
      sessionId: this.generateSecureSessionId(),
      userId: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + timeoutMinutes * 60000),
      lastActivity: new Date()
    }
  }
}
```

### Security Business Rules
- **Account Lockout**: 5 failed login attempts trigger 30-minute account lock
- **Session Timeout**: 8 hours for employees/panel members, 4 hours for administrators
- **Password Requirements**: Minimum 8 characters, must include letters and numbers
- **Session Validation**: Check expiration and last activity on every request

---

## 2. Ideas Component Business Logic

### Idea Lifecycle Management
```typescript
class IdeaLifecycleLogic {
  // Idea submission business rules
  submitIdea(userId: string, ideaData: IdeaData): IdeaSubmissionResult {
    // Business Rule: Validate required fields
    const validation = this.validateIdeaData(ideaData)
    if (!validation.isValid) {
      return { success: false, errors: validation.errors }
    }
    
    // Business Rule: Check user submission limits (max 5 active ideas per user)
    const activeIdeas = this.getActiveIdeasByUser(userId)
    if (activeIdeas.length >= 5) {
      return { success: false, reason: "SUBMISSION_LIMIT_EXCEEDED" }
    }
    
    // Business Rule: Auto-assign department category if not provided
    const category = ideaData.category || this.inferCategoryFromContent(ideaData.description)
    
    const idea = {
      id: this.generateIdeaId(),
      userId: userId,
      title: ideaData.title,
      description: ideaData.description,
      expectedBenefits: ideaData.expectedBenefits,
      category: category,
      status: 'Submitted',
      submittedAt: new Date(),
      version: 1
    }
    
    return { success: true, idea: idea }
  }
  
  // Draft auto-save business logic
  autoSaveDraft(userId: string, draftData: DraftData): AutoSaveResult {
    // Business Rule: Auto-save every 30 seconds during active typing
    // Business Rule: Only save if content has changed
    const existingDraft = this.getDraftById(draftData.draftId)
    
    if (existingDraft && this.contentEquals(existingDraft, draftData)) {
      return { success: true, action: "NO_CHANGE" }
    }
    
    // Business Rule: Maintain draft history (last 5 versions)
    const draftVersion = {
      ...draftData,
      savedAt: new Date(),
      version: (existingDraft?.version || 0) + 1
    }
    
    return { success: true, action: "SAVED", version: draftVersion.version }
  }
}
```

### Idea Status Transition Logic
```typescript
// Business Rule: Idea status lifecycle - Draft → Submitted → Approved/Not Approved → Recognized
enum IdeaStatus {
  Draft = 'Draft',
  Submitted = 'Submitted', 
  Approved = 'Approved',
  NotApproved = 'Not Approved',
  Recognized = 'Recognized'
}

class IdeaStatusLogic {
  // Status transition validation
  canTransitionStatus(currentStatus: IdeaStatus, newStatus: IdeaStatus): boolean {
    const validTransitions = {
      [IdeaStatus.Draft]: [IdeaStatus.Submitted],
      [IdeaStatus.Submitted]: [IdeaStatus.Approved, IdeaStatus.NotApproved],
      [IdeaStatus.Approved]: [IdeaStatus.Recognized],
      [IdeaStatus.NotApproved]: [], // No resubmission allowed
      [IdeaStatus.Recognized]: [] // Final status
    }
    
    return validTransitions[currentStatus]?.includes(newStatus) || false
  }
}
```

### Validation Business Rules
- **Required Fields**: Title, description, expected benefits must be non-empty
- **Content Limits**: Title max 100 characters, description max 2000 characters
- **Submission Limits**: Maximum 5 active ideas per user
- **Category Assignment**: Auto-infer from content if not specified
- **Draft Retention**: Keep last 5 versions of each draft

---

## 3. Evaluation Component Business Logic

### Evaluation Scoring Algorithm
```typescript
class EvaluationScoringLogic {
  // Core scoring business rules based on user requirements
  calculateIdeaApproval(evaluations: Evaluation[]): ApprovalResult {
    // Business Rule: Require exactly 2 panel member evaluations
    if (evaluations.length !== 2) {
      return { approved: false, reason: "INSUFFICIENT_EVALUATIONS" }
    }
    
    // Business Rule: Both evaluations must meet approval criteria
    for (const evaluation of evaluations) {
      const approvalCheck = this.checkEvaluationApproval(evaluation)
      if (!approvalCheck.approved) {
        return { 
          approved: false, 
          reason: "EVALUATION_BELOW_THRESHOLD",
          details: approvalCheck.details 
        }
      }
    }
    
    return { approved: true, aggregateScore: this.calculateAggregateScore(evaluations) }
  }
  
  // Individual evaluation approval logic
  checkEvaluationApproval(evaluation: Evaluation): EvaluationApprovalResult {
    const { feasibilityScore, impactScore, innovationScore } = evaluation.scores
    
    // Business Rule: Minimum score of 6 for each criterion
    if (feasibilityScore < 6 || impactScore < 6 || innovationScore < 6) {
      return {
        approved: false,
        reason: "CRITERION_BELOW_MINIMUM",
        details: {
          feasibility: feasibilityScore >= 6,
          impact: impactScore >= 6,
          innovation: innovationScore >= 6
        }
      }
    }
    
    // Business Rule: Total score must be above 24 out of 30
    const totalScore = feasibilityScore + impactScore + innovationScore
    if (totalScore <= 24) {
      return {
        approved: false,
        reason: "TOTAL_SCORE_BELOW_THRESHOLD",
        details: { totalScore, required: 24 }
      }
    }
    
    return { approved: true, totalScore }
  }
  
  // Aggregate score calculation for approved ideas
  calculateAggregateScore(evaluations: Evaluation[]): AggregateScore {
    const totalScores = evaluations.map(e => 
      e.scores.feasibilityScore + e.scores.impactScore + e.scores.innovationScore
    )
    
    return {
      averageTotal: totalScores.reduce((a, b) => a + b) / totalScores.length,
      averageFeasibility: evaluations.reduce((sum, e) => sum + e.scores.feasibilityScore, 0) / evaluations.length,
      averageImpact: evaluations.reduce((sum, e) => sum + e.scores.impactScore, 0) / evaluations.length,
      averageInnovation: evaluations.reduce((sum, e) => sum + e.scores.innovationScore, 0) / evaluations.length,
      evaluationCount: evaluations.length
    }
  }
}
```

### Evaluation Workflow Logic
```typescript
class EvaluationWorkflowLogic {
  // Duplicate evaluation prevention
  canPanelMemberEvaluate(panelMemberId: string, ideaId: string): EvaluationEligibility {
    // Business Rule: Database constraint prevents duplicate evaluations
    const existingEvaluation = this.getEvaluation(panelMemberId, ideaId)
    if (existingEvaluation) {
      return { eligible: false, reason: "ALREADY_EVALUATED" }
    }
    
    // Business Rule: Panel member cannot evaluate their own ideas
    const idea = this.getIdeaById(ideaId)
    if (idea.userId === panelMemberId) {
      return { eligible: false, reason: "CANNOT_EVALUATE_OWN_IDEA" }
    }
    
    // Business Rule: Idea must be in 'Submitted' status
    if (idea.status !== 'Submitted') {
      return { eligible: false, reason: "IDEA_NOT_AVAILABLE_FOR_EVALUATION" }
    }
    
    return { eligible: true }
  }
}
```

### Evaluation Business Rules
- **Scoring Scale**: 1-10 for each criterion (feasibility, impact, innovation)
- **Approval Criteria**: Total score > 24 AND minimum 6 per criterion
- **Evaluation Requirements**: Exactly 2 panel member evaluations required
- **Duplicate Prevention**: Database constraint + application-level checks
- **Self-Evaluation**: Panel members cannot evaluate their own ideas

---

## 4. Analytics Component Business Logic

### Analytics Calculation Logic
```typescript
class AnalyticsCalculationLogic {
  // Daily batch processing business rules
  processDailyAnalytics(): AnalyticsProcessingResult {
    // Business Rule: Run analytics processing at midnight daily
    const processingDate = new Date()
    
    // Calculate key metrics
    const metrics = {
      totalIdeas: this.getTotalIdeasCount(),
      submittedIdeas: this.getIdeasByStatus('Submitted').length,
      approvedIdeas: this.getIdeasByStatus('Approved').length,
      notApprovedIdeas: this.getIdeasByStatus('Not Approved').length,
      recognizedIdeas: this.getIdeasByStatus('Recognized').length,
      averageEvaluationTime: this.calculateAverageEvaluationTime(),
      topPerformingDepartments: this.calculateDepartmentRankings()
    }
    
    // Business Rule: Cache results for 24-hour period
    this.cacheAnalyticsResults(metrics, processingDate)
    
    return { success: true, metrics, processedAt: processingDate }
  }
  
  // Leaderboard generation logic
  generateLeaderboard(criteria?: LeaderboardCriteria): LeaderboardEntry[] {
    // Business Rule: Only include approved ideas in leaderboard
    const approvedIdeas = this.getIdeasByStatus('Approved')
    
    // Sort by aggregate score (highest first)
    const rankedIdeas = approvedIdeas
      .map(idea => ({
        ideaId: idea.id,
        title: idea.title,
        submitterName: this.getUserById(idea.userId).name,
        department: idea.category,
        aggregateScore: this.getAggregateScore(idea.id),
        evaluationCount: this.getEvaluationCount(idea.id)
      }))
      .sort((a, b) => b.aggregateScore.averageTotal - a.aggregateScore.averageTotal)
    
    // Business Rule: Assign rankings with tie handling
    return this.assignRankings(rankedIdeas)
  }
}
```

### Performance Optimization Logic
- **Database Indexing**: Optimize queries with indexes on status, userId, category, submittedAt
- **Query Optimization**: Use efficient SQL queries with proper joins and filtering
- **Caching Strategy**: Cache daily analytics results for 24-hour periods
- **Batch Processing**: Process analytics during off-peak hours (midnight)

---

## 5. Recognition Component Business Logic

### Recognition Cycle Logic
```typescript
class RecognitionCycleLogic {
  // Quarterly recognition processing
  processQuarterlyRecognition(adminUserId: string): RecognitionResult {
    // Business Rule: Only administrators can trigger recognition cycles
    if (!this.isAdministrator(adminUserId)) {
      return { success: false, reason: "UNAUTHORIZED_ACCESS" }
    }
    
    // Business Rule: Identify top 3 approved ideas from current quarter
    const quarterStart = this.getCurrentQuarterStart()
    const quarterEnd = this.getCurrentQuarterEnd()
    
    const approvedIdeas = this.getApprovedIdeasInPeriod(quarterStart, quarterEnd)
    
    if (approvedIdeas.length < 3) {
      return { 
        success: false, 
        reason: "INSUFFICIENT_IDEAS_FOR_RECOGNITION",
        availableIdeas: approvedIdeas.length 
      }
    }
    
    // Sort by aggregate score and select top 3
    const topIdeas = approvedIdeas
      .sort((a, b) => b.aggregateScore.averageTotal - a.aggregateScore.averageTotal)
      .slice(0, 3)
    
    // Generate recognition awards
    const awards = this.generateRecognitionAwards(topIdeas)
    
    return { success: true, awards, recognizedIdeas: topIdeas }
  }
  
  // Award generation logic
  generateRecognitionAwards(topIdeas: Idea[]): RecognitionAward[] {
    return topIdeas.map((idea, index) => ({
      ideaId: idea.id,
      rank: index + 1,
      awardType: this.getAwardType(index + 1), // Gold, Silver, Bronze
      digitalBadge: this.createDigitalBadge(idea, index + 1),
      certificate: this.generateCertificate(idea, index + 1),
      announcement: this.createAnnouncement(idea, index + 1)
    }))
  }
}
```

### Recognition Business Rules
- **Timing**: Quarterly cycles triggered manually by administrators
- **Selection Criteria**: Top 3 approved ideas by aggregate score within quarter
- **Minimum Requirements**: At least 3 approved ideas needed for recognition cycle
- **Award Types**: Gold (1st), Silver (2nd), Bronze (3rd) digital badges
- **Permanence**: Recognition status is permanent and cannot be revoked

---

## 6. Notifications Component Business Logic

### Event-Driven Notification Logic
```typescript
class NotificationEventLogic {
  // Notification creation based on system events
  handleSystemEvent(event: SystemEvent): NotificationResult {
    switch (event.type) {
      case 'IDEA_SUBMITTED':
        return this.createIdeaSubmissionNotification(event.data)
      
      case 'EVALUATION_COMPLETED':
        return this.createEvaluationCompletionNotification(event.data)
      
      case 'IDEA_APPROVED':
        return this.createIdeaApprovalNotification(event.data)
      
      case 'IDEA_NOT_APPROVED':
        return this.createIdeaNotApprovalNotification(event.data)
      
      case 'RECOGNITION_ANNOUNCED':
        return this.createRecognitionNotification(event.data)
      
      default:
        return { success: false, reason: "UNKNOWN_EVENT_TYPE" }
    }
  }
  
  // Polling-based delivery mechanism
  getNotificationsForUser(userId: string): UserNotification[] {
    // Business Rule: Return unread notifications first, then recent read notifications
    const unreadNotifications = this.getUnreadNotifications(userId)
    const recentReadNotifications = this.getRecentReadNotifications(userId, 10)
    
    return [...unreadNotifications, ...recentReadNotifications]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
```

### Notification Business Rules
- **Delivery Method**: Polling-based, frontend checks every 30 seconds
- **Notification Types**: Idea status changes, evaluation completions, recognition announcements
- **User Targeting**: Role-based and user-specific notification delivery
- **Retention**: Keep notifications for 30 days, then archive
- **Read Status**: Track read/unread status per user

---

## 7. Security Component Business Logic

### Authorization Logic
```typescript
class AuthorizationLogic {
  // Role-based access control
  authorizeUserAction(userId: string, action: string, resource: string): AuthorizationResult {
    const user = this.getUserById(userId)
    const userRole = user.role
    
    // Business Rule: Flat role structure with specific permissions
    const rolePermissions = {
      'Employee': [
        'idea:create', 'idea:read_own', 'idea:update_own', 'idea:delete_own',
        'draft:create', 'draft:read_own', 'draft:update_own', 'draft:delete_own',
        'analytics:read_personal', 'notification:read_own'
      ],
      'Panel Member': [
        'evaluation:create', 'evaluation:read_assigned', 'evaluation:update_own',
        'idea:read_for_evaluation', 'analytics:read_dashboard', 'notification:read_own'
      ],
      'Administrator': [
        'user:create', 'user:read', 'user:update', 'user:delete',
        'recognition:trigger', 'recognition:manage', 'analytics:read_all',
        'system:configure', 'notification:read_all'
      ]
    }
    
    const allowedActions = rolePermissions[userRole] || []
    const actionKey = `${resource}:${action}`
    
    if (!allowedActions.includes(actionKey)) {
      return { 
        authorized: false, 
        reason: "INSUFFICIENT_PERMISSIONS",
        requiredPermission: actionKey 
      }
    }
    
    return { authorized: true }
  }
}
```

### Security Business Rules
- **Role Structure**: Flat roles (Employee, Panel Member, Administrator)
- **Permission Model**: Action-based permissions tied to roles
- **Resource Access**: Users can only access their own resources unless role permits
- **Session Security**: Validate session on every request
- **Audit Logging**: Log all security-related events and authorization failures

---

## Business Logic Integration Patterns

### Cross-Component Workflows
1. **Idea Submission Flow**: Ideas → Security → Notifications
2. **Evaluation Flow**: Evaluation → Ideas → Analytics → Notifications
3. **Recognition Flow**: Recognition → Analytics → Ideas → Notifications
4. **User Management Flow**: Security → Authentication → Notifications

### Error Handling Patterns
- **Structured Errors**: Return specific business error codes with context
- **Validation Errors**: Detailed field-level validation messages
- **Authorization Errors**: Clear permission requirement messages
- **System Errors**: Generic messages with detailed logging

### Data Consistency Patterns
- **Optimistic Locking**: Use version numbers for conflict detection
- **Transaction Boundaries**: Define clear transaction scopes for multi-component operations
- **Rollback Strategies**: Implement compensation patterns for failed operations
- **Conflict Resolution**: Handle concurrent modification scenarios gracefully

This business logic model provides the foundation for implementing all backend functionality according to the approved functional design requirements.