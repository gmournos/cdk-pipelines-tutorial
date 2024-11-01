import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn, Tags } from 'aws-cdk-lib';
import { CodeBuildStep, CodeBuildStepProps, CodePipeline, CodePipelineSource, ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { ComplexStackSampleStack } from './complex-stack-sample-stack';
import { Accounts, CHANGESET_RENAME_MACRO, COMMON_REPO, DEPLOYER_STACK_NAME_TAG, DOMAIN_NAME, getReadableAccountName, INNER_PIPELINE_INPUT_FOLDER, makeVersionedPipelineName, ROLE_REASSIGN_MACRO, STACK_DEPLOYED_AT_TAG, STACK_NAME_TAG, STACK_VERSION_TAG } from './model';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StackExports } from './model';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnPipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { BuildSpec, LinuxBuildImage } from 'aws-cdk-lib/aws-codebuild';


const makeDeploymentStageName = (accountValue: string) => {
    return `${getReadableAccountName(accountValue)}-deployment`;
};

class DeploymentStage extends Stage {
    readonly containedStack: Stack;
    constructor(scope: Construct, targetAccount: string, pipelineStackProps: PipelineStackProps) {
        super(scope, `${pipelineStackProps.containedStackName}-pipeline-deployment-${targetAccount}`, {
            stageName: makeDeploymentStageName(targetAccount),
        });
        this.containedStack = new ComplexStackSampleStack(this, 'artifacts-stack', {
            ...pipelineStackProps.containedStackProps,
            stackName: pipelineStackProps.containedStackName
        });
        Tags.of(this.containedStack).add(STACK_VERSION_TAG, pipelineStackProps.containedStackVersion);
        Tags.of(this.containedStack).add(STACK_DEPLOYED_AT_TAG, (new Date()).toISOString());
    }
}

export interface PipelineStackProps extends StackProps {
    containedStackProps: StackProps;
    containedStackName: string;
    containedStackVersion: string;
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
        const codeSource = CodePipelineSource.s3(sourceBucket, `${INNER_PIPELINE_INPUT_FOLDER}/${props.containedStackName}-${props.containedStackVersion}.zip`, {
            trigger: S3Trigger.NONE,
        });

        // Create a new CodePipeline
        const pipeline = new CodePipeline(this, 'cicd-pipeline', {
            artifactBucket,
            pipelineName: makeVersionedPipelineName(props.containedStackName, props.containedStackVersion),
            // Define the synthesis step
            synth: new CodeBuildStep('synth-step', {
                input: codeSource,
                installCommands: [
                    'npm install -g aws-cdk',
                    `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${Accounts.DEVOPS}`,
                ],
                commands: ['npm ci', 'npm run build', 'npx aws-cdk synth -c pipeline=true'], // Build and synthesize the CDK app
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

        // Add a deployment stage to ACCEPTANCE

        const deployToAcceptanceStage = new DeploymentStage(this, Accounts.ACCEPTANCE, {
            ...props,
            env: {
                account: Accounts.ACCEPTANCE,
                region: this.region,
            }
        });
        const approvalAcceptance = {
            stackSteps: [ {
                stack: deployToAcceptanceStage.containedStack,
                changeSet: [
                    new ManualApprovalStep(`${props.containedStackName}-${props.containedStackVersion}-approval-promote-to-${Accounts.ACCEPTANCE}`, {
                        comment: `Approve to deploy to ${Accounts.ACCEPTANCE}`,
                    }),
                ],
            }],
        };
        pipeline.addStage(deployToAcceptanceStage, approvalAcceptance);

        pipeline.buildPipeline();

        this.addTransform(CHANGESET_RENAME_MACRO); 
        this.addTransform(ROLE_REASSIGN_MACRO); 
        disableTransitions(pipeline.pipeline.node.defaultChild as CfnPipeline, 
            [makeDeploymentStageName(Accounts.ACCEPTANCE)], 'Avoid manual approval expiration after one week');

        Tags.of(pipeline.pipeline).add(STACK_NAME_TAG, props.containedStackName);
        Tags.of(pipeline.pipeline).add(STACK_VERSION_TAG, props.containedStackVersion);
        Tags.of(pipeline.pipeline).add(DEPLOYER_STACK_NAME_TAG, this.stackName);
    }

    
    protected overrideBuildSpecPropsFromBuildspecYamlFile(defaultBuildSpecProps: CodeBuildStepProps, buildspecFilename: string) {
        const overridingObject = yaml.load(fs.readFileSync(buildspecFilename, 'utf8')) as Record<string, any>;

        const buildSpecProps = { ...defaultBuildSpecProps } as any;

        const installCommands = overridingObject.phases?.install?.commands;
        if (installCommands) {
            buildSpecProps.installCommands = installCommands;
            delete overridingObject.phases.install.commands;
        }
        const buildCommands = overridingObject.phases?.build?.commands;
        if (buildCommands) {
            buildSpecProps.commands = buildCommands;
            delete overridingObject.phases?.build.commands;
        }

        const baseDirectory = overridingObject.artifacts?.['base-directory'];
        if (baseDirectory) {
            buildSpecProps.baseDirectory = baseDirectory;
            delete overridingObject.artifacts['base-directory'];
        }

        const buildImage = overridingObject['build-image'] as string;
        if (buildImage && LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage]) {
            buildSpecProps.buildEnvironment.buildImage = LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage];
        }

        buildSpecProps.partialBuildSpec = BuildSpec.fromObject(overridingObject);
        return buildSpecProps;
    }

}

const disableTransitions = (pipeline: CfnPipeline, stageNames: string[], disableReason: string) => {
    const disableTransitionsPropertyParams = stageNames.map(stageName => {
        return {
            Reason: disableReason,
            StageName: stageName,
        };
    });
    pipeline.addPropertyOverride("DisableInboundStageTransitions", disableTransitionsPropertyParams);
};
