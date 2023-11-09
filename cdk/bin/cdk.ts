#!/usr/bin/env node
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Entry point script for CDK deployment of the Amazon Bedrock data exploration sample
 */
// External Dependencies:
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
// Local Dependencies:
import { CdkStack } from "../lib/cdk-stack";

export function main(): cdk.App {
  const app = new cdk.App();

  /**
   * The following line enables solution security checks from the cdk-nag AwsSolutions pack, with
   * verbose logging. If you want to experiment with new changes without throwing errors related to
   * solution security, you could comment/remove it:
   */
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

  new CdkStack(app, "BedrockDataExp", {
    /* If you don't specify 'env', this stack will be environment-agnostic.
     * Account/Region-dependent features and context lookups will not work,
     * but a single synthesized template can be deployed anywhere. */
    /* Uncomment the next line to specialize this stack for the AWS Account
     * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    /* Uncomment the next line if you know exactly what Account and Region you
     * want to deploy the stack to. */
    // env: { account: '123456789012', region: 'us-east-1' },
    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
    /* Set true to disable some or all of the sample data sources: */
    disableAthenaSample: false,
    disableNeptuneSample: false,
    disableRdsSample: false,
  });
  return app;
}
