// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
package io.aws.bedrock.dataexploration;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import io.aws.bedrock.dataexploration.config.DataExplorationProperties;

@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
@EnableConfigurationProperties(DataExplorationProperties.class)
public class DataexplorationApplication {

	public static void main(String[] args) {
		SpringApplication.run(DataexplorationApplication.class, args);
	}

}
