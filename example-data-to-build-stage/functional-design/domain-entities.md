# Backend Unit - Domain Entities

## Overview
This document defines the complete domain model for the Backend Unit, including all entities, relationships, data structures, and validation rules based on the approved functional design approach.

---

## Core Domain Entities

### 1. User Entity

```typescript
interface User {
  // Primary identifiers
  id: string                    // UUID primary key
  username: string              // Unique username for login
  email: string                 // User email address
  
  // User information
  firstName: string             // User's first name
  lastName: string              // User's last name
  department: string            // User's department/category
  
  // Authentication and security
  hashedPassword: string        // Bcrypt hashed password
  role: UserRole               // Single role assignment (flat structure)
  isActive: boolean            // Account active status
  
  // Account management
  createdAt: Date              // Account creation timestamp
  updatedAt: Date              // Last profile update
  lastLoginAt?: Date           // Last successful login
  failedLoginAttempts: number  // Failed login counter
  accountLockedUntil?: Date    // Account lock expiration
  
  // Audit fields
  createdBy: string            // Admin who created account
  version: number              // Optimistic locking version
}

enum UserRole {
  Employee = 'Employee',
  PanelMember = 'Panel Member', 
  Administrator = 'Administrator'
}

// Validation Rules
const UserValidation = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    unique: true
  },
  email: {
    required: true,
    format: 'email',
    unique: true
  },
  firstName: {
    required: true,
    minLength: 1,
    maxLength: 50
  },
  lastName: {
    required: true,
    minLength: 1,
    maxLength: 50
  },
  department: {
    required: true,
    enum: ['IT', 'HR', 'Operations', 'Finance', 'Marketing', 'Sales', 'Other']
  },
  password: {
    minLength: 8,
    requiresLetters: true,
    requiresNumbers: true
  }
}
```

### 2. Idea Entity

```typescript
interface Idea {
  // Primary identifiers
  id: string                   // UUID primary key
  userId: string               // Foreign key to User (submitter)
  
  // Idea content
  title: string                // Idea title
  description: string          // Detailed idea description
  expectedBenefits: string     // Expected benefits description
  category: string             // Department/category classification
  
  // Lifecycle management
  status: IdeaStatus          // Current idea status
  submittedAt: Date           // Submission timestamp
  evaluationStartedAt?: Date  // When evaluation began
  evaluationCompletedAt?: Date // When evaluation finished
  recognizedAt?: Date         // Recognition timestamp (if applicable)
  
  // Metadata
  version: number             // Optimistic locking version
  createdAt: Date            // Creation timestamp
  updatedAt: Date            // Last modification timestamp
}

enum IdeaStatus {
  Draft = 'Draft',
  Submitted = 'Submitted',
  Approved = 'Approved', 
  NotApproved = 'Not Approved',
  Recognized = 'Recognized'
}

// Validation Rules
const IdeaValidation = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 100,
    trim: true
  },
  description: {
    required: true,
    minLength: 20,
    maxLength: 2000,
    trim: true
  },
  expectedBenefits: {
    required: true,
    minLength: 10,
    maxLength: 1000,
    trim: true
  },
  category: {
    required: true,
    enum: ['IT', 'HR', 'Operations', 'Finance', 'Marketing', 'Sales', 'Other']
  }
}

// Business Constraints
const IdeaConstraints = {
  maxActiveIdeasPerUser: 5,
  statusTransitions: {
    'Draft': ['Submitted'],
    'Submitted': ['Approved', 'Not Approved'],
    'Approved': ['Recognized'],
    'Not Approved': [], // No resubmission allowed
    'Recognized': []    // Final status
  }
}
```

### 3. Draft Entity

```typescript
interface Draft {
  // Primary identifiers
  id: string                   // UUID primary key
  userId: string               // Foreign key to User
  
  // Draft content (partial idea data)
  title?: string               // Optional draft title
  description?: string         // Optional draft description
  expectedBenefits?: string    // Optional draft benefits
  category?: string            // Optional draft category
  
  // Version management
  version: number              // Draft version number
  autoSavedAt: Date           // Last auto-save timestamp
  manualSavedAt?: Date        // Last manual save timestamp
  
  // Metadata
  createdAt: Date             // Draft creation timestamp
  updatedAt: Date             // Last modification timestamp
}

// Validation Rules
const DraftValidation = {
  title: {
    maxLength: 100,
    trim: true
  },
  description: {
    maxLength: 2000,
    trim: true
  },
  expectedBenefits: {
    maxLength: 1000,
    trim: true
  }
}

// Business Constraints
const DraftConstraints = {
  maxVersionsPerDraft: 5,      // Keep last 5 versions
  autoSaveIntervalSeconds: 30,  // Auto-save every 30 seconds
  maxDraftsPerUser: 10         // Maximum drafts per user
}
```

### 4. Evaluation Entity

```typescript
interface Evaluation {
  // Primary identifiers
  id: string                   // UUID primary key
  ideaId: string              // Foreign key to Idea
  panelMemberId: string       // Foreign key to User (panel member)
  
  // Evaluation scores (embedded structure)
  scores: {
    feasibilityScore: number   // 1-10 scale
    impactScore: number        // 1-10 scale
    innovationScore: number    // 1-10 scale
  }
  
  // Additional evaluation data
  comments?: string           // Optional evaluation comments
  totalScore: number          // Calculated total (sum of criteria)
  
  // Evaluation workflow
  startedAt: Date            // Evaluation start timestamp
  completedAt?: Date         // Evaluation completion timestamp
  isComplete: boolean        // Completion status flag
  
  // Metadata
  version: number            // Optimistic locking version
  createdAt: Date           // Creation timestamp
  updatedAt: Date           // Last modification timestamp
}

// Validation Rules
const EvaluationValidation = {
  feasibilityScore: {
    required: true,
    min: 1,
    max: 10,
    integer: true
  },
  impactScore: {
    required: true,
    min: 1,
    max: 10,
    integer: true
  },
  innovationScore: {
    required: true,
    min: 1,
    max: 10,
    integer: true
  },
  comments: {
    maxLength: 500,
    trim: true
  }
}

// Business Constraints
const EvaluationConstraints = {
  requiredEvaluationsPerIdea: 2,
  minimumScorePerCriterion: 6,
  minimumTotalScore: 24,        // Must be > 24 for approval
  maxTotalScore: 30,
  duplicatePreventionConstraint: 'UNIQUE(panelMemberId, ideaId)'
}
```

### 5. Session Entity

```typescript
interface Session {
  // Primary identifiers
  id: string                   // Session ID (secure random)
  userId: string               // Foreign key to User
  
  // Session data
  createdAt: Date             // Session creation timestamp
  expiresAt: Date             // Session expiration timestamp
  lastActivityAt: Date        // Last activity timestamp
  ipAddress: string           // Client IP address
  userAgent: string           // Client user agent
  
  // Session status
  isActive: boolean           // Session active status
  terminatedAt?: Date         // Manual termination timestamp
  terminationReason?: string  // Termination reason
}

// Validation Rules
const SessionValidation = {
  id: {
    required: true,
    length: 64,                // 64-character secure random string
    pattern: /^[a-zA-Z0-9]+$/
  },
  ipAddress: {
    required: true,
    format: 'ip'
  }
}

// Business Constraints
const SessionConstraints = {
  maxSessionDurationMinutes: {
    'Employee': 480,           // 8 hours
    'Panel Member': 480,       // 8 hours
    'Administrator': 240       // 4 hours
  },
  maxConcurrentSessions: 3,    // Per user
  sessionCleanupIntervalHours: 24
}
```

### 6. Notification Entity

```typescript
interface Notification {
  // Primary identifiers
  id: string                   // UUID primary key
  userId: string               // Foreign key to User (recipient)
  
  // Notification content
  type: NotificationType      // Notification type enum
  title: string               // Notification title
  message: string             // Notification message content
  data?: any                  // Additional structured data
  
  // Notification status
  isRead: boolean             // Read status
  readAt?: Date              // Read timestamp
  
  // Metadata
  createdAt: Date            // Creation timestamp
  expiresAt?: Date           // Optional expiration timestamp
}

enum NotificationType {
  IdeaSubmitted = 'IDEA_SUBMITTED',
  EvaluationCompleted = 'EVALUATION_COMPLETED',
  IdeaApproved = 'IDEA_APPROVED',
  IdeaNotApproved = 'IDEA_NOT_APPROVED',
  RecognitionAnnounced = 'RECOGNITION_ANNOUNCED',
  SystemAnnouncement = 'SYSTEM_ANNOUNCEMENT'
}

// Validation Rules
const NotificationValidation = {
  title: {
    required: true,
    maxLength: 100,
    trim: true
  },
  message: {
    required: true,
    maxLength: 500,
    trim: true
  },
  type: {
    required: true,
    enum: Object.values(NotificationType)
  }
}

// Business Constraints
const NotificationConstraints = {
  retentionDays: 30,           // Keep notifications for 30 days
  maxNotificationsPerUser: 100, // Cleanup old notifications
  pollingIntervalSeconds: 30    // Frontend polling frequency
}
```

### 7. Recognition Entity

```typescript
interface Recognition {
  // Primary identifiers
  id: string                   // UUID primary key
  cycleId: string             // Recognition cycle identifier
  ideaId: string              // Foreign key to Idea
  
  // Recognition details
  rank: number                // Recognition rank (1, 2, 3)
  awardType: AwardType        // Award type enum
  quarter: string             // Recognition quarter (e.g., "2026-Q1")
  year: number                // Recognition year
  
  // Award artifacts
  digitalBadgeUrl: string     // URL to digital badge image
  certificateUrl: string      // URL to certificate document
  announcementText: string    // Recognition announcement text
  
  // Metadata
  awardedAt: Date            // Recognition award timestamp
  awardedBy: string          // Admin who triggered recognition
  createdAt: Date           // Creation timestamp
}

enum AwardType {
  Gold = 'Gold',     // 1st place
  Silver = 'Silver', // 2nd place
  Bronze = 'Bronze'  // 3rd place
}

// Validation Rules
const RecognitionValidation = {
  rank: {
    required: true,
    min: 1,
    max: 3,
    integer: true
  },
  quarter: {
    required: true,
    pattern: /^\d{4}-Q[1-4]$/  // Format: YYYY-Q#
  },
  year: {
    required: true,
    min: 2020,
    max: 2100
  },
  announcementText: {
    required: true,
    maxLength: 1000,
    trim: true
  }
}

// Business Constraints
const RecognitionConstraints = {
  maxRecognitionsPerCycle: 3,   // Top 3 ideas per quarter
  minimumIdeasForCycle: 3,      // Need at least 3 approved ideas
  cycleFrequency: 'quarterly'   // Recognition cycles run quarterly
}
```

---

## Entity Relationships

### Primary Relationships

```typescript
// User relationships
User 1:N Idea (user can submit multiple ideas)
User 1:N Draft (user can have multiple drafts)
User 1:N Evaluation (panel member can evaluate multiple ideas)
User 1:N Session (user can have multiple sessions)
User 1:N Notification (user can receive multiple notifications)

// Idea relationships  
Idea 1:N Evaluation (idea can have multiple evaluations)
Idea 1:1 Recognition (idea can have one recognition, optional)

// Evaluation relationships
Evaluation N:1 Idea (multiple evaluations per idea)
Evaluation N:1 User (multiple evaluations per panel member)

// Recognition relationships
Recognition N:1 Idea (multiple recognitions possible, but typically one)
Recognition N:1 User (awarded by admin)

// Session relationships
Session N:1 User (multiple sessions per user)

// Notification relationships
Notification N:1 User (multiple notifications per user)
```

### Referential Integrity Constraints

```sql
-- Foreign key constraints
ALTER TABLE ideas ADD CONSTRAINT fk_ideas_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE drafts ADD CONSTRAINT fk_drafts_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE evaluations ADD CONSTRAINT fk_evaluations_idea_id 
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE;

ALTER TABLE evaluations ADD CONSTRAINT fk_evaluations_panel_member_id 
  FOREIGN KEY (panel_member_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE sessions ADD CONSTRAINT fk_sessions_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user_id 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE recognitions ADD CONSTRAINT fk_recognitions_idea_id 
  FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE;

-- Unique constraints
ALTER TABLE users ADD CONSTRAINT uk_users_username UNIQUE (username);
ALTER TABLE users ADD CONSTRAINT uk_users_email UNIQUE (email);
ALTER TABLE evaluations ADD CONSTRAINT uk_evaluations_panel_member_idea 
  UNIQUE (panel_member_id, idea_id);
```

---

## Data Access Patterns

### Repository Interfaces

```typescript
interface UserRepository {
  findById(id: string): Promise<User | null>
  findByUsername(username: string): Promise<User | null>
  findByEmail(email: string): Promise<User | null>
  create(user: CreateUserRequest): Promise<User>
  update(id: string, updates: UpdateUserRequest): Promise<User>
  delete(id: string): Promise<void>
  findByRole(role: UserRole): Promise<User[]>
}

interface IdeaRepository {
  findById(id: string): Promise<Idea | null>
  findByUserId(userId: string): Promise<Idea[]>
  findByStatus(status: IdeaStatus): Promise<Idea[]>
  findByCategory(category: string): Promise<Idea[]>
  create(idea: CreateIdeaRequest): Promise<Idea>
  update(id: string, updates: UpdateIdeaRequest): Promise<Idea>
  delete(id: string): Promise<void>
  findActiveIdeasByUser(userId: string): Promise<Idea[]>
}

interface EvaluationRepository {
  findById(id: string): Promise<Evaluation | null>
  findByIdeaId(ideaId: string): Promise<Evaluation[]>
  findByPanelMemberId(panelMemberId: string): Promise<Evaluation[]>
  create(evaluation: CreateEvaluationRequest): Promise<Evaluation>
  update(id: string, updates: UpdateEvaluationRequest): Promise<Evaluation>
  checkDuplicateEvaluation(panelMemberId: string, ideaId: string): Promise<boolean>
}
```

### Query Optimization Strategies

```sql
-- Performance indexes
CREATE INDEX idx_ideas_user_id ON ideas(user_id);
CREATE INDEX idx_ideas_status ON ideas(status);
CREATE INDEX idx_ideas_category ON ideas(category);
CREATE INDEX idx_ideas_submitted_at ON ideas(submitted_at);

CREATE INDEX idx_evaluations_idea_id ON evaluations(idea_id);
CREATE INDEX idx_evaluations_panel_member_id ON evaluations(panel_member_id);
CREATE INDEX idx_evaluations_completed_at ON evaluations(completed_at);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

-- Composite indexes for common queries
CREATE INDEX idx_ideas_user_status ON ideas(user_id, status);
CREATE INDEX idx_evaluations_idea_complete ON evaluations(idea_id, is_complete);
```

---

## Domain Model Validation

### Entity Validation Summary
- ✅ **User Entity**: Complete with authentication, role management, and audit fields
- ✅ **Idea Entity**: Full lifecycle support with status transitions and constraints
- ✅ **Draft Entity**: Auto-save functionality with version management
- ✅ **Evaluation Entity**: Embedded scoring structure with business rule validation
- ✅ **Session Entity**: Comprehensive session management with security tracking
- ✅ **Notification Entity**: Event-driven notification system with retention policies
- ✅ **Recognition Entity**: Quarterly recognition cycles with award management

### Relationship Validation
- ✅ All foreign key relationships properly defined
- ✅ Referential integrity constraints implemented
- ✅ Unique constraints for business rules (duplicate evaluation prevention)
- ✅ Cascade delete policies for data consistency

### Business Rule Integration
- ✅ Flat role structure (single role per user)
- ✅ Idea status lifecycle (Draft → Submitted → Approved/Not Approved → Recognized)
- ✅ Evaluation scoring rules (1-10 scale, minimum thresholds)
- ✅ Recognition timing (quarterly cycles)
- ✅ Session management (role-based timeouts)
- ✅ Notification delivery (polling-based)

This domain model provides a complete foundation for implementing all backend functionality according to the approved functional design requirements.