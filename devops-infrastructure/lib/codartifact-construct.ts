import { Construct } from 'constructs';
import * as codeartifact from 'aws-cdk-lib/aws-codeartifact';
import { COMMON_REPO, DOMAIN_NAME, NPM_REPO, Accounts } from './model';

export class CodeArtifactCdkConstruct extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        // Only L1 constructs are available for codeartifact
        // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_codeartifact-readme.html
        const domain = new codeartifact.CfnDomain(this, DOMAIN_NAME, {
            domainName: DOMAIN_NAME,
            permissionsPolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Sid: 'ContributorPolicy',
                        Effect: 'Allow',
                        Principal: {
                            AWS: [`arn:aws:iam::${Accounts.DEVOPS}:root`, `arn:aws:iam::${Accounts.DEVELOPMENT}:root`],
                        },
                        Action: [
                            'codeartifact:DescribeDomain',
                            'codeartifact:GetAuthorizationToken',
                            'codeartifact:GetDomainPermissionsPolicy',
                            'codeartifact:ListRepositoriesInDomain',
                            'sts:GetServiceBearerToken',
                        ],
                        Resource: '*',
                    },
                ],
            },
        });

        const npmStoreRepository = new codeartifact.CfnRepository(this, NPM_REPO, {
            repositoryName: NPM_REPO,
            domainName: DOMAIN_NAME,
            externalConnections: ['public:npmjs'],
            description: 'Provides npm cache repository from NPM, Inc.',
            permissionsPolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            AWS: [`arn:aws:iam::${Accounts.DEVOPS}:root`, `arn:aws:iam::${Accounts.DEVELOPMENT}:root`],
                        },
                        Action: [
                            'codeartifact:DescribePackageVersion',
                            'codeartifact:DescribeRepository',
                            'codeartifact:GetPackageVersionReadme',
                            'codeartifact:GetRepositoryEndpoint',
                            'codeartifact:ListPackageVersionAssets',
                            'codeartifact:ListPackageVersionDependencies',
                            'codeartifact:ListPackageVersions',
                            'codeartifact:ListPackages',
                            'codeartifact:ReadFromRepository',
                        ],
                        Resource: '*',
                    },
                ],
            },
        });

        const commonRepo = new codeartifact.CfnRepository(this, COMMON_REPO, {
            repositoryName: COMMON_REPO,
            domainName: DOMAIN_NAME,
            upstreams: [npmStoreRepository.repositoryName],
            description: 'Repository to store the cdk pipelines tutorial libraries',
            permissionsPolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            AWS: [
                                `arn:aws:iam::${Accounts.DEVOPS}:root`, 
                                `arn:aws:iam::${Accounts.DEVELOPMENT}:root`
                            ],
                        },
                        Action: [
                            'codeartifact:DescribePackageVersion',
                            'codeartifact:DescribeRepository',
                            'codeartifact:GetPackageVersionReadme',
                            'codeartifact:GetRepositoryEndpoint',
                            'codeartifact:ListPackageVersionAssets',
                            'codeartifact:ListPackageVersionDependencies',
                            'codeartifact:ListPackageVersions',
                            'codeartifact:ListPackages',
                            'codeartifact:ReadFromRepository',
                            'codeartifact:PublishPackageVersion',
                        ],
                        Resource: '*',
                    },
                ],
            },
        });

        commonRepo.addDependency(npmStoreRepository);
        npmStoreRepository.addDependency(domain);
    }
}
