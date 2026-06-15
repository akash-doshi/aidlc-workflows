# Backend Unit - Infrastructure Design

## Overview
This document defines the complete infrastructure design for the Backend Unit, mapping logical components to specific AWS services for a production-ready deployment architecture that balances performance, security, and cost-effectiveness.

---

## Infrastructure Architecture Summary

### AWS Services Used
- **Compute**: EC2 instances (t3.medium/t3.large) with Application Load Balancer
- **Database**: RDS PostgreSQL (db.t3.small/db.t3.medium) single-AZ deployment
- **Storage**: S3 bucket for static files with CloudFront CDN
- **Networking**: Custom VPC with public/private subnets and security groups
- **Security**: AWS Certificate Manager for SSL/TLS, IAM roles and policies
- **Monitoring**: CloudWatch Logs and basic metrics
- **Scaling**: Auto Scaling Groups for compute optimization

### Environment Strategy
- **Single Production Environment**: Cost-effective approach for small-scale deployment
- **Development**: Local development environment with connection to production-like services
- **Future Expansion**: Architecture designed to support additional environments if needed

---

## 1. Compute Infrastructure

### EC2 Instance Configuration

#### Production Instance Specifications
```yaml
# Production EC2 Configuration
Instance Type: t3.large
vCPUs: 2
Memory: 8 GB
Network Performance: Up to 5 Gigabit
Storage: 20 GB GP3 EBS volume
Operating System: Amazon Linux 2023
```

#### Auto Scaling Configuration
```yaml
# Auto Scaling Group Configuration
Min Size: 1
Max Size: 3
Desired Capacity: 1
Target Group: ideation-portal-targets
Health Check Type: ELB
Health Check Grace Period: 300 seconds

# Scaling Policies
Scale Up Policy:
  - Metric: CPU Utilization > 70% for 2 consecutive periods
  - Action: Add 1 instance
  - Cooldown: 300 seconds

Scale Down Policy:
  - Metric: CPU Utilization < 30% for 5 consecutive periods
  - Action: Remove 1 instance
  - Cooldown: 300 seconds
```

### Application Load Balancer

#### ALB Configuration
```yaml
# Application Load Balancer
Name: ideation-portal-alb
Scheme: Internet-facing
IP Address Type: IPv4
Listeners:
  - Port: 80 (HTTP) -> Redirect to HTTPS
  - Port: 443 (HTTPS) -> Forward to Target Group

Target Group:
  Name: ideation-portal-targets
  Protocol: HTTP
  Port: 8000
  Health Check Path: /health/
  Health Check Interval: 30 seconds
  Healthy Threshold: 2
  Unhealthy Threshold: 5
```

#### SSL/TLS Configuration
```yaml
# SSL Certificate (AWS Certificate Manager)
Certificate Type: Public certificate
Domain Names:
  - ideation-portal.company.com
  - www.ideation-portal.company.com
Validation Method: DNS validation
Auto-renewal: Enabled
```

---

## 2. Database Infrastructure

### RDS PostgreSQL Configuration

#### Database Instance Specifications
```yaml
# RDS PostgreSQL Configuration
Engine: PostgreSQL 15.4
Instance Class: db.t3.medium
Allocated Storage: 100 GB (GP3)
Storage Autoscaling: Enabled (up to 1000 GB)
Multi-AZ: No (single-AZ for cost optimization)
Backup Retention: 0 days (per organizational requirements)
Maintenance Window: Sunday 03:00-04:00 UTC
```

#### Database Security Configuration
```yaml
# Database Security
VPC Security Group: rds-security-group
Subnet Group: private-db-subnet-group
Encryption at Rest: Enabled (AWS KMS)
Encryption in Transit: Required (SSL/TLS)
Parameter Group: Custom parameter group for performance tuning

# Database Parameters
shared_preload_libraries: pg_stat_statements
log_statement: all
log_min_duration_statement: 1000ms
max_connections: 100
```

### Database Connection Management

#### Connection Pooling Configuration
```python
# Django Database Configuration
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'ideation_portal',
        'USER': 'ideation_user',
        'PASSWORD': '${DB_PASSWORD}',  # From AWS Secrets Manager
        'HOST': '${RDS_ENDPOINT}',
        'PORT': '5432',
        'OPTIONS': {
            'sslmode': 'require',
            'connect_timeout': 10,
        },
        'CONN_MAX_AGE': 600,  # Connection pooling
    }
}

# Connection Pool Settings
DATABASE_POOL_SETTINGS = {
    'MAX_CONNS': 20,
    'MIN_CONNS': 5,
    'CONN_HEALTH_CHECKS': True,
    'CONN_MAX_AGE': 3600,
}
```

---

## 3. Storage Infrastructure

### S3 Static File Storage

#### S3 Bucket Configuration
```yaml
# S3 Bucket for Static Files
Bucket Name: ideation-portal-static-files
Region: us-east-1 (or selected region)
Versioning: Disabled
Public Access: Block all public access
Encryption: AES-256 server-side encryption

# Bucket Policy (CloudFront access only)
Policy: Allow CloudFront OAI access only
Lifecycle Rules:
  - Delete incomplete multipart uploads after 7 days
  - Transition to IA after 30 days (if applicable)
```

#### CloudFront CDN Configuration
```yaml
# CloudFront Distribution
Origin: S3 bucket (ideation-portal-static-files)
Origin Access Identity: Enabled
Default Cache Behavior:
  Viewer Protocol Policy: Redirect HTTP to HTTPS
  Allowed HTTP Methods: GET, HEAD
  Cache Policy: Managed-CachingOptimized
  TTL: Default 86400 seconds (24 hours)

# Custom Domain
Alternate Domain Names: static.ideation-portal.company.com
SSL Certificate: AWS Certificate Manager certificate
```

### Django Static Files Configuration
```python
# Django Static Files Settings
STATIC_URL = 'https://static.ideation-portal.company.com/'
STATIC_ROOT = '/opt/ideation-portal/staticfiles/'

# S3 Storage Configuration
AWS_STORAGE_BUCKET_NAME = 'ideation-portal-static-files'
AWS_S3_REGION_NAME = 'us-east-1'
AWS_S3_CUSTOM_DOMAIN = 'static.ideation-portal.company.com'
AWS_DEFAULT_ACL = None
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}

# Static files storage backend
STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
```

---

## 4. Networking Infrastructure

### VPC Architecture

#### VPC Configuration
```yaml
# Custom VPC
VPC CIDR: 10.0.0.0/16
DNS Hostnames: Enabled
DNS Resolution: Enabled

# Availability Zones: 2 AZs for redundancy
AZ-1: us-east-1a (or selected region equivalent)
AZ-2: us-east-1b (or selected region equivalent)

# Subnets
Public Subnet 1: 10.0.1.0/24 (AZ-1) - ALB, NAT Gateway
Public Subnet 2: 10.0.2.0/24 (AZ-2) - ALB redundancy
Private Subnet 1: 10.0.11.0/24 (AZ-1) - EC2 instances
Private Subnet 2: 10.0.12.0/24 (AZ-2) - RDS, future scaling
```

#### Internet Gateway and NAT Gateway
```yaml
# Internet Gateway
Internet Gateway: Attached to VPC
Route Table (Public): 0.0.0.0/0 -> Internet Gateway

# NAT Gateway (for private subnet internet access)
NAT Gateway: Located in Public Subnet 1
Elastic IP: Allocated for NAT Gateway
Route Table (Private): 0.0.0.0/0 -> NAT Gateway
```

### Security Groups

#### Application Security Group
```yaml
# EC2 Application Security Group
Name: app-security-group
Description: Security group for Django application servers

Inbound Rules:
  - Port 8000: Source ALB Security Group (HTTP from load balancer)
  - Port 22: Source Bastion/Admin IP (SSH access)

Outbound Rules:
  - Port 443: 0.0.0.0/0 (HTTPS outbound)
  - Port 80: 0.0.0.0/0 (HTTP outbound)
  - Port 5432: RDS Security Group (Database access)
```

#### Load Balancer Security Group
```yaml
# ALB Security Group
Name: alb-security-group
Description: Security group for Application Load Balancer

Inbound Rules:
  - Port 80: 0.0.0.0/0 (HTTP from internet)
  - Port 443: 0.0.0.0/0 (HTTPS from internet)

Outbound Rules:
  - Port 8000: App Security Group (Forward to application)
```

#### Database Security Group
```yaml
# RDS Security Group
Name: rds-security-group
Description: Security group for RDS PostgreSQL database

Inbound Rules:
  - Port 5432: App Security Group (Database access from application)

Outbound Rules:
  - None (database doesn't need outbound access)
```

---

## 5. Security Infrastructure

### IAM Roles and Policies

#### EC2 Instance Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/ec2/ideation-portal/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::ideation-portal-static-files/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:ideation-portal/*"
    }
  ]
}
```

#### Secrets Management
```yaml
# AWS Secrets Manager
Secret Name: ideation-portal/database
Secret Type: Database credentials
Rotation: Disabled (manual management)
Contents:
  - DB_PASSWORD: <generated-secure-password>
  - DB_USER: ideation_user
  - DB_NAME: ideation_portal
  - DB_HOST: <rds-endpoint>

Secret Name: ideation-portal/django
Secret Type: Application secrets
Contents:
  - SECRET_KEY: <django-secret-key>
  - AWS_ACCESS_KEY_ID: <s3-access-key>
  - AWS_SECRET_ACCESS_KEY: <s3-secret-key>
```

### Network Security

#### Network ACLs (Additional Security Layer)
```yaml
# Private Subnet NACL
Inbound Rules:
  - Rule 100: HTTP (80) from Public Subnets
  - Rule 110: HTTPS (443) from 0.0.0.0/0
  - Rule 120: PostgreSQL (5432) from Private Subnets
  - Rule 130: Ephemeral Ports (1024-65535) from 0.0.0.0/0

Outbound Rules:
  - Rule 100: HTTP (80) to 0.0.0.0/0
  - Rule 110: HTTPS (443) to 0.0.0.0/0
  - Rule 120: PostgreSQL (5432) to Private Subnets
  - Rule 130: Ephemeral Ports (1024-65535) to 0.0.0.0/0
```

---

## 6. Monitoring Infrastructure

### CloudWatch Configuration

#### CloudWatch Logs
```yaml
# Log Groups
Application Logs:
  Log Group: /aws/ec2/ideation-portal/application
  Retention: 30 days
  
System Logs:
  Log Group: /aws/ec2/ideation-portal/system
  Retention: 14 days

Database Logs:
  Log Group: /aws/rds/instance/ideation-portal-db/postgresql
  Retention: 7 days
```

#### CloudWatch Metrics and Alarms
```yaml
# Basic CloudWatch Alarms
High CPU Utilization:
  Metric: CPUUtilization
  Threshold: > 80%
  Period: 5 minutes
  Evaluation Periods: 2
  Action: SNS notification

High Memory Utilization:
  Metric: MemoryUtilization
  Threshold: > 85%
  Period: 5 minutes
  Evaluation Periods: 2
  Action: SNS notification

Database Connection Count:
  Metric: DatabaseConnections
  Threshold: > 80
  Period: 5 minutes
  Evaluation Periods: 1
  Action: SNS notification
```

### Application Health Monitoring
```python
# Django Health Check Configuration
HEALTH_CHECK_ENDPOINTS = {
    'database': '/health/database/',
    'application': '/health/application/',
    'storage': '/health/storage/',
}

# CloudWatch Custom Metrics
CLOUDWATCH_METRICS = {
    'namespace': 'IdeationPortal/Application',
    'metrics': [
        'user_logins',
        'idea_submissions',
        'evaluation_completions',
        'api_response_times',
    ]
}
```

---

## 7. Deployment Infrastructure

### Auto Scaling and Deployment

#### Launch Template Configuration
```yaml
# EC2 Launch Template
Name: ideation-portal-launch-template
Image ID: ami-0abcdef1234567890 (Amazon Linux 2023)
Instance Type: t3.large
Key Pair: ideation-portal-keypair
Security Groups: app-security-group
IAM Instance Profile: ideation-portal-ec2-role

User Data Script:
  - Install Docker and Docker Compose
  - Install CloudWatch agent
  - Configure application environment
  - Start application services
```

#### Deployment Process
```bash
# Deployment Automation Script
#!/bin/bash
# deploy.sh

# 1. Create new launch template version
aws ec2 create-launch-template-version \
  --launch-template-name ideation-portal-launch-template \
  --source-version 1 \
  --launch-template-data file://launch-template.json

# 2. Update Auto Scaling Group
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name ideation-portal-asg \
  --launch-template LaunchTemplateName=ideation-portal-launch-template,Version='$Latest'

# 3. Trigger instance refresh
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name ideation-portal-asg \
  --preferences MinHealthyPercentage=50,InstanceWarmup=300
```

---

## 8. Cost Optimization

### Auto Scaling Cost Optimization

#### Scaling Policies
```yaml
# Cost-Optimized Scaling
Target Tracking Scaling:
  Target Value: 50% CPU utilization
  Scale-out Cooldown: 300 seconds
  Scale-in Cooldown: 300 seconds

Scheduled Scaling (if applicable):
  Business Hours Scale-Up:
    Schedule: 0 8 * * MON-FRI
    Desired Capacity: 2
  
  Off-Hours Scale-Down:
    Schedule: 0 18 * * MON-FRI
    Desired Capacity: 1
```

#### Resource Optimization
```yaml
# Cost Monitoring
AWS Cost Explorer: Enabled
Budget Alerts:
  - Monthly budget: $500
  - Alert threshold: 80% of budget
  - Notification: Email to administrators

Reserved Instances:
  - Consider 1-year term for stable workloads
  - Evaluate after 3 months of usage data
  - Target: EC2 and RDS instances

Spot Instances:
  - Not recommended for production (single environment)
  - Consider for future development environments
```

---

## Infrastructure Design Validation

### Architecture Benefits
- ✅ **Scalability**: Auto Scaling Groups support growth from 1 to 3 instances
- ✅ **Security**: Custom VPC with private subnets and security groups
- ✅ **Performance**: Application Load Balancer with CloudFront CDN for static files
- ✅ **Reliability**: Multi-AZ ALB deployment with health checks
- ✅ **Cost Optimization**: Auto scaling and right-sized instances
- ✅ **Monitoring**: CloudWatch integration for logs and metrics
- ✅ **Maintainability**: Infrastructure as Code ready architecture

### Deployment Readiness
- ✅ **Compute**: EC2 instances with Auto Scaling Groups configured
- ✅ **Database**: RDS PostgreSQL with appropriate sizing and security
- ✅ **Storage**: S3 and CloudFront for static file delivery
- ✅ **Networking**: Custom VPC with proper subnet and security configuration
- ✅ **Security**: IAM roles, security groups, and SSL/TLS certificates
- ✅ **Monitoring**: CloudWatch logs, metrics, and basic alerting

### Future Expansion Capabilities
- **Multi-Environment**: Architecture supports adding staging/development environments
- **Geographic Expansion**: CloudFront enables global content delivery
- **High Availability**: Can upgrade to Multi-AZ RDS and cross-AZ deployment
- **Enhanced Monitoring**: Can add AWS X-Ray, custom dashboards, and advanced alerting
- **Backup Strategy**: Can implement automated backups and disaster recovery

This infrastructure design provides a robust, scalable, and cost-effective foundation for deploying the Backend Unit while maintaining the flexibility to enhance capabilities as requirements evolve.