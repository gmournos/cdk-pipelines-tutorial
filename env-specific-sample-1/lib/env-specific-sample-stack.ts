import * as cdk from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as path from 'path';

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
    }
}
