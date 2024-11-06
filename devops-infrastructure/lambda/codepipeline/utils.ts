import {
    CodePipelineClient,
    ListPipelinesCommand,
    ListTagsForResourceCommand,
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