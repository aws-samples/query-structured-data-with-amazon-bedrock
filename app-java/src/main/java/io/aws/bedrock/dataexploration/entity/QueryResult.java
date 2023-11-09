// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.entity;

import java.util.LinkedList;

public class QueryResult {

    private final LinkedList<LinkedList<String>> values;
    private final LinkedList<String> columns;

    private  BedrockResult bedrockResult;

    public QueryResult(LinkedList<LinkedList<String>> values, LinkedList<String> columns) {
        this.values = values;
        this.columns = columns;
    }

    public LinkedList<LinkedList<String>> getValues() {
        return values;
    }

    public LinkedList<String> getColumns() {
        return columns;
    }

    public BedrockResult getBedrockResult() {
        return bedrockResult;
    }

    public void setBedrockResult(BedrockResult bedrockResult) {
        this.bedrockResult = bedrockResult;
    }
}
