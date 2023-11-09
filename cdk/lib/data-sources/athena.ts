// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK construct for an Amazon Athena data source & sample data
 */
// External Dependencies:
import * as cdk from "aws-cdk-lib";
import * as athena from "aws-cdk-lib/aws-athena";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Provider } from "aws-cdk-lib/custom-resources";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { dedent } from "ts-dedent";
// Local Dependencies:
import { IDataSource, IDataSourceDescriptor } from "./base";
import { LoadAthenaDataProps } from "./lambda-load-data/athena";

export interface AthenaInfraProps {
  /**
   * Name of the Athena (Glue) data catalog to create
   */
  catalogName: string;
  /**
   * Name of the Athena schema/database to work in
   */
  dbName: string;
  /**
   * Custom resource provider for data loading Lambda (shared with other sources)
   */
  loaderProvider: Provider;
  /**
   * IAM role of data loading Lambda (to grant required permissions to)
   */
  loaderRole: iam.IRole;
  /**
   * Athena WorkGroup to create and work in
   */
  workgroupName: string;
}

/**
 * Construct to deploy a sample Athena database and populate it with data
 *
 * NOTE that 'Update' or 'Delete' events don't trigger any additional SQL to run in Athena
 */
export class AthenaInfra extends Construct implements IDataSource {
  public athenaCatalog: athena.CfnDataCatalog;
  public athenaWorkgroup: athena.CfnWorkGroup;
  private dbName: string;
  private athenaCatalogNameProp: string;
  private athenaWorkgroupNameProp: string;
  public queryOutputBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props: AthenaInfraProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);
    this.athenaCatalogNameProp = props.catalogName;
    this.athenaWorkgroupNameProp = props.workgroupName;
    this.dbName = props.dbName;

    this.queryOutputBucket = new s3.Bucket(this, "AthenaBucket", {
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.queryOutputBucket.grantReadWrite(props.loaderRole);
    NagSuppressions.addResourceSuppressions(this.queryOutputBucket, [
      {
        id: "AwsSolutions-S1",
        reason: "No need to log access to this bucket: would introduce pointless extra buckets",
      },
    ]);

    this.athenaCatalog = new athena.CfnDataCatalog(this, "AthenaCatalog", {
      name: props.catalogName,
      type: "GLUE",
      description: "Sample data catalog for exploring data with Amazon Bedrock",
      parameters: { "catalog-id": stack.account },
    });

    this.athenaWorkgroup = new athena.CfnWorkGroup(this, "AthenaWorkgroup", {
      name: props.workgroupName,
      description: "Demo workgroup for exploring data with Amazon Bedrock",
      recursiveDeleteOption: true,
      state: "ENABLED",
      workGroupConfiguration: {
        enforceWorkGroupConfiguration: true,
        resultConfiguration: {
          outputLocation: this.queryOutputBucket.s3UrlForObject(""),
          encryptionConfiguration: { encryptionOption: "SSE_S3" },
        },
      },
    });

    const loaderPolicy = new iam.ManagedPolicy(this, "AthenaLoaderPolicy", {
      description: "Permissions for automatically loading sample data into Athena",
      document: new iam.PolicyDocument({
        statements: this.getAthenaQueryAccessStatements().concat([
          new iam.PolicyStatement({
            actions: ["athena:UpdateDataCatalog"],
            resources: [
              `arn:${stack.partition}:athena:${stack.region}:${stack.account}:datacatalog/${props.catalogName}`,
            ],
            sid: "AthenaDataCatalogWrite",
          }),
          new iam.PolicyStatement({
            actions: [
              "glue:BatchCreatePartition",
              "glue:BatchGetPartition",
              "glue:CreateDatabase",
              "glue:CreatePartition",
              "glue:CreateTable",
              // NOTE: We haven't added delete perms because the current custom resource doesn't
              // clean up on delete:
              // "glue:DeleteDatabase",
              // "glue:DeletePartition",
              // "glue:DeleteTable",
              "glue:GetDatabase",
              "glue:GetDatabases",
              "glue:GetPartition",
              "glue:GetPartitionIndexes",
              "glue:GetPartitions",
              "glue:GetTable",
              "glue:GetTableVersion",
              "glue:GetTableVersions",
            ],
            resources: [
              `arn:${stack.partition}:glue:${stack.region}:${stack.account}:catalog`,
              `arn:${stack.partition}:glue:${stack.region}:${stack.account}:database/${props.dbName}`,
              `arn:${stack.partition}:glue:${stack.region}:${stack.account}:table/${props.dbName}/*`,
              `arn:${stack.partition}:glue:${stack.region}:${stack.account}:tableVersion/${props.dbName}/*`,
            ],
            sid: "GlueAccess",
          }),
        ]),
      }),
      roles: [props.loaderRole],
    });
    NagSuppressions.addResourceSuppressions(loaderPolicy, [
      {
        id: "AwsSolutions-IAM5",
        reason: "Data loader resource should be able to manage any tables within target Glue database",
      },
    ]);

    const loaderProps: LoadAthenaDataProps = {
      athenaCatalog: this.athenaCatalog.ref,
      athenaWorkgroup: this.athenaWorkgroup.ref,
      queryDatabase: this.dbName,
      queryStatements: AthenaInfra.getCreationQueryString(this.dbName)
        .split(";")
        .map((q) => q.trim())
        .filter((q) => q),
    };
    const dataLoad = new cdk.CustomResource(this, "AthenaData", {
      serviceToken: props.loaderProvider.serviceToken,
      properties: loaderProps,
      resourceType: "Custom::AthenaSample",
    });
    dataLoad.node.addDependency(loaderPolicy);
  }

  get dataSourceDescriptor(): IDataSourceDescriptor {
    const stack = cdk.Stack.of(this);
    const connProps = {
      AwsRegion: stack.region,
      AwsCredentialsProviderClass: "com.simba.athena.amazonaws.auth.DefaultAWSCredentialsProviderChain",
      Catalog: this.athenaCatalogNameProp,
      S3OutputLocation: this.queryOutputBucket.s3UrlForObject(),
      Schema: this.dbName,
      Workgroup: this.athenaWorkgroupNameProp,
    };

    return {
      databaseName: "TPC-H (Athena)",
      connectionUrl: `jdbc:awsathena://${Object.entries(connProps)
        .map((entry) => `${entry[0]}=${entry[1]}`)
        .join(";")}`,
      dbType: "ATHENA",
      schema: AthenaInfra.getCreationQueryString(this.dbName),
    };
  }

  /**
   * Construct policy statements for querying Athena (Note: Doesn't include output S3 bucket write)
   */
  public getAthenaQueryAccessStatements(): iam.PolicyStatement[] {
    const stack = cdk.Stack.of(this);
    return [
      new iam.PolicyStatement({
        actions: [
          "athena:BatchGetNamedQuery",
          "athena:BatchGetQueryExecution",
          "athena:GetNamedQuery",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:GetQueryResultsStream",
          "athena:GetQueryRuntimeStatistics",
          "athena:StartQueryExecution",
          "athena:StopQueryExecution",
        ],
        resources: [
          `arn:${stack.partition}:athena:${stack.region}:${stack.account}:workgroup/${this.athenaWorkgroupNameProp}`,
        ],
        sid: "AthenaWorkgroupPerms",
      }),
      new iam.PolicyStatement({
        actions: ["athena:GetDataCatalog"],
        resources: [
          `arn:${stack.partition}:athena:${stack.region}:${stack.account}:datacatalog/${this.athenaCatalogNameProp}`,
        ],
        sid: "AthenaDataCatalogRead",
      }),
      new iam.PolicyStatement({
        actions: [
          "glue:CreateConnection",
          "glue:DeleteConnection",
          "glue:GetConnection",
          "glue:GetConnections",
          "glue:GetDatabase",
          "glue:GetDatabases",
          "glue:GetPartition",
          "glue:GetPartitionIndexes",
          "glue:GetPartitions",
          "glue:GetTable",
          "glue:GetTableVersion",
          "glue:GetTableVersions",
          "glue:GetTables",
          "glue:GetUserDefinedFunction",
          "glue:GetUserDefinedFunctions",
          "glue:SearchTables",
          "glue:UpdateConnection",
        ],
        resources: [
          // Note: We need permissions like GetTable on the catalog *and* the db *and* the table:
          `arn:${stack.partition}:glue:${stack.region}:${stack.account}:catalog`,
          `arn:${stack.partition}:glue:${stack.region}:${stack.account}:database/${this.dbName}`,
          `arn:${stack.partition}:glue:${stack.region}:${stack.account}:table/${this.dbName}/*`,
        ],
        sid: "GlueCatalogRead",
      }),
    ];
  }

  /**
   * Suppress cdk-nag rules triggered by statements from `.getAthenaQueryAccessStatements()`
   * @param resource The CDK resource to suppress the rules on
   */
  public getAthenaQueryAccessNagSuppressions(resource: any, applyToChildren = false) {
    NagSuppressions.addResourceSuppressions(
      resource,
      [
        {
          id: "AwsSolutions-IAM5",
          reason: "Principal should have access to invoke any model. Log & metric streams require wildcards",
          appliesTo: [
            "Action::s3:Abort*",
            "Action::s3:DeleteObject*",
            "Action::s3:GetBucket*",
            "Action::s3:GetObject*",
            "Action::s3:List*",
            "Action::s3:*",
            { regex: `/^Resource::<\\w*AthenaBucket\\w+\\.Arn>\\/*/` },
            { regex: `/^Resource::arn:<AWS::Partition>:s3:::redshift-downloads\\/*/` },
            {
              regex: `/^Resource::arn:<AWS::Partition>:glue:<AWS::Region>:<AWS::AccountId>:table\\/${this.dbName}\\/*/`,
            },
          ],
        },
      ],
      applyToChildren
    );
  }

  /**
   * Grant all the permissions required to query this data source
   */
  public grantQuery(grantee: iam.IGrantable): void {
    this.getAthenaQueryAccessStatements().forEach((statement) =>
      grantee.grantPrincipal.addToPrincipalPolicy(statement)
    );
    s3.Bucket.fromBucketName(this, "ExternalDataBucket", "redshift-downloads").grantRead(grantee);
    this.queryOutputBucket.grantReadWrite(grantee);
    this.getAthenaQueryAccessNagSuppressions(grantee.grantPrincipal, true);
  }

  /**
   * Commented database setup query used for both schema and initialization
   */
  private static getCreationQueryString(dbName: string): string {
    return dedent(`
      create database ${dbName};

      create external table customer (
        c_custkey bigint,
        c_name string,
        c_address string,
        c_nationkey bigint,
        c_phone string,
        c_acctbal string,
        c_mktsegment string,
        c_comment string
      )
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/customer/';
      
      create external table lineitem (
        l_orderkey bigint,
        l_partkey bigint,
        l_suppkey bigint,
        l_linenumber bigint,
        l_quantity decimal(12,2),
        l_extendedprice decimal(12,2),
        l_discount decimal(12,2),
        l_tax decimal(12,2),
        l_returnflag string,
        l_linestatus string,
        l_shipdate date,
        l_commitdate date,
        l_receiptdate date,
        l_shipinstruct string,
        l_shipmode string,
        l_comment string
      )
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/lineitem/';
      
      create external table nation (
        n_nationkey bigint,
        n_name string,
        n_regionkey bigint,
        n_comment string                          
      )
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/nation/';
      
      create external table orders (
        o_orderkey bigint,
        o_custkey bigint,
        o_orderstatus string,
        o_totalprice decimal(12,2),
        o_orderdate date,
        o_orderpriority string,
        o_clerk string,
        o_shippriority bigint,
        o_comment string)
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/orders/';
      
      create external table part (
        p_partkey bigint,
        p_name string,
        p_mfgr string,
        p_brand string,
        p_type string,
        p_size bigint,
        p_container string,
        p_retailprice decimal(12,2),
        p_comment string
      )
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/part/';
      
      -- "partsupp" table contains the information about the parts carried by the supplier
      create external table partsupp (
        ps_partkey bigint COMMENT 'foreign key to p_partkey',
        ps_suppkey bigint COMMENT 'foreign key to s_suppkey',
        ps_availqty bigint COMMENT 'available quantity for the part carried by the supplier',
        ps_supplycost decimal(12,2) COMMENT 'cost posted by the supplier for the part',
        ps_comment string
      ) 
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/partsupp/';
      
      -- "region" table contains information about the major continents across the world
      create external table region (
        r_regionkey bigint COMMENT 'unique identifier of the region table',
        r_name string COMMENT 'region name',
        r_comment string COMMENT 'region comment'                  
      )
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/region/';
      
      -- "supplier" table contains information about the suppliers who sell parts to customers
      create external table supplier (
        s_suppkey bigint COMMENT 'unique identifier of the supplier table',
        s_name string COMMENT 'supplier name',
        s_address string COMMENT 'supplier address',
        s_nationkey bigint COMMENT 'foreign key to n_nationkey',
        s_phone string COMMENT 'supplier contact number',
        s_acctbal decimal(12,2) COMMENT 'supplier account balance',
        s_comment string COMMENT 'supplier comment'
      ) 
      row format delimited fields terminated by '|'
      location 's3://redshift-downloads/TPC-H/2.18/100GB/supplier/';
    `);
  }
}
