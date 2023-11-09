// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.controller.api;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import io.aws.bedrock.dataexploration.entity.QueryResult;
import io.aws.bedrock.dataexploration.service.DynamoDbService;
import io.aws.bedrock.dataexploration.service.UserQueryExecutionService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class DataExplorationApiController {

    private final DynamoDbService dynamoDbService;
    private final UserQueryExecutionService userQueryExecutionService;

    public DataExplorationApiController(DynamoDbService dynamoDbService,
            UserQueryExecutionService userQueryExecutionService) {
        this.dynamoDbService = dynamoDbService;
        this.userQueryExecutionService = userQueryExecutionService;
    }

    @GetMapping("/databases")
    public Iterable<DatabaseInformation> listDatabases() {
        return dynamoDbService.getDatabaseItems();
    }

    @PostMapping("/query")
    public QueryResult dataExploration(@RequestBody DataExplorationRequest dataExplorationRequest)
            throws ClassNotFoundException {
        return userQueryExecutionService.executeQuery(dataExplorationRequest.databaseName(),
                dataExplorationRequest.query());
    }

}
