const RETRY_DELAY_BASE = 100;
const MAX_RETRIES = 5;
export const withThrottlingRetry = async <T>(fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> => {
    return withExponentialBackoff(MAX_RETRIES, ['ThrottlingException'], fn, ...args); // Spread args here
};
const withExponentialBackoff = async <T>(maxRetries: number, errorNames: string[], fn: (...args: any[]) => Promise<T>, ...args: any[]): Promise<T> => {
    let retries = 0;
    while (true) {
        try {
            return await fn(...args); // Spread args here
        } catch (error: any) {
            if (errorNames.indexOf(error.name) >=0 && error && retries < maxRetries) {
                console.warn(`${error.name} encountered. Retrying...`);
                const delay = Math.random() * Math.pow(2, (1 + (retries % 3))) * RETRY_DELAY_BASE;
                await waitFor(delay > 5000 ? 5000 : delay);
                retries++;
            } else {
                throw error; // Propagate non-retryable errors or exceed max retries
            }
        }
    }
};
const waitFor = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};