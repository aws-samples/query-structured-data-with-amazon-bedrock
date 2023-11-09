// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK custom resource Lambda function for running queries in Amazon Athena
 */
// NodeJS Built-Ins:
import { createHash } from "crypto";
// External Dependencies:
import { Context } from "aws-lambda";
import {
  AthenaClient,
  GetNamedQueryCommand,
  GetQueryExecutionCommand,
  GetQueryExecutionCommandOutput,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from "@aws-sdk/client-athena";
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
export interface LoadAthenaDataProps {
  /**
   * Name of the Athena data catalog to work in
   */
  athenaCatalog: string;

  /**
   * Name of the Athena Workgroup to work in
   */
  athenaWorkgroup: string;

  /**
   * Optional name of the Athena database to use
   */
  queryDatabase?: string;

  /**
   * Sequence of SQL statements to run
   *
   * Exactly one of `queryStatements` or `storedQueryId` must be provided
   */
  queryStatements?: string[];

  /**
   * Stored Athena Query to run
   *
   * Exactly one of `queryStatements` or `storedQueryId` must be provided
   */
  storedQueryId?: string;
}

/**
 * This resource returns no GetAtt-able properties
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadAthenaDataAttrs {}

export const onEvent = async (
  event: CustomResourceProviderRequest<LoadAthenaDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadAthenaDataAttrs>> => {
  if (event.RequestType === "Create") return await onCreate(event, context);
  if (event.RequestType === "Update") return await onUpdate(event, context);
  if (event.RequestType === "Delete") return await onDelete(event, context);

  throw new Error(
    `Unexpected RequestType '${
      (event as CustomResourceProviderRequest<LoadAthenaDataProps>).RequestType
    }' not in 'Create','Update','Delete'`
  );
};

export const onCreate = async (
  event: CustomResourceProviderCreateRequest<LoadAthenaDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadAthenaDataAttrs>> => {
  const physId = await uploadData(event.ResourceProperties);
  console.log(`Created Athena sample database - ${physId}`);
  return {
    PhysicalResourceId: physId,
    Data: {},
  };
};

export const onUpdate = async (
  event: CustomResourceProviderUpdateRequest<LoadAthenaDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadAthenaDataAttrs>> => {
  // TODO: Is there any way we could support updates/deletion?
  console.warn("Updating this Athena data custom resource is a no-op!");
  return {
    PhysicalResourceId: event.PhysicalResourceId,
    Data: {},
  };
};

export const onDelete = async (
  event: CustomResourceProviderDeleteRequest<LoadAthenaDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadAthenaDataAttrs>> => {
  // TODO: Is there any way we could support updates/deletion?
  console.warn("Deleting this Athena data custom resource is a no-op!");
  return { PhysicalResourceId: event.PhysicalResourceId };
};

/**
 * Initialize the Athena database with sample tables
 * @param props Target CFn custom resource properties
 * @returns Physical resource ID in format `tableName:pKey[:sKey]`
 */
async function uploadData(props: LoadAthenaDataProps): Promise<string> {
  const client = new AthenaClient({});
  let queryDatabase: string | undefined;
  let queryStrings: string[] = [];
  let physResourceId: string;
  if (props.storedQueryId) {
    console.log(`Fetching stored query ${props.storedQueryId}`);
    const getQueryCmd = new GetNamedQueryCommand({ NamedQueryId: props.storedQueryId });
    const storedQuery = await client.send(getQueryCmd);
    if (!storedQuery.NamedQuery) {
      throw new Error(`Failed to fetch stored query ID ${props.storedQueryId} from Athena`);
    }
    const queryString = storedQuery.NamedQuery.QueryString;
    if (!queryString) {
      throw new Error(`Failed to fetch stored query ID ${props.storedQueryId} - empty string`);
    }

    queryDatabase = props.queryDatabase || storedQuery.NamedQuery.Database;
    physResourceId = props.storedQueryId;
    const multiQuery = queryString.indexOf(";") >= 0;
    if (multiQuery) console.log("Detected multiple statements in stored query");
    queryStrings = multiQuery ? queryString.split(";").map((q) => q.trim()) : [queryString];
    if (multiQuery) console.log(`Running ${queryStrings.length} statements`);
  } else if (props.queryStatements) {
    queryDatabase = props.queryDatabase;
    queryStrings = props.queryStatements;
    const queryHash = createHash("md5");
    queryStrings.forEach((q) => queryHash.update(q));
    physResourceId = "inline-" + queryHash.digest("hex").slice(0, 80);
  } else {
    throw new Error(
      "Resource properties must provide either 'queryStatements' or 'storedQueryId'. Got neither"
    );
  }

  for (const statement of queryStrings) {
    await runStatement({
      athenaCatalog: props.athenaCatalog,
      athenaDatabase: queryDatabase,
      athenaWorkgroup: props.athenaWorkgroup,
      client,
      queryString: statement,
      max_wait_secs: 60 * 8,
      poll_secs: 10,
    });
  }

  return physResourceId;
}

/**
 * Run a single Athena statement and (poll) wait for it to complete
 *
 * TODO: It'd be better to have event-based query execution callbacks
 * This function uses a polling wait instead for now
 *
 * @param args
 * @returns Query execution result
 */
async function runStatement(args: {
  athenaCatalog: string;
  athenaDatabase?: string;
  athenaWorkgroup: string;
  client: AthenaClient;
  queryString: string;
  max_wait_secs: number;
  poll_secs: number;
}): Promise<GetQueryExecutionCommandOutput> {
  // TODO: Could take catalog / workgroup from the stored query too?
  const startQueryCmd = new StartQueryExecutionCommand({
    QueryString: args.queryString,
    QueryExecutionContext: {
      Catalog: args.athenaCatalog,
      Database: args.athenaDatabase,
    },
    WorkGroup: args.athenaWorkgroup,
  });
  const queryRun = await args.client.send(startQueryCmd);
  if (!queryRun.QueryExecutionId) throw new Error(`Failed to run Athena query`);
  console.log(`Query execution started: ${queryRun.QueryExecutionId}\n${args.queryString}`);

  let last_result: GetQueryExecutionCommandOutput;
  let last_status: string | undefined;
  let total_wait = 0;
  while (total_wait < args.max_wait_secs) {
    await new Promise((r) => setTimeout(r, args.poll_secs * 1000));
    total_wait += args.poll_secs;
    last_result = await args.client.send(
      new GetQueryExecutionCommand({ QueryExecutionId: queryRun.QueryExecutionId })
    );
    last_status = last_result.QueryExecution?.Status?.State;
    if (!(last_status === QueryExecutionState.QUEUED || last_status === QueryExecutionState.RUNNING)) {
      break;
    } else {
      console.log(`Execution ${queryRun.QueryExecutionId} still running after ~${total_wait}s...`);
    }
  }
  if (last_status === QueryExecutionState.SUCCEEDED) {
    console.log(`Query execution ${queryRun.QueryExecutionId} succeeded!`);
    return queryRun;
  } else {
    throw new Error(
      `Athena execution ${queryRun.QueryExecutionId} entered non-success state '${last_status}'`
    );
  }
}
