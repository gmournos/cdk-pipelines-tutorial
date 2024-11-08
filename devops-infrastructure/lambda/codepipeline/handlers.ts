import { CodePipelineClient, PipelineExecutionStatus, StartPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';
import { filterTagsToMap, getPipelineArn, getPipelineLastExecutionStatus, getPipelineTags, listPipelines } from './utils';
import { DateTime } from 'luxon';
import { DEPLOYER_STACK_NAME_TAG, STACK_NAME_TAG, STACK_VERSION_TAG } from '@uniform-pipelines/model';
import { HISTORY_MONTHS_LENGTH, MAX_HISTORY_LENGTH, PipelineStackPair, ProgressStatus } from '../auto-cleanup-model';
import * as semver from 'semver';

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

const groupPipelinesByStackName = (pipelineList: UniformPipelineInfo[]): Map<string, UniformPipelineInfo[]> => {
    return pipelineList.reduce((map, pipelineInfo) => {
        const { containedStackName } = pipelineInfo;

        // Initialize array for this stack name if not already present
        if (!map.has(containedStackName)) {
            map.set(containedStackName, []);
        }

        // Push the pipelineInfo into the appropriate array
        map.get(containedStackName)!.push(pipelineInfo);

        return map;
    }, new Map<string, UniformPipelineInfo[]>());
};


export const detectOldPipelineStacks = async () : Promise<ProgressStatus<PipelineStackPair>> => {
    const uniformPipelines = await getOldUniformPipelinesInfo();
    const groupedUniformPipelines = groupPipelinesByStackName(uniformPipelines);
    const oldPipelineStacks : PipelineStackPair[] = [];

    for (const [stackName, pipelineInfos] of groupedUniformPipelines.entries()) {
        console.debug(`Examining stack ${stackName} for old pipelines`);

        const descSortedByVersionPipelineInfos = pipelineInfos.sort((a, b) => semver.compare(b.containedStackVersion, a.containedStackVersion));
        console.debug('Desc by version Sorted pipelines for stack are', descSortedByVersionPipelineInfos);

        const oldestPipelineInfos = descSortedByVersionPipelineInfos.slice(MAX_HISTORY_LENGTH);
        console.debug('Oldest pipelines are', oldestPipelineInfos);

        if (oldestPipelineInfos.length === 0) {
            console.info(`No old pipelines to clear for stack ${stackName}. Skipping...`);
            continue;
        }
        
        const now = DateTime.now();
    
        for (const potentiallyOldPipeline of oldestPipelineInfos) {
            const pipelineName = potentiallyOldPipeline.pipelineName;
            const pipelineDateTime = DateTime.fromJSDate(potentiallyOldPipeline.pipelineLastUpdate);
            // Calculate the difference in months
            const diffInMonths = now.diff(pipelineDateTime, 'months').months;
            
            if (diffInMonths < HISTORY_MONTHS_LENGTH) {
                console.warn(`Skipping pipeline that was updtated recently (i.e. ${diffInMonths} ago)`, pipelineName);
                continue;
            }
    
            if (potentiallyOldPipeline.pipelineStatus === PipelineExecutionStatus.InProgress) {
                console.warn('Skipping active pipeline', pipelineName);
                continue;
            }
            oldPipelineStacks.push({
                stackName: potentiallyOldPipeline.cloudformationStackName,
                pipelineName: potentiallyOldPipeline.pipelineName,
            });
        }
    }
    console.info('Detected old stacks:', oldPipelineStacks);
    return {
        isComplete: oldPipelineStacks.length === 0,
        unitsOfWork: oldPipelineStacks,
    };
};
