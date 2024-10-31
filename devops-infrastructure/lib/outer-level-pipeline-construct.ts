import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as cpactions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import { Action, Artifact } from 'aws-cdk-lib/aws-codepipeline';
import { Construct } from 'constructs';
import { Accounts, COMMON_REPO, DOMAIN_NAME, makeVersionedPipelineStackName, OUTER_PIPELINE_NAME } from './model';
import { IRole } from 'aws-cdk-lib/aws-iam';
import { IBucket } from 'aws-cdk-lib/aws-s3';

interface OuterLevelPipelineStackProps {
    sourceAction: Action;
    sourceOutput: Artifact;
    templatePath: string;
    mainRole: IRole;
    actionsRole: IRole;
    artifactBucket: IBucket;
}

export class OuterLevelPipelineConstruct extends Construct {
    constructor(scope: cdk.App, id: string, props: OuterLevelPipelineStackProps) {
        super(scope, id);

        // Synthesize stage - running `cdk synth`
        const synthOutput = new Artifact();
        const synthAction = new cpactions.CodeBuildAction({
            actionName: 'Synth',
            role: props.mainRole,
            input: props.sourceOutput,
            outputs: [synthOutput],
            project: new codebuild.PipelineProject(this, 'synth-outer-pipeline', {
                role: props.actionsRole,
                buildSpec: codebuild.BuildSpec.fromObject({
                    version: '0.2',
                    env: {
                        'exported-variables': ['targetStackName', 'targetStackVersion'],
                    },
                    phases: {
                        install: {
                            commands: [
                                'cat cdk.context.json',
                                'node --version',
                                'npm install -g aws-cdk',
                                'npx aws-cdk --version',
                                'targetStackName=$(jq -r .stackName cdk.context.json)',
                                'targetStackVersion=$(jq -r .version cdk.context.json)',
                                `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${Accounts.DEVOPS}`,
                                'npm ci',
                            ],
                        },
                        build: {
                            commands: ['cdk synth  -c pipeline=true'],
                        },
                    },
                    artifacts: {
                        'base-directory': 'cdk.out', // Output directory from cdk synth
                        files: [props.templatePath],
                    },
                }),
                environment: {
                    buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                    environmentVariables: {
                        DEVOPS_ACCOUNT: { value : process.env.DEVOPS_ACCOUNT},
                        DEVELOPMENT_ACCOUNT: { value : process.env.DEVELOPMENT_ACCOUNT },
                        TEST_ACCOUNT: { value : process.env.TEST_ACCOUNT },
                        ACCEPTANCE_ACCOUNT: { value : process.env.ACCEPTANCE_ACCOUNT },
                        PRODUCTION_ACCOUNT: { value : process.env.PRODUCTION_ACCOUNT },
                    },
                },
            }),
        });
        const targetStackName = synthAction.variable('targetStackName');
        const targetStackVersion = synthAction.variable('targetStackVersion');

        // Deploy stage
        const deployAction = new cpactions.CloudFormationCreateUpdateStackAction({
            actionName: 'CFN_Deploy',
            templatePath: synthOutput.atPath(props.templatePath),
            stackName: makeVersionedPipelineStackName(targetStackName, targetStackVersion),
            adminPermissions: true,
            role: props.actionsRole,
        });

        // Create the pipeline
        new codepipeline.Pipeline(this, 'outer-pipeline', {
            role: props.mainRole,
            artifactBucket: props.artifactBucket,
            pipelineName: OUTER_PIPELINE_NAME,
            stages: [
                {
                    stageName: 'Source',
                    actions: [props.sourceAction],
                },
                {
                    stageName: 'Synth',
                    actions: [synthAction],
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction],
                },
            ],
        });
    }
}
