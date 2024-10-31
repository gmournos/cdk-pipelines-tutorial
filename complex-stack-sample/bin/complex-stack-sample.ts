#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ComplexStackSampleStack } from '../lib/complex-stack-sample-stack';
import { PipelineStack } from '../lib/pipeline-construct';

const app = new cdk.App();

const inPipelines = app.node.tryGetContext('pipeline');
const description = 'Sample Stack with many assets';

if (inPipelines === 'true') {
    new PipelineStack(app, 'pipeline-stack', {
        containedStackName: 'ComplexStackSampleStack',
        containedStackProps: {
            description,
        },
        description: 'Pipeline stack to deploy Feature1',
        stackName: 'PipelineStack',
    });
} else {
    new ComplexStackSampleStack(app, 'ComplexStackSampleStack', {
        description,
    });
}
