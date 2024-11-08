export const HISTORY_MONTHS_LENGTH = 3;
export const MAX_HISTORY_LENGTH = 7;

export interface PipelineStackPair {
    pipelineName: string,
    stackName: string,
}

export interface ProgressStatus<T> {
    isComplete: boolean;
    unitsOfWork: T[];
}


