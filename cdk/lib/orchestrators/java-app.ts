// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK construct for Java orchestration app for structured data exploration with Amazon Bedrock
 */
// NodeJS Built-Ins:
import { execSync } from "child_process";
import * as path from "path";
// External Dependencies:
import * as apprunner from "@aws-cdk/aws-apprunner-alpha";
import * as cdk from "aws-cdk-lib";
import * as assets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
// Local Dependencies:
import { IDataExplorationOrchestrator, IDataExplorationOrchestratorProps } from "./base";

/**
 * Construct to deploy the Java natural language data exploration app on AWS AppRunner
 */
export class DataExplorationOrchestratorJava extends Construct implements IDataExplorationOrchestrator {
  private appRole: iam.IRole;
  private appService: apprunner.Service;

  constructor(scope: Construct, id: string, props: IDataExplorationOrchestratorProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);

    const appDir = path.join(__dirname, "..", "..", "..", "app-java");
    console.log("Building Java application...");
    console.log(
      execSync(
        [
          "mvn process-resources", // Fetch the JDBC driver jar file
          // Then install it:
          "mvn install:install-file  -Dfile=lib/AthenaJDBC42-2.1.1.1000.jar  -DgroupId=Athena  -DartifactId=AthenaJDBC42  -Dversion=2.1.1.1000  -Dpackaging=jar  -DgeneratePom=true",
          // Then install other deps & build:
          "mvn install",
          "mvn clean package",
        ].join("&&"),
        { encoding: "utf-8", cwd: appDir }
      )
    );
    const appImage = new assets.DockerImageAsset(this, "ImageAssets", {
      directory: appDir,
      platform: assets.Platform.LINUX_AMD64,
    });

    const allowedModelResources = [
      `arn:${stack.partition}:bedrock:${stack.region}::foundation-model/*`,
      `arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:provisioned-model/*`,
      `arn:${stack.partition}:bedrock:${stack.region}:${stack.account}:custom-model/*`,
    ];
    this.appRole = new iam.Role(this, "AppRole", {
      assumedBy: new iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
      inlinePolicies: {
        InlinePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
              resources: allowedModelResources,
              sid: "DirectBedrockAccess",
            }),
            new iam.PolicyStatement({
              actions: ["logs:CreateLogGroup", "logs:PutRetentionPolicy"],
              resources: [
                `arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:/aws/apprunner/*`,
              ],
              sid: "LoggingCreateGroup",
            }),
            new iam.PolicyStatement({
              actions: ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"],
              resources: [
                `arn:${stack.partition}:logs:${stack.region}:${stack.account}:log-group:/aws/apprunner/*:log-stream:*`,
              ],
              sid: "LoggingStoreEvents",
            }),
            new iam.PolicyStatement({
              actions: [
                "cloudwatch:PutMetricData",
                "cloudwatch:PutMetricStream",
                "cloudwatch:StartMetricStreams",
                "cloudwatch:StopMetricStreams",
              ],
              resources: ["*"],
              sid: "LoggingMetrics",
            }),
          ],
        }),
      },
    });

    const appVpcConnector = new apprunner.VpcConnector(this, "AppVpcConnector", {
      securityGroups: props.securityGroups,
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
    });
    // Need to explicitly create the AppRunner ECR access role to be able to suppress cdk-nags
    // about its (auto-generated) policy resources:
    const appRunnerEcrAccessRole = new iam.Role(this, "AppRunnerEcrAccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
      inlinePolicies: {
        InlinePolicy: new iam.PolicyDocument({
          statements: [
            // For some reason apprunner.Source.fromAsset() was not sufficient to grant the
            // AppRunner service access to the ECR image (probably just a timing issue as it was
            // intermittent?) so we set up an inline policy explicitly in the app role:
            new iam.PolicyStatement({
              actions: [
                "ecr:BatchCheckLayerAvailability",
                "ecr:BatchGetImage",
                "ecr:DescribeImages",
                "ecr:GetAuthorizationToken",
                "ecr:GetDownloadUrlForLayer",
              ],
              resources: [appImage.repository.repositoryArn],
              sid: "ECRImageRead",
            }),
          ],
        }),
      },
    });
    this.appService = new apprunner.Service(this, "AppService", {
      autoDeploymentsEnabled: true,
      source: apprunner.Source.fromAsset({
        imageConfiguration: { port: 8080 },
        asset: appImage,
      }),
      accessRole: appRunnerEcrAccessRole,
      instanceRole: this.appRole,
      vpcConnector: appVpcConnector,
    });
    NagSuppressions.addResourceSuppressions(
      appRunnerEcrAccessRole,
      [
        {
          id: "AwsSolutions-IAM5",
          appliesTo: ["Resource::*"],
          reason: "Auto-generated '*' gets added by AppRunner construct? Can't control",
        },
      ],
      true
    );

    this.appService.addEnvironmentVariable(
      "BEDROCK_DATA_EXPLORATION_DYNAMO_TABLE_NAME",
      props.dataSourceTableName
    );
  }

  get principal(): iam.IRole {
    return this.appRole;
  }

  get url(): string {
    return this.appService.serviceUrl;
  }
}
