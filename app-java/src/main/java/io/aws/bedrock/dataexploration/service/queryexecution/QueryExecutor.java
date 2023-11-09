// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.queryexecution;

import io.aws.bedrock.dataexploration.entity.BedrockResult;
import io.aws.bedrock.dataexploration.entity.DatabaseInformation;
import io.aws.bedrock.dataexploration.entity.QueryResult;

public interface QueryExecutor {

    public QueryResult executeQuery(DatabaseInformation databaseInformation, String queryString) throws ClassNotFoundException;

}
