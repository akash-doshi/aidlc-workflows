# Backend Unit - Business Rules

## Overview
This document defines comprehensive business rules for all components and services in the Backend Unit, including validation rules, workflow constraints, and business logic enforcement mechanisms.

---

## 1. Authentication Component Business Rules

### Login and Authentication Rules

#### Rule AUTH-001: Account Lockout Policy
- **Rule**: Lock user account after 5 consecutive failed login attempts
- **Duration**: 30 minutes lockout period
- **Reset**: Successful login resets failed attempt counter to zero
- **Scope**: Applies to all user roles
- **Implementation**: Track failed attempts per username, implement time-based unlock

#### Rule AUTH-002: Session Timeout Policy
- **Employee/Panel Member**: 8 hours (480 minutes) session timeout
- **Administrator**: 4 hours (240 minutes) session timeout
- **Inactivity**: Sessions expire after 2 hours of inactivity regardless of role
- **Concurrent Sessions**: Maximum 3 active sessions per user
- **Implementation**: Check session expiration on every request

#### Rule AUTH-003: Password Requirements
- **Minimum Length**: 8 characters
- **Complexity**: Must contain at least one letter and one number
- **History**: Cannot reuse last 3 passwords
- **Expiration**: Passwords expire after 90 days for administrators, 180 days for others
- **Implementation**: Validate on password creation and update

#### Rule AUTH-004: Session Security
- **Session ID**: 64-character cryptographically secure random string
- **IP Binding**: Sessions are bound to originating IP address
- **User Agent**: Track user agent for session validation
- **Secure Cookies**: Use secure, HTTP-only cookies for session management
- **Implementation**: Generate secure session IDs, validate IP and user agent

### Account Management Rules

#### Rule AUTH-005: User Account Creation
- **Username**: Must be unique, 3-50 characters, alphanumeric and underscore only
- **Email**: Must be unique, valid email format
- **Role Assignment**: Only administrators can create accounts and assign roles
- **Default Status**: New accounts are active by default
- **Implementation**: Validate uniqueness constraints, enforce role-based creation

#### Rule AUTH-006: Account Deactivation
- **Soft Delete**: Deactivate accounts rather than hard delete
- **Data Retention**: Maintain user data for audit purposes
- **Session Termination**: Terminate all active sessions when account is deactivated
- **Reactivation**: Only administrators can reactivate deactivated accounts
- **Implementation**: Set isActive flag, terminate sessions, maintain audit trail

---

## 2. Ideas Component Business Rules

### Idea Submission Rules

#### Rule IDEA-001: Submission Limits
- **Per User Limit**: Maximum 5 active ideas per user at any time
- **Active Definition**: Ideas with status Draft, Submitted, or Approved
- **Enforcement**: Prevent new submissions when limit reached
- **Reset**: Limit resets when ideas move to Not Approved or Recognized status
- **Implementation**: Count active ideas before allowing new submissions

#### Rule IDEA-002: Required Content Validation
- **Title**: Required, 5-100 characters, trimmed
- **Description**: Required, 20-2000 characters, trimmed
- **Expected Benefits**: Required, 10-1000 characters, trimmed
- **Category**: Required, must be from predefined list
- **Implementation**: Server-side validation with detailed error messages

#### Rule IDEA-003: Category Assignment
- **Valid Categories**: IT, HR, Operations, Finance, Marketing, Sales, Other
- **Auto-Assignment**: If not specified, infer from description content
- **User Override**: Users can override auto-assigned category
- **Default**: Use "Other" if category cannot be inferred
- **Implementation**: Content analysis for auto-assignment, validation against enum

#### Rule IDEA-004: Status Lifecycle Management
- **Valid Transitions**: 
  - Draft → Submitted
  - Submitted → Approved OR Not Approved
  - Approved → Recognized
- **No Resubmission**: Ideas marked "Not Approved" cannot be resubmitted
- **Final Status**: "Recognized" is a final status with no further transitions
- **Implementation**: Validate status transitions, prevent invalid changes

### Draft Management Rules

#### Rule IDEA-005: Auto-Save Functionality
- **Frequency**: Auto-save every 30 seconds during active typing
- **Trigger**: Only save when content has changed since last save
- **Version Limit**: Keep maximum 5 versions per draft
- **Cleanup**: Remove oldest versions when limit exceeded
- **Implementation**: Client-side timer with change detection, server-side version management

#### Rule IDEA-006: Draft Retention Policy
- **Maximum Drafts**: 10 drafts per user
- **Age Limit**: Drafts older than 90 days are automatically deleted
- **Conversion**: Converting draft to idea removes draft record
- **User Cleanup**: Users can manually delete their own drafts
- **Implementation**: Scheduled cleanup job, user-initiated deletion

### Idea Ownership Rules

#### Rule IDEA-007: Ownership and Access Control
- **Creator Rights**: Users can view, edit, and delete their own ideas (Draft status only)
- **Read Access**: Panel members can read ideas assigned for evaluation
- **Admin Access**: Administrators have read access to all ideas
- **Modification Limits**: Only creators can modify ideas in Draft status
- **Implementation**: Role-based access control with ownership validation

---

## 3. Evaluation Component Business Rules

### Evaluation Assignment Rules

#### Rule EVAL-001: Evaluation Eligibility
- **Self-Evaluation**: Panel members cannot evaluate their own ideas
- **Duplicate Prevention**: Panel members cannot evaluate the same idea twice
- **Status Requirement**: Only ideas with "Submitted" status can be evaluated
- **Role Requirement**: Only users with "Panel Member" role can perform evaluations
- **Implementation**: Database constraints and application-level validation

#### Rule EVAL-002: Evaluation Requirements
- **Required Evaluations**: Each idea must receive exactly 2 evaluations
- **Panel Member Selection**: Panel members self-select ideas to evaluate
- **Completion Requirement**: All three criteria must be scored to complete evaluation
- **Optional Comments**: Comments are optional but encouraged
- **Implementation**: Track evaluation count, validate completion criteria

### Scoring Rules

#### Rule EVAL-003: Scoring Scale and Validation
- **Scale**: 1-10 integer scale for each criterion
- **Criteria**: Feasibility, Impact, Innovation (all required)
- **Total Score**: Sum of three criteria (3-30 range)
- **Input Validation**: Reject non-integer or out-of-range scores
- **Implementation**: Server-side validation with specific error messages

#### Rule EVAL-004: Approval Criteria
- **Individual Criterion Minimum**: Each criterion must score 6 or higher
- **Total Score Minimum**: Total score must be greater than 24 (not equal)
- **Both Evaluations**: Both panel member evaluations must meet criteria
- **Approval Decision**: Idea approved only if both evaluations meet all criteria
- **Implementation**: Validate each evaluation against criteria, aggregate for final decision

### Evaluation Workflow Rules

#### Rule EVAL-005: Evaluation Process Management
- **Start Tracking**: Record evaluation start timestamp when panel member begins
- **Completion Tracking**: Record completion timestamp when all scores submitted
- **Session Management**: Allow partial completion with session persistence
- **Timeout**: Incomplete evaluations timeout after 24 hours
- **Implementation**: Track evaluation sessions, implement timeout cleanup

#### Rule EVAL-006: Evaluation Modification Rules
- **Edit Window**: Panel members can modify evaluations within 1 hour of completion
- **Version Control**: Track evaluation changes with version numbers
- **Final Lock**: Evaluations are locked once idea status changes from "Submitted"
- **Audit Trail**: Maintain complete history of evaluation changes
- **Implementation**: Time-based edit windows, version tracking, audit logging

---

## 4. Analytics Component Business Rules

### Data Processing Rules

#### Rule ANALYTICS-001: Batch Processing Schedule
- **Frequency**: Daily batch processing at midnight (00:00 UTC)
- **Data Freshness**: Analytics data is up to 24 hours old
- **Processing Window**: Allow 2-hour window for processing completion
- **Failure Handling**: Retry failed processing up to 3 times
- **Implementation**: Scheduled job with retry logic and monitoring

#### Rule ANALYTICS-002: Data Inclusion Criteria
- **Leaderboard**: Only include ideas with "Approved" status
- **Metrics Calculation**: Include all ideas regardless of status for submission metrics
- **Time Ranges**: Support daily, weekly, monthly, and quarterly aggregations
- **Department Filtering**: Support analytics by department/category
- **Implementation**: Status-based filtering, configurable time ranges

### Performance Rules

#### Rule ANALYTICS-003: Caching Strategy
- **Cache Duration**: Cache analytics results for 24 hours
- **Cache Invalidation**: Invalidate cache when new evaluations complete
- **Cache Keys**: Use combination of date, filters, and user role for cache keys
- **Memory Management**: Limit cache size to prevent memory issues
- **Implementation**: Redis or in-memory cache with TTL and size limits

#### Rule ANALYTICS-004: Query Optimization
- **Database Indexes**: Maintain indexes on frequently queried fields
- **Query Limits**: Limit result sets to prevent performance issues
- **Pagination**: Implement pagination for large result sets
- **Aggregation**: Use database aggregation functions for calculations
- **Implementation**: Optimized SQL queries with proper indexing

### Access Control Rules

#### Rule ANALYTICS-005: Role-Based Analytics Access
- **Personal Analytics**: Users can view their own submission and performance data
- **Dashboard Access**: Panel members and administrators can view system dashboards
- **Detailed Analytics**: Only administrators can access detailed system analytics
- **Data Privacy**: Users cannot see other users' personal analytics
- **Implementation**: Role-based filtering and data access controls

---

## 5. Recognition Component Business Rules

### Recognition Cycle Rules

#### Rule RECOG-001: Cycle Timing and Triggers
- **Frequency**: Quarterly recognition cycles (Q1, Q2, Q3, Q4)
- **Manual Trigger**: Only administrators can initiate recognition cycles
- **Minimum Ideas**: Require at least 3 approved ideas to run recognition cycle
- **Cycle Overlap**: Cannot run multiple recognition cycles simultaneously
- **Implementation**: Admin-only trigger, validation of minimum requirements

#### Rule RECOG-002: Winner Selection Criteria
- **Selection Pool**: Only ideas with "Approved" status from current quarter
- **Ranking Method**: Rank by aggregate total score (highest first)
- **Winner Count**: Select top 3 ideas for recognition
- **Tie Breaking**: Use submission date (earlier submission wins) for tie breaking
- **Implementation**: Score-based ranking with tie-breaking logic

### Award Management Rules

#### Rule RECOG-003: Award Types and Distribution
- **Award Levels**: Gold (1st), Silver (2nd), Bronze (3rd)
- **Digital Badges**: Generate unique digital badge for each award level
- **Certificates**: Create personalized certificates for idea submitters
- **Public Display**: Display winners on public leaderboards and announcements
- **Implementation**: Award generation system with template-based certificates

#### Rule RECOG-004: Recognition Permanence
- **Permanent Status**: Recognition status cannot be revoked or changed
- **Historical Record**: Maintain complete history of all recognition cycles
- **Audit Trail**: Track who initiated recognition and when
- **Data Retention**: Preserve recognition data permanently
- **Implementation**: Immutable recognition records with audit logging

---

## 6. Notifications Component Business Rules

### Notification Creation Rules

#### Rule NOTIF-001: Event-Driven Notification Triggers
- **Idea Events**: Notify on idea submission, status changes, recognition
- **Evaluation Events**: Notify on evaluation completion, approval decisions
- **System Events**: Notify on recognition announcements, system maintenance
- **User Events**: Notify on account changes, role modifications
- **Implementation**: Event-driven architecture with notification handlers

#### Rule NOTIF-002: Notification Targeting
- **User-Specific**: Target notifications to specific users based on ownership
- **Role-Based**: Send notifications to all users with specific roles
- **System-Wide**: Broadcast important announcements to all users
- **Opt-Out**: Allow users to configure notification preferences
- **Implementation**: Flexible targeting system with user preferences

### Delivery and Management Rules

#### Rule NOTIF-003: Delivery Mechanism
- **Polling-Based**: Frontend polls for notifications every 30 seconds
- **Batch Delivery**: Group multiple notifications for efficient delivery
- **Priority Handling**: Prioritize urgent notifications over routine ones
- **Retry Logic**: Retry failed notification deliveries up to 3 times
- **Implementation**: RESTful API with polling endpoints and retry mechanisms

#### Rule NOTIF-004: Notification Lifecycle
- **Retention Period**: Keep notifications for 30 days after creation
- **Read Status**: Track read/unread status per user
- **Cleanup**: Automatically delete notifications older than retention period
- **User Actions**: Allow users to mark as read, delete, or archive notifications
- **Implementation**: Scheduled cleanup with user action tracking

---

## 7. Security Component Business Rules

### Authorization Rules

#### Rule SEC-001: Role-Based Access Control
- **Flat Role Structure**: Users have exactly one role (Employee, Panel Member, Administrator)
- **Permission Mapping**: Each role has specific permissions for actions and resources
- **Resource Ownership**: Users can access their own resources regardless of role
- **Admin Override**: Administrators have access to all resources
- **Implementation**: Permission matrix with role-based and ownership-based access

#### Rule SEC-002: Action Authorization Matrix
```
Employee Permissions:
- idea:create, idea:read_own, idea:update_own, idea:delete_own
- draft:create, draft:read_own, draft:update_own, draft:delete_own
- analytics:read_personal, notification:read_own

Panel Member Permissions:
- evaluation:create, evaluation:read_assigned, evaluation:update_own
- idea:read_for_evaluation, analytics:read_dashboard, notification:read_own

Administrator Permissions:
- user:create, user:read, user:update, user:delete
- recognition:trigger, recognition:manage, analytics:read_all
- system:configure, notification:read_all
```

### Data Security Rules

#### Rule SEC-003: Data Access Validation
- **Request Validation**: Validate all incoming requests for required parameters
- **SQL Injection Prevention**: Use parameterized queries for all database operations
- **Input Sanitization**: Sanitize all user inputs to prevent XSS attacks
- **Output Encoding**: Encode all outputs to prevent injection attacks
- **Implementation**: Input validation middleware, parameterized queries, output encoding

#### Rule SEC-004: Audit and Logging
- **Security Events**: Log all authentication, authorization, and security-related events
- **User Actions**: Log significant user actions (create, update, delete operations)
- **Failed Attempts**: Log all failed authentication and authorization attempts
- **Data Changes**: Maintain audit trail for sensitive data modifications
- **Implementation**: Comprehensive logging system with structured log format

### Session Security Rules

#### Rule SEC-005: Session Validation
- **Every Request**: Validate session on every API request
- **IP Validation**: Verify request IP matches session IP
- **Expiration Check**: Verify session has not expired
- **Activity Update**: Update last activity timestamp on valid requests
- **Implementation**: Session middleware with comprehensive validation

#### Rule SEC-006: Security Headers and HTTPS
- **HTTPS Only**: All communications must use HTTPS
- **Security Headers**: Implement security headers (HSTS, CSP, X-Frame-Options)
- **CORS Policy**: Configure appropriate CORS policy for frontend access
- **Rate Limiting**: Implement rate limiting to prevent abuse
- **Implementation**: Security middleware with header configuration and rate limiting

---

## Business Rule Enforcement Mechanisms

### Validation Layers

#### Layer 1: Frontend Validation (User Experience)
- **Purpose**: Immediate user feedback and improved user experience
- **Scope**: Basic format validation, required field checks
- **Security**: Not trusted for security purposes
- **Implementation**: Client-side JavaScript validation

#### Layer 2: API Validation (Security)
- **Purpose**: Security enforcement and data integrity
- **Scope**: Complete business rule validation
- **Security**: Primary security enforcement layer
- **Implementation**: Server-side validation middleware

#### Layer 3: Database Constraints (Data Integrity)
- **Purpose**: Final data integrity enforcement
- **Scope**: Critical constraints and referential integrity
- **Security**: Last line of defense against data corruption
- **Implementation**: Database constraints and triggers

### Error Handling Standards

#### Structured Error Response Format
```typescript
interface BusinessRuleError {
  success: false
  errorCode: string          // Specific business error code
  message: string           // User-friendly error message
  details?: any            // Additional error context
  field?: string           // Field name for validation errors
  timestamp: Date          // Error timestamp
}
```

#### Error Code Categories
- **AUTH-xxx**: Authentication and session errors
- **AUTHZ-xxx**: Authorization and permission errors
- **VALID-xxx**: Validation and business rule errors
- **DATA-xxx**: Data integrity and consistency errors
- **SYS-xxx**: System and infrastructure errors

### Monitoring and Compliance

#### Rule Violation Monitoring
- **Real-time Alerts**: Alert on critical business rule violations
- **Metrics Collection**: Collect metrics on rule enforcement effectiveness
- **Trend Analysis**: Analyze patterns in rule violations
- **Compliance Reporting**: Generate compliance reports for audit purposes
- **Implementation**: Monitoring system with alerting and reporting capabilities

This comprehensive business rules framework ensures consistent enforcement of all business logic across the Backend Unit while maintaining security, data integrity, and user experience standards.