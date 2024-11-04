#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ComplexStackSampleStack } from '../lib/complex-stack-sample-stack';
import { InnerPipelineStackFactory } from '@uniform-pipelines/factory';

const app = new cdk.App();

const inPipelines = app.node.tryGetContext('pipeline');
const containedStackDescription = app.node.tryGetContext('description');
const containedStackVersion = app.node.tryGetContext('version');
const containedStackName = app.node.tryGetContext('stackName');

const versionedDescription = `${containedStackName}:${containedStackVersion}: ${containedStackDescription}`;

if (inPipelines === 'true') {
    new InnerPipelineStackFactory().buildInnerPipelineStackBase(app, ComplexStackSampleStack);
} else {
    new ComplexStackSampleStack(app, 'ComplexStackSampleStack', {
        description: versionedDescription,
        stackName: containedStackName,
    });
}
