#!/bin/bash

STACK_NAME=""
REGION=""
CLI_PROFILE=""
REPO_URL=""
REPO_NAME=""
FRONTEND_DIR="$REPO_NAME/frontend/auth-app"
BACKEND_DIR="$REPO_NAME/backend"
BUILD_DIR="$FRONTEND_DIR/build"
ENV_FILE="$FRONTEND_DIR/.env"
LAMBDA_FUNCTION_NAME="AppTestFunction"
LOG_FILE="deploy_log.txt"

SCRIPT_DIR=$(pwd)

echo -e "\n\n=========== Deploying main.yml ===========" | tee -a $LOG_FILE
aws cloudformation deploy \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --template-file main.yml \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM >> $LOG_FILE 2>&1

if [ $? -ne 0 ]; then
  echo "CloudFormation stack deployment failed!" | tee -a $LOG_FILE
  exit 1
fi

echo -e "\n\n=========== Retrieving Stack Outputs ===========" | tee -a $LOG_FILE
REACT_APP_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='ReactAppBucketName'].OutputValue" \
  --output text)

ADDITIONAL_BUCKET_NAME=$(aws cloudformation describe-stacks \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='AdditionalBucketName'].OutputValue" \
  --output text)

CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

APP_API_URL=$(aws cloudformation describe-stacks \
  --region $REGION \
  --profile $CLI_PROFILE \
  --stack-name $STACK_NAME \
  --query "Stacks[0].Outputs[?OutputKey=='AppApiUrl'].OutputValue" \
  --output text)

if [ -z "$ADDITIONAL_BUCKET_NAME" ] || [ -z "$CLOUDFRONT_DISTRIBUTION_ID" ] || [ -z "$APP_API_URL" ]; then
  echo "Failed to retrieve necessary stack outputs!" | tee -a $LOG_FILE
  exit 1
fi

echo "React App S3 Bucket Name: $REACT_APP_BUCKET_NAME" | tee -a $LOG_FILE
echo "Additional S3 Bucket Name: $ADDITIONAL_BUCKET_NAME" | tee -a $LOG_FILE
echo "CloudFront Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID" | tee -a $LOG_FILE
echo "API Gateway URL: $APP_API_URL" | tee -a $LOG_FILE

echo -e "\n\n=========== Cloning GitHub Repository ===========" | tee -a $LOG_FILE
if [ ! -d "$REPO_NAME" ]; then
  git clone $REPO_URL >> $LOG_FILE 2>&1
else
  echo "Repository already exists, pulling latest changes..." | tee -a $LOG_FILE
  cd $REPO_NAME
  git pull origin main >> $LOG_FILE 2>&1
  cd ..
fi

if [ -d "$SCRIPT_DIR/$FRONTEND_DIR" ]; then
  cd "$SCRIPT_DIR/$FRONTEND_DIR"
else
  echo "Frontend directory not found!" | tee -a $LOG_FILE
  exit 1
fi

echo -e "\n\n=========== Updating .env File ===========" | tee -a $LOG_FILE
echo "REACT_APP_BUCKET_URL=$ADDITIONAL_BUCKET_NAME" > .env
echo "REACT_APP_BASE_API=$APP_API_URL" >> .env
echo "bucket_name=$ADDITIONAL_BUCKET_NAME" >> .env
echo "region=us-east-1" >> .env
echo "table_name=$DYNAMODB_TABLE_NAME" >> .env

echo -e "\n\n=========== Building React App ===========" | tee -a $LOG_FILE
cd "$SCRIPT_DIR/$FRONTEND_DIR" || { echo "Failed to navigate to frontend directory"; exit 1; }

echo "Current Directory: $(pwd)" | tee -a $LOG_FILE

npm install >> $LOG_FILE 2>&1
npm run build >> $LOG_FILE 2>&1

sleep 5

if [ ! -d "$SCRIPT_DIR/$FRONTEND_DIR/build" ]; then
  echo "Build directory not found! Build failed." | tee -a $LOG_FILE
  exit 1
else
  echo "Build successful!" | tee -a $LOG_FILE
fi

echo -e "\n\n=========== Uploading Build to S3 ===========" | tee -a $LOG_FILE
aws s3 sync "$SCRIPT_DIR/$FRONTEND_DIR/build" "s3://$REACT_APP_BUCKET_NAME" --delete --profile $CLI_PROFILE >> $LOG_FILE 2>&1

if [ $? -ne 0 ]; then
  echo "Failed to upload build to S3!" | tee -a $LOG_FILE
  exit 1
else
  echo "Build successfully uploaded to S3!" | tee -a $LOG_FILE
fi

echo -e "\n\n=========== Invalidating CloudFront Cache ===========" | tee -a $LOG_FILE
aws cloudfront create-invalidation \
  --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --paths "/*" \
  --profile $CLI_PROFILE >> $LOG_FILE 2>&1

if [ $? -ne 0 ]; then
  echo "Failed to create CloudFront invalidation!" | tee -a $LOG_FILE
  exit 1
fi

echo -e "\n\n=========== Preparing Lambda Code ===========" | tee -a $LOG_FILE
cd "$SCRIPT_DIR/$BACKEND_DIR"

if [ ! -d "$SCRIPT_DIR/$BACKEND_DIR" ]; then
  echo "Backend directory not found!" | tee -a $LOG_FILE
  exit 1
fi

zip -r index.mjs.zip index.mjs >> $LOG_FILE 2>&1

if [ ! -f "index.mjs.zip" ]; then
  echo "Failed to create Lambda zip file!" | tee -a $LOG_FILE
  exit 1
fi

echo -e "\n\n=========== Creating/Updating Lambda Function ===========" | tee -a $LOG_FILE
aws lambda create-function \
  --function-name $LAMBDA_FUNCTION_NAME \
  --runtime nodejs20.x \
  --role $LAMBDA_ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://index.mjs.zip \
  --environment Variables="{bucket_name=$REACT_APP_BUCKET_NAME,region=us-east-1,table_name=$DYNAMODB_TABLE_NAME}" \
  --region $REGION \
  --profile $CLI_PROFILE >> $LOG_FILE 2>&1 \
  || aws lambda update-function-code \
  --function-name $LAMBDA_FUNCTION_NAME \
  --zip-file fileb://index.mjs.zip \
  --region $REGION \
  --profile $CLI_PROFILE >> $LOG_FILE 2>&1

aws lambda update-function-configuration \
  --function-name $LAMBDA_FUNCTION_NAME \
  --environment Variables="{bucket_name=$REACT_APP_BUCKET_NAME,region=us-east-1,table_name=$DYNAMODB_TABLE_NAME}" \
  --region $REGION \
  --profile $CLI_PROFILE >> $LOG_FILE 2>&1

cd "$SCRIPT_DIR"

echo -e "\n\n=========== Committing and Pushing All .env Files ===========" | tee -a $LOG_FILE

cd "$SCRIPT_DIR/$REPO_NAME"

echo "Switching Git remote URL to SSH..." | tee -a $LOG_FILE
git remote set-url origin <git@github.com:Alks080900/cloud-project-aws.git REPLACE THIS ONE WITH YOUR OWN REPO> >> $LOG_FILE 2>&1

echo "Staging all .env files in the repository..." | tee -a $LOG_FILE
git add **/.env >> $LOG_FILE 2>&1

if git diff --staged --quiet; then
  echo "No changes to commit for any .env files." | tee -a $LOG_FILE
else

  echo "Committing all .env files..." | tee -a $LOG_FILE
  git commit -m "Update .env files across project" >> $LOG_FILE 2>&1

  if [ $? -ne 0 ]; then
    echo "Git commit failed! Exiting." | tee -a $LOG_FILE
    exit 1
  else
    echo "Changes committed successfully." | tee -a $LOG_FILE
  fi

  echo "Pushing changes to GitHub..." | tee -a $LOG_FILE
  git push origin main >> $LOG_FILE 2>&1


  if [ $? -ne 0 ]; then
    echo "Git push failed! Exiting." | tee -a $LOG_FILE
    exit 1
  else
    echo "Changes pushed to GitHub successfully." | tee -a $LOG_FILE
  fi
fi

echo -e "\n\n=========== Deployment Complete ===========" | tee -a $LOG_FILE
