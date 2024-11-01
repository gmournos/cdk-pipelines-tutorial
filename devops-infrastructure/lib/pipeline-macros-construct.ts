import { Construct } from 'constructs';
import { CfnMacro, Duration } from 'aws-cdk-lib';
import { join } from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { CHANGESET_RENAME_MACRO } from './model';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';

export class PipelineMacrosConstruct extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        this.makeChangesetRenameMacro();
    }

    makeChangesetRenameMacro() {
        const lambdaRole = new Role(this, 'LambdaExecutionRole', {
            roleName: 'pipeline-macros-execution-role',
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'), // Lambda service principal
            description: 'Role with basic execution permissions for Lambda',
        });

        // Attach AWSLambdaBasicExecutionRole managed policy to the role
        lambdaRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));

        const changesetTransformerMacroFunction = new NodejsFunction(
            this, 'uniform-pipeline-changeset-rename-function', {
                functionName: 'uniform-pipeline-changeset-rename-function',
                runtime: Runtime.NODEJS_20_X,
                handler: 'alterChangesetNames',
                entry: join('lambda', 'cloudformation', 'macros', 'rename-changesets-macro.ts'),
                timeout: Duration.minutes(3),
                role: lambdaRole,
            },
        );

        new CfnMacro(this, CHANGESET_RENAME_MACRO, {
            description: 'Macro that processes Uniform Pipelines and assigns unique changeset names',
            name: CHANGESET_RENAME_MACRO,
            functionName: changesetTransformerMacroFunction.functionName,
        });
    }
}
