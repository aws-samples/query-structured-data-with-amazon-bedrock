// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Shared entry point for multi-resource CDK custom resource Lambda function
 */
// External Dependencies:
import { Context } from "aws-lambda";
// Local Dependencies:
import { LoadAthenaDataAttrs, LoadAthenaDataProps, onEvent as onAthenaEvent } from "./athena";
import { CustomResourceProviderRequest, CustomResourceEventResult } from "./cfn-base";
import { LoadDDBDataAttrs, LoadDDBDataProps, onEvent as onDDBEvent } from "./dynamo";
import { LoadRDSDataAttrs, LoadRDSDataProps, onEvent as onRDSEvent } from "./rds";

enum CustomResourceTypes {
  ATHENA_SAMPLE = "Custom::AthenaSample",
  DDB_ITEM = "Custom::DDBItem",
  RDS_SAMPLE = "Custom::RDSSample",
}

type CustomAthenaResourceRequest = CustomResourceProviderRequest<LoadAthenaDataProps> & {
  ResourceType: CustomResourceTypes.ATHENA_SAMPLE;
};
type CustomDDBResourceRequest = CustomResourceProviderRequest<LoadDDBDataProps> & {
  ResourceType: CustomResourceTypes.DDB_ITEM;
};
type CustomRDSResourceRequest = CustomResourceProviderRequest<LoadRDSDataProps> & {
  ResourceType: CustomResourceTypes.RDS_SAMPLE;
};

/**
 * A combined CloudFormation custom resource provider Lambda to load data into data stores
 *
 * This function supports multiple different custom resource types
 *
 * @param event A CloudFormation custom resource (create/update/delete) event
 * @param context AWS Lambda request context
 * @returns CloudFormation custom resource callback data
 */
export const onEvent = async (
  event: CustomAthenaResourceRequest | CustomDDBResourceRequest | CustomRDSResourceRequest,
  context: Context
): Promise<
  | CustomResourceEventResult<LoadAthenaDataAttrs>
  | CustomResourceEventResult<LoadDDBDataAttrs>
  | CustomResourceEventResult<LoadRDSDataAttrs>
> => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);

  if (event.ResourceType === "Custom::AthenaSample") return await onAthenaEvent(event, context);
  if (event.ResourceType === "Custom::DDBItem") return await onDDBEvent(event, context);
  if (event.ResourceType === "Custom::RDSSample") return await onRDSEvent(event, context);

  const unknownEvent = event as CustomResourceProviderRequest<object>;
  if (unknownEvent.RequestType === "Delete") {
    console.warn(`Ignoring Delete request for unknown ResourceType ${unknownEvent.ResourceType}`);
    return { PhysicalResourceId: unknownEvent.PhysicalResourceId as string };
  } else {
    throw new Error(
      `Unexpected ResourceType '${unknownEvent.ResourceType}' not in ${Object.values(CustomResourceTypes)}`
    );
  }
};
