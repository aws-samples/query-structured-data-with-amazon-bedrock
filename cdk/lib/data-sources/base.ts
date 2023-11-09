// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * Base interfaces which pluggable data sources should conform to for use with the solution
 */

/**
 * Schema of data source descriptor objects in DynamoDB
 */
export interface IDataSourceDescriptor {
  databaseName: string;
  connectionUrl: string;
  databaseCredentialsSsm?: string;
  dbType: "ATHENA" | "NEPTUNE" | "POSTGRESQL";
  schema: string;
}

/**
 * All 'data source' constructs should expose a dataSourceDescriptor property
 */
export interface IDataSource {
  readonly dataSourceDescriptor: IDataSourceDescriptor;
}
