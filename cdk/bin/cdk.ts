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

function booleanEnvVar(name: string, defaultValue = false): boolean {
  const envVar = process.env[name];
  if (envVar === undefined) {
    return defaultValue;
  }
  const envLower = envVar.toLowerCase();
  if (["1", "t", "true", "y", "yes"].indexOf(envLower) >= 0) {
    return true;
  } else if (["0", "f", "false", "n", "no"].indexOf(envLower) >= 0) {
    return false;
  } else {
    throw new Error(`Invalid boolean environment variable: ${name}=${envVar}`);
  }
}

export function main(): cdk.App {
  const app = new cdk.App();

  /**
   * The following line enables solution security checks from the cdk-nag AwsSolutions pack, with
   * verbose logging. If you want to experiment with new changes without throwing errors related to
   * solution security, you could comment/remove it:
   */
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));

  const appConfig = {
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
    /* Set environment variables or modify default values to disable some or all of the sample data
     * sources: */
    enableAthenaSample: booleanEnvVar("SAMPLE_DATA_SOURCE_ATHENA", true),
    enableNeptuneSample: booleanEnvVar("SAMPLE_DATA_SOURCE_NEPTUNE", true),
    enableRdsSample: booleanEnvVar("SAMPLE_DATA_SOURCE_RDS", true),
  };

  console.log(`CDK app configuration:\n${JSON.stringify(appConfig, null, 2)}`);
  new CdkStack(app, "BedrockDataExp", appConfig);
  return app;
}
