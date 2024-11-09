import * as cdk from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';
import { HighLevelFunction } from './high-level-function';
import { Code } from 'aws-cdk-lib/aws-lambda';

export interface EnvSpecificSampleStackProps extends cdk.StackProps {
    environmentName: string;
}

export class EnvSpecificSampleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: EnvSpecificSampleStackProps) {
        super(scope, id, props);

        // 1. Create an S3 Bucket
        const bucket = new Bucket(this, 'env-specidic-1-sample-bucket', {
            bucketName: `uniform-pipeline-env-specidic-1-sample-bucket-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        (bucket.node.defaultChild as CfnBucket).overrideLogicalId(`feature3samplebucketfor${props.environmentName}`);

        // 2. Deploy a sample file to the S3 Bucket
        new BucketDeployment(this, 'deploy-sample-file', {
            sources: [Source.asset(path.join('sample-files', props.environmentName))],
            destinationBucket: bucket,
        });
        
        // 3. Create a Lambda function using HighLevelFunction
        new HighLevelFunction(this, 'env-specific-aspect-sample-function', {
            functionName: 'uniform-pipelines-env-specific-aspect-sample-function',
            handler: "index.handler",
            code: Code.fromInline(`
                exports.handler = async function(event) {
                    console.log("Event: ", JSON.stringify(event, null, 2));
                    return {
                        statusCode: 200,
                        body: JSON.stringify({ message: "Hello from Lambda!" }),
                    };
                };
            `)
        });
    }
}
