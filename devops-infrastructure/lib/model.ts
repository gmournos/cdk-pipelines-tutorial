export const Accounts = {
    DEVOPS: process.env.DEVOPS_ACCOUNT || 'default-devops-account',
    DEVELOPMENT: process.env.DEVELOPMENT_ACCOUNT || 'default-development-account',
    TEST: process.env.TEST_ACCOUNT || 'default-test-account',
    ACCEPTANCE: process.env.ACCEPTANCE_ACCOUNT || 'default-acceptance-account',
    PRODUCTION: process.env.PRODUCTION_ACCOUNT || 'default-production-account',
} as const; // immutable

export const DOMAIN_NAME = 'cdk-pipelines-tutorial-artifact-domain';
export const NPM_REPO = 'cdk-pipelines-tutorial-npm-repo';
export const COMMON_REPO = 'cdk-pipelines-tutorial-common-repo';
export const SOURCE_CODE_BUCKET_NAME = 'cdk-pipelines-tutorial-sources-bucket';
export const ARTIFACT_BUCKET_NAME = 'cdk-pipelines-tutorial-artifact-bucket';
export const ARTIFACT_BUCKET_KEY_NAME = 'cdk-pipelines-tutorial-artifact-key';

export enum StackExports {
    PIPELINE_SOURCE_BUCKET_ARN_REF = 'uniform-pipeline-source-bucket-arn-ref',
    PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF = 'uniform-pipeline-artifact-bucket-key-arn-ref',
    PIPELINE_ARTIFACT_BUCKET_ARN_REF = 'uniform-pipeline-artifact-bucket-arn-ref',
};
  