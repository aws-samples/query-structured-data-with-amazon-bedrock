// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK construct for underlying VPC infrastructure for the sample
 */
// External Dependencies:
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";

/**
 * Construct to deploy shared networking infrastructure for the Bedrock data analytics sample
 */
export class VpcInfra extends Construct {
  public dbSecurityGroup: ec2.ISecurityGroup;
  public vpc: ec2.IVpc;
  public vpcFlowLog: ec2.FlowLog;
  public vpcFlowLogGroup: logs.ILogGroup;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      // 3 AZs not working and tough to fix, per https://github.com/aws/aws-cdk/issues/3237
      // maxAzs: 3,
      natGateways: 1,
    });

    // cdk-nag AwsSolutions-VPC7 rule wants every VPC to have an associated Folow log for debug:
    this.vpcFlowLogGroup = new logs.LogGroup(this, "FlowLogs");
    const flowLogRole = new iam.Role(this, "FlowLogRole", {
      assumedBy: new iam.ServicePrincipal("vpc-flow-logs.amazonaws.com"),
    });
    this.vpcFlowLog = new ec2.FlowLog(this, "FlowLog", {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(this.vpcFlowLogGroup, flowLogRole),
    });

    this.dbSecurityGroup = new ec2.SecurityGroup(this, "DBSecurityGroup", {
      allowAllOutbound: true,
      description: "Shared security group for demo databases in the solution",
      vpc: this.vpc,
    });
  }
}
