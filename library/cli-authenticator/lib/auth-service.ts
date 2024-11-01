import { type CognitoUser } from '@aws-amplify/auth';
import { Amplify, Auth } from 'aws-amplify';
import { CognitoIdentityClient } from '@aws-sdk/client-cognito-identity';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { LoginConfig } from './accounts';

const AWS_REGION = 'eu-west-1';

export class AuthService {

    async generateTemporaryCredentials(accountConfig: LoginConfig) {
        Amplify.configure({
            Auth: {
                region: AWS_REGION,
                userPoolId: accountConfig.userPoolId,
                userPoolWebClientId: accountConfig.clientId,
                identityPoolId: accountConfig.identityPoolId,
            },
        });

        const cognitoUser = await this.loginToUserPool(accountConfig.authenticationData.username, accountConfig.authenticationData.password);
        return this.getTemporaryCredentialsFromIdentityPool(accountConfig, cognitoUser);
    }

    protected async loginToUserPool(userName: string, password: string) {
        const result = await Auth.signIn(userName, password) as CognitoUser;
        return result;
    }

    protected async getTemporaryCredentialsFromIdentityPool(accountConfig: LoginConfig, user: CognitoUser){
        const jwtToken = user.getSignInUserSession()?.getIdToken().getJwtToken();
        if (jwtToken === undefined) {
            throw new Error(
                `Error loging in for ${accountConfig.authenticationData.username} in the user pool`);
        }
        
        const tokenProvider = `cognito-idp.${AWS_REGION}.amazonaws.com/${accountConfig.userPoolId}`;
        const cognitoIdentity = new CognitoIdentityClient({
            credentials: fromCognitoIdentityPool({
                identityPoolId: accountConfig.identityPoolId,
                logins: {
                    [tokenProvider]: jwtToken,
                },
            }),
        });
        const credentials = await cognitoIdentity.config.credentials();
        return credentials;
    }
}