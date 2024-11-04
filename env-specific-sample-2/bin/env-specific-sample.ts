#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DynamicEnvSpecificSampleStack } from '../lib/env-specific-sample-stack';

const app = new cdk.App();
new DynamicEnvSpecificSampleStack(app, 'ComplexStackSampleStack', {
    description: 'Dynamic env specific stack',
});
