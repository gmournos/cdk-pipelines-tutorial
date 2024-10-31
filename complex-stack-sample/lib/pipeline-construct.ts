import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn } from 'aws-cdk-lib';
import { CodeBuildStep, CodePipeline, CodePipelineSource, IFileSetProducer } from 'aws-cdk-lib/pipelines';
import { ComplexStackSampleStack } from './complex-stack-sample-stack';
import { Accounts, COMMON_REPO, DOMAIN_NAME } from './model';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StackExports } from './model';
import { SOURCE_CODE_KEY } from './model';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';

const PIPELINE_NAME = 'Feature1_Pipeline';

class DeploymentStage extends Stage {
    constructor(scope: Construct, targetAccount: string, pipelineStackProps: PipelineStackProps) {
        super(scope, `${pipelineStackProps.containedStackName}-pipeline-deployment-${targetAccount}`, {
            stageName: `deployment-${targetAccount}`,
        });
        new ComplexStackSampleStack(this, 'artifacts-stack', {
            ...pipelineStackProps.containedStackProps,
            stackName: pipelineStackProps.containedStackName
        });
    }
}

export interface PipelineStackProps extends StackProps {
    containedStackProps: StackProps;
    containedStackName: string;
}

export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

        const encryptionKey = Key.fromKeyArn(this, 'artifact-bucket-key-arn',
            Fn.importValue(StackExports.PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF));

        const artifactBucket = Bucket.fromBucketAttributes(this, 'pipeline-artifact-bucket', {
            bucketArn: Fn.importValue(StackExports.PIPELINE_ARTIFACT_BUCKET_ARN_REF),
            encryptionKey,
        });

        const sourceBucket = Bucket.fromBucketAttributes(this, 'pipeline-source-bucket', {
            bucketArn: Fn.importValue(StackExports.PIPELINE_SOURCE_BUCKET_ARN_REF),
        });
        const codeSource = CodePipelineSource.s3(sourceBucket, SOURCE_CODE_KEY, {
            trigger: S3Trigger.NONE,
        });

        const codeArtifactPermissions = [
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
                    `arn:aws:codeartifact:${this.region}:${this.account}:domain/${DOMAIN_NAME}`,
                    `arn:aws:codeartifact:${this.region}:${this.account}:repository/${DOMAIN_NAME}/${COMMON_REPO}`,
                ],
            }),
            new PolicyStatement({
                sid: 'AllowCodeArtifactStsLogin',
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

        // Create a new CodePipeline
        const pipeline = new CodePipeline(this, 'cicd-pipeline', {
            artifactBucket,
            pipelineName: PIPELINE_NAME,
            // Define the synthesis step
            synth: new CodeBuildStep('synth-step', {
                input: codeSource,
                installCommands: [
                    'npm install -g aws-cdk',
                    `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${Accounts.DEVOPS}`,
                ],
                commands: ['npm ci', 'npm run build', 'npx aws-cdk synth -c pipeline=true'], // Build and synthesize the CDK app
                rolePolicyStatements: codeArtifactPermissions,
                env: {
                    DEVOPS_ACCOUNT: process.env.DEVOPS_ACCOUNT!,
                    DEVELOPMENT_ACCOUNT: process.env.DEVELOPMENT_ACCOUNT!, 
                    TEST_ACCOUNT: process.env.TEST_ACCOUNT!,
                    ACCEPTANCE_ACCOUNT: process.env.ACCEPTANCE_ACCOUNT!,
                    PRODUCTION_ACCOUNT: process.env.PRODUCTION_ACCOUNT!,
                },
            }),
        });

        // Add a deployment stage to TEST
        pipeline.addStage(new DeploymentStage(this, Accounts.TEST, props));

        pipeline.buildPipeline();

        sourceBucket.grantRead(pipeline.pipeline.role);
    }
}
