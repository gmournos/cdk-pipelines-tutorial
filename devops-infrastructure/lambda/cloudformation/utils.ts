import { CloudFormationClient, DeleteStackCommand, DeleteStackCommandOutput } from "@aws-sdk/client-cloudformation";
import { withThrottlingRetry } from "../concurrency/utils";

const client = new CloudFormationClient();

/**
 * Function to delete a CloudFormation stack by name.
 * @param stackName - The name of the stack to delete.
 * @returns A confirmation message after initiating deletion.
 */
export const deleteCloudFormationStack = async (stackName: string): Promise<DeleteStackCommandOutput> => {
    
    // Create the delete stack command
    const command = new DeleteStackCommand({ StackName: stackName });

    try {
        // Send the delete command
        return await withThrottlingRetry(() => client.send(command));
    } catch (error) {
        console.error("Error deleting CloudFormation stack:", error);
        throw new Error(`Failed to delete stack "${stackName}".`);
    }
};
