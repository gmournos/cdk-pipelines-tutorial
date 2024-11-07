import { Construct } from 'constructs';
import { StackProps, Stack, Stage, Fn, Tags } from 'aws-cdk-lib';
import { CodeBuildStep, CodeBuildStepProps, CodePipeline, CodePipelineSource, ManualApprovalStep } from 'aws-cdk-lib/pipelines';
import { getReadableAccountName, 
    INNER_PIPELINE_INPUT_FOLDER, makeVersionedPipelineName, PIPELINES_BUILD_SPEC_DEF_FILE, 
    PIPELINES_BUILD_SPEC_POSTMAN_DEF_FILE, PIPELINES_POSTMAN_SPEC_DEF_FILE, 
    STACK_DEPLOYED_AT_TAG, STACK_VERSION_TAG, StackExports } from '@uniform-pipelines/model';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { S3Trigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { Key } from 'aws-cdk-lib/aws-kms';
import * as fs from 'fs';
import { makeMainBuildStepDefaultBuildspec, makePostmanCodeBuildDefaultBuildspec, overrideBuildSpecPropsFromBuildspecYamlFile } from './inner-pipeline-util';

interface EnvironmentAware {
    environmentName?: string;
}
export type ContainedStackPropsType = StackProps & Partial<EnvironmentAware>;
export type ContainedStackClassConstructor<P extends ContainedStackPropsType = StackProps> = new(c: Construct, id: string, p: P) => Stack;


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

export interface InnerPipelineConstructProps <P extends ContainedStackPropsType = StackProps> {
    containedStackProps?: P;
    containedStackName: string;
    containedStackVersion: string;
    containedStackClass: ContainedStackClassConstructor<P>,
}

export class InnerPipelineConstruct<P extends ContainedStackPropsType = StackProps> extends Construct {
    readonly pipeline: CodePipeline;
    protected readonly codeSource: CodePipelineSource;
    readonly stagesWithtransitionsToDisable: string[] = []; 

    public createDeploymentStage(targetAccount: string, requiresApproval: boolean, shouldSmokeTest: boolean, pipelineStackProps: InnerPipelineConstructProps<P>, targetRegion?: string) {

        class DeploymentStage extends Stage {
            readonly containedStack: Stack;

            constructor(scope: Construct, targetAccount: string, pipelineStackProps: InnerPipelineConstructProps<P>) {
                super(scope, `${pipelineStackProps.containedStackName}-pipeline-deployment-${targetAccount}`, {
                    stageName: makeDeploymentStageName(targetAccount),
                });
                this.containedStack = new pipelineStackProps.containedStackClass(this, 'artifacts-stack', {
                    ...pipelineStackProps.containedStackProps,
                    stackName: pipelineStackProps.containedStackName,
                    env: { 
                        account: targetAccount,
                        region: targetRegion ?? this.region,
                    },
                    environmentName: getReadableAccountName(targetAccount),
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

    protected makeManualApprovalStep(targetAccount: string, pipelineStackProps: InnerPipelineConstructProps<P>) {
        const accountName = getReadableAccountName(targetAccount);

        return new ManualApprovalStep(`${pipelineStackProps.containedStackName}-${pipelineStackProps.containedStackVersion}-approval-promote-to-${accountName}`, {
            comment: `Approve to deploy to ${accountName}`,
        });
    }

    constructor(scope: Construct, id: string, props: InnerPipelineConstructProps<P>) {
        super(scope, id);

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
            selfMutation: this.needsSelfMutation(scope),
        });
    }

    protected needsSelfMutation(scope: Construct) {
        const mutationFromContext = scope.node.tryGetContext("selfMutation");
        return  mutationFromContext === 'true';
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
