import {
    CodePipelineClient,
    ListPipelinesCommand,
    PipelineSummary
} from '@aws-sdk/client-codepipeline';
import { withThrottlingRety } from '../concurrency/utils';

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
            const response = await withThrottlingRety(async () => await client.send(command));

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
