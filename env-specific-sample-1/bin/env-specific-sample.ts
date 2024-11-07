#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EnvSpecificSampleStack } from '../lib/env-specific-sample-stack';
import { getReadableAccountName } from '@uniform-pipelines/model';

const app = new cdk.App();

new EnvSpecificSampleStack(app, 'env-specific-1', {
    description: "Environment specific stack",
    environmentName: getReadableAccountName(process.env.CDK_DEFAULT_ACCOUNT!),
});

