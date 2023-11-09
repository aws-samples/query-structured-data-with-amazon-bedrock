// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service;

import io.aws.bedrock.dataexploration.entity.BedrockResult;
import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import io.aws.bedrock.dataexploration.entity.QueryResult;
import io.aws.bedrock.dataexploration.service.promptgenerator.AthenaPromptGenerator;
import io.aws.bedrock.dataexploration.service.promptgenerator.NeptunePromptGenerator;
import io.aws.bedrock.dataexploration.service.promptgenerator.PostgreSqlPromptGenerator;
import io.aws.bedrock.dataexploration.service.queryexecution.AthenaQueryExecutor;
import io.aws.bedrock.dataexploration.service.queryexecution.NeptuneQueryExecutor;
import io.aws.bedrock.dataexploration.service.queryexecution.PostgreSqlQueryExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class UserQueryExecutionService {

    private static final Logger LOGGER = LoggerFactory.getLogger(UserQueryExecutionService.class);
    private final DynamoDbService dynamoDbService;
    private final BedrockService bedrockService;
    private final PostgreSqlPromptGenerator postgreSqlPromptGenerator;
    private final NeptunePromptGenerator neptunePromptGenerator;
    private final AthenaPromptGenerator athenaPromptGenerator;
    private final NeptuneQueryExecutor neptuneQueryExecutor;
    private final AthenaQueryExecutor athenaQueryExecutor;
    private final PostgreSqlQueryExecutor postgreSqlQueryExecutor;

    public UserQueryExecutionService(DynamoDbService dynamoDbService, BedrockService bedrockService,
            PostgreSqlPromptGenerator postgreSqlPromptGenerator, NeptunePromptGenerator neptunePromptGenerator,
            AthenaPromptGenerator athenaPromptGenerator, NeptuneQueryExecutor neptuneQueryExecutor,
            AthenaQueryExecutor athenaQueryExecutor, PostgreSqlQueryExecutor postgreSqlQueryExecutor) {
        this.dynamoDbService = dynamoDbService;
        this.bedrockService = bedrockService;
        this.postgreSqlPromptGenerator = postgreSqlPromptGenerator;
        this.neptunePromptGenerator = neptunePromptGenerator;
        this.athenaPromptGenerator = athenaPromptGenerator;
        this.neptuneQueryExecutor = neptuneQueryExecutor;
        this.athenaQueryExecutor = athenaQueryExecutor;
        this.postgreSqlQueryExecutor = postgreSqlQueryExecutor;
    }

    public QueryResult executeQuery(String databaseName, String userQuestion) throws ClassNotFoundException {
        DatabaseInformation databaseItem = dynamoDbService.getDatabaseItem(databaseName);
        String prompt = "";
        switch (databaseItem.getDbType()) {

            case POSTGRESQL -> {
                prompt = postgreSqlPromptGenerator.generatePrompt(databaseItem, userQuestion);
            }
            case NEPTUNE -> {
                prompt = neptunePromptGenerator.generatePrompt(databaseItem, userQuestion);
            }
            case ATHENA -> {
                prompt = athenaPromptGenerator.generatePrompt(databaseItem, userQuestion);
            }
        }
        BedrockResult bedrockResult = null;
        try {
            bedrockResult = bedrockService.callBedrock(prompt);
        } catch (Exception e) {
            String message = "Error calling Bedrock";
            LOGGER.error(message, e);
            throw new RuntimeException(message, e);
        }
        QueryResult queryResult = null;
        try {
            switch (databaseItem.getDbType()) {

                case POSTGRESQL -> {
                    queryResult = postgreSqlQueryExecutor.executeQuery(databaseItem, bedrockResult.getQuery());
                }
                case NEPTUNE -> {
                    queryResult = neptuneQueryExecutor.executeQuery(databaseItem, bedrockResult.getQuery());
                }
                case ATHENA -> {
                    queryResult = athenaQueryExecutor.executeQuery(databaseItem, bedrockResult.getQuery());
                }
            }
            queryResult.setBedrockResult(bedrockResult);
        } catch (Exception e) {
            String message = "Executing the query failed for bedrock result: " + bedrockResult;
            LOGGER.error(message, e);
            throw new RuntimeException(message, e);
        }
        return queryResult;
    }
}
