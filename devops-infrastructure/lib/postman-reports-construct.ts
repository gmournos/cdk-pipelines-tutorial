import { CfnOutput } from 'aws-cdk-lib';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ReportGroup } from 'aws-cdk-lib/aws-codebuild';
import { POSTMAN_REPORT_GROUP, StackExports } from './model';

interface PostmanReportsConstructProps {
    artifactBucket: IBucket;
}

export class PostmanReportsConstruct extends Construct {
    constructor(scope: Construct, id: string, props: PostmanReportsConstructProps) {
        super(scope, id);
        const testReports = new ReportGroup(this, `postman-test-report-group`, {
            exportBucket: props.artifactBucket,
            reportGroupName: POSTMAN_REPORT_GROUP,
        });

        new CfnOutput(this, StackExports.POSTMAN_REPORT_GROUP_ARN_REF, {
            description: 'Arn of the report group arn for postman reports',
            value: testReports.reportGroupArn,
            exportName: StackExports.POSTMAN_REPORT_GROUP_ARN_REF,
        });
    }
}
