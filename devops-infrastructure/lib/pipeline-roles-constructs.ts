import { CfnOutput, DefaultStackSynthesizer, Stack } from 'aws-cdk-lib';
import {
    AccountPrincipal,
    ArnPrincipal,
    CompositePrincipal,
    Effect,
    IRole,
    ManagedPolicy,
    PolicyStatement,
    Role,
    ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import {
    Accounts,
    COMMON_REPO,
    DOMAIN_NAME,
    INNER_PIPELINE_INPUT_FOLDER,
    PipelineRoles,
    SOURCE_CODE_KEY,
    StackExports,
} from '@uniform-pipelines/model';

import { TargetRegions } from '@uniform-pipelines/model';

const getKmsBucketReadPermissions = (bucketArn: string, bucketKeyArn: string) => {
    return [
        new PolicyStatement({
            actions: ['kms:Decrypt*', 'kms:DescribeKey'],
            resources: [bucketKeyArn],
        }),
        new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
            resources: [bucketArn, `${bucketArn}/*`],
        }),
    ];
};

const getKmsBucketWritePermissions = (bucketArn: string, bucketKeyArn: string) => {
    return [
        new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                's3:DeleteObject*',
                's3:PutObject',
                's3:PutObjectLegalHold',
                's3:PutObjectRetention',
                's3:PutObjectTagging',
                's3:PutObjectVersionTagging',
                's3:Abort*',
                's3:GetObject*',
                's3:GetBucket*',
                's3:List*',
            ],
            resources: [bucketArn, `${bucketArn}/*`],
        }),
        new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['kms:Encrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Decrypt'],
            resources: [bucketKeyArn],
        }),
    ];
};

interface PipelinesRoleConstructProps {
    artifactBucketKeyArn: string;
    artifactBucketArn: string;
    sourceBucketArn: string;
}

export class PipelinesRoleConstruct extends Construct {
    private filePublishingPrincipals: ArnPrincipal[];
    private deployAccountPrincipals: ArnPrincipal[];
    private codeArtifactPermissions: PolicyStatement[];
    private cloudwatchPermissions: PolicyStatement[];
    private codeBuildPermissions: PolicyStatement[];
    private outerPipelineReadSourceBucketPermissions: PolicyStatement[];
    private innerPipelineReadSourceBucketPermissions: PolicyStatement[];
    private writeSourceBucketPermissions: PolicyStatement[];
    private artifactBucketWritePermissions: PolicyStatement[];
    private artifactBucketReadPermissions: PolicyStatement[];
    private cloudFormationPermnissions: PolicyStatement[];
    private postmanReportPermissions: PolicyStatement[];
    
    outerPipelineActionsRole: IRole;
    outerPipelineMainRole: IRole;
    outerPipelineDeploymentRole: IRole;

    innerPipelineMainRole: Role;
    innerPiplelineCodeSourceActionRole: IRole;
    innerPipelineBuildActionRole: IRole;
    innerPipelineManualApprovalActionRole: IRole;
    innerPipelineSelfMutationCodebuildProjectServiceRole: IRole;
    innerPipelineFileAssetsCodebuildProjectServiceRole: IRole;
    innerPipelineCdkCodeBuildProjectServiceRole: IRole;
    innerPipelinePostmanCodeBuildProjectServiceRole: IRole;

    constructor(scope: Construct, id: string, props: PipelinesRoleConstructProps) {
        super(scope, id);
        const targetEnvironments = [
            { account: Accounts.TEST, region: TargetRegions.TEST },
            { account: Accounts.ACCEPTANCE, region: TargetRegions.ACCEPTANCE },
            { account: Accounts.PRODUCTION, region: TargetRegions.PRODUCTION },
        ];

        this.deployAccountPrincipals = targetEnvironments.map(
            targetEnv => new ArnPrincipal(`arn:aws:iam::${targetEnv.account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-deploy-role-${targetEnv.account}-${targetEnv.region}`)
        );
        this.filePublishingPrincipals = targetEnvironments.map(
            targetEnv => new ArnPrincipal(`arn:aws:iam::${targetEnv.account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-file-publishing-role-${targetEnv.account}-${targetEnv.region}`)
        );
        
        this.codeArtifactPermissions = this.makeCodeArtifactPermissions();
        this.cloudwatchPermissions = this.makeCloudwatchPermissions();
        this.codeBuildPermissions = this.makeCodeBuildPermissions();
        this.outerPipelineReadSourceBucketPermissions = this.makeOuterPipelineReadSourceBucketPermissions(props.sourceBucketArn);
        this.innerPipelineReadSourceBucketPermissions = this.makeInnerPipelineReadSourceBucketPermissions(props.sourceBucketArn);
        this.writeSourceBucketPermissions = this.makeWriteSourceBucketPermissions(props.sourceBucketArn);
        this.cloudFormationPermnissions = this.makeCloudFormationPermissions();
        this.postmanReportPermissions = this.makePostmanReportPermissions();
        
        this.artifactBucketWritePermissions = getKmsBucketWritePermissions(
            props.artifactBucketArn,
            props.artifactBucketKeyArn,
        );
        this.artifactBucketReadPermissions = getKmsBucketReadPermissions(
            props.artifactBucketArn,
            props.artifactBucketKeyArn,
        );

        this.innerPipelineMainRole = this.makeInnerPipelineMainRole();
        this.innerPiplelineCodeSourceActionRole = this.makeInnerPiplelineCodeSourceActionRole();
        this.innerPipelineBuildActionRole = this.makeInnerPipelineBuildActionRole(this.innerPipelineMainRole.roleArn);
        this.innerPipelineManualApprovalActionRole = this.makeInnerPipelineManualApprovalActionRole();
        this.innerPipelineSelfMutationCodebuildProjectServiceRole = this.makeInnerPipelineSelfMutationCodebuildProjectServiceRole();
        this.innerPipelineFileAssetsCodebuildProjectServiceRole = this.makeInnerPipelineFileAssetsCodebuildProjectServiceRole();
        this.innerPipelinePostmanCodeBuildProjectServiceRole = this.makeInnerPipelinePostmanCodeBuildProjectServiceRole();
        this.innerPipelineCdkCodeBuildProjectServiceRole = this.makeInnerPipelineCdkCodeBuildProjectServiceRole();
        this.allowInnerPipelineMainRoleAssumeEverything();

        this.outerPipelineActionsRole = this.makeOuterPipelineActionsRole();
        this.outerPipelineMainRole = this.makeOuterPipelineMainRole();
        this.outerPipelineDeploymentRole = this.makeOuterPipelineDeploymentRole();
    }

    makeInnerPipelineMainRole() {
        const pipelineMainRole = new Role(this, 'inner-pipeline-main-role', {
            roleName: PipelineRoles.INNER_PIPELINE_MAIN_ROLE,
            assumedBy: new ServicePrincipal('codepipeline.amazonaws.com'),
        });

        [ ...this.artifactBucketWritePermissions,  ...this.codeArtifactPermissions,].forEach(permission => pipelineMainRole.addToPolicy(permission));

        return pipelineMainRole;
    }
    
    makeInnerPiplelineCodeSourceActionRole() {
        // CodeBuild Source Stage/Action that reads the code source
        const innerPipelineCodeSourceActionRole = new Role(this, 'inner-pipeline-code-source-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_SOURCE_STAGE_SOURCE_ACTION,
            assumedBy: new AccountPrincipal(Stack.of(this).account),
        });

        [...this.innerPipelineReadSourceBucketPermissions, ...this.artifactBucketWritePermissions].forEach(permission => innerPipelineCodeSourceActionRole.addToPolicy(permission));
        return innerPipelineCodeSourceActionRole;
    }

    makeInnerPipelineBuildActionRole(innerPipelineRoleArn: string) {
        // CodeBuild role used by Build Stage/Synth Action
        // Also used in UpdatePipeline Stage/SelfMutate Action
        // Also used in Assets Stage/Assets Action
        // Also used in Deploy Stage/Postman Action

        const buildActionRole = new Role(this, 'inner-pipeline-synth-action-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION,
            assumedBy: new ArnPrincipal(innerPipelineRoleArn),
        });

        [...this.codeBuildPermissions].forEach(permission => buildActionRole.addToPolicy(permission));
        return buildActionRole;
    }
    
    makeInnerPipelineManualApprovalActionRole() {
        // Deploy stages/Manual Approval Action roles
        const innerPipelineManualApprovalActionRole = new Role(this, 'inner-pipeline-manual-approval-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_APPROVAL_ACTION,
            assumedBy: new AccountPrincipal(Stack.of(this).account),
        });
        return innerPipelineManualApprovalActionRole;
    }

    makeInnerPipelineSelfMutationCodebuildProjectServiceRole() {
        // Self Mutation Codebuild project Service Role
        const selfMutationServiceRole = new Role(this, 'inner-pipeline-self-mutation-step-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_SELFUPDATE_PROJECT,
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
        });

        const { region } = Stack.of(this);

        const assumeLocalDeploymentRolesPermission = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: [
                `arn:aws:iam::${Accounts.DEVOPS}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-deploy-role-${Accounts.DEVOPS}-${region}`,
                `arn:aws:iam::${Accounts.DEVOPS}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-file-publishing-role-${Accounts.DEVOPS}-${region}`,
                `arn:aws:iam::${Accounts.DEVOPS}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-image-publishing-role-${Accounts.DEVOPS}-${region}`,
            ],
        });

        const cloudformationPermission = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['cloudformation:DescribeStacks'],
            resources: ['*'],
        });

        const listBucketsPermission = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['s3:ListBucket'],
            resources: ['*'],
        });

        [...this.cloudwatchPermissions, assumeLocalDeploymentRolesPermission, ...this.artifactBucketReadPermissions,
            cloudformationPermission, listBucketsPermission].forEach(permission => selfMutationServiceRole.addToPolicy(permission));

        return selfMutationServiceRole;
    }

    makeInnerPipelineFileAssetsCodebuildProjectServiceRole() {
        const assetsServiceRole = new Role(this, 'inner-pipeline-assets-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_ASSETS_PROJECT,
            assumedBy: new CompositePrincipal(
                new AccountPrincipal(Stack.of(this).account),
                new ServicePrincipal('codebuild.amazonaws.com'),
            ),
        });
        const filePublishingAccountArns = this.filePublishingPrincipals.map(accountArn => accountArn.arn);

        const assumeRolesPermission = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: filePublishingAccountArns,
        });

        [assumeRolesPermission, ...this.cloudwatchPermissions, ...this.codeBuildPermissions, ...this.postmanReportPermissions, 
            ...this.artifactBucketReadPermissions].forEach(permission => assetsServiceRole.addToPolicy(permission));

        return assetsServiceRole;
    }

    makeInnerPipelineCdkCodeBuildProjectServiceRole() {
        // PipelineRole shared across all pipelines
        const buildServiceRole = new Role(this, 'inner-pipeline-build-step-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_CDK_BUILD_PROJECT,
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
        });

        [...this.postmanReportPermissions, ...this.cloudwatchPermissions, ...this.artifactBucketWritePermissions, ...this.codeArtifactPermissions, 
            ...this.innerPipelineReadSourceBucketPermissions].forEach(permission => buildServiceRole.addToPolicy(permission));
        
        return buildServiceRole;
    }

    
    makeInnerPipelinePostmanCodeBuildProjectServiceRole() {
        // PipelineRole shared across all pipelines
        const postmanServiceRole = new Role(this, 'inner-pipeline-postman-step-role', {
            roleName: PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_POSTMAN_BUILD_PROJECT,
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
        });

        [...this.postmanReportPermissions, ...this.cloudwatchPermissions, ...this.artifactBucketWritePermissions, ...this.codeArtifactPermissions ].forEach(
            permission => postmanServiceRole.addToPolicy(permission));
        return postmanServiceRole;
    }

    allowInnerPipelineMainRoleAssumeEverything() {
        const deploymentAccountArns = this.deployAccountPrincipals.map(accountArn => accountArn.arn);
        const assumeRolesPermission = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: [...deploymentAccountArns, this.innerPiplelineCodeSourceActionRole.roleArn, 
                this.innerPipelineManualApprovalActionRole.roleArn, this.innerPipelineBuildActionRole.roleArn,
                this.innerPipelineCdkCodeBuildProjectServiceRole.roleArn, this.innerPipelineFileAssetsCodebuildProjectServiceRole.roleArn, 
                this.innerPipelineSelfMutationCodebuildProjectServiceRole.roleArn, this.innerPipelinePostmanCodeBuildProjectServiceRole.roleArn],
        });

        this.innerPipelineMainRole.addToPolicy(assumeRolesPermission);
    }


    makeOuterPipelineMainRole() {
        const outerPipelineMainRole = new Role(this, 'outer-pipeline-role', {
            roleName: PipelineRoles.OUTER_PIPELINE_ROLE,
            assumedBy: new CompositePrincipal(new ServicePrincipal('codepipeline.amazonaws.com')),
        });

        const assumeRolesPermission = new PolicyStatement({
            effect: Effect.ALLOW,
            actions: ['sts:AssumeRole'],
            resources: [this.outerPipelineActionsRole.roleArn],
        });

        outerPipelineMainRole.addToPolicy(assumeRolesPermission);

        new CfnOutput(this, 'outer-pipeline-main-role-arn-export', {
            description: 'Arn of the main role of outer Pipelines',
            value: outerPipelineMainRole.roleArn,
            exportName: StackExports.OUTER_PIPELINE_MAIN_ROLE_ARN_REF,
        });
        return outerPipelineMainRole;
    }

    makeOuterPipelineActionsRole() {
        const outerPipelineActionsRole = new Role(this, 'outer-pipeline-actions-role', {
            roleName: PipelineRoles.OUTER_PIPELINE_ACTIONS_ROLE,
            assumedBy: new CompositePrincipal(
                new AccountPrincipal(Stack.of(this).account),
                new ServicePrincipal('codebuild.amazonaws.com'),
            ),
        });

        [
            ...this.codeArtifactPermissions,
            ...this.cloudwatchPermissions,
            ...this.codeBuildPermissions,
            ...this.outerPipelineReadSourceBucketPermissions,
            ...this.writeSourceBucketPermissions,
            ...this.artifactBucketWritePermissions,
            ...this.cloudFormationPermnissions,
        ].forEach(permission => outerPipelineActionsRole.addToPolicy(permission));

        new CfnOutput(this, 'outer-pipeline-actions-role-arn-export', {
            description: 'Arn of the actions role of outer Pipelines',
            value: outerPipelineActionsRole.roleArn,
            exportName: StackExports.OUTER_PIPELINE_ACTIONS_ROLE_ARN_REF,
        });
        return outerPipelineActionsRole;
    }

    makeOuterPipelineDeploymentRole() {
        const outerPipelineDeploymentRole = new Role(this, 'outer-pipeline-deployment-role', {
            roleName: PipelineRoles.OUTER_PIPELINE_DEPLOYMENT_ROLE,
            assumedBy: new CompositePrincipal(new ServicePrincipal('cloudformation.amazonaws.com')),
        });
        const adminAccess = ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess');
        outerPipelineDeploymentRole.addManagedPolicy(adminAccess);

        new CfnOutput(this, 'outer-pipeline-deployment-role-arn-export', {
            description: 'Arn of the deployment role of outer Pipelines',
            value: outerPipelineDeploymentRole.roleArn,
            exportName: StackExports.OUTER_PIPELINE_DEPLOYMENT_ROLE_ARN_REF,
        });
        return outerPipelineDeploymentRole;
    }

    makeCloudFormationPermissions() {
        return [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'cloudformation:CreateStack', // To create the stack
                    'cloudformation:UpdateStack', // To update the stack
                    'cloudformation:DescribeStacks', // To monitor stack progress
                    'cloudformation:GetTemplate', // To retrieve stack template
                    'cloudformation:ValidateTemplate', // Validate the template before deployment
                ],
                resources: ['*'],
            }),
        ];
    }

    makeWriteSourceBucketPermissions(sourceBucketArn: string) {
        return [
            new PolicyStatement({
                actions: [
                    's3:PutObject', // Allows uploading objects
                    's3:PutObjectAcl', // Allows setting object ACLs
                ],
                resources: [
                    `${sourceBucketArn}/${INNER_PIPELINE_INPUT_FOLDER}/*`,
                ],
            }),
        ];
    }

    makeOuterPipelineReadSourceBucketPermissions(sourceBucketArn: string) {
        return [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    's3:GetObject', // To read the source zip file
                    's3:GetObjectVersion', // If versioned objects are used
                    's3:GetBucketLocation', // To locate the bucket
                ],
                resources: [`${sourceBucketArn}/${SOURCE_CODE_KEY}`],
            }),
        ];
    }

    makeInnerPipelineReadSourceBucketPermissions(sourceBucketArn: string) {
        return [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
                resources: [sourceBucketArn, `${sourceBucketArn}/${INNER_PIPELINE_INPUT_FOLDER}/*`],
            }),
        ];
    }

    makeCloudwatchPermissions() {
        return [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                resources: [
                    `arn:aws:logs:eu-west-1:${Accounts.DEVOPS}:log-group:/aws/codebuild/*`,
                    `arn:aws:logs:eu-west-1:${Accounts.DEVOPS}:log-group:/aws/codebuild`,
                ],
            }),
        ];
    }

    makeCodeBuildPermissions() {
        return [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['codebuild:BatchGetBuilds', 'codebuild:StartBuild', 'codebuild:StopBuild'],
                resources: [`arn:aws:codebuild:eu-west-1:${Accounts.DEVOPS}:project/*`],
            }),
        ];
    }

    makePostmanReportPermissions() {
        const postmanReportPermissions = [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['codebuild:CreateReport', 'codebuild:UpdateReport', 'codebuild:BatchPutTestCases',
                    'codebuild:BatchPutCodeCoverages', 'codebuild:CreateReportGroup'],
                resources: [`arn:aws:codebuild:eu-west-1:${Accounts.DEVOPS}:report-group/*`, `arn:aws:codebuild:eu-west-1:${Accounts.DEVOPS}:report-group`],
            }),
        ];
        return postmanReportPermissions;
    }

    makeCodeArtifactPermissions() {
        const { account, region } = Stack.of(this);
        return [
            new PolicyStatement({
                sid: 'AllowArtifactoryLogin',
                effect: Effect.ALLOW,
                actions: [
                    'codeartifact:GetAuthorizationToken',
                    'codeartifact:GetRepositoryEndpoint',
                    'codeartifact:ReadFromRepository',
                ],
                resources: [
                    // Grant access only to the specific domain and repository
                    `arn:aws:codeartifact:${region}:${account}:domain/${DOMAIN_NAME}`,
                    `arn:aws:codeartifact:${region}:${account}:repository/${DOMAIN_NAME}/${COMMON_REPO}`,
                ],
            }),
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['sts:GetServiceBearerToken'],
                resources: ['*'], // `sts:GetServiceBearerToken` targets sts service-wide
                conditions: {
                    StringEquals: {
                        'sts:AWSServiceName': 'codeartifact.amazonaws.com',
                    },
                },
            }),
        ];
    }
}
