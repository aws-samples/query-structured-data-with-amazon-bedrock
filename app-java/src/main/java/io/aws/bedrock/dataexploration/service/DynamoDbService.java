// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service;

import java.util.HashSet;

import org.springframework.stereotype.Service;

import io.aws.bedrock.dataexploration.config.DataExplorationProperties;
import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

@Service
public class DynamoDbService {

    private final DynamoDbEnhancedClient enhancedClient = DynamoDbEnhancedClient.builder().dynamoDbClient(
            DynamoDbClient.builder().build()).build();
    private final DynamoDbTable<DatabaseInformation> databaseTable;

    private final DataExplorationProperties dataExplorationProperties;

    private final HashSet<String> dropDownDbType = new HashSet<>();

    public DynamoDbService(DataExplorationProperties dataExplorationProperties) {
        this.dataExplorationProperties = dataExplorationProperties;
        this.databaseTable = enhancedClient.table(dataExplorationProperties.getDynamoTableName(),
                TableSchema.fromBean(DatabaseInformation.class));
    }

    public void storeDatabaseEntry(DatabaseInformation databaseInformation) {
        databaseTable.putItem(databaseInformation);
    }

    public DynamoDbTable<DatabaseInformation> getDatabaseTable() {
        return databaseTable;
    }

    public Iterable<DatabaseInformation> getDatabaseItems() {
        return databaseTable.scan().items();
    }

    public HashSet<String> getDropDown() {
        getDatabaseItems().forEach(item -> dropDownDbType.add(item.getDbType().toString()));

        return this.dropDownDbType;
    }

    public DatabaseInformation getDatabaseItem(String key) {
        return databaseTable.getItem(Key.builder().partitionValue(key).build());
    }
}
