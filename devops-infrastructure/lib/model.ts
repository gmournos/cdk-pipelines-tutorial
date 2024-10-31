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
export const OUTER_PIPELINE_NAME = 'Outer_Pipeline';
export const INNER_PIPELINE_INPUT_FOLDER = 'inner-pipeline-input'
export const INNER_PIPELINE_STACK_TEMPLATE_NAME = 'inner-pipeline-stack';

export const SOURCE_CODE_KEY = 'deployments/pipeline-input.zip';
export const CHANGESET_RENAME_MACRO = 'uniform-pipeline-changeset-rename-macro';

export enum StackExports {
    PIPELINE_SOURCE_BUCKET_ARN_REF = 'uniform-pipeline-source-bucket-arn-ref',
    PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF = 'uniform-pipeline-artifact-bucket-key-arn-ref',
    PIPELINE_ARTIFACT_BUCKET_ARN_REF = 'uniform-pipeline-artifact-bucket-arn-ref',
    OUTER_PIPELINE_MAIN_ROLE_ARN_REF = 'outer-pipeline-main-role-arn-ref',
    OUTER_PIPELINE_ACTIONS_ROLE_ARN_REF = 'outer-pipeline-actions-role-arn-ref',
    OUTER_PIPELINE_DEPLOYMENT_ROLE_ARN_REF = 'outer-pipeline-deploymenent-role-arn-ref',
};

export const makeVersionedPipelineName = (containedStackName: string, containedStackVersion: string) => {
    return `${containedStackName}-${containedStackVersion.replace(/\./g, '-')}-pipeline`; 
}

export const makeVersionedPipelineStackName = (containedStackName: string, containedStackVersion: string) => {
    return `${containedStackName}-${containedStackVersion.replace(/\./g, '-')}-pipeline-stack`; 
}


export const STACK_NAME_TAG = 'uniform-pipelines:contained-stack-name';
export const STACK_VERSION_TAG = 'uniform-pipelines:contained-stack-version';
export const DEPLOYER_STACK_NAME_TAG = 'uniform-pipelines:deployer-stack-name';
export const STACK_DEPLOYED_AT_TAG = 'uniform-pipelines:deployed-at';


export enum PipelineRoles {
    OUTER_PIPELINE_ROLE = 'outer-pipeline-role',
    OUTER_PIPELINE_ACTIONS_ROLE = 'outer-pipeline-actions-role',
    OUTER_PIPELINE_DEPLOYMENT_ROLE = 'outer-pipeline-deployment-deployment-role',
};

export const getReadableAccountName = (accountValue: string) => {
    const accountKey = Object.keys(Accounts).find(key => Accounts[key as keyof typeof Accounts] === accountValue);

    if (accountKey) {
        return accountKey.toLowerCase();
    } else {
        throw new Error('Account not found');
    }
};

