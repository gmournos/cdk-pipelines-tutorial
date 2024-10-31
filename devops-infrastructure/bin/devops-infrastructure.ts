#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DevopsInfrastructureStack } from '../lib/devops-infrastructure-stack';

const app = new cdk.App();
new DevopsInfrastructureStack(app, 'devops-infrastructure-stack', {
});