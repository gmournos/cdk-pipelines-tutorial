export const HISTORY_MONTHS_LENGTH = 3;
export const MAX_HISTORY_LENGTH = 7;
export const DELETE_BATCH_SIZE = 5;
export const MINUTES_BETWEEN_DELETES = 3;
export const DELETE_PROCESS_TIMEOUT_MINUTES = 60; // 1 hour


export interface PipelineStackPair {
    pipelineName: string,
    stackName: string,
}

export interface ProgressStatus<T> {
    isComplete: boolean;
    unitsOfWork: T[];
}


