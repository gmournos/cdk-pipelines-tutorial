import { CodePipelineClient, PipelineExecutionStatus, StartPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
import { filterTagsToMap, getPipelineArn, getPipelineLastExecutionStatus, getPipelineTags, listPipelines } from './utils';
import { DateTime } from 'luxon';
import { DEPLOYER_STACK_NAME_TAG, STACK_NAME_TAG, STACK_VERSION_TAG } from '@uniform-pipelines/model';
import { HISTORY_MONTHS_LENGTH } from '../auto-cleanup-model';

// Create a new CodePipeline client
const client = new CodePipelineClient();

export const startPipeline = async () => {
    const params = {
        name: process.env.PIPELINE_NAME, // Pipeline name passed as environment variable
    };

    try {
        const command = new StartPipelineExecutionCommand(params);
        await client.send(command);
        console.info('Pipeline started successfully');
    } catch (err) {
        console.error('Error starting pipeline:', err);
        throw err;
    }
};


interface UniformPipelineInfo {
    pipelineName: string;
    pipelineArn: string;
    containedStackVersion: string;
    containedStackName: string;
    pipelineLastUpdate: Date;
    cloudformationStackName: string;
    pipelineStatus: PipelineExecutionStatus;
}

const getOldUniformPipelinesInfo = async () => {
    const allPipelines = await listPipelines();
    const pattern = /-\d{1,3}-\d{1,3}-\d{1,3}-pipeline$/;
    const result: UniformPipelineInfo[] = [];

    const filteredUniformPipelines = allPipelines.filter(pipeline => pattern.test(pipeline.name ?? ''));
    console.debug('Uniform pipelines are', filteredUniformPipelines);
    
    for (const pipeline of filteredUniformPipelines) {
        console.debug('Examining pipeline', pipeline);
        if (pipeline.name === undefined) {
            console.warn('Skipping empty pipeline', pipeline);
            continue;
        }
        const pipelineArn = await getPipelineArn(pipeline.name);
        if (pipelineArn === undefined) {
            console.warn('Skipping empty pipeline Arn for pipeline', pipeline);
            continue;
        }

        const pipelineLastUpdate = pipeline.updated;
        if (pipelineLastUpdate === undefined) {
            console.warn('Skipping pipeline with corrupt last update', pipeline);
            continue;
        }
        
        const allPipelineTags = await getPipelineTags(pipelineArn);
        const pipelineTags = filterTagsToMap(allPipelineTags, [
            STACK_NAME_TAG,
            STACK_VERSION_TAG,
            DEPLOYER_STACK_NAME_TAG,
        ]);

        const cloudformationStackName = pipelineTags.get(DEPLOYER_STACK_NAME_TAG);
        const containedStackVersion = pipelineTags.get(STACK_VERSION_TAG);
        const containedStackName = pipelineTags.get(STACK_NAME_TAG);

        if (
            cloudformationStackName === undefined ||
            containedStackVersion === undefined ||
            containedStackName === undefined
        ) {
            console.warn('Skipping corrupt pipeline', pipeline);
            continue;
        }
        const pipelineStatus = await getPipelineLastExecutionStatus(pipeline.name);
        
        result.push({
            pipelineName: pipeline.name,
            pipelineArn,
            containedStackVersion,
            containedStackName,
            pipelineLastUpdate,
            cloudformationStackName,
            pipelineStatus,
        });
    }

    return result;
};
