#!/bin/bash

STACK_NAME=""
REGION=""
CLI_PROFILE=""
REPO_URL=""

echo -e "\n\n=========== Deploying main.yml ==========="
aws cloudformation deploy \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --template-file main.yml \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM

if [ $? -ne 0 ]; then
  echo "CloudFormation stack deployment failed!"
  exit 1
fi

echo -e "\n\n=========== Retrieving Stack Outputs ==========="
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='ReactAppBucketName'].OutputValue" \
  --output text)

CLOUDFRONT_DOMAIN=$(aws cloudformation describe-stacks \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionDomainName'].OutputValue" \
  --output text)

if [ -z "$BUCKET_NAME" ] || [ -z "$CLOUDFRONT_DOMAIN" ]; then
  echo "Failed to retrieve necessary stack outputs!"
  exit 1
fi

echo "S3 Bucket Name: $BUCKET_NAME"
echo "CloudFront Domain: https://$CLOUDFRONT_DOMAIN"

echo -e "\n\n=========== Cloning GitHub Repository ==========="
git clone $REPO_URL
REPO_NAME=$(basename $REPO_URL .git)
cd $REPO_NAME/frontend/auth-app

echo -e "\n\n=========== Installing Dependencies and Building Project ==========="
npm install
npm run build

echo -e "\n\n=========== Syncing Build to S3 ==========="
aws s3 sync build/ s3://$BUCKET_NAME --delete --profile $CLI_PROFILE

echo -e "\n\n=========== Deployment Complete ==========="
echo "You can access your React app at: http://$CLOUDFRONT_DOMAIN"

