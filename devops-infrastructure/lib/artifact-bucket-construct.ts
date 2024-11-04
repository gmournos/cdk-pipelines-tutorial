import { BlockPublicAccess, Bucket, BucketEncryption, IBucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { ARTIFACT_BUCKET_NAME, ARTIFACT_BUCKET_KEY_NAME, Accounts, StackExports } from "@uniform-pipelines/model";
import { CfnOutput, DefaultStackSynthesizer, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Key } from "aws-cdk-lib/aws-kms";
import { AccountPrincipal, ArnPrincipal, Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";


export class ArtifactBucketConstruct extends Construct {
    artifactBucketEncryptionKey: Key;
    artifactBucket: IBucket;
    private deployAccountPrincipals: ArnPrincipal[];
        
    constructor(scope: Construct, id: string) {
        super(scope, id);
        const deployAccounts = [Accounts.TEST, Accounts.ACCEPTANCE, Accounts.PRODUCTION];
        this.deployAccountPrincipals = deployAccounts.map(
            account => new ArnPrincipal(`arn:aws:iam::${account}:role/cdk-${DefaultStackSynthesizer.DEFAULT_QUALIFIER}-deploy-role-${account}-${Stack.of(this).region}`)
        );
        
        this.artifactBucketEncryptionKey = this.makeArtifactBucketKey();
        this.artifactBucket = this.makeArtifactBucket();
    }

    makeArtifactBucketKey() {
        // Encryption key for the artifact bucket Store
        const artifactBucketEncryptionKey = new Key(this, ARTIFACT_BUCKET_KEY_NAME, {
            description: `EncryptionKey used by the uniform pipelines to access the content of the ${ARTIFACT_BUCKET_NAME}`,
            alias: ARTIFACT_BUCKET_KEY_NAME,
            enableKeyRotation: true,
        });
        const {account} = Stack.of(this);

        const crossAccountKeyPermissions = [
            new PolicyStatement({
                actions: ['kms:Decrypt', 'kms:DescribeKey'],
                resources: ['*'],
                principals: this.deployAccountPrincipals,
            }),
            new PolicyStatement({
                actions: ['kms:Decrypt', 'kms:DescribeKey', 'kms:Encrypt', 'kms:ReEncrypt*', 'kms:GenerateDataKey*'],
                principals: [new AccountPrincipal(account)],
                resources: ['*'],
            }),
        ];

        crossAccountKeyPermissions.forEach(permission => artifactBucketEncryptionKey.addToResourcePolicy(permission));

        new CfnOutput(this, 'uniform-pipeline-artifact-bucket-key-arn-export', {
            description: 'Arn of the kms key of the artifact bucket of uniform Pipelines',
            value: artifactBucketEncryptionKey.keyArn,
            exportName: StackExports.PIPELINE_ARTIFACT_BUCKET_KEY_ARN_REF,
        });

        return artifactBucketEncryptionKey;
    }

    
    makeArtifactBucket() {
        
        const artifactBucket = new Bucket(this, ARTIFACT_BUCKET_NAME, {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryptionKey: this.artifactBucketEncryptionKey,
            encryption: BucketEncryption.KMS,
            bucketName: `${ARTIFACT_BUCKET_NAME}`,
            versioned: false,
            removalPolicy: RemovalPolicy.DESTROY,
        });
        const crossAccountArtifactBucketPermissions = [
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['s3:GetObject*', 's3:GetBucket*', 's3:List*'],
                principals: [
                    ...this.deployAccountPrincipals,
                    new AccountPrincipal(Stack.of(this).account),
                ],
                resources: [
                    artifactBucket.bucketArn, `${artifactBucket.bucketArn}/*`,
                ],
            }),
        ];
        crossAccountArtifactBucketPermissions.forEach(permission => artifactBucket.addToResourcePolicy(permission));
        new CfnOutput(this, 'uniform-pipeline-artifact-bucket-arn-export', {
            description: 'Arn of the artifact bucket of cdk uniform Pipelines',
            value: artifactBucket.bucketArn,
            exportName: StackExports.PIPELINE_ARTIFACT_BUCKET_ARN_REF,
        });
        return artifactBucket;
    }
}