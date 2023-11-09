// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.entity;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;

@DynamoDbBean
public class DatabaseInformation {

    private String connectionUrl;
    private String databaseName;
    private String databaseCredentialsSsm;
    private DbType dbType;
    private String schema;

    public String getConnectionUrl() {
        return connectionUrl;
    }

    public void setConnectionUrl(String connectionUrl) {
        this.connectionUrl = connectionUrl;
    }

    @DynamoDbPartitionKey
    public String getDatabaseName() {
        return databaseName;
    }

    public void setDatabaseName(String databaseName) {
        this.databaseName = databaseName;
    }

    public String getDatabaseCredentialsSsm() {
        return databaseCredentialsSsm;
    }

    public void setDatabaseCredentialsSsm(String databaseCredentialsSsm) {
        this.databaseCredentialsSsm = databaseCredentialsSsm;
    }

    public DbType getDbType() {
        return dbType;
    }

    public void setDbType(DbType dbType) {
        this.dbType = dbType;
    }

    public String getSchema() {
        return schema;
    }

    public void setSchema(String schema) {
        this.schema = schema;
    }

    @Override
    public String toString() {
        return "DatabaseInformationDDB{" +
                "connectionUrl='" + connectionUrl + "'" +
                "databaseName='" + databaseName + '\'' +
                ", databaseCredentialsSsm='" + databaseCredentialsSsm + '\'' +
                ", dbType=" + dbType +
                ", schema='" + schema + '\'' +
                '}';
    }
}
