// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK custom resource Lambda function for loading data to DynamoDB
 */
// External Dependencies:
import { Context } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
// Local Dependencies:
import {
  CustomResourceEventResult,
  CustomResourceProviderCreateRequest,
  CustomResourceProviderDeleteRequest,
  CustomResourceProviderRequest,
  CustomResourceProviderUpdateRequest,
} from "./cfn-base";

/**
 * Input resource properties supported for loading DynamoDB data
 */
export interface LoadDDBDataProps {
  /**
   * The item to be loaded in plain JSON format (no need for DynamoDB syntax)
   */
  item: { [key: string]: any };

  /**
   * The name of the partition (primary) key field for this table
   *
   * This is used for constructing a physical resource ID from the item data
   */
  partitionKeyField: string;

  /**
   * The (optional) name of the sort (secondary) key field for this table
   *
   * If supplied, this is used for constructing a physical resource ID from the item data
   */
  sortKeyField?: string;

  /**
   * The name of the DynamoDB table to write to
   */
  tableName: string;
}

/**
 * This resource returns no GetAtt-able properties
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadDDBDataAttrs {}

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
  event: CustomResourceProviderRequest<LoadDDBDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadDDBDataAttrs>> => {
  if (event.RequestType === "Create") return await onCreate(event, context);
  if (event.RequestType === "Update") return await onUpdate(event, context);
  if (event.RequestType === "Delete") return await onDelete(event, context);

  throw new Error(
    `Unexpected RequestType '${
      (event as CustomResourceProviderRequest<LoadDDBDataProps>).RequestType
    }' not in 'Create','Update','Delete'`
  );
};

export const onCreate = async (
  event: CustomResourceProviderCreateRequest<LoadDDBDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadDDBDataAttrs>> => {
  const physId = await putItem(event.ResourceProperties);
  console.log(`Inserted item to DynamoDB - ${physId}`);
  return {
    PhysicalResourceId: physId,
    Data: {},
  };
};

export const onUpdate = async (
  event: CustomResourceProviderUpdateRequest<LoadDDBDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadDDBDataAttrs>> => {
  const physId = await putItem(event.ResourceProperties);
  console.log(`Updated item in DynamoDB - ${physId}`);
  return {
    PhysicalResourceId: physId,
    Data: {},
  };
};

export const onDelete = async (
  event: CustomResourceProviderDeleteRequest<LoadDDBDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadDDBDataAttrs>> => {
  console.warn("Deleting this DynamoDB data custom resource is a no-op!");
  return { PhysicalResourceId: event.PhysicalResourceId };
};

/**
 * Put one item in DynamoDB and return a physical resource ID string representing it.
 * @param props Target CFn custom resource properties
 * @returns Physical resource ID in format `tableName:pKey[:sKey]`
 */
async function putItem(props: LoadDDBDataProps): Promise<string> {
  if (!(props.partitionKeyField in props.item)) {
    throw new Error(
      `Partition/primary key field '${props.partitionKeyField} missing from item: ${JSON.stringify(
        props.item
      )}`
    );
  }
  let physId = `ddb:${props.tableName}:${props.item[props.partitionKeyField]}`;
  if (props.sortKeyField) {
    if (!(props.sortKeyField in props.item)) {
      throw new Error(
        `Sort/secondary key field '${props.sortKeyField} missing from item: ${JSON.stringify(props.item)}`
      );
    }

    physId += `:${props.item[props.sortKeyField]}`;
  }

  const client = new DynamoDBClient({});
  const putCommand = new PutItemCommand({
    Item: marshall(props.item),
    TableName: props.tableName,
  });
  await client.send(putCommand);
  return physId;
}
