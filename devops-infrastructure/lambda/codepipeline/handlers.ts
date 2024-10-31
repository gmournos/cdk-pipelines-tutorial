import { CodePipelineClient, StartPipelineExecutionCommand } from '@aws-sdk/client-codepipeline';

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
