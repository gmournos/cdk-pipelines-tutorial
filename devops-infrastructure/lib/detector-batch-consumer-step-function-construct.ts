import { Duration } from 'aws-cdk-lib';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Choice, Condition, DefinitionBody, StateMachine, Succeed, Wait, WaitTime } from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import { DELETE_PROCESS_TIMEOUT_MINUTES, MINUTES_BETWEEN_DELETES } from '../lambda/auto-cleanup-model';

interface BatchProcessingStepFunctionConstructProps {
    detectorLambda: IFunction;
    batchConsumerLambda: IFunction;
    stepFunctionName: string;
}

export class BatchProcessingStepFunctionConstruct extends Construct {
    stateMachine: StateMachine;

    constructor(scope: Construct, id: string, props: BatchProcessingStepFunctionConstructProps) {
        super(scope, id);

        const { detectorLambda, batchConsumerLambda } = props;

        // Step 1: Invoke Detector Lambda to get initial list of stack names
        const detectorStep = new LambdaInvoke(this, `${id}-run-detector-function`, {
            lambdaFunction: detectorLambda,
            outputPath: '$.Payload', // Use the Lambda's output as the input for the next step
        });

        // Step 2: Invoke Consumer Lambda to process the stacks
        const consumerStep = new LambdaInvoke(this, `${id}-run-consumer-function`, {
            lambdaFunction: batchConsumerLambda,
            outputPath: '$.Payload', // Get the remaining items from the Consumer Lambda
        });

        // Step 3: Wait for MINUTES_BETWEEN_DELETES minutes between each consumer execution
        const waitStep = new Wait(this, `${id}-wait-state`, {
            time: WaitTime.duration(Duration.minutes(MINUTES_BETWEEN_DELETES)),
        });

        // Step 4: Define a choice to check if any items remain after consumer execution
        const checkIfDone = new Choice(this, `${id}-check-complete-state`)
            .when(Condition.booleanEquals('$.isComplete', false), waitStep.next(consumerStep))
            .otherwise(new Succeed(this, `${id}-success-state`));

        // Step 5: Define the Step Function Workflow
        const definition = detectorStep
            .next(consumerStep)
            .next(checkIfDone);

        // Step 6: Create the Step Function
        this.stateMachine = new StateMachine(this, `${id}-state-machine`, {
            stateMachineName: props.stepFunctionName,
            definitionBody: DefinitionBody.fromChainable(definition),
            timeout: Duration.hours(DELETE_PROCESS_TIMEOUT_MINUTES), // Set timeout as needed
        });

    }
}
