// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.entity;

public class BedrockResult {

    private final String explanation;

    private final String query;

    public BedrockResult(String explanation, String query) {
        this.explanation = explanation;
        this.query = query;
    }

    public String getExplanation() {
        return explanation;
    }

    public String getQuery() {
        return query;
    }

    @Override
    public String toString() {
        return "BedrockResult{" +
               "explanation='" + explanation + '\'' +
               ", query='" + query + '\'' +
               '}';
    }
}
