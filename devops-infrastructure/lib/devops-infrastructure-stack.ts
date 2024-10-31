import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodeArtifactCdkConstruct } from './codartifact-construct';
import { SourceCodeBucketConstruct } from './source-code-bucket-construct';
import { ArtifactBucketConstruct } from './artifact-bucket-construct';

export class DevopsInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        new CodeArtifactCdkConstruct(this, 'codeartifact-construct');
        const sourceBucketConstruct = new SourceCodeBucketConstruct(this, 'source-code-bucket');
        const artifactBucketConstruct = new ArtifactBucketConstruct(this, 'artifact-bucket');
    }
}
