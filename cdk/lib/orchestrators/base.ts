// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Common interfaces for Bedrock data exploration orchestrators/apps
 *
 * These interfaces help structure how alternative client/orchestrator apps can be plugged in to
 * the solution.
 */
// External Dependencies:
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

/**
 * Base parameters that a Bedrock data exploration app construct should require
 */
export interface IDataExplorationOrchestratorProps {
  dataSourceTableName: string;
  securityGroups: ec2.ISecurityGroup[];
  vpc: ec2.IVpc;
  vpcSubnets: ec2.SubnetSelection;
}

/**
 * Common CDK interface that a Bedrock data exploration app construct should expose
 */
export interface IDataExplorationOrchestrator {
  /**
   * IAM Principal (most likely a Role) which should be granted access to data sources
   */
  readonly principal: iam.IGrantable & Construct;
  /**
   * URL for users to log in to the application UI
   */
  readonly url: string;
}
