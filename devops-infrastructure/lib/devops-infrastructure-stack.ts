import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodeArtifactCdkConstruct } from './codartifact-construct';
import { SourceCodeBucketConstruct } from './source-code-bucket-construct';
import { ArtifactBucketConstruct } from './artifact-bucket-construct';
import { OuterLevelPipelineConstruct } from './outer-level-pipeline-construct';
import { Role } from 'aws-cdk-lib/aws-iam';
import { PipelinesRoleConstruct } from './pipeline-roles-constructs';

export class DevopsInfrastructureStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        new CodeArtifactCdkConstruct(this, 'codeartifact-construct');
        const sourceBucketConstruct = new SourceCodeBucketConstruct(this, 'source-code-bucket');
        const artifactBucketConstruct = new ArtifactBucketConstruct(this, 'artifact-bucket');
        const pipelineRolesConstruct = new PipelinesRoleConstruct(this, 'pipeline-roles', {
            artifactBucketArn: artifactBucketConstruct.artifactBucket.bucketArn,
            artifactBucketKeyArn: artifactBucketConstruct.artifactBucketEncryptionKey.keyArn,
            sourceBucketArn: sourceBucketConstruct.sourceBucket.bucketArn,
        });

        new OuterLevelPipelineConstruct(this, 'outer-pipeline', {
            artifactBucketArn: artifactBucketConstruct.artifactBucket.bucketArn,
            artifactBucketKeyArn: artifactBucketConstruct.artifactBucketEncryptionKey.keyArn,
            sourceBucketArn: sourceBucketConstruct.sourceBucket.bucketArn,
            mainRole: pipelineRolesConstruct.outerPipelineMainRole,
            actionsRole: pipelineRolesConstruct.outerPipelineActionsRole,
            deploymentRole: pipelineRolesConstruct.outerPipelineDeploymentRole,
        });
        
    }
}
