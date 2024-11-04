import { StackProps } from "aws-cdk-lib";
import * as cdk from 'aws-cdk-lib';
import { ContainedStackClassConstructor, INNER_PIPELINE_STACK_TEMPLATE_NAME, 
    makeVersionedPipelineStackName, PartialStackProps } from "./model";
import { InnerPipelineStack } from "./inner-pipeline-stack";

export class InnerPipelineStackFactory<P extends StackProps = StackProps> {
    buildInnerPipelineStackBase(parentScope: cdk.App, containedStackClass: ContainedStackClassConstructor<P>, extraContainedStackProps?: PartialStackProps<StackProps>) {
        const containedStackVersion = parentScope.node.tryGetContext('version');
        const containedStackName = parentScope.node.tryGetContext('stackName');
        const containedStackDescription = parentScope.node.tryGetContext('description');
        const versionedDescription = `${containedStackName}:${containedStackVersion}: ${containedStackDescription}`;
        const innerPipelineConstructProps = {
            containedStackName,
            containedStackVersion,
            containedStackClass,
            containedStackProps: {
                ...extraContainedStackProps,
                description: versionedDescription,
            },
        };
        new InnerPipelineStack(parentScope, INNER_PIPELINE_STACK_TEMPLATE_NAME, {
            ...innerPipelineConstructProps,
            description: `Inner Delivery Pipeline for ${containedStackName}:${containedStackVersion}`,
            stackName: makeVersionedPipelineStackName(containedStackName, containedStackVersion),
        });
   }
}
