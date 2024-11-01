import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn, Tags } from 'aws-cdk-lib';
import { CodeBuildStep, CodeBuildStepProps, CodePipeline, CodePipelineSource, ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { Accounts, CHANGESET_RENAME_MACRO, DEPLOYER_STACK_NAME_TAG, getReadableAccountName, 
    INNER_PIPELINE_INPUT_FOLDER, makeVersionedPipelineName, PIPELINES_BUILD_SPEC_DEF_FILE, 
    PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE, PIPELINES_POSTMAN_SPEC_DEF_FILE, ROLE_REASSIGN_MACRO, 
    STACK_DEPLOYED_AT_TAG, STACK_NAME_TAG, STACK_VERSION_TAG } from './model';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { StackExports } from './model';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';
import { CfnPipeline } from 'aws-cdk-lib/aws-codepipeline';
import * as fs from 'fs';
import { makeMainBuildStepDefaultBuildspec, makePostmanCodeBuildDefaultBuildspec, overrideBuildSpecPropsFromBuildspecYamlFile } from './inner-pipeline-util';


const makeDeploymentStageName = (accountValue: string) => {
    return `${getReadableAccountName(accountValue)}-deployment`;
};

export const fileExists = (filename: string) => {
    try {
        fs.accessSync(filename);
        return true;
    } catch (err) {
        return false;
    }
};

export const hasBuildSpec = () => {
    return fileExists(PIPELINES_BUILD_SPEC_DEF_FILE);
};

export const hasPostmanSpec = () => {
    return fileExists(PIPELINES_POSTMAN_SPEC_DEF_FILE);
};

export const hasPostmanBuildSpec = () => {
    return fileExists(PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE);
};

export type ContainedStackClassConstructor<P extends StackProps = StackProps> = new(c: Construct, id: string, p: P) => Stack;

export interface PipelineStackProps <P extends StackProps = StackProps> extends StackProps {
    containedStackProps?: StackProps;
    containedStackName: string;
    containedStackVersion: string;
    containedStackClass: ContainedStackClassConstructor<P>,
}

export class PipelineStack<P extends StackProps = StackProps> extends Stack {
    protected readonly pipeline: CodePipeline;
    protected readonly codeSource: CodePipelineSource;
    protected readonly stagesWithtransitionsToDisable: string[] = []; 

    public createDeploymentStage(targetAccount: string, requiresApproval: boolean, shouldSmokeTest: boolean, pipelineStackProps: PipelineStackProps<P>) {

        class DeploymentStage extends Stage {
            readonly containedStack: Stack;

            constructor(scope: Construct, targetAccount: string, pipelineStackProps: PipelineStackProps<P>) {
                super(scope, `${pipelineStackProps.containedStackName}-pipeline-deployment-${targetAccount}`, {
                    stageName: makeDeploymentStageName(targetAccount),
                });
                this.containedStack = new pipelineStackProps.containedStackClass(this, 'artifacts-stack', {
                    ...pipelineStackProps.containedStackProps,
                    stackName: pipelineStackProps.containedStackName,
                    env: { 
                        account: targetAccount,
                        region: this.region,
                    }, 
                } as P);
                Tags.of(this.containedStack).add(STACK_VERSION_TAG, pipelineStackProps.containedStackVersion);
                Tags.of(this.containedStack).add(STACK_DEPLOYED_AT_TAG, (new Date()).toISOString());
            }
        }
        if (requiresApproval) {
            this.stagesWithtransitionsToDisable.push(makeDeploymentStageName(targetAccount));
        }

        const resultStage = new DeploymentStage(this, targetAccount, pipelineStackProps);
        const approval = requiresApproval ? {
            stackSteps: [ {
                stack: resultStage.containedStack,
                changeSet: [this.makeManualApprovalStep(targetAccount, pipelineStackProps)],
            }],
        } : {} ;
        const stage = this.pipeline.addStage(resultStage, approval);

        if (shouldSmokeTest && hasPostmanSpec()) {
            stage.addPost(this.makePostmanCodeBuild(targetAccount));
        }
    }

    protected makeManualApprovalStep(targetAccount: string, pipelineStackProps: PipelineStackProps<P>) {
        const accountName = getReadableAccountName(targetAccount);

        return new ManualApprovalStep(`${pipelineStackProps.containedStackName}-${pipelineStackProps.containedStackVersion}-approval-promote-to-${accountName}`, {
            comment: `Approve to deploy to ${accountName}`,
        });
    }

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
        this.codeSource = CodePipelineSource.s3(sourceBucket, `${INNER_PIPELINE_INPUT_FOLDER}/${props.containedStackName}-${props.containedStackVersion}.zip`, {
            trigger: S3Trigger.NONE,
        });

        // Create a new CodePipeline
        this.pipeline = new CodePipeline(this, 'cicd-pipeline', {
            artifactBucket,
            pipelineName: makeVersionedPipelineName(props.containedStackName, props.containedStackVersion),
            // Define the synthesis step
            synth: this.makeMainBuildStep(this.codeSource), 
        });
        
        // Add a deployment stage to TEST
        this.createDeploymentStage(Accounts.TEST, false, true, props); 

        // Add a deployment stage to ACCEPTANCE
        this.createDeploymentStage(Accounts.ACCEPTANCE, true, false, props); 
        
        this.pipeline.buildPipeline();

        this.addTransform(CHANGESET_RENAME_MACRO); 
        this.addTransform(ROLE_REASSIGN_MACRO); 
        disableTransitions(this.pipeline.pipeline.node.defaultChild as CfnPipeline, 
            this.stagesWithtransitionsToDisable, 'Avoid manual approval expiration after one week');

        Tags.of(this.pipeline.pipeline).add(STACK_NAME_TAG, props.containedStackName);
        Tags.of(this.pipeline.pipeline).add(STACK_VERSION_TAG, props.containedStackVersion);
        Tags.of(this.pipeline.pipeline).add(DEPLOYER_STACK_NAME_TAG, this.stackName);
    }

    
    protected makeMainBuildStep(codeSource: CodePipelineSource) {
        const defaultBuildSpecProps = makeMainBuildStepDefaultBuildspec(codeSource);
        
        const buildSpecProps = hasBuildSpec() ? overrideBuildSpecPropsFromBuildspecYamlFile(defaultBuildSpecProps, PIPELINES_BUILD_SPEC_DEF_FILE) : defaultBuildSpecProps;

        return new CodeBuildStep('synth-step', buildSpecProps);
    }

    protected makePostmanCodeBuild(account: string) {
        
        const defaultBuildSpecProps: CodeBuildStepProps = makePostmanCodeBuildDefaultBuildspec(account, this.codeSource);
        const buildSpecProps = hasPostmanBuildSpec() ? overrideBuildSpecPropsFromBuildspecYamlFile(defaultBuildSpecProps,
            PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE) : defaultBuildSpecProps;

        return new CodeBuildStep(`test-run-postman-${account}`, buildSpecProps);
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
