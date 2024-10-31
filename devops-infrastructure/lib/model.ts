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
