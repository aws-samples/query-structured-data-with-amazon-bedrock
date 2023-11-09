// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration.controller.api;

public record DataExplorationRequest(String databaseName, String query) {
}
