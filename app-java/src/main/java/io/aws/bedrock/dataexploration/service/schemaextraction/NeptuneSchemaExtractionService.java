// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.schemaextraction;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import org.springframework.stereotype.Service;

@Service
public class NeptuneSchemaExtractionService implements SchemaExtractor {
    @Override
    public String extractSchemaFromDatabase(DatabaseInformation databaseInformation) {
        return null;
    }
}
