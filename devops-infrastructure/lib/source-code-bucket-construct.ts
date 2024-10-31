import { Bucket, IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { SOURCE_CODE_BUCKET_NAME, StackExports } from "./model";
import { CfnOutput } from "aws-cdk-lib";

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
    }
}