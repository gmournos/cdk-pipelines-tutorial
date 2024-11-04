import { Bucket, EventType, IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { OUTER_PIPELINE_NAME, SOURCE_CODE_BUCKET_NAME, StackExports } from "@uniform-pipelines/model";
import { CfnOutput, Stack } from "aws-cdk-lib";
import { join } from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

export class SourceCodeBucketConstruct extends Construct {
    sourceBucket: IBucket;

    constructor(scope: Construct, id: string) {
        super(scope, id);

        this.sourceBucket = new Bucket(this, 'tutorial-sources-bucket', {
            bucketName: SOURCE_CODE_BUCKET_NAME,
            versioned: true,
        });

        new CfnOutput(this, 'uniform-pipeline-source-bucket-arn-export', {
            description: 'Arn of the source bucket of cdk uniform Pipelines',
            value: this.sourceBucket.bucketArn,
            exportName: StackExports.PIPELINE_SOURCE_BUCKET_ARN_REF,
        });

        
        // Create a Node.js Lambda function using NodejsFunction
        const pipelineTriggerLambda = new NodejsFunction(this, 'pipeline-trigger-function', {
            entry: join('lambda', 'codepipeline', 'handlers.ts'),  // Path to the Lambda function file
            handler: 'startPipeline',  // The name of the exported handler in the Lambda file
            environment: {
                PIPELINE_NAME: OUTER_PIPELINE_NAME,  // Set the name of your pipeline as an environment variable
            },
        });
        const { account, region } = Stack.of(this);

        pipelineTriggerLambda.addToRolePolicy(new PolicyStatement({
            actions: ['codepipeline:StartPipelineExecution'],  // Allow Lambda to start pipeline execution
            resources: [`arn:aws:codepipeline:${region}:${account}:${OUTER_PIPELINE_NAME}`],  // The ARN of the pipeline
            effect: Effect.ALLOW,
        }));

        // Add S3 event notification to trigger Lambda on object creation
        this.sourceBucket.addEventNotification(
            EventType.OBJECT_CREATED_PUT,  // Event for file creation
            new LambdaDestination(pipelineTriggerLambda),  // Destination is the Lambda function
            { prefix: 'deployments/' }  // Only trigger for files in the 'deployments/' folder
        );
    }
}