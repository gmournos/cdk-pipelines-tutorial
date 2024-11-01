
type CloudFormationMacroEvent = {
    fragment: any;
    requestId: any,
};

type CloudFormationMacroResponse = CloudFormationMacroEvent & {
    status: string,
}

const PREPARE_ACTION = 'Prepare';
const DEPLOY_ACTION = 'Deploy';
const PREVIOUS_CHANGESET_NAME = 'PipelineChange';

const alterChangesetName = (actionNode: any, pipelineName: string) => {
    if (actionNode?.Configuration?.ChangeSetName === PREVIOUS_CHANGESET_NAME) {
        actionNode.Configuration.ChangeSetName = `UniformPipelineChange-${pipelineName}`;
    } else {
        throw new Error('Unexpected action config');
    }
};

const processPipelineResource = (pipelineResourceNode: any) => {
    console.log('Entering pipeline :', pipelineResourceNode?.Properties?.Name);

    const pipelineName = pipelineResourceNode?.Properties?.Name;

    if (pipelineName === undefined) {
        throw new Error('Unexpected empty pipeline name');
    }

    const stages = pipelineResourceNode.Properties.Stages;
    
    for (const stageNode of stages) {
        console.log('Entering Stage:', stageNode.Name);
        for (const actionNode of stageNode.Actions) {
            console.log('Visiting Action:', actionNode.Name);

            if (actionNode.Name === PREPARE_ACTION || actionNode.Name === DEPLOY_ACTION) {
                alterChangesetName(actionNode, pipelineName);
            }
        }
    }
}

export async function alterChangesetNames(event: CloudFormationMacroEvent, context: any): Promise<CloudFormationMacroResponse> {
    const fragment = event.fragment;

    if (fragment && fragment.Resources) {

        for (const key in fragment.Resources) {
            const resource = fragment.Resources[key];
            
            console.log(`Visiting resource ${resource.Name} with type ${resource.Type}`);

            if (resource.Type === 'AWS::CodePipeline::Pipeline') {
                processPipelineResource(resource); 
            }
        }

        console.debug('transformed pipeline', JSON.stringify(fragment));
    }

    return {
        requestId: event.requestId,
        status: 'success',
        fragment,
    };
};
