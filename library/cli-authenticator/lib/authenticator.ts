import { AwsCredentialIdentity } from '@smithy/types';
import { writeFile } from 'fs';
import { AccountConfig, ACCOUNTS, AuthenticationData, CredentialsPair, LoginConfig } from './accounts';
import { AuthService } from './auth-service';

export class Authenticator {

    public async credentialsToFile() {
        await this.obtainCredentials(this.writeCredentialsToFile);
    }

    public async credentialsToConsole() {
        await this.obtainCredentials(this.writeCredentialsToConsole);
    }

    private async obtainCredentials(writer: (username: string, credentials: AwsCredentialIdentity) => any) {

        const input = this.getProcessInput();
        const accountConfig = this.getEnvConfiguration(input.environment);
        const loginConfig = this.getAccountLoginForRole(accountConfig, input.environment, input.userGroup);
        const credentials = await new AuthService().generateTemporaryCredentials(loginConfig);
        await writer(loginConfig.authenticationData.username, credentials);
    }

    private getProcessInput(): { environment: string, userGroup: string } {
        let environment = 'development';
        let userGroup = 'ApplicationManagerGroup';

        const args = process.argv.slice(2);
        if (args.length >= 1) {
            environment = args[0];
        }
        if (args.length >= 2) {
            userGroup = args[1];
        }
        return {environment, userGroup};
    }

    private getEnvConfiguration(environment: string): AccountConfig {
        const accountConfig = ACCOUNTS.get(environment);
        if (accountConfig === undefined) {
            throw new Error(`unknown environment ${environment}`);
        }
        return accountConfig;
    }

    
    private getAccountLoginForRole(accountConfig: AccountConfig, environment: string, userGroup: string): LoginConfig {
        const authenticationCredentialsPair =
            accountConfig.authenticationData[userGroup as keyof AuthenticationData] as CredentialsPair | undefined;

        if (authenticationCredentialsPair === undefined) {
            throw new Error(
                `No credentials configured for group ${userGroup} in environment ${environment}`);
        }

        return {
            userPoolId : accountConfig.userPoolId,
            clientId: accountConfig.clientId,
            authenticationData: authenticationCredentialsPair,
            identityPoolId: accountConfig.identityPoolId,
        };
    }


    private async writeCredentialsToFile(username: string, credentials: AwsCredentialIdentity) {
        const creds = {
            values: [
                {key: 'login', value: username},
                {key: 'accessKeyId', value: credentials.accessKeyId},
                {key: 'secretAccessKey', value: credentials.secretAccessKey},
                {key: 'sessionToken', value: credentials.sessionToken},
            ],
        };

        console.log(`Writing credentials.json for user ${username}`);

        writeFile('credentials.json', JSON.stringify(creds), function(ferr: any) {
            if (ferr) {
                console.log(ferr);
            }
        });
    }

    private async writeCredentialsToConsole(username: string, credentials: AwsCredentialIdentity) {
        const creds = {
            login: username,
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
        };

        console.log(JSON.stringify(creds, null, '  '));
    }
}