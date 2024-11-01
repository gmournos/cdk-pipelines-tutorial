import { BuildSpec, LinuxBuildImage, ReportGroupType } from "aws-cdk-lib/aws-codebuild";
import { CodeBuildStepProps, CodePipelineSource } from "aws-cdk-lib/pipelines";
import { Accounts, COMMON_REPO, DOMAIN_NAME, getReadableAccountName, PIPELINES_POSTMAN_SPEC_DEF_FILE, StackExports } from "./model";
import { Fn } from "aws-cdk-lib";
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export const makeMainBuildStepDefaultBuildspec = (codeSource: CodePipelineSource)  => {
    return {
        buildEnvironment: {
            buildImage: LinuxBuildImage.STANDARD_7_0,
        },
        input: codeSource,
        installCommands: [
            'npm install -g aws-cdk',
            `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${Accounts.DEVOPS}`,
        ],
        commands: [
            'npm ci', 'npm run build', 'npx aws-cdk synth -c pipeline=true',
        ],

        env: {
            DEVOPS_ACCOUNT: process.env.DEVOPS_ACCOUNT!,
            DEVELOPMENT_ACCOUNT: process.env.DEVELOPMENT_ACCOUNT!, 
            TEST_ACCOUNT: process.env.TEST_ACCOUNT!,
            ACCEPTANCE_ACCOUNT: process.env.ACCEPTANCE_ACCOUNT!,
            PRODUCTION_ACCOUNT: process.env.PRODUCTION_ACCOUNT!,
        },
    };
};


export const makePostmanCodeBuildDefaultBuildspec = (account: string, codeSource: CodePipelineSource) => {

    const accountName = getReadableAccountName(account);

    const testReportsArn = Fn.importValue(StackExports.POSTMAN_REPORT_GROUP_ARN_REF);

    const defaultBuildSpecProps: CodeBuildStepProps = {
        buildEnvironment: {
            buildImage: LinuxBuildImage.STANDARD_7_0,
        },
        input: codeSource,
        installCommands: [
            `aws codeartifact login --tool npm --repository ${COMMON_REPO} --domain ${DOMAIN_NAME} --domain-owner ${Accounts.DEVOPS}`,
            'npm install -g newman',
        ],
        commands: [
            `echo "Running API tests at ${accountName}"`,
            `newman run -r junit ${PIPELINES_POSTMAN_SPEC_DEF_FILE}`,
        ],
        partialBuildSpec: BuildSpec.fromObject({

            reports: {
                [testReportsArn]: {
                    files: ['**/*'],
                    'base-directory': 'newman',
                    'discard-paths': true,
                    type: ReportGroupType.TEST,
                },
            },
        }),
    };
    return defaultBuildSpecProps;
};

export const overrideBuildSpecPropsFromBuildspecYamlFile = (defaultBuildSpecProps: CodeBuildStepProps, buildspecFilename: string) => {
    const overridingObject = yaml.load(fs.readFileSync(buildspecFilename, 'utf8')) as Record<string, any>;

    const buildSpecProps = { ...defaultBuildSpecProps } as any;

    const installCommands = overridingObject.phases?.install?.commands;
    if (installCommands) {
        buildSpecProps.installCommands = installCommands;
        delete overridingObject.phases.install.commands;
    }
    const buildCommands = overridingObject.phases?.build?.commands;
    if (buildCommands) {
        buildSpecProps.commands = buildCommands;
        delete overridingObject.phases?.build.commands;
    }

    const baseDirectory = overridingObject.artifacts?.['base-directory'];
    if (baseDirectory) {
        buildSpecProps.baseDirectory = baseDirectory;
        delete overridingObject.artifacts['base-directory'];
    }

    const buildImage = overridingObject['build-image'] as string;
    if (buildImage && LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage]) {
        buildSpecProps.buildEnvironment.buildImage = LinuxBuildImage[buildImage as keyof typeof LinuxBuildImage];
    }

    buildSpecProps.partialBuildSpec = BuildSpec.fromObject(overridingObject);
    return buildSpecProps;
};





