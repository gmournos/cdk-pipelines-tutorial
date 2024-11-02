#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { InnerPipelineStackFactory } from '@uniform-pipelines/factory';
import { getReadableAccountName } from '@uniform-pipelines/model';
import { EnvSpecificSampleStack, EnvSpecificSampleStackProps } from '../lib/env-specific-sample-stack';

const app = new cdk.App();

const inPipelines = app.node.tryGetContext('pipeline');
const containedStackDescription = app.node.tryGetContext('description');
const containedStackVersion = app.node.tryGetContext('version');
const containedStackName = app.node.tryGetContext('stackName');

const versionedDescription = `${containedStackName}:${containedStackVersion}: ${containedStackDescription}`;

if (inPipelines === 'true') {
    new InnerPipelineStackFactory<EnvSpecificSampleStackProps>().buildInnerPipelineStackBase(app, EnvSpecificSampleStack);
} else {
    new EnvSpecificSampleStack(app, 'ComplexStackSampleStack', {
        description: versionedDescription,
        stackName: containedStackName,
        environmentName: getReadableAccountName(process.env.CDK_DEFAULT_ACCOUNT!),
    });
}
