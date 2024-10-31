import * as cdk from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class ComplexStackSampleStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

    // 1. Create an S3 Bucket
    const bucket = new Bucket(this, 'feature1-sample-bucket', {
        versioned: true,
        bucketName: `cdk-pipelines-feature1-sample-bucket-${this.account}`,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      });
  
      // 2. Deploy a sample file to the S3 Bucket
      new BucketDeployment(this, 'deploy-sample-file', {
        sources: [Source.asset('./sample-file')],
        destinationBucket: bucket,
      });
    }
}
