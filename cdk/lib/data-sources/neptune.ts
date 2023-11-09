// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
/**
 * CDK construct for an Amazon Neptune graph data source & sample data
 */

// External Dependencies:
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as neptune from "aws-cdk-lib/aws-neptune";
import { NagSuppressions } from "cdk-nag";
import { Construct } from "constructs";
import { dedent } from "ts-dedent";
// Local Dependencies:
import { IDataSource, IDataSourceDescriptor } from "./base";

export interface NeptuneInfraProps {
  dbSecurityGroup: ec2.ISecurityGroup;
  vpc: ec2.IVpc;
}

/**
 * Construct to deploy an Amazon Neptune cluster and populate it with IMDb sample data
 *
 * This construct is based on the "Build Your First Graph Application with Amazon Neptune" workshop
 * and accompanying CloudFormation stack, but split out and re-implemented some parts in CDK so
 * we could create and control the underlying VPC (to share with other data sources) from CDK.
 *
 * For details of the original workshop, see:
 * https://catalog.us-east-1.prod.workshops.aws/workshops/2ae99bf2-10df-444f-a21f-8ad0537a9bdd/en-US
 * https://neptune-workshop-assets.s3.amazonaws.com/neptune-immersion-day.yaml
 */
export class NeptuneInfra extends Construct implements IDataSource {
  private portNumber = 8182;
  public dbCluster: neptune.CfnDBCluster;
  public dbInstance: neptune.CfnDBInstance;

  constructor(scope: Construct, id: string, props: NeptuneInfraProps) {
    super(scope, id);
    const stack = cdk.Stack.of(this);

    const dbSubnetGroup = new neptune.CfnDBSubnetGroup(this, "NeptuneSubnetGroup", {
      dbSubnetGroupDescription: "Subnet group for Amazon Neptune sample database",
      subnetIds: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
    });

    const dbClusterParamGroup = new neptune.CfnDBClusterParameterGroup(this, "NeptuneClusterParams", {
      description: "Cluster parameters for Amazon Neptune sample database",
      family: "neptune1.2",
      parameters: { neptune_enable_audit_log: 0 },
    });

    const dbParamGroup = new neptune.CfnDBParameterGroup(this, "NeptuneDBParams", {
      description: "DB parameters for Amazon Neptune sample database",
      family: "neptune1.2",
      parameters: {
        neptune_query_timeout: 300000, // (Milliseconds)
      },
    });

    this.dbCluster = new neptune.CfnDBCluster(this, "NeptuneCluster", {
      engineVersion: "1.2.0.2",
      dbClusterParameterGroupName: dbClusterParamGroup.ref,
      dbPort: this.portNumber,
      dbSubnetGroupName: dbSubnetGroup.ref,
      // Can't enable IAM auth or you'll run in to this error in data loading Lambda:
      // https://stackoverflow.com/questions/66154489/unable-to-connect-to-aws-neptune-db-after-enabling-iam-db-authorisation
      iamAuthEnabled: false,
      storageEncrypted: true,
      vpcSecurityGroupIds: [props.dbSecurityGroup.securityGroupId],
    });
    NagSuppressions.addResourceSuppressions(this.dbCluster, [
      { id: "AwsSolutions-N3", reason: "Temp sample database does not need backup/retention" },
    ]);
    NagSuppressions.addResourceSuppressions(this.dbCluster, [
      { id: "AwsSolutions-N5", reason: "TODO: Switch to IAM-based database authentication" },
    ]);

    props.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(this.portNumber),
      "Neptune from anywhere"
    );

    this.dbInstance = new neptune.CfnDBInstance(this, "NeptuneInstance", {
      autoMinorVersionUpgrade: true,
      dbInstanceClass: "db.r5.2xlarge",
      dbParameterGroupName: dbParamGroup.ref,
      dbClusterIdentifier: this.dbCluster.ref,
      dbSubnetGroupName: dbSubnetGroup.ref,
    });

    const s3LoadPolicy = new iam.ManagedPolicy(this, "NeptuneS3LoadPolicy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["s3:GetObject", "s3:GetObjectTorrent", "s3:GetObjectVersion", "s3:ListBucket"],
          conditions: {
            StringNotEquals: { "s3:ResourceAccount": stack.account },
          },
          resources: ["*"],
        }),
      ],
    });
    NagSuppressions.addResourceSuppressions(s3LoadPolicy, [
      {
        id: "AwsSolutions-IAM5",
        reason: "Data loader should be able to read any sample data from *outside* this account",
        appliesTo: ["Resource::*"],
      },
    ]);

    const s3LoadRole = new iam.Role(this, "NeptuneS3LoadRole", {
      assumedBy: new iam.ServicePrincipal("rds.amazonaws.com"),
      managedPolicies: [s3LoadPolicy],
    });

    const addIamRoleToNeptuneStack = new cdk.CfnStack(this, "AddIamRoleToNeptune", {
      templateUrl:
        "https://s3.amazonaws.com/aws-neptune-customer-samples/neptune-sagemaker/cloudformation-templates/common/add-iam-role-to-neptune.json",
      parameters: {
        DBClusterId: this.dbCluster.ref,
        NeptuneLoadFromS3IAMRoleArn: s3LoadRole.roleArn,
      },
      timeoutInMinutes: 60,
    });

    const neptuneDLPGStack = new cdk.CfnStack(this, "NeptuneBLPG", {
      templateUrl: `https://s3.amazonaws.com/ee-assets-prod-${stack.region}/modules/f3f89ef4607743429fb01ae23d983197/v1/workshop/templates/bulkloadstack/bulk-load-stack-39.yaml`,
      parameters: {
        bulkloadFormat: "csv",
        bulkloadNeptuneData: `https://s3.amazonaws.com/ee-assets-prod-${stack.region}/modules/f3f89ef4607743429fb01ae23d983197/v1/workshop/data-v2/imdb-pg/`,
        bulkloadNeptuneEndpoint: this.dbCluster.attrEndpoint,
        bulkloadNeptuneIAMRole: s3LoadRole.roleArn,
        bulkloadNeptuneSecurityGroup: props.dbSecurityGroup.securityGroupId,
        bulkloadSubnet1: props.vpc.privateSubnets[0].subnetId,
      },
    });
    neptuneDLPGStack.addDependency(addIamRoleToNeptuneStack);
    neptuneDLPGStack.addDependency(this.dbInstance); // Instance must be ready, to use cluster

    const neptuneDLRDFStack = new cdk.CfnStack(this, "NeptuneBLRDF", {
      templateUrl: `https://s3.amazonaws.com/ee-assets-prod-${stack.region}/modules/f3f89ef4607743429fb01ae23d983197/v1/workshop/templates/bulkloadstack/bulk-load-stack-39.yaml`,
      parameters: {
        bulkloadFormat: "nquads",
        bulkloadNeptuneData: `https://s3.amazonaws.com/ee-assets-prod-${stack.region}/modules/f3f89ef4607743429fb01ae23d983197/v1/workshop/data-v2/imdb-rdf/`,
        bulkloadNeptuneEndpoint: this.dbCluster.attrEndpoint,
        bulkloadNeptuneIAMRole: s3LoadRole.roleArn,
        bulkloadNeptuneSecurityGroup: props.dbSecurityGroup.securityGroupId,
        bulkloadSubnet1: props.vpc.privateSubnets[0].subnetId,
      },
    });
    neptuneDLRDFStack.addDependency(neptuneDLPGStack); // TODO: Is this actually needed?
    neptuneDLRDFStack.addDependency(addIamRoleToNeptuneStack);
    neptuneDLRDFStack.addDependency(this.dbInstance); // Instance must be ready, to use cluster
  }

  get dataSourceDescriptor(): IDataSourceDescriptor {
    return {
      databaseName: "IMDb Graph (Neptune)",
      connectionUrl: `bolt://${this.dbCluster.attrEndpoint}:${this.portNumber}`,
      dbType: "NEPTUNE",
      schema: dedent(`
        <entities>
        Artist {
            name: string
            birthYear: int  // Year in which the artist was born
            deathYear?: int  // Year in which the artist died (or undefined if still alive)
        }
        
        Genre {
            genre: string  // Name of the genre
        }
        
        movie {
            year: int  // Year the movie was released
            averageRating: float  // Average audience rating from 0 to 10
            runtime: int  // Length of the movie in minutes
            numVotes: int  // Number of votes contributing to the average rating
            title: string  // Title of the movie
        }
        
        Person {  // A known user in the system
            birthday: date
            firstName: string  // The person's given name
            lastName: string  // The person's family name
            gender: string
            browserUsed: string
            locationIP: string
            id: string
            creationDate: date  // Date the person was first recorded in the database
        }
        
        Place {
            name: string
            type: string
            url: string  // Web URL containing more information about the location
        }
        </entities>
        
        <relations>
        (Person)-[:rated {  // Rating entered by a person for a movie
            rating: float  // Rating from 0 to 10
        }]->(movie)
        
        (movie)-[:genre {}]->(Genre)  // Tagging a movie to a genre
        
        (Place)-[:isPartOf {}]->(Place) // Geographical hierarchy of places such as cities and countries
        
        (Person)-[:isLocatedIn {}]->(Place)  // Known residence of a user/person
        
        (Person)-[:knows {  // Acquaintance - Person 1 knows Person 2
            creationDate: date  // Date the connection was recorded
        }]->(Person)
        
        (Person)-[:follows]->(Artist)  // Person follows an Artist to receive updates on their work
        
        (Artist)<-[:actor]-(movie)  // Men (male-identifying artists) starring in the movie
        
        (Artist)<-[:actress]-(movie)  // Women (female-identifying artists) starring in the movie
        
        (Artist)<-[:director]-(movie)  // The artist(s) that directed the movie
        
        (Artist)<-[:producer]-(movie)  // The artist(s) that produced the movie
        
        (Artist)<-[:writer]-(movie)  // The artist(s) that wrote the movie (screenplay or etc)
        </relations>
        
        Note that relations are one-directional and always run from (movie)->(Artist) or (Artist)<-(movie), never from (Artist)->(movie) or (movie)<-(Artist).
        
        For example, you may \`MATCH (a1:Artist {name: "Artist1"})<-[:actress|actor]-(m:movie)-[:actress|actor]->(a2:Artist {name: "Artist2"})\`
        
        ...But it would be invalid to \`MATCH (a1:Artist)-[:actor]->(m:movie)\`
      `),
    };
  }
}
