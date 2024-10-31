#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ComplexStackSampleStack } from '../lib/complex-stack-sample-stack';

const app = new cdk.App();
new ComplexStackSampleStack(app, 'ComplexStackSampleStack', {});