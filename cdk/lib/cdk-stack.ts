// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Overall CDK stack for the Bedrock Data Exploration sample
 */
// External Dependencies:
import * as cdk from "aws-cdk-lib";
import * as ddb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as cr from "aws-cdk-lib/custom-resources";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
// Local Dependencies:
import { AthenaInfra } from "./data-sources/athena";
import { NeptuneInfra } from "./data-sources/neptune";
import { RdsInfra } from "./data-sources/rds";
import { VpcInfra } from "./vpc";
import { DataExplorationOrchestratorJava, IDataExplorationOrchestrator } from "./orchestrators";

/**
 * Arguments/properties for data exploration demo stack
 */
export interface DataExplorationStackProps extends cdk.StackProps {
  /**
   * Set true to enable the Amazon Athena (TPC-H) sample data source
   */
  enableAthenaSample?: boolean;
  /**
   * Set true to enable the Amazon Neptune (IMDb) sample data source
   */
  enableNeptuneSample?: boolean;
  /**
   * Set true to enable the Amazon RDS (Pagila) sample data source
   */
  enableRdsSample?: boolean;
}

/**
 * Main CloudFormation stack for the Bedrock data analytics sample
 */
export class CdkStack extends cdk.Stack {
  private dataSourceTable: ddb.ITable;

  constructor(scope: Construct, id: string, props?: DataExplorationStackProps) {
    super(scope, id, props);
    const enableAthenaSample = props ? !!props.enableAthenaSample : true;
    const enableNeptuneSample = props ? !!props.enableNeptuneSample : true;
    const enableRdsSample = props ? !!props.enableRdsSample : true;

    const vpcInfra = new VpcInfra(this, "VpcInfra");

    // Data source metastore and loading infrastructure:
    const ddbPartitionKey = "databaseName";
    this.dataSourceTable = new ddb.Table(this, "DataSourceTable", {
      partitionKey: { name: ddbPartitionKey, type: ddb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const loaderRole = new iam.Role(this, "DataLoaderRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaVPCAccessExecutionRole"),
      ],
    });
    this.dataSourceTable.grantWriteData(loaderRole);
    NagSuppressions.addResourceSuppressions(
      loaderRole,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "Use starter managed policy for Lambda VPC execution",
          appliesTo: [{ regex: "/^Policy::.*/service-role/AWSLambdaVPCAccessExecutionRole$/" }],
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "Use starter managed policy for Lambda VPC execution",
          appliesTo: [
            "Action::s3:Abort*",
            "Action::s3:DeleteObject*",
            "Action::s3:GetBucket*",
            "Action::s3:GetObject*",
            "Action::s3:List*",
            { regex: "/^Resource::<AthenaInfraAthenaBucket.*\\.Arn>/*/" },
          ],
        },
      ],
      true // This one needs to be recursive to capture the role>defaultPolicy hierarchy
    );
    const loaderFunction = new NodejsFunction(this, "DataLoaderFn", {
      bundling: {},
      description: "CFn custom resource handler to load initial sample data",
      entry: `${__dirname}/data-sources/lambda-load-data/index.ts`,
      handler: "onEvent",
      memorySize: 128,
      role: loaderRole,
      runtime: Runtime.NODEJS_20_X,
      securityGroups: [vpcInfra.dbSecurityGroup],
      timeout: cdk.Duration.minutes(10),
      vpc: vpcInfra.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });
    const loaderProvider = new cr.Provider(this, "DataLoaderProvider", {
      onEventHandler: loaderFunction,
    });
    NagSuppressions.addResourceSuppressions(
      loaderProvider,
      [
        {
          id: "AwsSolutions-IAM4",
          reason: "framework-onEvent CR Provider can use default permissions",
          appliesTo: [{ regex: "/^Policy::.*/service-role/AWSLambdaBasicExecutionRole$/" }],
        },
        {
          id: "AwsSolutions-IAM5",
          reason: "framework-onEvent CR Provider can use default permissions",
          appliesTo: [{ regex: "/^Resource::<DataLoaderFn.*>:\\*$/" }],
        },
        {
          id: "AwsSolutions-L1",
          reason: "framework-onEvent CR Provider uses older Lamda runtime",
        }
      ],
      true
    );

    const orchestrator: IDataExplorationOrchestrator = new DataExplorationOrchestratorJava(
      this,
      "Orchestrator",
      {
        dataSourceTableName: this.dataSourceTable.tableName,
        securityGroups: [vpcInfra.dbSecurityGroup],
        vpc: vpcInfra.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      }
    );

    this.dataSourceTable.grantReadData(orchestrator.principal);
    NagSuppressions.addResourceSuppressions(
      orchestrator.principal,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Invoke any Bedrock model and log any metrics",
          appliesTo: [
            { regex: `/^Resource::arn:<AWS::Partition>:bedrock:<AWS::Region>:.*/` },
            "Resource::*",
            { regex: `/^Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:.*/` },
          ],
        },
      ],
      true
    );

    // Create enabled sample data sources:
    if (enableAthenaSample) {
      const athenaInfra = new AthenaInfra(this, "AthenaInfra", {
        dbName: "bedrockathena",
        catalogName: "BedrockAthenaSample",
        loaderProvider,
        loaderRole,
        workgroupName: "BedrockAthenaWorkgroup",
      });
      athenaInfra.grantQuery(orchestrator.principal);
      const athenaDesc = new cdk.CustomResource(this, "AthenaDescriptor", {
        serviceToken: loaderProvider.serviceToken,
        properties: {
          item: athenaInfra.dataSourceDescriptor,
          partitionKeyField: ddbPartitionKey,
          tableName: this.dataSourceTable.tableName,
        },
        resourceType: "Custom::DDBItem",
      });
    }
    if (enableNeptuneSample) {
      const neptuneInfra = new NeptuneInfra(this, "NeptuneInfra", {
        dbSecurityGroup: vpcInfra.dbSecurityGroup,
        vpc: vpcInfra.vpc,
      });
      const neptuneDesc = new cdk.CustomResource(this, "NeptuneDescriptor", {
        serviceToken: loaderProvider.serviceToken,
        properties: {
          item: neptuneInfra.dataSourceDescriptor,
          partitionKeyField: ddbPartitionKey,
          tableName: this.dataSourceTable.tableName,
        },
        resourceType: "Custom::DDBItem",
      });
    }
    if (enableRdsSample) {
      const rdsInfra = new RdsInfra(this, "RdsInfra", {
        dbSecurityGroup: vpcInfra.dbSecurityGroup,
        loaderProvider,
        loaderRole,
        vpc: vpcInfra.vpc,
      });
      rdsInfra.grantFetchCredential(orchestrator.principal);
      const rdsDesc = new cdk.CustomResource(this, "RDSDescriptor", {
        serviceToken: loaderProvider.serviceToken,
        properties: {
          item: rdsInfra.dataSourceDescriptor,
          partitionKeyField: ddbPartitionKey,
          tableName: this.dataSourceTable.tableName,
        },
        resourceType: "Custom::DDBItem",
      });
    }

    new cdk.CfnOutput(this, "AppURL", { value: orchestrator.url });
  }
}
