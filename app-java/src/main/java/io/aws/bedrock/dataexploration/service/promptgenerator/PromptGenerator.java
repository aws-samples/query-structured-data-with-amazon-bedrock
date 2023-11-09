// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.service.promptgenerator;

import io.aws.bedrock.dataexploration.entity.DatabaseInformation;

public interface PromptGenerator {

    public String generatePrompt(DatabaseInformation databaseItem, String userQuestion);

}
