import {
    CodePipelineClient,
    GetPipelineCommand,
    GetPipelineExecutionCommand,
    ListPipelineExecutionsCommand,
    ListPipelinesCommand,
    ListTagsForResourceCommand,
    PipelineExecutionStatus,
    PipelineSummary,
    Tag
} from '@aws-sdk/client-codepipeline';
import { withThrottlingRetry } from '../concurrency/utils';

const client = new CodePipelineClient();

export const listPipelines = async (): Promise<PipelineSummary[]> => {
    // Prepare an array to collect all pipelines
    const pipelines: PipelineSummary[] = [];

    // Initialize pagination token
    let nextToken: string | undefined = undefined;

    try {
        // Loop through all paginated results
        do {
            const command: ListPipelinesCommand = new ListPipelinesCommand({ nextToken });
            const response = await withThrottlingRetry(async () => await client.send(command));

            // Add each pipeline summary to the array
            if (response.pipelines) {
                pipelines.push(...response.pipelines);
            }

            // Update the token to the next page of results
            nextToken = response.nextToken;
        } while (nextToken);

        return pipelines;
    } catch (error) {
        console.error('Error listing pipelines:', error);
        throw error;
    }
};


export const getPipelineTags = async (pipelineArn: string) => {
    // Initialize the CodePipeline client

    // Create the command to fetch tags
    const command = new ListTagsForResourceCommand({
        resourceArn: pipelineArn,
    });

    try {
        // Send the command and retrieve tags
        const response = await withThrottlingRetry(async () => await client.send(command));
        return response.tags || [];
    } catch (error) {
        console.error('Error fetching tags for pipeline:', error);
        throw error;
    }
};

export const filterTagsToMap = (tags: Tag[], tagNames: string[]): Map<string, string> => {
    const tagMap = new Map<string, string>();

    // Populate the map with specified tag names and their values if they exist
    for (const tagName of tagNames) {
        const tag = tags.find(t => t.key === tagName);
        if (tag && tag.value) {
            tagMap.set(tagName, tag.value);
        }
    }

    return tagMap;
};

export const getPipelineLastExecutionStatus = async (pipelineName: string): Promise<PipelineExecutionStatus> => {
    try {
        // Retrieve the most recent execution ID
        const listExecutionsCommand = new ListPipelineExecutionsCommand({ pipelineName, maxResults: 1 });
        const listResponse = await withThrottlingRetry(() => client.send(listExecutionsCommand));

        const lastExecutionId = listResponse.pipelineExecutionSummaries?.[0]?.pipelineExecutionId;

        if (!lastExecutionId) {
            throw new Error(`No executions found for pipeline: ${pipelineName}`);
        }

        // Get the status of the last execution
        const getExecutionCommand = new GetPipelineExecutionCommand({
            pipelineName,
            pipelineExecutionId: lastExecutionId,
        });
        const executionResponse = await withThrottlingRetry(() => client.send(getExecutionCommand));

        const status = executionResponse.pipelineExecution?.status;

        if (!status) {
            throw new Error(`Could not retrieve the status for pipeline execution: ${lastExecutionId}`);
        }

        return status;
    } catch (error) {
        console.error(`Error getting last execution status for ${pipelineName}:`, error);
        throw error;
    }
}

// Function to get pipeline ARN by name
export const getPipelineArn = async (pipelineName: string): Promise<string | undefined> => {
    try {
        const pipelineData = await withThrottlingRetry(() => client.send(new GetPipelineCommand({ name: pipelineName })));
        return pipelineData.metadata?.pipelineArn;
    } catch (error) {
        console.error(`Failed to get pipeline ARN for ${pipelineName}:`, error);
        throw error;
    }
}

