// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.model;

import java.lang.String;
import java.util.HashSet;
import java.util.LinkedHashMap;

import io.aws.bedrock.dataexploration.service.DynamoDbService;

public class SelectEngineFromDropDown {

    //private LinkedHashMap<String, String> dbTypeOptions;

    private HashSet<String> dbTypeOptions;

    public SelectEngineFromDropDown(DynamoDbService dynamoDbService) {
        this.dbTypeOptions = dynamoDbService.getDropDown();
    }
}
