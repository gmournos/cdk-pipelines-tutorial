import { PipelineRoles } from '../../../lib/model';

const SOURCE_STAGE = 'Source';
const BUILD_STAGE = 'Build';
const SELF_MUTATE_STAGE = 'UpdatePipeline';
const ASSETS_STAGE = 'Assets';
const DEPLOYMENT_STAGE_SUFFIX = '-deployment';
const POSTMAN_ACTION = '-run-postman-';
const APPROVAL_ACTION = '-approval-promote-to-';

const CODEBUILD_PROJECT_SYNTH = 'synth-step';
const CODEBUILD_PROJECT_POSTMAN = '-run-postman-';
const CODEBUILD_PROJECT_SELF_MUTATE = 'UpdatePipeline/SelfMutate';
const CODEBUILD_PROJECT_ASSET = 'Assets/FileAsset';

const DEVOPS_ACCOUNT = process.env.DEVOPS_ACCOUNT;

type CloudFormationMacroEvent = {
    fragment: any;
    requestId: any,
};

type CloudFormationMacroResponse = CloudFormationMacroEvent & {
    status: string,
}

const replaceServiceRoleArnWithGlobalRole = (codebuildNode: any, globalRoleName: string) => {
    console.log('Replacing Service Role with :', globalRoleName);
    codebuildNode.Properties.ServiceRole = `arn:aws:iam::${DEVOPS_ACCOUNT}:role/${globalRoleName}`;
};

const replaceRoleArnWithGlobalRole = (parentNode: any, globalRoleName: string) => {
    console.log('Replacing Role with :', globalRoleName);
    parentNode.RoleArn = `arn:aws:iam::${DEVOPS_ACCOUNT}:role/${globalRoleName}`;
};

const replaceStageActionRoleArnsWithGlobalRole = (stageNode: any, globalRoleName: string, expectedActions: number = 0) => {
    if (expectedActions !== 0 && expectedActions !== stageNode.Actions.length) {
        throw new Error(`Error transforming stage ${stageNode.Name}. Expected ${expectedActions} actions but found ${stageNode.Actions.length}`);
    }
    for (const action of stageNode.Actions) {
        console.log('Visiting Action:', action.Name);
        replaceRoleArnWithGlobalRole(action, globalRoleName);
    }
};


const replaceDeploymentStageActionRoleArnsWithImports = (deploymnetStageNode: any) => {
    // Prepare and Update Changeset are handled by the service roles of the target account.
    // But we still need to set the roles for postman and manual approval

    for (const action of deploymnetStageNode.Actions) {
        console.log('Visiting Action Name:', action.Name);
        if (action.Name.includes(POSTMAN_ACTION)) {
            replaceRoleArnWithGlobalRole(action, PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_POSTMAN_ACTION);
        } else if (action.Name.includes(APPROVAL_ACTION)) {
            replaceRoleArnWithGlobalRole(action, PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_DEPLOY_STAGE_APPROVAL_ACTION);
        }
    }
};


const processPipelineResource = (pipelineResourceNode: any) => {
    console.log('Entering pipeline :', pipelineResourceNode.Name);

    const stages = pipelineResourceNode.Properties.Stages;
    replaceRoleArnWithGlobalRole(pipelineResourceNode.Properties, PipelineRoles.INNER_PIPELINE_MAIN_ROLE);
    delete pipelineResourceNode.DependsOn; // it would depend on the main pipeline role and related policy

    for (const stage of stages) {
        console.log('Entering Stage:', stage.Name);

        if (stage.Name === SOURCE_STAGE) {
            replaceStageActionRoleArnsWithGlobalRole(stage, PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_SOURCE_STAGE_SOURCE_ACTION, 1);
        } else if (stage.Name === BUILD_STAGE) {
            replaceStageActionRoleArnsWithGlobalRole(stage, PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_BUILD_STAGE_BUILD_CDK_ACTION, 1);
        } else if (stage.Name === SELF_MUTATE_STAGE) {
            replaceStageActionRoleArnsWithGlobalRole(stage, PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_UPDATEPIPELINE_STAGE_SELFMUTATE_ACTION, 1);
        } else if (stage.Name === ASSETS_STAGE) {
            replaceStageActionRoleArnsWithGlobalRole(stage, PipelineRoles.INNER_PIPELINE_CODEBUILD_ROLE_ASSETS_STAGE_FILEASSET_ACTION, 0);
        } else if (stage.Name.endsWith(DEPLOYMENT_STAGE_SUFFIX)) {
            replaceDeploymentStageActionRoleArnsWithImports(stage);
        } else {
            throw new Error(`Unknown stage ${stage.Name}`);
        }
    }
}

// codeBuildResourceNode
const processCodebuildResource = (codeBuildResourceNode: any) => {
    console.log(`Entering Codebuild project name: ${codeBuildResourceNode?.Name}, description: ${codeBuildResourceNode.Properties?.Description}`);

    if (codeBuildResourceNode.Properties?.Description?.includes(CODEBUILD_PROJECT_SYNTH)) {
        replaceServiceRoleArnWithGlobalRole(codeBuildResourceNode, PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_CDK_BUILD_PROJECT);
    } else if (codeBuildResourceNode?.Properties?.Description?.includes(CODEBUILD_PROJECT_POSTMAN)) {
        replaceServiceRoleArnWithGlobalRole(codeBuildResourceNode, PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_POSTMAN_BUILD_PROJECT);
    } else if (codeBuildResourceNode?.Properties?.Description?.includes(CODEBUILD_PROJECT_SELF_MUTATE)) {
        replaceServiceRoleArnWithGlobalRole(codeBuildResourceNode, PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_SELFUPDATE_PROJECT);
    } else if (codeBuildResourceNode?.Properties?.Description?.includes(CODEBUILD_PROJECT_ASSET)) {
        replaceServiceRoleArnWithGlobalRole(codeBuildResourceNode, PipelineRoles.INNER_PIPELINE_CODEBUILD_SERVICE_ROLE_ASSETS_PROJECT);
    } else {
        throw new Error(`Unknown codebuild Project ${codeBuildResourceNode?.Properties?.Description}`);
    }
}

export async function transformRoles(event: CloudFormationMacroEvent, context: any): Promise<CloudFormationMacroResponse> {
    const fragment = event.fragment;

    if (fragment && fragment.Resources) {
        const filteredResources: Record<string, any> = {};

        for (const key in fragment.Resources) {
            const resource = fragment.Resources[key];
            
            console.log(`Visiting resource ${resource.Name} with type ${resource.Type}`);

            if (resource.Type === 'AWS::CodePipeline::Pipeline') {
                processPipelineResource(resource);
            } else if (resource.Type === 'AWS::CodeBuild::Project') {
                processCodebuildResource(resource);
            }
            
            if (resource.Type !== 'AWS::IAM::Role' && resource.Type !== 'AWS::IAM::Policy') {
                filteredResources[key] = resource;
            } else {
                console.log('Filtering out role/policy', key);
            }
            
        }

        // Replace the original resources with the filtered resources
        fragment.Resources = filteredResources;

        console.log(JSON.stringify(fragment));
    }

    return {
        requestId: event.requestId,
        status: 'success',
        fragment,
    };
}

