#!/bin/bash

# Exit script on any error
set -e

ZIP_FILE="pipeline-input.zip"
S3_BUCKET="cdk-pipelines-tutorial-sources-bucket"
S3_KEY="deployments/${ZIP_FILE}" # Path in S3 where the zip will be stored

# Exclude unnecessary files and folders
EXCLUDES=(
    --exclude "node_modules/*"
    --exclude "dist/*"
    --exclude ".git/*"
    --exclude "cdk.out/*"
    --exclude ".venv/*"
    --exclude "*.log"
    --exclude ".DS_Store"
    --exclude "coverage/*"
)

# Create zip file excluding node_modules, dist, etc.
echo "Zipping project directory..."
zip -r "${ZIP_FILE}" . "${EXCLUDES[@]}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null
then
    echo "AWS CLI not found. Please install and configure AWS CLI."
    exit 1
fi

# Upload the zip file to the specified S3 bucket
echo "Uploading ${ZIP_FILE} to s3://${S3_BUCKET}/${S3_KEY}..."
aws s3 cp "${ZIP_FILE}" "s3://${S3_BUCKET}/${S3_KEY}"

# Clean up the local zip file
echo "Cleaning up..."
rm "${ZIP_FILE}"

echo "Project zipped and uploaded to S3 successfully!"
