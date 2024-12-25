# Full-Stack Authentication Application

This project demonstrates a full automation building of simple web app using cloudformation, the project is highly customizable and the scripts below can be revise based on your own setup of its building process.

## Project Overview

### infra-using-nodejs (Main Project)
This is the main part of the project that implements the full-stack authentication application using **Node.js** and AWS services (S3, Lambda, DynamoDB, API Gateway). The application features user sign-up, login, and profile image upload, following a serverless architecture.

### infra-using-python (Experimentation)
This folder contains experimental implementations using **Python**. It is not the primary focus of the project, but rather a sandbox for testing alternative approaches. This is similar to the main project (Node js) but when it is deployed using the Cloudformation of this app it generates only the process of frontend build, assumming the the API, DynamoDB and Bucket is already existed. 

## Setting Up the Project on AWS

To create an entire serverless infrastructure for this project on AWS, you will need the `deploy-infra.sh` script and the `main.yml` CloudFormation template located in the **infra-using-nodejs** folder.

Linux and macOS Compatibility:
The deploy-infra.sh script is primarily compatible with Linux and macOS operating systems. If you're using Windows, you will need to make minimal revisions to the script (such as adjusting file paths) or use Windows Subsystem for Linux (WSL) to run the script seamlessly.

### Steps:

1. Clone the repository and navigate to the **infra-using-nodejs** folder.
2. Modify the `deploy-infra.sh` script with your own parameters:

```bash
#!/bin/bash

STACK_NAME=""                # Add your CloudFormation stack name here
REGION=""                    # Add your desired AWS region (e.g., us-east-1)
CLI_PROFILE=""               # Add your AWS CLI profile (if needed)
REPO_URL=""                  # Add the URL of the GitHub repository
REPO_NAME=""                 # Add the name of the repository
FRONTEND_DIR="$REPO_NAME/frontend/auth-app"
BACKEND_DIR="$REPO_NAME/backend"
BUILD_DIR="$FRONTEND_DIR/build"
ENV_FILE="$FRONTEND_DIR/.env"
LAMBDA_FUNCTION_NAME=""      # Add the name of your Lambda function
LOG_FILE="deploy_log.txt"

