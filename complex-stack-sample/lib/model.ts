import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";

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
export const ROLE_REASSIGN_MACRO = 'uniform-pipeline-role-reassign-macro';

export const POSTMAN_REPORT_GROUP = 'uniform-pipeline-postman-report-group';

export const PIPELINES_BUILD_SPEC_DEF_FILE = 'custom-buildspec.yaml';
export const PIPELINES_POSTMAN_SPEC_DEF_FILE = 'postman.json';
export const PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE = 'custom-buildspec-apitests.yaml';

export enum StackExports {
    PIPELINE_SOURCE_BUCKET_ARN_REF = 'uniform-pipeline-source-bucket-arn-ref',
    PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF = 'uniform-pipeline-artifact-bucket-key-arn-ref',
    PIPELINE_ARTIFACT_BUCKET_ARN_REF = 'uniform-pipeline-artifact-bucket-arn-ref',
    OUTER_PIPELINE_MAIN_ROLE_ARN_REF = 'outer-pipeline-main-role-arn-ref',
    OUTER_PIPELINE_ACTIONS_ROLE_ARN_REF = 'outer-pipeline-actions-role-arn-ref',
    OUTER_PIPELINE_DEPLOYMENT_ROLE_ARN_REF = 'outer-pipeline-deploymenent-role-arn-ref',
    POSTMAN_REPORT_GROUP_ARN_REF = 'uniform-pipeline-postman-report-group-arn-ref',
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
    INNER_PIPELINE_MAIN_ROLE = 'inner-pipeline-role',
    INNER_PIPELINE_CODEBUILD_ROLE_SOURCE_STAGE_SOURCE_ACTION = 'inner-pipeline-source-role',
    INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION = 'inner-pipeline-synth-role',
    INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_APPROVAL_ACTION = 'inner-pipeline-manual-approval-role',
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_SELFUPDATE_PROJECT = 'inner-pipeline-self-mutation-role',
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_ASSETS_PROJECT = 'inner-pipeline-assets-role',
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_CDK_BUILD_PROJECT = 'inner-pipeline-build-service-role',
    INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_POSTMAN_BUILD_PROJECT = 'inner-pipeline-postman-role',
    // same permissions are needed for these actions as in build stage/synth action
    INNER_PIPELINE_CODEBUILD_ROLE_UPDATEPIPELINE_STAGE_SELFMUTATE_ACTION = INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION,
    INNER_PIPELINE_CODEBUILD_ROLE_ASSETS_STAGE_FILEASSET_ACTION = INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION,
    INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_POSTMAN_ACTION = INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION,
};

export const getReadableAccountName = (accountValue: string) => {
    const accountKey = Object.keys(Accounts).find(key => Accounts[key as keyof typeof Accounts] === accountValue);

    if (accountKey) {
        return accountKey.toLowerCase();
    } else {
        throw new Error('Account not found');
    }
};

export type OmitProperties<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type PartialStackProps<T extends StackProps> = undefined | OmitProperties<T, 'stackName' | 'env' | 'description' >;
export type ContainedStackClassConstructor<P extends StackProps = StackProps> = new(c: Construct, id: string, p: P) => Stack;



