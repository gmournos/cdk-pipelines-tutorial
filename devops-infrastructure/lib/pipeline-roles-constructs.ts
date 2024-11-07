import { CfnOutput, Stack } from 'aws-cdk-lib';
import {
    AccountPrincipal,
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
} from './model';

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
    private codeArtifactPermissions: PolicyStatement[];
    private cloudwatchPermissions: PolicyStatement[];
    private codeBuildPermissions: PolicyStatement[];
    private readSourceBucketPermissions: PolicyStatement[];
    private writeSourceBucketPermissions: PolicyStatement[];
    private artifactBucketWritePermissions: PolicyStatement[];
    private cloudFormationPermnissions: PolicyStatement[];

    outerPipelineActionsRole: IRole;
    outerPipelineMainRole: IRole;
    outerPipelineDeploymentRole: IRole;

    constructor(scope: Construct, id: string, props: PipelinesRoleConstructProps) {
        super(scope, id);
        this.codeArtifactPermissions = this.makeCodeArtifactPermissions();
        this.cloudwatchPermissions = this.makeCloudwatchPermissions();
        this.codeBuildPermissions = this.makeCodeBuildPermissions();
        this.readSourceBucketPermissions = this.makeReadSourceBucketPermissions(props.sourceBucketArn);
        this.writeSourceBucketPermissions = this.makeWriteSourceBucketPermissions(props.sourceBucketArn);
        this.cloudFormationPermnissions = this.makeCloudFormationPermissions();

        this.artifactBucketWritePermissions = getKmsBucketWritePermissions(
            props.artifactBucketArn,
            props.artifactBucketKeyArn,
        );
        this.outerPipelineActionsRole = this.makeOuterPipelineActionsRole();
        this.outerPipelineMainRole = this.makeOuterPipelineMainRole();
        this.outerPipelineDeploymentRole = this.makeOuterPipelineDeploymentRole();
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
            ...this.readSourceBucketPermissions,
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

    makeReadSourceBucketPermissions(sourceBucketArn: string) {
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
