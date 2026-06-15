# Backend Unit - Deployment Architecture

## Overview
This document provides detailed deployment architecture diagrams, procedures, and operational guidance for the Backend Unit infrastructure on AWS.

---

## Architecture Diagram

### High-Level Architecture
```
Internet
    |
    v
[Route 53 DNS]
    |
    v
[CloudFront CDN] -----> [S3 Static Files]
    |
    v
[Application Load Balancer]
    |
    v
[Auto Scaling Group]
    |
    v
[EC2 Instances (Django + Gunicorn + Nginx)]
    |
    v
[RDS PostgreSQL Database]
```

### Network Architecture
```
VPC (10.0.0.0/16)
├── Public Subnet 1 (10.0.1.0/24) - AZ-1
│   ├── Application Load Balancer
│   └── NAT Gateway
├── Public Subnet 2 (10.0.2.0/24) - AZ-2
│   └── Application Load Balancer (redundancy)
├── Private Subnet 1 (10.0.11.0/24) - AZ-1
│   └── EC2 Instances (Auto Scaling Group)
└── Private Subnet 2 (10.0.12.0/24) - AZ-2
    └── RDS PostgreSQL Database
```

## Deployment Procedures

### Initial Infrastructure Setup

#### 1. VPC and Networking Setup
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=ideation-portal-vpc}]'

# Create Internet Gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=ideation-portal-igw}]'

# Create Subnets
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.11.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxx --cidr-block 10.0.12.0/24 --availability-zone us-east-1b
```
#### 2. Security Groups Creation
```bash
# Application Load Balancer Security Group
aws ec2 create-security-group \
  --group-name alb-security-group \
  --description "Security group for Application Load Balancer" \
  --vpc-id vpc-xxx

# EC2 Application Security Group
aws ec2 create-security-group \
  --group-name app-security-group \
  --description "Security group for Django application servers" \
  --vpc-id vpc-xxx

# RDS Database Security Group
aws ec2 create-security-group \
  --group-name rds-security-group \
  --description "Security group for RDS PostgreSQL database" \
  --vpc-id vpc-xxx
```

#### 3. RDS Database Setup
```bash
# Create DB Subnet Group
aws rds create-db-subnet-group \
  --db-subnet-group-name ideation-portal-db-subnet-group \
  --db-subnet-group-description "Subnet group for Ideation Portal database" \
  --subnet-ids subnet-xxx subnet-yyy

# Create RDS Instance
aws rds create-db-instance \
  --db-instance-identifier ideation-portal-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 100 \
  --storage-type gp3 \
  --db-name ideation_portal \
  --master-username ideation_user \
  --master-user-password <secure-password> \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name ideation-portal-db-subnet-group \
  --no-multi-az \
  --backup-retention-period 0
```

#### 4. Application Load Balancer Setup
```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name ideation-portal-alb \
  --subnets subnet-xxx subnet-yyy \
  --security-groups sg-xxx \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4

# Create Target Group
aws elbv2 create-target-group \
  --name ideation-portal-targets \
  --protocol HTTP \
  --port 8000 \
  --vpc-id vpc-xxx \
  --health-check-path /health/ \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 5
```

### Application Deployment Process

#### 1. Launch Template Creation
```json
{
  "LaunchTemplateName": "ideation-portal-launch-template",
  "LaunchTemplateData": {
    "ImageId": "ami-0abcdef1234567890",
    "InstanceType": "t3.large",
    "KeyName": "ideation-portal-keypair",
    "SecurityGroupIds": ["sg-xxx"],
    "IamInstanceProfile": {
      "Name": "ideation-portal-ec2-role"
    },
    "UserData": "base64-encoded-startup-script",
    "BlockDeviceMappings": [
      {
        "DeviceName": "/dev/xvda",
        "Ebs": {
          "VolumeSize": 20,
          "VolumeType": "gp3",
          "DeleteOnTermination": true
        }
      }
    ]
  }
}
```

#### 2. Auto Scaling Group Setup
```bash
# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name ideation-portal-asg \
  --launch-template LaunchTemplateName=ideation-portal-launch-template,Version='$Latest' \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/ideation-portal-targets/xxx \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --vpc-zone-identifier "subnet-xxx,subnet-yyy"
```

### Static Files and CDN Setup

#### 1. S3 Bucket Configuration
```bash
# Create S3 Bucket
aws s3 mb s3://ideation-portal-static-files

# Configure bucket policy for CloudFront access
aws s3api put-bucket-policy \
  --bucket ideation-portal-static-files \
  --policy file://s3-bucket-policy.json

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket ideation-portal-static-files \
  --server-side-encryption-configuration file://encryption-config.json
```

#### 2. CloudFront Distribution Setup
```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json

# Update DNS records
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-changes.json
```

## Operational Procedures

### Deployment Workflow

#### Standard Deployment Process
1. **Pre-deployment Checks**
   - Verify application health checks pass
   - Confirm database connectivity
   - Validate configuration files

2. **Application Deployment**
   - Create new launch template version
   - Update Auto Scaling Group
   - Trigger instance refresh
   - Monitor deployment progress

3. **Post-deployment Verification**
   - Verify application health endpoints
   - Check CloudWatch logs for errors
   - Validate user functionality
   - Monitor performance metrics

#### Rollback Procedure
```bash
# Emergency rollback process
# 1. Revert to previous launch template version
aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name ideation-portal-asg \
  --launch-template LaunchTemplateName=ideation-portal-launch-template,Version='$Previous'

# 2. Trigger immediate instance refresh
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name ideation-portal-asg \
  --preferences MinHealthyPercentage=0,InstanceWarmup=60

# 3. Monitor rollback completion
aws autoscaling describe-instance-refreshes \
  --auto-scaling-group-name ideation-portal-asg
```

### Monitoring and Alerting

#### CloudWatch Dashboard Configuration
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "ideation-portal-alb"],
          ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", "ideation-portal-alb"],
          ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "ideation-portal-asg"],
          ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "ideation-portal-db"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Application Performance"
      }
    }
  ]
}
```

### Maintenance Procedures

#### Database Maintenance
```bash
# Weekly maintenance tasks
# 1. Analyze database performance
aws rds describe-db-log-files --db-instance-identifier ideation-portal-db

# 2. Monitor slow queries
aws logs filter-log-events \
  --log-group-name /aws/rds/instance/ideation-portal-db/postgresql \
  --filter-pattern "duration"

# 3. Check database connections
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBInstanceIdentifier,Value=ideation-portal-db \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Average
```

#### Security Updates
```bash
# Monthly security update process
# 1. Create AMI snapshot of current instance
aws ec2 create-image \
  --instance-id i-xxx \
  --name "ideation-portal-backup-$(date +%Y%m%d)" \
  --description "Pre-update backup"

# 2. Update launch template with latest AMI
aws ec2 create-launch-template-version \
  --launch-template-name ideation-portal-launch-template \
  --source-version 1 \
  --launch-template-data '{"ImageId":"ami-updated"}'

# 3. Perform rolling update
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name ideation-portal-asg \
  --preferences MinHealthyPercentage=50,InstanceWarmup=300
```

## Disaster Recovery

### Backup Strategy
Since no automated backups are required per organizational policy, manual backup procedures are available:

```bash
# Manual database backup (if needed)
pg_dump -h <rds-endpoint> -U ideation_user -d ideation_portal > backup_$(date +%Y%m%d).sql

# Application code backup
aws s3 sync /opt/ideation-portal s3://ideation-portal-backups/code/$(date +%Y%m%d)/

# Static files backup
aws s3 sync s3://ideation-portal-static-files s3://ideation-portal-backups/static/$(date +%Y%m%d)/
```

### Recovery Procedures
```bash
# Database recovery (if backup exists)
psql -h <rds-endpoint> -U ideation_user -d ideation_portal < backup_YYYYMMDD.sql

# Application recovery
aws s3 sync s3://ideation-portal-backups/code/YYYYMMDD/ /opt/ideation-portal/
sudo systemctl restart gunicorn nginx

# Static files recovery
aws s3 sync s3://ideation-portal-backups/static/YYYYMMDD/ s3://ideation-portal-static-files/
aws cloudfront create-invalidation --distribution-id E123456789 --paths "/*"
```

This deployment architecture provides a comprehensive foundation for operating the Backend Unit infrastructure with proper procedures for deployment, monitoring, maintenance, and recovery operations.