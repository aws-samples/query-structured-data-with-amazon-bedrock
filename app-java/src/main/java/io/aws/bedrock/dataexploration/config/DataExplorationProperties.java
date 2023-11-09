// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("bedrock.data.exploration")
public class DataExplorationProperties {

    private String bedrockProxy;
    private String dynamoTableName;

    public String getBedrockProxy() {
        return bedrockProxy;
    }

    public void setBedrockProxy(String bedrockProxy) {
        this.bedrockProxy = bedrockProxy;
    }

    public String getDynamoTableName() {
        return dynamoTableName;
    }

    public void setDynamoTableName(String dynamoTableName) {
        this.dynamoTableName = dynamoTableName;
    }
}
