import * as cdk from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

export class ComplexStackSampleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // 1. Create an S3 Bucket
        const bucket = new Bucket(this, 'feature2-sample-bucket', {
            versioned: true,
            bucketName: `cdk-pipelines-feature2-sample-bucket-${this.account}`,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // 2. Deploy a sample file to the S3 Bucket
        new BucketDeployment(this, 'deploy-sample-file', {
            sources: [Source.asset('./sample-file')],
            destinationBucket: bucket,
        });

        // 3. Create a Lambda function using NodejsFunction
        const myLambda = new NodejsFunction(this, 'feature2-sample-function', {
            functionName: 'cdk-pipelines-feature2-sample-function',
            runtime: Runtime.NODEJS_20_X,
            entry: path.join('lambda', 'sample-function.ts'),
            handler: 'writeRandomToS3',
            environment: {
                BUCKET_NAME: bucket.bucketName,
            },
        });

        // Grant the Lambda function permissions to read/write from the S3 bucket
        bucket.grantReadWrite(myLambda);
    }
}
