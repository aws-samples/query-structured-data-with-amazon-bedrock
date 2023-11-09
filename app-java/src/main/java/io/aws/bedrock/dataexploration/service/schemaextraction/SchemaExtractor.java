// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.schemaextraction;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;

public interface SchemaExtractor {

    public String extractSchemaFromDatabase(DatabaseInformation databaseInformation);

}
