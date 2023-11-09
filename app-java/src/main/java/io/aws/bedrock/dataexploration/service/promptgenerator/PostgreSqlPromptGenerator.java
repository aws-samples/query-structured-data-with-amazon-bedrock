// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.promptgenerator;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import org.springframework.stereotype.Service;

@Service
public class PostgreSqlPromptGenerator implements PromptGenerator {

    @Override
    public String generatePrompt(DatabaseInformation databaseItem, String userQuestion) {
        return """
                Human:
                You are connected to a relational database with the following schema:

                <schema>
                %s
                </schema>

                The database is implemented in PostgreSQL. Write a query to retrieve the data needed to answer the following question - or respond with "unknown" if the given schema does not contain relevant information. Output the query inside <query></query> tags and and explanation of what the query does inside <explanation></explanation> tags. Do not use any linebreak inside the <query></query> and <explanation></explanation> tags!

                Question: %s

                Assistant:"""
                .formatted(databaseItem.getSchema(), userQuestion);
    }

}
