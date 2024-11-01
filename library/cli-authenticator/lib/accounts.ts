export type CredentialsPair = {
    username : string,
    password : string,
}

export type AuthenticationData = {
    ApplicationManagerGroup: CredentialsPair,
    User1Group?: CredentialsPair,
    User2Group?: CredentialsPair,
    User3Group?: CredentialsPair,
}

export interface AccountConfig {
    userPoolId : string;
    clientId : string;
    identityPoolId : string;
    authenticationData: AuthenticationData
}

export interface LoginConfig {
    userPoolId : string;
    clientId : string;
    identityPoolId : string;
    authenticationData: CredentialsPair;
}


const TEST_CONFIG : AccountConfig = {
    userPoolId : 'eu-west-1_Mf0fNqtf5',
    identityPoolId : 'eu-west-1:90a05b7f-ee6a-43df-8ba8-d9d7969644c1',
    clientId : '19067pgbgqq2562bt53kib7hsb',
    authenticationData: {
        ApplicationManagerGroup: {
            username : 'put your test user1 here',
            password : 'password from param store normally but ...',
        },
        User1Group: {
            username : 'put your test user2 here',
            password : 'password from param store normally but ...',
        },
    },
};

export const ACCOUNTS : Map<string, AccountConfig> = new Map([
    ['test', TEST_CONFIG],
]);  
