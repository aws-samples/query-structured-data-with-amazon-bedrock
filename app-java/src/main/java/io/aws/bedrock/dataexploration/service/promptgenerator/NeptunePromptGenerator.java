// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.promptgenerator;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import org.springframework.stereotype.Service;

@Service
public class NeptunePromptGenerator implements PromptGenerator {

    @Override
    public String generatePrompt(DatabaseInformation databaseItem, String userQuestion) {
        return """
                Human:
                You are connected to a graph database with the following schema:

                <schema>
                %s
                </schema>

                The database is implemented in Amazon Neptune Neo4J. Write a query to retrieve the data needed to answer the following question - or respond with "unknown" if the given schema does not contain relevant information. Check you use relations only in the direction they run when matching. Return only an explanation of how the query works enclosed in <explanation></explanation> tags, and a valid OpenCypher query enclosed in <query></query> tags.

                <question>%s</question>

                Assistant:
                """
                .formatted(databaseItem.getSchema(), userQuestion);
    }

}
