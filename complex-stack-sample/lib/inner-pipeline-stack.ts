
import { StackProps } from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib';
import { Accounts, CHANGESET_RENAME_MACRO, DEPLOYER_STACK_NAME_TAG, 
    ROLE_REASSIGN_MACRO, STACK_NAME_TAG, STACK_VERSION_TAG } from "./model";
import { ContainedStackPropsType, InnerPipelineConstruct, InnerPipelineConstructProps } from "./inner-pipeline-construct";
import { CfnPipeline } from "aws-cdk-lib/aws-codepipeline";
import { Construct } from "constructs";

interface InnerPipelineStackProps<P extends ContainedStackPropsType = StackProps> extends StackProps, InnerPipelineConstructProps<P> {} 

export class InnerPipelineStack<P extends ContainedStackPropsType = StackProps> extends cdk.Stack {
            
    constructor(scope: Construct, id: string, props: InnerPipelineStackProps<P>) {
        super(scope, id, props);    

        const innerPipelineConstruct = new InnerPipelineConstruct(this, 'inner-pipeline-construct', props);

        // Add a deployment stage to TEST
        innerPipelineConstruct.createDeploymentStage(Accounts.TEST, false, true, props); 

        // Add a deployment stage to ACCEPTANCE
        innerPipelineConstruct.createDeploymentStage(Accounts.ACCEPTANCE, true, false, props); 

        // Add a deployment stage to PRODUCTION
        innerPipelineConstruct.createDeploymentStage(Accounts.PRODUCTION, true, false, props); 

        innerPipelineConstruct.pipeline.buildPipeline();

        this.addTransform(CHANGESET_RENAME_MACRO); 
        this.addTransform(ROLE_REASSIGN_MACRO); 
        disableTransitions(innerPipelineConstruct.pipeline.pipeline.node.defaultChild as CfnPipeline, 
            innerPipelineConstruct.stagesWithtransitionsToDisable, 'Avoid manual approval expiration after one week');

        cdk.Tags.of(innerPipelineConstruct.pipeline.pipeline).add(STACK_NAME_TAG, props.containedStackName);
        cdk.Tags.of(innerPipelineConstruct.pipeline.pipeline).add(STACK_VERSION_TAG, props.containedStackVersion);
        cdk.Tags.of(innerPipelineConstruct.pipeline.pipeline).add(DEPLOYER_STACK_NAME_TAG, this.stackName);
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
