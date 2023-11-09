// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK custom resource Lambda function for loading Pagila sample data to Postgres/RDS
 */
// NodeJS Built-Ins:
import { createHash } from "crypto";
import * as fs from "fs";
import * as https from "https";
// External Dependencies:
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { Context } from "aws-lambda";
import * as tmp from "tmp";
import { Client as DbClient } from "pg";
// Local Dependencies:
import {
  CustomResourceEventResult,
  CustomResourceProviderCreateRequest,
  CustomResourceProviderDeleteRequest,
  CustomResourceProviderRequest,
  CustomResourceProviderUpdateRequest,
} from "./cfn-base";

/**
 * Input resource properties supported for loading RDS data
 */
export interface LoadRDSDataProps {
  /**
   * Name of the database to use
   */
  dbName: string;

  /**
   * Host name of the RDS cluster / writer node
   */
  host: string;

  /**
   * Optional port to connect on (defaults to PostgreSQL default port)
   */
  port?: number;

  /**
   * ARN or name of the AWS Secrets Manager Secret to retrieve the username and password from
   */
  credSecret: string;
}

/**
 * This resource returns no GetAtt-able properties
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface LoadRDSDataAttrs {}

export const onEvent = async (
  event: CustomResourceProviderRequest<LoadRDSDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadRDSDataAttrs>> => {
  if (event.RequestType === "Create") return await onCreate(event, context);
  if (event.RequestType === "Update") return await onUpdate(event, context);
  if (event.RequestType === "Delete") return await onDelete(event, context);

  throw new Error(
    `Unexpected RequestType '${
      (event as CustomResourceProviderRequest<LoadRDSDataProps>).RequestType
    }' not in 'Create','Update','Delete'`
  );
};

export const onCreate = async (
  event: CustomResourceProviderCreateRequest<LoadRDSDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadRDSDataAttrs>> => {
  const physId = await uploadData(event.ResourceProperties);
  console.log(`Loaded data to Amazon RDS - ${physId}`);
  return {
    PhysicalResourceId: physId,
    Data: {},
  };
};

export const onUpdate = async (
  event: CustomResourceProviderUpdateRequest<LoadRDSDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadRDSDataAttrs>> => {
  console.warn("Updating this RDS data custom resource is a no-op!");
  return {
    PhysicalResourceId: event.PhysicalResourceId,
    Data: {},
  };
};

export const onDelete = async (
  event: CustomResourceProviderDeleteRequest<LoadRDSDataProps>,
  context: Context
): Promise<CustomResourceEventResult<LoadRDSDataAttrs>> => {
  console.warn("Deleting this RDS data custom resource is a no-op!");
  return { PhysicalResourceId: event.PhysicalResourceId };
};

function downloadFile(url: string, dest: string): Promise<void> {
  const file = fs.createWriteStream(dest);
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
      })
      .on("error", (err) => reject(err));
  });
}

/**
 * Initialize the sample data in RDS/Postgres
 * @param props Target CFn custom resource properties
 * @returns Physical resource ID in format `tableName:pKey[:sKey]`
 */
async function uploadData(props: LoadRDSDataProps): Promise<string> {
  // TODO: Implement data loading here
  const tmpSchemaQueryFile = tmp.fileSync();
  const tmpDataQueryFile = tmp.fileSync();
  const physIdHash = createHash("md5");
  try {
    console.log("Downloading Pagila setup queries from Github...");
    await Promise.all([
      downloadFile(
        "https://raw.githubusercontent.com/devrimgunduz/pagila/master/pagila-schema.sql",
        tmpSchemaQueryFile.name
      ),
      downloadFile(
        "https://raw.githubusercontent.com/devrimgunduz/pagila/master/pagila-insert-data.sql",
        tmpDataQueryFile.name
      ),
    ]);

    console.log("Fetching database credential from Secrets Manager");
    const secman = new SecretsManagerClient({});
    const credCommand = new GetSecretValueCommand({
      SecretId: props.credSecret,
    });
    const credResult = await secman.send(credCommand);
    const credJson = credResult.SecretString;
    if (!credJson) {
      throw new Error(
        `Failed to get SecretString from AWS Secrets Manager for secret ID: ${props.credSecret}`
      );
    }

    const creds = JSON.parse(credJson);
    const password: string = creds["password"];
    const user: string = creds["username"];
    const port: number = props.port || creds["port"] || 5432;
    const host: string = props.host || creds["host"];
    if ("port" in creds && creds["port"] !== port) {
      console.warn(`Credential port ${creds["port"]} does not match provided port ${port}`);
    }
    if ("dbname" in creds && creds["dbname"] !== props.dbName) {
      console.warn(`Credential dbname ${creds["dbname"]} does not match provided database ${props.dbName}`);
    }
    if ("host" in creds && creds["host"] !== props.host) {
      console.warn(`Credential host ${creds["host"]} does not match provided host ${props.host}`);
    }

    console.log("Connecting to Postgres database...");
    console.log(
      JSON.stringify(
        {
          host,
          port,
          user,
          database: props.dbName,
          password: `${typeof password} of length ${password.length}`,
        },
        null,
        2
      )
    );
    const client = new DbClient({
      host,
      port,
      user,
      password,
      database: props.dbName,
    });
    await client.connect();

    try {
      const schemaSql = await fs.promises.readFile(tmpSchemaQueryFile.name, "utf-8");
      console.log("Running schema generation statements...");
      await client.query(schemaSql);
      physIdHash.update(schemaSql);

      const dataSql = await fs.promises.readFile(tmpDataQueryFile.name, "utf-8");
      console.log("Running data loading statements...");
      await client.query(dataSql);
      physIdHash.update(dataSql);
    } finally {
      client.end();
    }
  } finally {
    tmpSchemaQueryFile.removeCallback();
    tmpDataQueryFile.removeCallback();
  }

  return `${props.dbName}-${physIdHash.digest("hex").slice(0, 80)}`;
}
