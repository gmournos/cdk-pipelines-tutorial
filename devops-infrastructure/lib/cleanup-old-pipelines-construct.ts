import { Construct } from 'constructs';
import { Duration, Stack } from 'aws-cdk-lib';
import { join } from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { BatchProcessingStepFunctionConstruct } from './detector-batch-consumer-step-function-construct';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { DELETE_PROCESS_SCHEDULE } from '../lambda/auto-cleanup-model';

export class CleanupOldPipelinesConstruct extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);

        const detectorFunction = new NodejsFunction(this, 'old-pipelines-detector-function', {
            functionName: 'old-pipelines-detector-function',
            runtime: Runtime.NODEJS_20_X,
            handler: 'detectOldPipelineStacks',
            entry: join('lambda', 'codepipeline', 'handlers.ts'),
            timeout: Duration.minutes(10),
        });
        detectorFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: [
                    'codepipeline:ListPipelines',
                    'codepipeline:ListTagsForResource',
                    'codepipeline:ListPipelineExecutions',
                    'codepipeline:GetPipelineExecution',
                    'codepipeline:GetPipeline',
                ],
                resources: ['*'],
            }),
        );

        const batchDeleteFunction = new NodejsFunction(this, 'old-pipelines-batch-delete-function', {
            functionName: 'old-pipelines-batch-delete-function',
            runtime: Runtime.NODEJS_20_X,
            handler: 'batchDeleteStacks',
            entry: join('lambda', 'cloudformation', 'handlers.ts'),
            timeout: Duration.minutes(5),
        });
        // Add permissions for CloudFormation delete stack action directly to the Lambda function
        batchDeleteFunction.addToRolePolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['cloudformation:DeleteStack', 'codepipeline:DeletePipeline'],
                resources: ['*'],
            }),
        );

        const stepFunctionConstruct = new BatchProcessingStepFunctionConstruct(this, 'batch-cleanup-old-pipelines', {
            batchConsumerLambda: batchDeleteFunction,
            detectorLambda: detectorFunction,
            stepFunctionName: 'delete-old-pipelines',
        });

        // Create a CloudWatch Event Rule for daily invocation at 1 AM UTC
        const rule = new Rule(this, 'cleanup-daily-rule', {
            schedule: Schedule.expression(DELETE_PROCESS_SCHEDULE),
        });

        // Add Step Function as the target of the rule
        rule.addTarget(new SfnStateMachine(stepFunctionConstruct.stateMachine));
    }
}
